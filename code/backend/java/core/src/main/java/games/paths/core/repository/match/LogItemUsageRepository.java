package games.paths.core.repository.match;

import games.paths.core.entity.match.LogItemUsageEntity;
import games.paths.core.entity.match.LogItemUsageEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * LogItemUsageRepository - Spring Data JPA repository for "log_item_usage".
 * Step 34: append-only log of every successful use-item.
 */
@Repository
public interface LogItemUsageRepository extends JpaRepository<LogItemUsageEntity, LogItemUsageEntityId> {

    List<LogItemUsageEntity> findByIdMatchOrderByIdAsc(Long idMatch);

    List<LogItemUsageEntity> findByIdMatchAndIdCharacterMatchOrderByIdAsc(Long idMatch, Long idCharacterMatch);

    /** Highest {@code id} across the whole table: the table carries UNIQUE (id). */
    @Query("SELECT COALESCE(MAX(l.id), 0) FROM LogItemUsageEntity l")
    long findMaxId();

    /**
     * Deletes every usage row for the given matches. Used by the test-data cleanup
     * before the character instances are removed: {@code log_item_usage} references
     * {@code gaming_character_instance(id, id_match)} (FK enforced on PostgreSQL).
     */
    @Modifying
    @Query("DELETE FROM LogItemUsageEntity l WHERE l.idMatch IN :matchIds")
    int deleteByMatchIdIn(@Param("matchIds") List<Long> matchIds);
}
