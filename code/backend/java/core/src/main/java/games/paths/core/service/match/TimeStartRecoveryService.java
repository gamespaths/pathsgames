package games.paths.core.service.match;

import games.paths.core.port.match.EdgeStateStorePort;
import games.paths.core.port.match.LocationEntryPort;
import games.paths.core.port.match.LocationEntryPort.PendingAutomaticEvent;
import games.paths.core.port.match.RecoveryStorePort;
import games.paths.core.port.match.RecoveryStorePort.ClassBonusView;
import games.paths.core.port.match.RecoveryStorePort.LocationSafety;
import games.paths.core.port.match.RecoveryStorePort.RecoveryCharacter;
import games.paths.core.port.match.RecoveryStorePort.RecoveryMatchContext;
import games.paths.core.port.match.RecoveryStorePort.StateLocationView;

import java.util.ArrayList;
import java.util.Comparator;
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
 * <p>Step 30: every recovered character then goes through {@link EdgeStateEvaluator}. A
 * recovery is not only healing — an unsafe location restores no life at all, and a positive
 * class {@code sad} bonus can push sadness over its cap — so the same overflow and coma rules
 * that guard event execution apply here too.</p>
 *
 * <p>See {@code documentation_v0/Step26_TimeStartRecovery.md} and
 * {@code documentation_v0/Step30_EdgeStates.md}.</p>
 */
public class TimeStartRecoveryService {

    private final RecoveryStorePort store;
    private final EdgeStateStorePort edgeStore;

    public TimeStartRecoveryService(RecoveryStorePort store, EdgeStateStorePort edgeStore) {
        this.store = store;
        this.edgeStore = edgeStore;
    }

    /**
     * Run the full time-start recovery sequence for a match: the per-character recap
     * (deltas applied) and, since Step 33, the automatic events this time-start owes —
     * the counters that reached zero and the {@code id_event_if_character_start_time}
     * of every occupied location.
     *
     * <p>It collects those events rather than running them. The event engine sits
     * <em>above</em> this service in the wiring (an event can force a time end, which
     * comes back here), so executing them from inside would close a dependency cycle.
     * {@code TimeAdvancementService} runs the list once this returns.</p>
     *
     * <p>Empty when the match has no resolvable story context or no characters.</p>
     */
    public TimeStartOutcome applyAtTimeStart(long idMatch) {
        Optional<RecoveryMatchContext> ctxOpt = store.loadContext(idMatch);
        if (ctxOpt.isEmpty()) {
            return TimeStartOutcome.none();
        }
        RecoveryMatchContext ctx = ctxOpt.get();
        List<RecoveryCharacter> characters = store.findCharacters(idMatch);
        if (characters.isEmpty()) {
            return TimeStartOutcome.none();
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

        // 2. Recover each character (recovery + class bonus + clamp + Step 30 edge states).
        List<RecoveryRecap> recaps = new ArrayList<>();
        List<Boolean> comaAfter = new ArrayList<>();
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

            // A recovery can still push a character over an edge: a positive class sad bonus
            // raises sadness, and an unsafe location never heals. Evaluate before the write so
            // the corrected values land in the same UPDATE.
            EdgeStateEvaluator.Verdict verdict = EdgeStateEvaluator.evaluate(
                    new EdgeStateEvaluator.CharacterState(
                            c.id(), result.life(), result.sadUnclamped(), c.sadMax(),
                            c.constitution(), c.isComa()));

            int energyDelta = result.energy() - c.energy();
            int lifeDelta = verdict.lifeAfter() - c.life();
            int sadDelta = verdict.sadAfter() - c.sad();
            store.updateCharacterStats(idMatch, c.id(),
                    result.energy(), verdict.lifeAfter(), verdict.sadAfter());
            store.logRecovery(idMatch, c.id(),
                    "recovery safe=" + safe + " p=" + p
                            + " dEnergy=" + energyDelta + " dLife=" + lifeDelta + " dSad=" + sadDelta);
            EdgeStateEvaluator.persist(edgeStore, idMatch, verdict, ctx.currentClock(), null);
            recaps.add(new RecoveryRecap(c.uuid(), energyDelta, lifeDelta, sadDelta));

            // v0.30.1 — a comatose character who rested in a safe location wakes. Safe recovery
            // has already lifted its life above zero (life += COS + secure_param, both ≥ 1), so
            // the guard cannot leave it awake-but-dead to re-coma next clock. Independent of the
            // others: one character waking does not require the rest of the location to wake.
            boolean stillComa = verdict.comaTriggered() || c.isComa();
            if (c.isComa() && safe && verdict.lifeAfter() > 0) {
                edgeStore.clearComa(idMatch, c.id());
                edgeStore.logEdgeState(idMatch, c.id(), null, ctx.currentClock(),
                        EdgeStateStorePort.MSG_COMA_RECOVERED + " " + c.id());
                stillComa = false;
            }
            comaAfter.add(stillComa);
        }

        // The whole party can go under during a recovery just as during an event. The row is
        // written here; running the story epilogue is the event engine's job, which owns the
        // chain runner and a result object to carry a card back in.
        if (EdgeStateEvaluator.allInComa(comaAfter)) {
            edgeStore.logEdgeState(idMatch, null, null, ctx.currentClock(),
                    EdgeStateStorePort.MSG_ALL_PLAYER_COMA + " " + idMatch);
        }

        // 3. Decrement location counters; flag zeros and collect the events they owe.
        //    A counter is a ONE-SHOT FUSE: `current <= 0` skips an exhausted one and
        //    markStateLocationActivated latches it, so the event fires exactly once per
        //    match and the counter never restarts.
        List<PendingAutomaticEvent> pending = new ArrayList<>();
        for (Map.Entry<Long, Integer> e : counterByLocation.entrySet()) {
            long idLocation = e.getKey();
            int current = nz(e.getValue());
            if (current <= 0) continue;
            int next = current - 1;
            store.updateStateLocationCounter(idMatch, idLocation, next);
            if (next == 0) {
                LocationSafety s = safetyByLocation.get(idLocation);
                Integer pendingEvent = s == null ? null : s.idEventIfCounterZero();
                store.logCounterZero(idMatch, idLocation, pendingEvent, ctx.currentClock(),
                        "counter reached zero at location " + idLocation
                                + (pendingEvent != null ? "; pending event " + pendingEvent : ""));
                store.markStateLocationActivated(idMatch, idLocation);
                addPending(pending, LocationEntryPort.TRIGGER_COUNTER_ZERO, idLocation,
                        pendingEvent, nominalActor(characters, idLocation), s);
            }
        }

        // 4. Step 33 — a time unit BEGINNING where a character stands is its own trigger,
        //    independent of any counter. One entry per occupied location, not per character:
        //    the event describes the place, and the nominal actor is who it happens to.
        for (Long idLocation : occupied) {
            LocationSafety s = safetyByLocation.get(idLocation);
            if (s == null) continue;
            addPending(pending, LocationEntryPort.TRIGGER_CHARACTER_START_TIME, idLocation,
                    s.idEventIfCharacterStartTime(), nominalActor(characters, idLocation), s);
        }

        // Deterministic across locations: priority_automatic_event first, then location id.
        pending.sort(Comparator.comparingInt(PendingAutomaticEvent::priority)
                .thenComparingLong(PendingAutomaticEvent::idLocation));

        return new TimeStartOutcome(recaps, pending);
    }

