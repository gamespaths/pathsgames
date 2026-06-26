package games.paths.core.port.match;

import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.match.MatchListFilter;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.model.match.MatchSummaryPage;

import java.util.List;

/**
 * MatchQueryPort - Inbound port for read-side match operations.
 * Step 19: list user matches and return enriched match info.
 */
public interface MatchQueryPort {

    /**
     * Returns the matches created by the given user, newest first.
     */
    List<MatchSummary> listUserMatches(String userUuid);

    /**
     * Returns every match in the platform, newest first. Admin-only view
     * exposed at GET /api/admin/matches.
     */
    List<MatchSummary> listAllMatches();

    /**
     * v0.28.1 — returns one keyset page of the admin match list, applying the
     * optional filters in {@code filter} (status / creator / story / sinceDays)
     * and resuming from {@code filter.cursor()}. Exposed at GET /api/admin/matches.
     */
    MatchSummaryPage listMatchesPage(MatchListFilter filter);

    /**
     * Returns the full match detail (summary + state) by match uuid, with all
     * card texts resolved in {@code lang} (English fallback when blank/missing).
     * @return {@code null} when the match does not exist or the user
     *         is not allowed to access it.
     */
    MatchDetail getMatchInfo(String matchUuid, String userUuid, String lang);

    /**
     * Returns the full match detail (summary + state) by match uuid for the
     * admin view — without the per-user ownership check. Exposed at
     * GET /api/admin/matches/{uuidMatch}/info.
     *
     * @return {@code null} only when the match does not exist.
     */
    MatchDetail getMatchInfoForAdmin(String matchUuid);
}
