package games.paths.adapters.auth.repository;

import games.paths.adapters.auth.entity.IdTokenSeenEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * IdTokenSeenRepository - v1.2.0 the Google ID-token replay store.
 */
@Repository
public interface IdTokenSeenRepository extends JpaRepository<IdTokenSeenEntity, String> {

    @Modifying
    @Query("DELETE FROM IdTokenSeenEntity t WHERE t.expiresAt < :now")
    int deleteExpired(@Param("now") String now);
}
