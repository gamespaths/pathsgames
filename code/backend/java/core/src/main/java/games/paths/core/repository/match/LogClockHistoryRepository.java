package games.paths.core.repository.match;

import games.paths.core.entity.match.LogClockHistoryEntity;
import games.paths.core.entity.match.LogClockHistoryEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * LogClockHistoryRepository - Spring Data JPA repository for "log_clock_history".
 * Step 25: append-only log of clock advances.
 */
@Repository
public interface LogClockHistoryRepository
        extends JpaRepository<LogClockHistoryEntity, LogClockHistoryEntityId> {

    List<LogClockHistoryEntity> findByIdMatchOrderByClockAsc(Long idMatch);

    /** Highest {@code id} across the whole table (ids are globally unique). */
    @Query("SELECT COALESCE(MAX(l.id), 0) FROM LogClockHistoryEntity l")
    long findMaxId();
}
