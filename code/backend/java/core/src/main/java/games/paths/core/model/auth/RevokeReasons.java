package games.paths.core.model.auth;

/**
 * RevokeReasons - v1.7.0 why a refresh token was revoked (users_tokens.revoked_reason): ROTATED and LOGOUT
 * rows are deleted after 7 days, the others kept until their expiry; LIMIT answers SESSION_LIMIT.
 */
public final class RevokeReasons {

    public static final String ROTATED = "ROTATED";
    public static final String LOGOUT = "LOGOUT";
    public static final String LOGOUT_ALL = "LOGOUT_ALL";
    public static final String LIMIT = "LIMIT";
    public static final String ADMIN = "ADMIN";
    /** Days a ROTATED or LOGOUT row is kept (reuse detection window). */
    public static final int SHORT_RETENTION_DAYS = 7;

    private RevokeReasons() {
    }
}
