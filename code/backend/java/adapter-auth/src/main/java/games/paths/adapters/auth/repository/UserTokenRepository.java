package games.paths.adapters.auth.repository;

import games.paths.adapters.auth.entity.UserTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * UserTokenRepository - Spring Data JPA repository for the users_tokens table.
 * Provides CRUD + custom query methods for refresh token management.
 */
@Repository
public interface UserTokenRepository extends JpaRepository<UserTokenEntity, Long> {

    /**
     * Delete all tokens belonging to expired guest users.
     */
    @Modifying
    @Query("DELETE FROM UserTokenEntity t WHERE t.idUser IN " +
           "(SELECT u.id FROM UserEntity u WHERE u.state = :state AND u.guestExpiresAt < :now)")
    int deleteTokensOfExpiredGuests(@Param("state") Integer state, @Param("now") String now);

    /**
     * Delete all tokens belonging to a specific user.
     */
    @Modifying
    void deleteByIdUser(Long idUser);

    // === Step 13: Session & Token Management ===

    /**
     * Find a non-revoked token by its refresh token string.
     */
    Optional<UserTokenEntity> findByRefreshTokenAndRevokedFalse(String refreshToken);

    /**
     * Find a token (regardless of revoked status) by its refresh token string.
     */
    Optional<UserTokenEntity> findByRefreshToken(String refreshToken);

    /**
     * Count non-revoked, non-expired tokens for a user.
     */
    @Query("SELECT COUNT(t) FROM UserTokenEntity t WHERE t.idUser = :userId AND t.revoked = false AND t.expiresAt >= :now")
    int countActiveTokensByUserId(@Param("userId") Long userId, @Param("now") String now);

    /**
     * Revoke all tokens for a specific user (set revoked = true).
     */
    @Modifying
    @Query("UPDATE UserTokenEntity t SET t.revoked = true, t.tsUpdate = :now WHERE t.idUser = :userId AND t.revoked = false")
    int revokeAllByUserId(@Param("userId") Long userId, @Param("now") String now);

    /**
     * Find all active (non-revoked) tokens for a user ordered by creation timestamp ascending (oldest first).
     */
    @Query("SELECT t FROM UserTokenEntity t WHERE t.idUser = :userId AND t.revoked = false ORDER BY t.tsInsert ASC")
    List<UserTokenEntity> findActiveTokensByUserIdOrderByTsInsertAsc(@Param("userId") Long userId);
}
