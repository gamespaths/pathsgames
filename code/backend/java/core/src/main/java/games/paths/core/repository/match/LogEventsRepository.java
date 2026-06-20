package games.paths.core.repository.match;

import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.entity.match.LogEventsEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
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
}
