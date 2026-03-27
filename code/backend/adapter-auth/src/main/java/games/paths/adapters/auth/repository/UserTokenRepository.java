package games.paths.adapters.auth.repository;

import games.paths.adapters.auth.entity.UserTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

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
}
