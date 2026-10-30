package games.paths.core.model.auth;

/**
 * NewUser - v1.2.0 a user row to insert (Google user or bootstrapped admin); never a password.
 */
public record NewUser(String uuid, String username, String nickname, String emailAddress, String role,
                      int state, String language) {

    @Override
    public String toString() {
        return "NewUser{uuid='" + uuid + "', username='" + username + "'}";
    }
}
