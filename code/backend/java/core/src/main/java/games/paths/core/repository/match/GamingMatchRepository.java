package games.paths.core.repository.match;

import games.paths.core.entity.match.GamingMatchEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * GamingMatchRepository - Spring Data JPA repository for the "gaming_match" table.
 * Step 19: CRUD support for single-player match creation and retrieval.
 */
@Repository
public interface GamingMatchRepository extends JpaRepository<GamingMatchEntity, Long> {

    Optional<GamingMatchEntity> findByUuid(String uuid);

    List<GamingMatchEntity> findByIdUserCreatorOrderByTsInsertDesc(Long idUserCreator);

    List<GamingMatchEntity> findAllByOrderByTsInsertDesc();

    long countByIdUserCreatorAndStatusIn(Long idUserCreator, List<String> statuses);

    /**
     * Returns the ids of every match whose name matches the given SQL LIKE
     * pattern. Used by the dev-only test-data cleanup to locate the runtime
     * state rows that must be removed first.
     */
    @Query("SELECT m.id FROM GamingMatchEntity m WHERE m.name LIKE :pattern")
    List<Long> findMatchIdsByNameLike(@Param("pattern") String pattern);

    /**
     * Deletes every match whose name matches the given SQL LIKE pattern.
     * Used by the dev-only test-data cleanup. Returns the count of deleted rows.
     */
    @Modifying
    @Query("DELETE FROM GamingMatchEntity m WHERE m.name LIKE :pattern")
    int deleteByNameLike(@Param("pattern") String pattern);
}
