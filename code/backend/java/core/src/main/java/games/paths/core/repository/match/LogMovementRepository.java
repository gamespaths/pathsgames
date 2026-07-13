package games.paths.core.repository.match;

import games.paths.core.entity.match.LogMovementEntity;
import games.paths.core.entity.match.LogMovementEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * LogMovementRepository - Spring Data JPA repository for "log_movements".
 * Step 28: append-only log of character movements.
 */
@Repository
public interface LogMovementRepository
        extends JpaRepository<LogMovementEntity, LogMovementEntityId> {

    List<LogMovementEntity> findByIdMatch(Long idMatch);

    /** Highest {@code id} across the whole table (ids are globally unique). */
    @Query("SELECT COALESCE(MAX(l.id), 0) FROM LogMovementEntity l")
    long findMaxId();

    /**
     * Deletes every movement row for the given matches. Used by the test-data cleanup
     * before the character instances are removed: {@code log_movements} references
     * {@code gaming_character_instance(id, id_match)} (FK enforced on PostgreSQL).
     */
    @Modifying
    @Query("DELETE FROM LogMovementEntity l WHERE l.idMatch IN :matchIds")
    int deleteByMatchIdIn(@Param("matchIds") List<Long> matchIds);
}
