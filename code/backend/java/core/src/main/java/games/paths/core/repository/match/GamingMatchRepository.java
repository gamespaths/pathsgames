package games.paths.core.repository.match;

import games.paths.core.entity.match.GamingMatchEntity;
import org.springframework.data.domain.Pageable;
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
     * v0.32.1 — true when the user already owns a match on that story in one of
     * the given statuses. Backs the duplicate-match guard of match creation.
     */
    boolean existsByIdUserCreatorAndIdStoryAndStatusIn(Long idUserCreator,
                                                      Long idStory,
                                                      List<String> statuses);

    /**
     * v0.28.1 — keyset page of the admin match list, newest first.
     *
     * <p>Every filter is optional ({@code NULL} ⇒ ignored). {@code tsFrom} scopes
     * to matches created at/after an ISO-8601 instant (sinceDays). The keyset
     * cursor ({@code tsCursor}/{@code idCursor}) selects the rows strictly older
     * than the last row of the previous page, so pages never skip or duplicate a
     * row even while new matches are inserted. {@code ts_insert} is an ISO-8601
     * instant string, so its lexical order matches chronological order; {@code id}
     * is the deterministic tie-breaker.</p>
     *
     * <p>{@code pageable} supplies only the LIMIT (pass an unsorted page); the
     * ORDER BY lives in the query.</p>
     */
    @Query("""
            SELECT m FROM GamingMatchEntity m
            WHERE (:status IS NULL OR m.status = :status)
              AND (:idUser IS NULL OR m.idUserCreator = :idUser)
              AND (:idStory IS NULL OR m.idStory = :idStory)
              AND (:tsFrom IS NULL OR m.tsInsert >= :tsFrom)
              AND (:tsCursor IS NULL OR m.tsInsert < :tsCursor
                   OR (m.tsInsert = :tsCursor AND m.id < :idCursor))
            ORDER BY m.tsInsert DESC, m.id DESC
            """)
    List<GamingMatchEntity> findMatchesPage(@Param("status") String status,
                                            @Param("idUser") Long idUser,
                                            @Param("idStory") Long idStory,
                                            @Param("tsFrom") String tsFrom,
                                            @Param("tsCursor") String tsCursor,
                                            @Param("idCursor") Long idCursor,
                                            Pageable pageable);

    /**
     * Returns the ids of every match whose name matches the given SQL LIKE
     * pattern. Used by the dev-only test-data cleanup to locate the runtime
     * state rows that must be removed first.
     */
    @Query("SELECT m.id FROM GamingMatchEntity m WHERE m.name LIKE :pattern")
    List<Long> findMatchIdsByNameLike(@Param("pattern") String pattern);

    /** v0.36.2 — the matches these users created, whatever the status. */
    @Query("SELECT m.id FROM GamingMatchEntity m WHERE m.idUserCreator IN :userIds")
    List<Long> findMatchIdsByUserCreatorIds(@Param("userIds") List<Long> userIds);

    @Modifying
    @Query("DELETE FROM GamingMatchEntity m WHERE m.id IN :ids")
    int deleteByIdIn(@Param("ids") List<Long> ids);

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
