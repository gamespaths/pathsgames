package games.paths.core.port.match;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * MatchLogsStorePort - outbound port used by {@code MatchLogsService} (Step 28.7) to
 * read the consolidated match log from the four append-only log tables, plus the
 * story-scoped lookups that enrich the entries with cards and characters (v0.28.7).
 */
public interface MatchLogsStorePort {

    Optional<MatchSummary> findMatchByUuid(String uuid);

    /** Ordered by clock ASC. */
    List<WeatherLogEntry> findWeatherLog(long idMatch);

    /** Ordered by id ASC (insertion order). */
    List<MovementLogEntry> findMovementLog(long idMatch);

    /** Ordered by clock ASC. */
    List<ClockLogEntry> findClockLog(long idMatch);

    /** All log_events rows for the match, ordered by id ASC. */
    List<EventLogEntry> findEventLog(long idMatch);

    // ── v0.28.7 enrichment lookups: one query each, reused across the whole page ──

    /** Weather rule id → {@code id_card}, for every weather of the story. */
    Map<Long, Integer> findWeatherIdCards(long idStory);

    /** Location id → {@code id_card}, for every location of the story. */
    Map<Long, Integer> findLocationIdCards(long idStory);

    /** Character template id → {@code id_card}, for every template of the story. */
    Map<Long, Integer> findCharacterTemplateIdCards(long idStory);

    /** Event (list_events) id → its own {@code id_card}, for every event of the story. */
    Map<Long, Integer> findEventIdCards(long idStory);

    /** Character instance id → its uuid and template, for every character of the match. */
    Map<Long, CharacterLogView> findCharactersByMatch(long idMatch);

    record MatchSummary(long id, String uuid, int currentClock, long idUserCreator, long idStory) {}

    record WeatherLogEntry(long id, Integer clock, Long idWeather, String timestamp) {}

    record MovementLogEntry(long id, Long idCharacterMatch, Long idLocationFrom,
                            Long idLocationTo, Integer energyCost, String timestamp,
                            Integer foodCost, Integer magicCost, Integer coinCost) {

        /** Pre-v0.35.3 shape: a move whose only price was energy. */
        public MovementLogEntry(long id, Long idCharacterMatch, Long idLocationFrom,
                                Long idLocationTo, Integer energyCost, String timestamp) {
            this(id, idCharacterMatch, idLocationFrom, idLocationTo, energyCost, timestamp,
                    0, 0, 0);
        }
    }

    record ClockLogEntry(long id, Integer clock, String timestamp) {}

    /** {@code idEvent} is the list_events row the message refers to — null on rows the
     * service does not classify as EVENT (SLEEP, RECOVERY, ...). */
    /** {@code idLocation} is the Step 33 column: set on counter-zero and automatic-event rows. */
    record EventLogEntry(long id, Long idCharacterMatch, Integer clock,
                         String timestamp, String logMessage, Long idEvent, Long idLocation,
                         Integer energyCost, Integer foodCost, Integer magicCost,
                         Integer coinCost) {

        /** Pre-v0.35.3 shape: a row written before the price was persisted. */
        public EventLogEntry(long id, Long idCharacterMatch, Integer clock, String timestamp,
                             String logMessage, Long idEvent, Long idLocation) {
            this(id, idCharacterMatch, clock, timestamp, logMessage, idEvent, idLocation,
                    0, 0, 0, 0);
        }
    }

    /** The character that performed a logged action. */
    record CharacterLogView(long id, String uuid, Long idCharacterTemplate) {}
}
