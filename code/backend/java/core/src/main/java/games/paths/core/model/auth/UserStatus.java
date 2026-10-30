package games.paths.core.model.auth;

/**
 * UserStatus - v1.2.0 the identity a request runs as, read from the users table: role and
 * state always come from here, never from a token claim; v1.7.0 sessionsValidAfter in epoch seconds (0 = none).
 */
public record UserStatus(long id, String uuid, String username, String nickname, String role, int state,
                         String language, long sessionsValidAfter) {

    public UserStatus(long id, String uuid, String username, String nickname, String role, int state,
                      String language) {
        this(id, uuid, username, nickname, role, state, language, 0L);
    }

    public boolean isAdmin() {
        return UserStates.ROLE_ADMIN.equals(role);
    }

    public boolean isGuest() {
        return state == UserStates.GUEST;
    }

    /** False when the token was issued (epoch seconds) before the last "log out of all devices". */
    public boolean acceptsTokenIssuedAt(long issuedAtSeconds) {
        return sessionsValidAfter <= 0 || issuedAtSeconds >= sessionsValidAfter;
    }
}