    /** Skips a null or non-positive event id — an unauthored trigger is not a trigger. */
    private static void addPending(List<PendingAutomaticEvent> out, String trigger, long idLocation,
                                   Integer idEvent, Long idActorCharacter, LocationSafety safety) {
        if (idEvent == null || idEvent <= 0) {
            return;
        }
        int priority = safety == null || safety.priorityAutomaticEvent() == null
                ? 0
                : safety.priorityAutomaticEvent();
        out.add(new PendingAutomaticEvent(trigger, idLocation, idEvent.longValue(),
                idActorCharacter, priority));
    }

    /**
     * The lowest-id character standing in a location, or null when nobody is.
     *
     * <p>An automatic location event belongs to the place, not to a player, but its effects
     * still have to resolve {@code target = ONLY_ONE} against somebody and {@code target =
     * ALL} against everyone <em>there</em>. Picking the lowest id makes that choice
     * deterministic; picking nobody, when the place is empty, is equally correct — the world
     * still changes, it just changes around no one.</p>
     */
    private static Long nominalActor(List<RecoveryCharacter> characters, long idLocation) {
        Long lowest = null;
        for (RecoveryCharacter c : characters) {
            if (c.idLocation() == null || c.idLocation() != idLocation) {
                continue;
            }
            if (lowest == null || c.id() < lowest) {
                lowest = c.id();
            }
        }
        return lowest;
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
                clamp(newSad, 0, sadMax),
                newSad);
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

    /**
     * Final recovered stats. {@code sadUnclamped} is the raw sadness before the cap, which the
     * Step 30 overflow rule reads: a positive class {@code sad} bonus can push a character over
     * the cap during what is nominally a recovery.
     */
    public record StatTriple(int energy, int life, int sad, int sadUnclamped) {
    }

    /** Per-character recovery summary surfaced in the time-advance response. */
    public record RecoveryRecap(String characterUuid, int energyDelta, int lifeDelta, int sadDelta) {
    }

    /**
     * What one time-start produced: the stat deltas, and the automatic events it owes,
     * already ordered by {@code priority_automatic_event} then location id.
     */
    public record TimeStartOutcome(List<RecoveryRecap> recovery,
                                   List<PendingAutomaticEvent> pending) {

        public static TimeStartOutcome none() {
            return new TimeStartOutcome(List.of(), List.of());
        }
    }
}
