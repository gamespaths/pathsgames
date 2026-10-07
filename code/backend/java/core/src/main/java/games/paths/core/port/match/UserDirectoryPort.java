package games.paths.core.port.match;

import games.paths.core.model.auth.AdminUserView;

import java.util.List;
import java.util.Optional;

/**
 * UserDirectoryPort - v0.41.6 outbound, read-only lookup of users for the admin owner move;
 * the views come back with {@code matchCount} 0, the service fills it.
 */
public interface UserDirectoryPort {

    Optional<AdminUserView> findById(long id);

    Optional<AdminUserView> findByUuid(String uuid);

    /** Case-insensitive; more than one row means an ambiguous email. */
    List<AdminUserView> findByEmail(String email);

    List<AdminUserView> findByUsername(String username);
}
