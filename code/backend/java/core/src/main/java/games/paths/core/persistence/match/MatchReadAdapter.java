package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.port.match.MatchReadPort;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.GamingStateLocationsRepository;
import games.paths.core.repository.match.GamingStateRegistryRepository;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * MatchReadAdapter - JPA adapter implementing the {@link MatchReadPort}.
 * Step 19 — read-only views of the match runtime state.
 */
@Repository
@Transactional(readOnly = true)
public class MatchReadAdapter implements MatchReadPort {

    private final GamingMatchRepository matchRepository;
    private final GamingStateLocationsRepository locationsRepository;
    private final GamingStateRegistryRepository registryRepository;

    public MatchReadAdapter(GamingMatchRepository matchRepository,
                            GamingStateLocationsRepository locationsRepository,
                            GamingStateRegistryRepository registryRepository) {
        this.matchRepository = matchRepository;
        this.locationsRepository = locationsRepository;
        this.registryRepository = registryRepository;
    }

    @Override
    public Optional<GamingMatchEntity> findMatchByUuid(String uuid) {
        return matchRepository.findByUuid(uuid);
    }

    @Override
    public List<GamingMatchEntity> findMatchesByUserId(Long userId) {
        if (userId == null) {
            return List.of();
        }
        return matchRepository.findByIdUserCreatorOrderByTsInsertDesc(userId);
    }

    @Override
    public List<GamingStateLocationsEntity> findLocationsByMatchId(Long matchId) {
        if (matchId == null) {
            return List.of();
        }
        return locationsRepository.findByIdMatch(matchId);
    }

    @Override
    public List<GamingStateRegistryEntity> findRegistryByMatchId(Long matchId) {
        if (matchId == null) {
            return List.of();
        }
        return registryRepository.findByIdMatch(matchId);
    }
}
