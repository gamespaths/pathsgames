package games.paths.core.repository.match;

import games.paths.core.entity.match.LogChoicesExecutedEntity;
import games.paths.core.entity.match.LogChoicesExecutedEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * LogChoicesExecutedRepository - Spring Data JPA repository for "log_choices_executed".
 * Step 32: append-only history of the options a match resolved.
 */
@Repository
public interface LogChoicesExecutedRepository
        extends JpaRepository<LogChoicesExecutedEntity, LogChoicesExecutedEntityId> {

    List<LogChoicesExecutedEntity> findByIdMatchOrderByIdAsc(Long idMatch);

    /** Highest {@code id} across the whole table (ids are globally unique). */
    @Query("SELECT COALESCE(MAX(l.id), 0) FROM LogChoicesExecutedEntity l")
    long findMaxId();

    /**
     * Deletes every choice-history row of the given matches. Called by the match delete
     * paths: SQLite does not enforce the {@code ON DELETE CASCADE} the schema declares,
     * so the rows have to go explicitly or a deleted match leaves orphans behind.
     */
    @Modifying
    @Query("DELETE FROM LogChoicesExecutedEntity l WHERE l.idMatch IN :matchIds")
    int deleteByMatchIdIn(@Param("matchIds") List<Long> matchIds);
}
