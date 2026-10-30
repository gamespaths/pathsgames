package games.paths.core.port.auth;

import games.paths.core.model.auth.UserStatus;

import java.util.Optional;

/**
 * UserStatePort - v1.2.0 role and state of the user behind a valid token, cached 60 seconds;
 * a state change (ban, suspend, deletion) evicts the user so the refusal is immediate.
 */
public interface UserStatePort {

    Optional<UserStatus> current(String userUuid);

    void evict(String userUuid);
}
