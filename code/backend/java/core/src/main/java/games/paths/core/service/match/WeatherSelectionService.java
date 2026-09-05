package games.paths.core.service.match;

import games.paths.core.port.match.WeatherStorePort;
import games.paths.core.port.match.WeatherStorePort.WeatherCharacter;
import games.paths.core.port.match.WeatherStorePort.WeatherMatchContext;
import games.paths.core.port.match.WeatherStorePort.WeatherRuleView;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Random;

/**
 * WeatherSelectionService - selects the active weather at every time-start and
 * applies its effects (Step 27).
 *
 * <p>Algorithm (pure, deterministic for a given match seed):</p>
 * <ol>
 *   <li>Load the active weather rules for the story and keep only those whose
 *       time range covers the current clock and whose registry condition (if
 *       any) is satisfied.</li>
 *   <li>Pick one eligible rule with a <b>weighted roll</b>: each rule's weight is
 *       its {@code probability}; the roll uses a {@link Random} seeded with
 *       {@code rng_seed + clock} so a match with rng_seed=42 is reproducible and
 *       the weather still varies clock-to-clock.</li>
 *   <li>Apply {@code delta_energy} to every character (clamped 0..energy_max),
 *       store the weather on the match, append a {@code log_weather} row and, when
 *       the rule has an {@code id_event}, record it as pending (execution in a
 *       later step).</li>
 * </ol>
 *
 * <p>When no rule is eligible the current weather is cleared. See
 * {@code documentation_v0/Step27_WeatherSystem.md}.</p>
 */
public class WeatherSelectionService {

    private final WeatherStorePort store;
    private final RegistryService registryService;

    public WeatherSelectionService(WeatherStorePort store, RegistryService registryService) {
        this.store = store;
        this.registryService = registryService;
    }

    /**
     * Select and apply the weather for a match at time-start. Returns the recap
     * of what was selected, or an empty recap when the match has no resolvable
     * context.
     */
    public WeatherSelection applyAtTimeStart(long idMatch) {
        Optional<WeatherMatchContext> ctxOpt = store.loadContext(idMatch);
        if (ctxOpt.isEmpty()) {
            return WeatherSelection.none();
        }
        WeatherMatchContext ctx = ctxOpt.get();
        int clock = ctx.currentClock();

        List<WeatherRuleView> eligible = filterEligible(
                store.findActiveWeatherRules(ctx.idStory()), idMatch, clock);

        if (eligible.isEmpty()) {
            store.setCurrentWeather(idMatch, null);
            return WeatherSelection.none();
        }

        WeatherRuleView chosen = weightedPick(eligible, seedFor(ctx, clock));

        // Persist the selection.
        store.setCurrentWeather(idMatch, chosen.id());
        store.insertLogWeather(idMatch, clock, chosen.id());

        // Apply the energy delta to every character (clamped).
        List<CharacterDelta> deltas = new ArrayList<>();
        int delta = nz(chosen.deltaEnergy());
        if (delta != 0) {
            for (WeatherCharacter c : store.findCharacters(idMatch)) {
                int newEnergy = clamp(c.energy() + delta, 0, c.energyMax());
                int applied = newEnergy - c.energy();
                if (applied != 0) {
                    store.updateCharacterEnergy(idMatch, c.id(), newEnergy);
                }
                deltas.add(new CharacterDelta(c.id(), applied));
            }
        }

        // Weather-linked event (execution wired in a later step).
        if (chosen.idEvent() != null) {
            store.logWeatherEvent(idMatch, chosen.idEvent(),
                    "Weather " + chosen.uuid() + " triggered event " + chosen.idEvent());
        }

        return new WeatherSelection(true, chosen.id(), chosen.uuid(), delta, deltas);
    }

    /** Read the current weather of a match by uuid (REST query, no side effects). */
    public Optional<WeatherStorePort.CurrentWeatherView> currentWeather(String matchUuid) {
        return store.findCurrentWeatherByMatchUuid(matchUuid);
    }

    /** Admin weather view: rng seed + current weather + every rule + log history. */
    public WeatherAdminView weatherAdmin(String matchUuid) {
        return new WeatherAdminView(
                store.findRngSeed(matchUuid).orElse(null),
                store.findCurrentWeatherByMatchUuid(matchUuid).orElse(null),
                withRegistryVerdict(matchUuid, store.findWeatherRulesForMatch(matchUuid)),
                store.findWeatherLog(matchUuid));
    }

