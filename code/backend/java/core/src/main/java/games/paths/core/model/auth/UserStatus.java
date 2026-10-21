package games.paths.core.model.auth;

/**
 * UserStatus - v1.2.0 the identity a request runs as, read from the users table: role and
 * state always come from here, never from a token claim.
 */
public record UserStatus(long id, String uuid, String username, String nickname, String role, int state,
                         String language) {

    public boolean isAdmin() {
        return UserStates.ROLE_ADMIN.equals(role);
    }

    public boolean isGuest() {
        return state == UserStates.GUEST;
    }
}
