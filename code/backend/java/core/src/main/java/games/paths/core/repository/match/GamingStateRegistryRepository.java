package games.paths.core.repository.match;

import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.entity.match.GamingStateRegistryEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * GamingStateRegistryRepository - Spring Data JPA repository for the
 * "gaming_state_registry" table.
 * Step 19: Used to seed default registry values on match creation and to
 * read the per-match registry on match-info retrieval.
 */
@Repository
public interface GamingStateRegistryRepository
        extends JpaRepository<GamingStateRegistryEntity, GamingStateRegistryEntityId> {

    List<GamingStateRegistryEntity> findByIdMatch(Long idMatch);

    /**
     * Step 36.1 - every row of one key. A LIST and not an Optional: a multi-valued key owns
     * several rows, and an Optional query throws NonUniqueResultException on the second one
     * rather than quietly picking a winner.
     */
    @Query("SELECT r FROM GamingStateRegistryEntity r WHERE r.idMatch = :idMatch AND r.key = :key")
    List<GamingStateRegistryEntity> findByIdMatchAndKey(@Param("idMatch") Long idMatch,
                                                        @Param("key") String key);

    /**
     * Deletes every registry row belonging to the given match ids.
     * Used by the dev-only test-data cleanup.
     */
    @Modifying
    @Query("DELETE FROM GamingStateRegistryEntity r WHERE r.idMatch IN :matchIds")
    int deleteByMatchIdIn(@Param("matchIds") List<Long> matchIds);
}
