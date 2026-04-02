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

    /**
     * Delete all expired guest users (state=6 with guest_expires_at in the past).
     * Returns the count of deleted rows.
     */
    @Modifying
    @Query("DELETE FROM UserEntity u WHERE u.state = :state AND u.guestExpiresAt < :now")
    int deleteExpiredGuests(@Param("state") Integer state, @Param("now") String now);

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

    // === Step 13: Session & Token Management ===

    /**
     * Find any user by UUID (any state).
     */
    Optional<UserEntity> findByUuid(String uuid);
}
