package games.paths.core.port.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;

import java.util.List;
import java.util.Optional;

/**
 * MatchPersistencePort - Outbound port used by command services to
 * persist a new match and its derived runtime state.
 */
public interface MatchPersistencePort {

    GamingMatchEntity saveMatch(GamingMatchEntity entity);

    Optional<GamingMatchEntity> findMatchByUuid(String uuid);

    void saveLocations(List<GamingStateLocationsEntity> entities);

    void saveRegistry(List<GamingStateRegistryEntity> entities);
}