    /**
     * v0.36.2 — answer each rule with whether the registry lets it through, so the console can
     * say why a rule never fires. Computed here rather than in the adapter, and by the very
     * comparison the selection uses, so the two cannot drift apart.
     */
    private List<WeatherStorePort.WeatherRuleSummary> withRegistryVerdict(
            String matchUuid, List<WeatherStorePort.WeatherRuleSummary> rules) {
        List<WeatherStorePort.WeatherRuleSummary> out = new ArrayList<>();
        for (WeatherStorePort.WeatherRuleSummary r : rules) {
            out.add(new WeatherStorePort.WeatherRuleSummary(
                    r.id(), r.uuid(), r.idTextName(), r.name(), r.probability(), r.deltaEnergy(),
                    r.costMoveSafeLocation(), r.costMoveNotSafeLocation(), r.active(), r.current(),
                    r.conditionKey(), r.conditionValue(), r.conditionOperator(),
                    registryMet(matchUuid, r)));
        }
        return out;
    }

    /** A rule with no condition key is always let through; otherwise the shared comparison. */
    private boolean registryMet(String matchUuid, WeatherStorePort.WeatherRuleSummary r) {
        if (RegistryService.noCondition(r.conditionKey())) {
            return true;
        }
        return RegistryService.evaluate(r.conditionOperator(), r.conditionValue(),
                registryService.findByMatchUuid(matchUuid, r.conditionKey()));
    }

    /** Aggregate returned to the admin weather endpoint. */
    public record WeatherAdminView(Long rngSeed,
                                   WeatherStorePort.CurrentWeatherView current,
                                   List<WeatherStorePort.WeatherRuleSummary> rules,
                                   List<WeatherStorePort.WeatherLogView> log) {
    }

    /** Keep only rules whose time range covers the clock and whose condition matches. */
    private List<WeatherRuleView> filterEligible(List<WeatherRuleView> rules, long idMatch, int clock) {
        List<WeatherRuleView> out = new ArrayList<>();
        if (rules == null) {
            return out;
        }
        for (WeatherRuleView r : rules) {
            if (!timeMatches(r, clock)) {
                continue;
            }
            if (!conditionMatches(r, idMatch)) {
                continue;
            }
            out.add(r);
        }
        return out;
    }

    /** A null bound means "open"; otherwise clock must fall inside [from, to]. */
    static boolean timeMatches(WeatherRuleView r, int clock) {
        if (r.timeFrom() != null && clock < r.timeFrom()) {
            return false;
        }
        return r.timeTo() == null || clock <= r.timeTo();
    }

    /**
     * No condition_key → always matches; otherwise {@link RegistryService#evaluate} decides.
     * Step 36 retired the old reading of a null condition_key_value as "the key must be unset":
     * a condition with no value is now never met, as it already was for events and movement.
     */
    private boolean conditionMatches(WeatherRuleView r, long idMatch) {
        if (RegistryService.noCondition(r.conditionKey())) {
            return true;
        }
        return RegistryService.evaluate(r.conditionOperator(), r.conditionKeyValue(),
                registryService.find(idMatch, r.conditionKey()));
    }

    /**
     * Weighted roll across eligible rules. Rules are first ordered by
     * (priority desc, id asc) so the cumulative walk is deterministic; the weight
     * is each rule's probability. When every weight is ≤ 0 the first rule (highest
     * priority) is returned.
     */
    static WeatherRuleView weightedPick(List<WeatherRuleView> eligible, long seed) {
        List<WeatherRuleView> ordered = new ArrayList<>(eligible);
        ordered.sort(Comparator
                .comparingInt((WeatherRuleView r) -> nz(r.priority())).reversed()
                .thenComparingLong(WeatherRuleView::id));

        int total = 0;
        for (WeatherRuleView r : ordered) {
            total += Math.max(0, nz(r.probability()));
        }
        if (total <= 0) {
            return ordered.get(0);
        }
        int roll = new Random(seed).nextInt(total);
        int cumulative = 0;
        for (WeatherRuleView r : ordered) {
            cumulative += Math.max(0, nz(r.probability()));
            if (roll < cumulative) {
                return r;
            }
        }
        return ordered.get(ordered.size() - 1);
    }

    /** Per-match deterministic seed that still varies clock-to-clock. */
    private static long seedFor(WeatherMatchContext ctx, int clock) {
        long base = ctx.rngSeed() != null ? ctx.rngSeed() : ctx.idStory();
        return base + clock;
    }

    private static int clamp(int v, int min, int max) {
        if (v < min) return min;
        if (max > 0 && v > max) return max;
        return v;
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }

    /** Recap of the weather selected at a time-start. */
    public record WeatherSelection(boolean selected,
                                   Long idWeather,
                                   String weatherUuid,
                                   int deltaEnergy,
                                   List<CharacterDelta> characterDeltas) {
        public static WeatherSelection none() {
            return new WeatherSelection(false, null, null, 0, List.of());
        }
    }

    public record CharacterDelta(long idCharacter, int energyApplied) {
    }
}
