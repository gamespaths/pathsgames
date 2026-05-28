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

    List<GamingStateLocationsEntity> findLocationsByMatchId(Long matchId);

    List<GamingStateRegistryEntity> findRegistryByMatchId(Long matchId);
}
