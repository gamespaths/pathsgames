package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.port.match.MatchPersistencePort;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.GamingStateLocationsRepository;
import games.paths.core.repository.match.GamingStateRegistryRepository;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * MatchPersistenceAdapter - JPA adapter implementing the
 * {@link MatchPersistencePort}. Step 19 — single-player match write side.
 */
@Repository
@Transactional
public class MatchPersistenceAdapter implements MatchPersistencePort {

    private final GamingMatchRepository matchRepository;
    private final GamingStateLocationsRepository locationsRepository;
    private final GamingStateRegistryRepository registryRepository;

    public MatchPersistenceAdapter(GamingMatchRepository matchRepository,
                                   GamingStateLocationsRepository locationsRepository,
                                   GamingStateRegistryRepository registryRepository) {
        this.matchRepository = matchRepository;
        this.locationsRepository = locationsRepository;
        this.registryRepository = registryRepository;
    }

    @Override
    public GamingMatchEntity saveMatch(GamingMatchEntity entity) {
        return matchRepository.save(entity);
    }

    @Override
    public Optional<GamingMatchEntity> findMatchByUuid(String uuid) {
        return matchRepository.findByUuid(uuid);
    }

    @Override
    public void saveLocations(List<GamingStateLocationsEntity> entities) {
        if (entities == null || entities.isEmpty()) {
            return;
        }
        locationsRepository.saveAll(entities);
    }

    @Override
    public void saveRegistry(List<GamingStateRegistryEntity> entities) {
        if (entities == null || entities.isEmpty()) {
            return;
        }
        registryRepository.saveAll(entities);
    }

    @Override
    public int deleteMatchesByNameLike(String nameLikePattern) {
        // Locate the matching matches, remove their derived runtime state
        // (locations + registry) first, then delete the matches themselves.
        // Explicit child deletion keeps the operation correct on SQLite, where
        // foreign-key cascades are not enforced.
        List<Long> matchIds = matchRepository.findMatchIdsByNameLike(nameLikePattern);
        if (matchIds.isEmpty()) {
            return 0;
        }
        locationsRepository.deleteByMatchIdIn(matchIds);
        registryRepository.deleteByMatchIdIn(matchIds);
        return matchRepository.deleteByNameLike(nameLikePattern);
    }

    @Override
    public boolean updateMatchFields(String uuid, String status, String name) {
        Optional<GamingMatchEntity> opt = matchRepository.findByUuid(uuid);
        if (opt.isEmpty()) {
            return false;
        }
        GamingMatchEntity match = opt.get();
        if (status != null) {
            match.setStatus(status);
        }
        if (name != null) {
            match.setName(name);
        }
        matchRepository.save(match);
        return true;
    }

    @Override
    public boolean deleteMatchByUuid(String uuid) {
        Optional<GamingMatchEntity> opt = matchRepository.findByUuid(uuid);
        if (opt.isEmpty()) {
            return false;
        }
        // Remove the derived runtime state (locations + registry) first.
        List<Long> matchIds = List.of(opt.get().getId());
        locationsRepository.deleteByMatchIdIn(matchIds);
        registryRepository.deleteByMatchIdIn(matchIds);
        matchRepository.delete(opt.get());
        return true;
    }
}
