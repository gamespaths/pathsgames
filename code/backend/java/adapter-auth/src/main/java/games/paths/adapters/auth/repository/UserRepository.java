package games.paths.adapters.auth.repository;

import games.paths.adapters.auth.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * UserRepository - Spring Data JPA repository for the users table.
 * Provides CRUD + custom query methods for guest user management.
 */
@Repository
public interface UserRepository extends JpaRepository<UserEntity, Long> {

    /**
     * Find a guest user by their cookie token and state=6 (guest).
     */
    Optional<UserEntity> findByGuestCookieTokenAndState(String guestCookieToken, Integer state);

    /** v0.41.0 — the four tables referencing users(id) without cascade: such a guest is never deleted. */
    String NOT_REFERENCED =
            " AND NOT EXISTS (SELECT 1 FROM gaming_match m WHERE m.id_user_creator = u.id)"
            + " AND NOT EXISTS (SELECT 1 FROM gaming_character_instance c WHERE c.id_user = u.id)"
            + " AND NOT EXISTS (SELECT 1 FROM gaming_user_sessions s WHERE s.id_user = u.id)"
            + " AND NOT EXISTS (SELECT 1 FROM chat_messages cm WHERE cm.id_user = u.id)";

    /** v0.41.0 — expired guests (state=6, guest_expires_at in the past) nothing references. */
    @Query(value = "SELECT u.id FROM users u WHERE u.state = :state AND u.guest_expires_at < :now"
            + NOT_REFERENCED, nativeQuery = true)
    List<Number> findExpiredGuestIdsWithoutReferences(@Param("state") Integer state,
                                                      @Param("now") String now);

    /** v0.41.0 — at most {@code limit} guests last seen before the bound that nothing references. */
    @Query(value = "SELECT u.id FROM users u WHERE u.state = :state"
            + " AND COALESCE(u.ts_last_access, u.ts_registration) < :before"
            + NOT_REFERENCED + " ORDER BY u.id LIMIT :limit", nativeQuery = true)
    List<Number> findStaleGuestIdsWithoutReferences(@Param("state") Integer state,
                                                    @Param("before") String before,
                                                    @Param("limit") int limit);

    /** v0.41.0 — dev/test only: registration and last access moved back to one instant. */
    @Modifying
    @Query(value = "UPDATE users SET ts_registration = :ts, ts_last_access = :ts WHERE id = :id",
            nativeQuery = true)
    int backdateGuest(@Param("id") Long id, @Param("ts") String ts);

    /**
     * Delete all guest users whose username matches the given SQL LIKE pattern.
     * Used by the dev-only test-data cleanup. Returns the count of deleted rows.
     */
    @Modifying
    @Query("DELETE FROM UserEntity u WHERE u.state = :state AND u.username LIKE :pattern")
    int deleteGuestsByUsernameLike(@Param("state") Integer state, @Param("pattern") String pattern);

    // === Admin queries ===

    /**
     * Find all guest users ordered by registration date descending.
     */
    List<UserEntity> findByStateOrderByTsRegistrationDesc(Integer state);

    /**
     * Find a guest user by UUID and state.
     */
    Optional<UserEntity> findByUuidAndState(String uuid, Integer state);

    /**
     * Count all guest users.
     */
    long countByState(Integer state);

    /**
     * Count active (non-expired) guest users.
     */
    @Query("SELECT COUNT(u) FROM UserEntity u WHERE u.state = :state AND u.guestExpiresAt >= :now")
    long countActiveGuests(@Param("state") Integer state, @Param("now") String now);

    /**
     * Count expired guest users.
     */
    @Query("SELECT COUNT(u) FROM UserEntity u WHERE u.state = :state AND u.guestExpiresAt < :now")
    long countExpiredGuests(@Param("state") Integer state, @Param("now") String now);

    // === v0.36.2: paging and the stale purge ===

    /**
     * One keyset page of guests, newest last-access first. {@code lastAccessBefore} is an
     * optional upper bound; the cursor pair continues a previous page. A guest that has never
     * been back is ordered by its registration, which is the only date it has.
     */
    @Query("SELECT u FROM UserEntity u WHERE u.state = :state"
            + " AND (:before IS NULL OR COALESCE(u.tsLastAccess, u.tsRegistration) < :before)"
            + " AND (:tsCursor IS NULL"
            + "      OR COALESCE(u.tsLastAccess, u.tsRegistration) < :tsCursor"
            + "      OR (COALESCE(u.tsLastAccess, u.tsRegistration) = :tsCursor AND u.id < :idCursor))"
            + " ORDER BY COALESCE(u.tsLastAccess, u.tsRegistration) DESC, u.id DESC")
    List<UserEntity> findGuestsPage(@Param("state") Integer state,
                                    @Param("before") String lastAccessBefore,
                                    @Param("tsCursor") String tsCursor,
                                    @Param("idCursor") Long idCursor,
                                    org.springframework.data.domain.Pageable pageable);

    /** The ids of every guest whose last access (or registration) predates the bound. */
    @Query("SELECT u.id FROM UserEntity u WHERE u.state = :state"
            + " AND COALESCE(u.tsLastAccess, u.tsRegistration) < :before")
    List<Long> findGuestIdsWithLastAccessBefore(@Param("state") Integer state,
                                                @Param("before") String before);

    @Modifying
    @Query("DELETE FROM UserEntity u WHERE u.state = :state AND u.id IN :ids")
    int deleteGuestsByIds(@Param("state") Integer state, @Param("ids") List<Long> ids);

    // === Step 13: Session & Token Management ===

    /**
     * Find any user by UUID (any state).
     */
    Optional<UserEntity> findByUuid(String uuid);

    // === v0.41.6: admin owner move lookups ===

    List<UserEntity> findByUsernameOrderByIdAsc(String username);

    @Query("SELECT u FROM UserEntity u WHERE LOWER(u.emailAddress) = LOWER(:email) ORDER BY u.id")
    List<UserEntity> findByEmailIgnoreCase(@Param("email") String email);
}
