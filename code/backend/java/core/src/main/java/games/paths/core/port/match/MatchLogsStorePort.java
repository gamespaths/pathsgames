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

    /** Character instance id → its uuid and template, for every character of the match. */
    Map<Long, CharacterLogView> findCharactersByMatch(long idMatch);

    record MatchSummary(long id, String uuid, int currentClock, long idUserCreator, long idStory) {}

    record WeatherLogEntry(long id, Integer clock, Long idWeather, String timestamp) {}

    record MovementLogEntry(long id, Long idCharacterMatch, Long idLocationFrom,
                            Long idLocationTo, Integer energyCost, String timestamp) {}

    record ClockLogEntry(long id, Integer clock, String timestamp) {}

    record EventLogEntry(long id, Long idCharacterMatch, Integer clock,
                         String timestamp, String logMessage) {}

    /** The character that performed a logged action. */
    record CharacterLogView(long id, String uuid, Long idCharacterTemplate) {}
}
