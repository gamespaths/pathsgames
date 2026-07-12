package games.paths.core.port.match;

import games.paths.core.model.story.CardInfo;

import java.util.List;

/**
 * MatchLogsPort - inbound port exposing the consolidated match log
 * (Step 28.7: GET /api/matches/{uuid}/logs and GET /api/admin/matches/{uuid}/logs).
 *
 * <p>v0.28.7 — the timeline is cursor-paginated (same envelope convention as the
 * paginated admin match list) and each WEATHER / MOVEMENT entry carries its
 * resolved {@link CardInfo}; MOVEMENT entries also name the character that moved.</p>
 */
public interface MatchLogsPort {

    /** Default page size when the caller does not pass {@code limit}. */
    int DEFAULT_LIMIT = 50;

    /** Hard cap on the page size, mirroring the admin match list. */
    int MAX_LIMIT = 200;

    /**
     * Returns one page of the consolidated log for the given match. Checks ownership —
     * only the match creator can call this.
     *
     * @param lang   language used to resolve the entry cards; defaults to {@code en}
     * @param limit  page size, clamped to [1, {@value #MAX_LIMIT}]; {@code null} → {@value #DEFAULT_LIMIT}
     * @param cursor opaque token from a previous {@code nextCursor}; {@code null} → first page
     * @throws games.paths.core.port.match.TurnCyclePort.TurnCycleException
     *         with MATCH_NOT_FOUND when the match is unknown or not owned by userUuid.
     */
    MatchLogsResult getMatchLogs(String uuidMatch, String userUuid, String lang,
                                 Integer limit, String cursor);

    /**
     * Admin variant — same payload, no ownership check.
     *
     * @throws games.paths.core.port.match.TurnCyclePort.TurnCycleException
     *         with MATCH_NOT_FOUND when the match is unknown.
     */
    MatchLogsResult getMatchLogsForAdmin(String uuidMatch, String lang,
                                         Integer limit, String cursor);

    /**
     * One page of the consolidated log.
     *
     * @param logs       the entries on this page, oldest first
     * @param nextCursor token to fetch the following page, or {@code null} on the last page
     * @param limit      the effective (clamped) page size that produced this page
     * @param total      the total number of entries in the whole timeline
     */
    record MatchLogsResult(String matchUuid, int currentClock, List<LogEntry> logs,
                           String nextCursor, int limit, int total) {}

    /**
     * Single log entry. All fields except {@code type} and {@code timestamp} are nullable;
     * present fields depend on the type:
     * <ul>
     *   <li>WEATHER       — clock, idWeather, idCard, card</li>
     *   <li>MOVEMENT      — idCharacterMatch, characterUuid, characterName, idLocationFrom,
     *                       idLocationTo, energyCost, idCard, card (of the destination location)</li>
     *   <li>SLEEP         — clock, idCharacterMatch, characterUuid, characterName</li>
     *   <li>CLOCK_ADVANCE — clock</li>
     *   <li>RECOVERY      — idCharacterMatch, characterUuid, characterName, message</li>
     * </ul>
     */
    record LogEntry(
            String type,
            Integer clock,
            String timestamp,
            Long idWeather,
            Long idCharacterMatch,
            String characterUuid,
            String characterName,
            Long idLocationFrom,
            Long idLocationTo,
            Integer energyCost,
            String message,
            Integer idCard,
            CardInfo card
    ) {}
}
