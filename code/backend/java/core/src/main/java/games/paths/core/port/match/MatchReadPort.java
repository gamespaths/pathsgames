package games.paths.core.port.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;

import java.util.List;
import java.util.Optional;

/**
 * MatchReadPort - Outbound port used by query services to read match data.
 */
public interface MatchReadPort {

    Optional<GamingMatchEntity> findMatchByUuid(String uuid);

    List<GamingMatchEntity> findMatchesByUserId(Long userId);

    /** Returns every match in the platform, newest first (admin view). */
    List<GamingMatchEntity> findAllMatches();

    /**
     * v0.28.1 — returns a keyset page of matches (newest first) matching the
     * given resolved criteria. Used by the paginated admin list. The adapter is
     * expected to fetch at most {@link MatchPageCriteria#limit()} rows.
     */
    List<GamingMatchEntity> findMatchesPage(MatchPageCriteria criteria);

    /**
     * Resolved (uuid → id) criteria for {@link #findMatchesPage(MatchPageCriteria)}.
     * Any {@code null} field is ignored. {@code tsFrom} is an ISO-8601 lower
     * bound; {@code tsCursor}/{@code idCursor} carry the keyset position.
     */
    record MatchPageCriteria(String status, Long idUser, Long idStory, String tsFrom,
                             String tsCursor, Long idCursor, int limit) {
    }

    List<GamingStateLocationsEntity> findLocationsByMatchId(Long matchId);

    List<GamingStateRegistryEntity> findRegistryByMatchId(Long matchId);
}
