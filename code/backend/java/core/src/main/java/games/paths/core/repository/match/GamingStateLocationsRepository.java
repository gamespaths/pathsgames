package games.paths.core.repository.match;

import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateLocationsEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * GamingStateLocationsRepository - Spring Data JPA repository for the
 * "gaming_state_locations" table.
 * Step 19: Used to seed location state when a match is created and to read
 * it back for the match-info endpoint.
 */
@Repository
public interface GamingStateLocationsRepository
        extends JpaRepository<GamingStateLocationsEntity, GamingStateLocationsEntityId> {

    List<GamingStateLocationsEntity> findByIdMatch(Long idMatch);
}
