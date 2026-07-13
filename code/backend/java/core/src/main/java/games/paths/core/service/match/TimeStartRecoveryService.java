package games.paths.core.service.match;

import games.paths.core.port.match.RecoveryStorePort;
import games.paths.core.port.match.RecoveryStorePort.ClassBonusView;
import games.paths.core.port.match.RecoveryStorePort.LocationSafety;
import games.paths.core.port.match.RecoveryStorePort.RecoveryCharacter;
import games.paths.core.port.match.RecoveryStorePort.RecoveryMatchContext;
import games.paths.core.port.match.RecoveryStorePort.StateLocationView;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * TimeStartRecoveryService - applies per-character stat recovery, class bonuses
 * and location time-counter decrements at every time-start (Step 26).
 *
 * <p>Recovery rules (P = location.secure_param + difficulty.energy; a location is
 * <em>safe</em> when secure_param &gt; 0):</p>
 * <ul>
 *   <li><b>safe</b> → energy += DEX + P, life += COS + secure_param, sadness -= INT + secure_param</li>
 *   <li><b>unsafe</b> → energy += difficulty.energy only (no DEX, no secure_param)</li>
 * </ul>
 * Class bonuses (list_classes_bonus for the character's class) are added on top,
 * then every value is clamped: 0 ≤ energy ≤ energy_max, 0 ≤ life ≤ life_max,
 * 0 ≤ sad ≤ sad_max.
 *
 * <p>Location counters: a location occupied by a player and carrying
 * counter_time &gt; 0 but lacking a gaming_state_locations row is seeded; every
 * existing counter &gt; 0 is decremented; when it reaches zero the location's
 * id_event_if_counter_zero is logged as pending (execution wired in Step 29).</p>
 *
 * <p>See {@code documentation_v0/Step26_TimeStartRecovery.md}.</p>
 */
public class TimeStartRecoveryService {

    private final RecoveryStorePort store;

    public TimeStartRecoveryService(RecoveryStorePort store) {
        this.store = store;
    }

    /**
     * Run the full time-start recovery sequence for a match and return the
     * per-character recap (deltas applied). Returns an empty list when the match
     * has no resolvable story context or no characters.
     */
    public List<RecoveryRecap> applyAtTimeStart(long idMatch) {
        Optional<RecoveryMatchContext> ctxOpt = store.loadContext(idMatch);
        if (ctxOpt.isEmpty()) {
            return List.of();
        }
        RecoveryMatchContext ctx = ctxOpt.get();
        List<RecoveryCharacter> characters = store.findCharacters(idMatch);
        if (characters.isEmpty()) {
            return List.of();
        }

        Map<Long, LocationSafety> safetyByLocation = new HashMap<>();
        for (LocationSafety s : store.findLocationSafety(ctx.idStory())) {
            safetyByLocation.put(s.idLocation(), s);
        }
        List<ClassBonusView> allBonuses = store.findClassBonuses(ctx.idStory());

        Map<Long, Integer> counterByLocation = new HashMap<>();
        Map<Long, Integer> flagByLocation = new HashMap<>();
        for (StateLocationView sl : store.findStateLocations(idMatch)) {
            counterByLocation.put(sl.idLocation(), sl.clockCounter());
            flagByLocation.put(sl.idLocation(), sl.flagAlreadyActived());
        }

        // Build the set of locations currently occupied by characters.
        Set<Long> occupied = new HashSet<>();
        for (RecoveryCharacter c : characters) {
            if (c.idLocation() != null) occupied.add(c.idLocation());
        }

        // 1a. Re-seed occupied locations where the existing row has clockCounter = 0
        //     and has never been activated, but the story definition now carries
        //     counterTime > 0. This fixes matches created before counter_time was set.
        for (Long idLocation : occupied) {
            Integer existing = counterByLocation.get(idLocation);
            if (existing == null || existing > 0) continue;
            if (flagByLocation.getOrDefault(idLocation, 0) != 0) continue;
            LocationSafety s = safetyByLocation.get(idLocation);
            int counterTime = s == null ? 0 : nz(s.counterTime());
            if (counterTime <= 0) continue;
            store.updateStateLocationCounter(idMatch, idLocation, counterTime);
            counterByLocation.put(idLocation, counterTime);
        }

        // 1b. Seed missing state-location rows for occupied locations with a counter.
        for (Long idLocation : occupied) {
            if (counterByLocation.containsKey(idLocation)) continue;
            LocationSafety s = safetyByLocation.get(idLocation);
            int counterTime = s == null ? 0 : nz(s.counterTime());
            if (counterTime > 0) {
                store.insertStateLocation(idMatch, idLocation, counterTime);
                counterByLocation.put(idLocation, counterTime);
            }
        }

        // 2. Recover each character (recovery + class bonus + clamp).
        List<RecoveryRecap> recaps = new ArrayList<>();
        for (RecoveryCharacter c : characters) {
            LocationSafety s = c.idLocation() == null ? null : safetyByLocation.get(c.idLocation());
            int secureParam = s == null ? 0 : nz(s.secureParam());
            boolean safe = secureParam > 0;
            int p = secureParam + ctx.difficultyEnergy();

            List<ClassBonusView> bonuses = bonusesForClass(allBonuses, c.idClass());
            StatTriple result = computeRecovery(
                    c.dexterity(), c.intelligence(), c.constitution(),
                    c.energy(), c.life(), c.sad(),
                    c.energyMax(), c.lifeMax(), c.sadMax(),
                    safe, p, ctx.difficultyEnergy(),
                    sumBonus(bonuses, "energy"),
                    sumBonus(bonuses, "life"),
                    sumBonus(bonuses, "sad"));

            int energyDelta = result.energy() - c.energy();
            int lifeDelta = result.life() - c.life();
            int sadDelta = result.sad() - c.sad();
            store.updateCharacterStats(idMatch, c.id(), result.energy(), result.life(), result.sad());
            store.logRecovery(idMatch, c.id(),
                    "recovery safe=" + safe + " p=" + p
                            + " dEnergy=" + energyDelta + " dLife=" + lifeDelta + " dSad=" + sadDelta);
            recaps.add(new RecoveryRecap(c.uuid(), energyDelta, lifeDelta, sadDelta));
        }

        // 3. Decrement location counters; flag zeros (event execution deferred to Step 29).
        for (Map.Entry<Long, Integer> e : counterByLocation.entrySet()) {
            long idLocation = e.getKey();
            int current = nz(e.getValue());
            if (current <= 0) continue;
            int next = current - 1;
            store.updateStateLocationCounter(idMatch, idLocation, next);
            if (next == 0) {
                LocationSafety s = safetyByLocation.get(idLocation);
                Integer pendingEvent = s == null ? null : s.idEventIfCounterZero();
                store.logCounterZero(idMatch, idLocation, pendingEvent,
                        "counter reached zero at location " + idLocation
                                + (pendingEvent != null ? "; pending event " + pendingEvent : ""));
                store.markStateLocationActivated(idMatch, idLocation);
            }
        }

        return recaps;
    }

    // ── pure recovery math (unit-tested directly) ────────────────────────────

    /**
     * Compute the recovered (energy, life, sad) for a character, applying the
     * safe/unsafe recovery formula, the class bonuses and the stat caps.
     */
    public static StatTriple computeRecovery(int dexterity, int intelligence, int constitution,
                                             int energy, int life, int sad,
                                             int energyMax, int lifeMax, int sadMax,
                                             boolean safe, int p, int difficultyEnergy,
                                             int bonusEnergy, int bonusLife, int bonusSad) {
        int secureParam = p - difficultyEnergy;
        int newEnergy = safe ? energy + dexterity + p : energy + difficultyEnergy;
        int newLife = life;
        int newSad = sad;
        if (safe) {
            newLife = life + constitution + secureParam;
            newSad = sad - (intelligence + secureParam);
        }
        newEnergy += bonusEnergy;
        newLife += bonusLife;
        newSad += bonusSad;
        return new StatTriple(
                clamp(newEnergy, 0, energyMax),
                clamp(newLife, 0, lifeMax),
                clamp(newSad, 0, sadMax));
    }

    public static int clamp(int value, int min, int max) {
        if (max < min) {
            return min;
        }
        return Math.max(min, Math.min(max, value));
    }

    private static List<ClassBonusView> bonusesForClass(List<ClassBonusView> all, Long idClass) {
        if (idClass == null) {
            return List.of();
        }
        List<ClassBonusView> out = new ArrayList<>();
        for (ClassBonusView b : all) {
            if (b.idClass() == idClass) {
                out.add(b);
            }
        }
        return out;
    }

    private static int sumBonus(List<ClassBonusView> bonuses, String stat) {
        int total = 0;
        for (ClassBonusView b : bonuses) {
            if (stat.equalsIgnoreCase(b.statistic())) {
                total += b.value();
            }
        }
        return total;
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }

    /** Final recovered stats. */
    public record StatTriple(int energy, int life, int sad) {
    }

    /** Per-character recovery summary surfaced in the time-advance response. */
    public record RecoveryRecap(String characterUuid, int energyDelta, int lifeDelta, int sadDelta) {
    }
}
