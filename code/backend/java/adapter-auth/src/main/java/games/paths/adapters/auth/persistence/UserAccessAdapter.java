package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.entity.UserEntity;
import games.paths.adapters.auth.repository.UserRepository;
import games.paths.core.port.match.UserAccessPort;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * UserAccessAdapter - Adapter that exposes a read-only view of the
 * {@code users} table to the match domain via {@link UserAccessPort}.
 * Step 19 — used to validate the creator on POST /matches and to
 * resolve the user uuid on GET /match/&#123;uuid&#125;/info.
 */
@Repository
@Transactional(readOnly = true)
public class UserAccessAdapter implements UserAccessPort {

    private final UserRepository userRepository;

    public UserAccessAdapter(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public Optional<UserView> findByUuid(String uuid) {
        if (uuid == null || uuid.isBlank()) {
            return Optional.empty();
        }
        return userRepository.findByUuid(uuid).map(this::toView);
    }

    private UserView toView(UserEntity entity) {
        return new UserView(
                entity.getId(),
                entity.getUuid(),
                entity.getUsername(),
                entity.getRole(),
                entity.getState());
    }
}
