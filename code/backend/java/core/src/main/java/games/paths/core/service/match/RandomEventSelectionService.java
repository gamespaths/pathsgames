package games.paths.core.service.match;

import games.paths.core.model.match.MatchStatuses;
import games.paths.core.port.match.RandomEventStorePort;
import games.paths.core.port.match.RandomEventStorePort.RandomEventMatchContext;
import games.paths.core.port.match.RandomEventStorePort.RandomEventRuleView;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.Set;

/**
 * RandomEventSelectionService - picks at most one global random event per time-start (Step 39).
 * {@code probability} is an absolute percentage; a total above 100 scales every row down.
 */
public class RandomEventSelectionService {

    /** Keeps the random roll of day N away from the weather roll of day N+1 (seed + clock). */
    public static final long SEED_SALT = 1_000_003L;
    static final int PERCENT = 100;

    private final RandomEventStorePort store;
    private final RegistryService registryService;

    public RandomEventSelectionService(RandomEventStorePort store, RegistryService registryService) {
        this.store = store;
        this.registryService = registryService;
    }

    /** The event to fire at this time-start, or empty when nothing fires. */
    public Optional<RandomEventPick> pickAtTimeStart(long idMatch) {
        RandomEventMatchContext ctx = store.loadContext(idMatch).orElse(null);
        if (ctx == null || !MatchStatuses.RUNNING.equals(ctx.status()) || ctx.currentClock() <= 0) {
            return Optional.empty();
        }
        List<RandomEventRuleView> rows = store.findRandomEvents(ctx.idStory());
        if (rows == null || rows.isEmpty()) {
            return Optional.empty();
        }
        List<RandomEventRuleView> eligible = filterEligible(rows, idMatch, store.findConsumedEventIds(idMatch));
        return pick(eligible, seedFor(ctx))
                .map(r -> new RandomEventPick(r.id(), r.idEvent()));
    }

    private List<RandomEventRuleView> filterEligible(List<RandomEventRuleView> rows, long idMatch,
                                                     Set<Long> consumed) {
        List<RandomEventRuleView> out = new ArrayList<>();
        for (RandomEventRuleView r : rows) {
            if (isRunnable(r, consumed) && conditionMatches(r, idMatch)) {
                out.add(r);
            }
        }
        return out;
    }

    /** Positive probability, existing event without choices, and not a spent ONCE event. */
    static boolean isRunnable(RandomEventRuleView r, Set<Long> consumed) {
        if (r.probability() <= 0 || r.idEvent() == null || r.idEvent() <= 0
                || !r.eventExists() || r.eventOwnsChoices()) {
            return false;
        }
        boolean once = EventAvailabilityChecker.TYPE_ONCE.equalsIgnoreCase(r.eventType());
        return !(once && consumed != null && consumed.contains(r.idEvent().longValue()));
    }

    private boolean conditionMatches(RandomEventRuleView r, long idMatch) {
        if (RegistryService.noCondition(r.conditionKey())) {
            return true;
        }
        return RegistryService.evaluate(r.conditionOperator(), r.conditionValue(),
                registryService.find(idMatch, r.conditionKey()));
    }

    /** Probability DESC, then id ASC: the fixed order of the cumulative walk. */
    static List<RandomEventRuleView> order(List<RandomEventRuleView> eligible) {
        List<RandomEventRuleView> ordered = new ArrayList<>(eligible);
        ordered.sort(Comparator.comparingInt(RandomEventRuleView::probability).reversed()
                .thenComparingLong(RandomEventRuleView::id));
        return ordered;
    }

    /** The row whose cumulative range holds {@code roll}; empty when roll lands past the total. */
    static Optional<RandomEventRuleView> walk(List<RandomEventRuleView> ordered, int roll) {
        int cumulative = 0;
        for (RandomEventRuleView r : ordered) {
            cumulative += r.probability();
            if (roll < cumulative) {
                return Optional.of(r);
            }
        }
        return Optional.empty();
    }

    /** Roll in [0, max(100, total)): below 100 the gap is "nothing", above it the rows scale. */
    static Optional<RandomEventRuleView> pick(List<RandomEventRuleView> eligible, long seed) {
        if (eligible == null || eligible.isEmpty()) {
            return Optional.empty();
        }
        return walk(order(eligible), new Random(seed).nextInt(Math.max(PERCENT, total(eligible))));
    }

    static int total(List<RandomEventRuleView> eligible) {
        int total = 0;
        for (RandomEventRuleView r : eligible) {
            total += r.probability();
        }
        return total;
    }

    static long seedFor(RandomEventMatchContext ctx) {
        long base = ctx.rngSeed() != null ? ctx.rngSeed() : ctx.idStory();
        return base + ctx.currentClock() + SEED_SALT;
    }

    /** The row that fired and the event it runs. */
    public record RandomEventPick(long idRandomEvent, long idEvent) {
    }
}
