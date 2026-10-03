package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.entity.UserEntity;
import games.paths.adapters.auth.repository.UserRepository;
import games.paths.core.model.auth.AdminUserView;
import games.paths.core.port.match.UserDirectoryPort;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * UserDirectoryAdapter - v0.41.6 read-only {@link UserDirectoryPort} on the users table:
 * by id, uuid, case-insensitive email and username, for the admin owner move.
 */
@Repository
@Transactional(readOnly = true)
public class UserDirectoryAdapter implements UserDirectoryPort {

    private final UserRepository userRepository;

    public UserDirectoryAdapter(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public Optional<AdminUserView> findById(long id) {
        return userRepository.findById(id).map(UserDirectoryAdapter::toView);
    }

    @Override
    public Optional<AdminUserView> findByUuid(String uuid) {
        if (isBlank(uuid)) {
            return Optional.empty();
        }
        return userRepository.findByUuid(uuid).map(UserDirectoryAdapter::toView);
    }

    @Override
    public List<AdminUserView> findByEmail(String email) {
        if (isBlank(email)) {
            return List.of();
        }
        return userRepository.findByEmailIgnoreCase(email.trim()).stream().map(UserDirectoryAdapter::toView).toList();
    }

    @Override
    public List<AdminUserView> findByUsername(String username) {
        if (isBlank(username)) {
            return List.of();
        }
        return userRepository.findByUsernameOrderByIdAsc(username.trim()).stream()
                .map(UserDirectoryAdapter::toView).toList();
    }

    static AdminUserView toView(UserEntity e) {
        return new AdminUserView(e.getId(), e.getUuid(), e.getUsername(), e.getNickname(), e.getEmailAddress(),
                e.getRole(), e.getState(), e.getGuestExpiresAt(), e.getTsRegistration(), e.getTsLastAccess(), 0);
    }

    private static boolean isBlank(String text) {
        return text == null || text.isBlank();
    }
}
