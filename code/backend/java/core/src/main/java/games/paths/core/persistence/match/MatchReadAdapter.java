package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.port.match.MatchReadPort;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.GamingStateLocationsRepository;

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

    public MatchReadAdapter(GamingMatchRepository matchRepository,
                            GamingStateLocationsRepository locationsRepository) {
        this.matchRepository = matchRepository;
        this.locationsRepository = locationsRepository;
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
    public List<GamingMatchEntity> findAllMatches() {
        return matchRepository.findAllByOrderByTsInsertDesc();
    }

    @Override
    public List<GamingMatchEntity> findMatchesPage(MatchPageCriteria c) {
        int limit = Math.max(1, c.limit());
        return matchRepository.findMatchesPage(
                c.status(), c.idUser(), c.idStory(), c.tsFrom(),
                c.tsCursor(), c.idCursor(),
                org.springframework.data.domain.PageRequest.of(0, limit));
    }

    @Override
    public List<GamingStateLocationsEntity> findLocationsByMatchId(Long matchId) {
        if (matchId == null) {
            return List.of();
        }
        return locationsRepository.findByIdMatch(matchId);
    }
}
