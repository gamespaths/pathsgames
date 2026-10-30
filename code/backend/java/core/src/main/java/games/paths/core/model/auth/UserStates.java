package games.paths.core.model.auth;

/**
 * UserStates - v1.2.0 the values of users.state; 1 (registration) and 5 (password_reset) are unused
 * since there are no passwords. 7 = deleting, set by DELETE /api/auth/me until the job ends.
 */
public final class UserStates {

    public static final int REGISTRATION = 1;
    public static final int ACTIVE = 2;
    public static final int BLOCKED = 3;
    public static final int BANNED = 4;
    public static final int PASSWORD_RESET = 5;
    public static final int GUEST = 6;
    public static final int DELETING = 7;

    public static final String ROLE_ADMIN = "ADMIN";
    public static final String ROLE_PLAYER = "PLAYER";

    private UserStates() {
    }

    /** Throws the error a login, refresh or request of a user in this state gets, if any. */
    public static void requireUsable(int state) {
        if (state == BLOCKED || state == BANNED) {
            throw new AuthException(AuthException.Code.ACCOUNT_DISABLED, "The account is disabled");
        }
        if (state == DELETING) {
            throw new AuthException(AuthException.Code.ACCOUNT_DELETION_IN_PROGRESS,
                    "The account is being deleted");
        }
    }
}
