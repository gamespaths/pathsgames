package games.paths.core.repository.match;

import games.paths.core.entity.match.GamingStoryProgressEntity;
import games.paths.core.entity.match.GamingStoryProgressEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * GamingStoryProgressRepository - Spring Data JPA repository for "gaming_story_progress".
 * Step 32: the milestone rows written by an {@code is_progress} choice.
 */
@Repository
public interface GamingStoryProgressRepository
        extends JpaRepository<GamingStoryProgressEntity, GamingStoryProgressEntityId> {

    List<GamingStoryProgressEntity> findByIdMatchOrderByIdAsc(Long idMatch);

    /** Highest {@code id} of the given match — the composite key is {@code (id, id_match)}. */
    @Query("SELECT COALESCE(MAX(p.id), 0) FROM GamingStoryProgressEntity p WHERE p.idMatch = :idMatch")
    long findMaxIdByMatch(@Param("idMatch") long idMatch);

    /**
     * Deletes every milestone row of the given matches. Called by the match delete paths:
     * SQLite does not enforce the {@code ON DELETE CASCADE} the schema declares.
     */
    @Modifying
    @Query("DELETE FROM GamingStoryProgressEntity p WHERE p.idMatch IN :matchIds")
    int deleteByMatchIdIn(@Param("matchIds") List<Long> matchIds);
}
