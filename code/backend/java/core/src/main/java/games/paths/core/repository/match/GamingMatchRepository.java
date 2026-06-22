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
     * Clears the current-turn character pointer for the given matches. Must run
     * before the per-match character instances are deleted: the
     * {@code fk_match_character_current_turn} FK (enforced on PostgreSQL) would
     * otherwise block deletion of a still-referenced character row.
     */
    @Modifying
    @Query("UPDATE GamingMatchEntity m SET m.idCharacterCurrentTurn = NULL WHERE m.id IN :matchIds")
    int clearCurrentTurnByMatchIdIn(@Param("matchIds") List<Long> matchIds);

    /**
     * Deletes every match whose name matches the given SQL LIKE pattern.
     * Used by the dev-only test-data cleanup. Returns the count of deleted rows.
     */
    @Modifying
    @Query("DELETE FROM GamingMatchEntity m WHERE m.name LIKE :pattern")
    int deleteByNameLike(@Param("pattern") String pattern);

    /**
     * Deletes all matches for a given story.
     * Used when deleting a story to avoid FK constraint violations.
     */
    @Modifying
    void deleteByIdStory(Long idStory);
}
