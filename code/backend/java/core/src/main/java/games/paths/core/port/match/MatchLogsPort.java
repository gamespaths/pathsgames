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

    /** Timeline order: oldest entry first. The default when no {@code order} is given. */
    String ORDER_ASC = "asc";

    /** Timeline order: newest entry first. */
    String ORDER_DESC = "desc";

    /**
     * Returns one page of the consolidated log for the given match. Checks ownership —
     * only the match creator can call this.
     *
     * @param lang   language used to resolve the entry cards; defaults to {@code en}
     * @param limit  page size, clamped to [1, {@value #MAX_LIMIT}]; {@code null} → {@value #DEFAULT_LIMIT}
     * @param cursor opaque token from a previous {@code nextCursor}; {@code null} → first page
     * @param order  {@value #ORDER_DESC} for newest first; anything else → {@value #ORDER_ASC}
     * @throws games.paths.core.port.match.TurnCyclePort.TurnCycleException
     *         with MATCH_NOT_FOUND when the match is unknown or not owned by userUuid.
     */
    MatchLogsResult getMatchLogs(String uuidMatch, String userUuid, String lang,
                                 Integer limit, String cursor, String order);

    /**
     * Admin variant — same payload, no ownership check.
     *
     * @throws games.paths.core.port.match.TurnCyclePort.TurnCycleException
     *         with MATCH_NOT_FOUND when the match is unknown.
     */
    MatchLogsResult getMatchLogsForAdmin(String uuidMatch, String lang,
                                         Integer limit, String cursor, String order);

    /**
     * One page of the consolidated log.
     *
     * @param logs       the entries on this page — oldest first in {@value #ORDER_ASC},
     *                   newest first in {@value #ORDER_DESC}
     * @param nextCursor token to fetch the following page, or {@code null} on the last page
     * @param limit      the effective (clamped) page size that produced this page
     * @param total      the total number of entries in the whole timeline
     * @param order      the effective order this page was cut with
     */
    record MatchLogsResult(String matchUuid, int currentClock, List<LogEntry> logs,
                           String nextCursor, int limit, int total, String order) {}

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
     *   <li>EVENT         — idEvent, idCharacterMatch, characterUuid, characterName,
     *                       message, idCard, card (v0.30.3 — of the triggered event itself)</li>
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
            CardInfo card,
            Long idEvent
    ) {}
}
