package games.paths.core.repository.match;

import games.paths.core.entity.match.LogWeatherEntity;
import games.paths.core.entity.match.LogWeatherEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * LogWeatherRepository - Spring Data JPA repository for "log_weather".
 * Step 27: append-only log of weather selections.
 */
@Repository
public interface LogWeatherRepository
        extends JpaRepository<LogWeatherEntity, LogWeatherEntityId> {

    List<LogWeatherEntity> findByIdMatchOrderByClockAsc(Long idMatch);

    /** Highest {@code id} across the whole table (ids are globally unique). */
    @Query("SELECT COALESCE(MAX(l.id), 0) FROM LogWeatherEntity l")
    long findMaxId();
}
