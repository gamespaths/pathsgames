package games.paths.core.repository.match;

import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.entity.match.LogEventsEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * LogEventsRepository - Spring Data JPA repository for "log_events".
 * Step 26: append-only log of recovery summaries and counter-zero events.
 */
@Repository
public interface LogEventsRepository extends JpaRepository<LogEventsEntity, LogEventsEntityId> {

    List<LogEventsEntity> findByIdMatchOrderByIdAsc(Long idMatch);

    /** Highest {@code id} across the whole table (ids are globally unique). */
    @Query("SELECT COALESCE(MAX(l.id), 0) FROM LogEventsEntity l")
    long findMaxId();

    /**
     * Deletes every log row for the given matches. Used by the test-data cleanup
     * before the character instances are removed: {@code log_events} references
     * {@code gaming_character_instance(id, id_match)} (FK enforced on PostgreSQL).
     */
    @Modifying
    @Query("DELETE FROM LogEventsEntity l WHERE l.idMatch IN :matchIds")
    int deleteByMatchIdIn(@Param("matchIds") List<Long> matchIds);
}
