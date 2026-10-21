package games.paths.adapters.auth.repository;

import games.paths.adapters.auth.entity.UserIdentityEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * UserIdentityRepository - v1.2.0 Spring Data repository of users_identities.
 */
@Repository
public interface UserIdentityRepository extends JpaRepository<UserIdentityEntity, Long> {

    Optional<UserIdentityEntity> findByProviderAndEmail(String provider, String email);

    List<UserIdentityEntity> findByIdUserOrderByIdAsc(Long idUser);

    @Modifying
    void deleteByIdUser(Long idUser);
}
