package games.paths.core.repository.match;

import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateLocationsEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    /**
     * Deletes every location-state row belonging to the given match ids.
     * Used by the dev-only test-data cleanup.
     */
    @Modifying
    @Query("DELETE FROM GamingStateLocationsEntity l WHERE l.idMatch IN :matchIds")
    int deleteByMatchIdIn(@Param("matchIds") List<Long> matchIds);
}
