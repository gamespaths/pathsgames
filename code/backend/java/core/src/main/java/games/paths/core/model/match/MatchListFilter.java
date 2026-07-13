package games.paths.core.model.match;

/**
 * MatchListFilter - raw request inputs for the paginated admin match list
 * (GET /api/admin/matches, v0.28.1).
 *
 * <p>Carries the <em>unresolved</em> values straight from the query string. The
 * query service turns {@code userUuid}/{@code storyUuid} into ids,
 * {@code sinceDays} into an ISO-8601 lower bound and {@code cursor} into a keyset
 * position. Any {@code null}/blank field means "no filter".</p>
 *
 * @param status    exact match status (CREATED/RUNNING/PAUSED/ENDED/GAMEOVER)
 * @param userUuid  creator filter
 * @param storyUuid story filter
 * @param sinceDays only matches created within the last N days
 * @param cursor    opaque token from a previous page's {@code nextCursor}
 * @param limit     requested page size (clamped by the service)
 */
public record MatchListFilter(String status, String userUuid, String storyUuid,
                              Integer sinceDays, String cursor, Integer limit) {
}
