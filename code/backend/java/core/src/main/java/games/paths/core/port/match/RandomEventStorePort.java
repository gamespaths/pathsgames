package games.paths.core.port.match;

import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * RandomEventStorePort - read-only outbound port of the Step 39 random event picker.
 * Running the picked event goes through {@link LocationEntryPort#runRandomEvent}.
 */
public interface RandomEventStorePort {

    /** Story id, clock, RNG seed and status of a match; empty when the match is unknown. */
    Optional<RandomEventMatchContext> loadContext(long idMatch);

    /** Every {@code list_global_random_events} row of the story, with its event's facts. */
    List<RandomEventRuleView> findRandomEvents(long idStory);

    /** The events already executed in this match ({@code EVENT_EXECUTED} markers). */
    Set<Long> findConsumedEventIds(long idMatch);

    record RandomEventMatchContext(long idStory, int currentClock, Long rngSeed, String status) {
    }

    /** One random event row; the event fields are false/null when {@code idEvent} is dangling. */
    record RandomEventRuleView(long id,
                               Integer idEvent,
                               int probability,
                               String conditionKey,
                               String conditionValue,
                               String conditionOperator,
                               boolean eventExists,
                               String eventType,
                               boolean eventOwnsChoices) {
    }
}
