package games.paths.core.port.match;

import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.match.MatchSummary;

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
     * Returns the full match detail (summary + state) by match uuid.
     * @return {@code null} when the match does not exist or the user
     *         is not allowed to access it.
     */
    MatchDetail getMatchInfo(String matchUuid, String userUuid);
}
