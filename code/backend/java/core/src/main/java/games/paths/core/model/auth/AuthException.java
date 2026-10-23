package games.paths.core.model.auth;

/**
 * AuthException - v1.2.0 a refused login, refresh or account action, with its API error code.
 * The message never carries personal data (email, names).
 */
public class AuthException extends RuntimeException {

    /** The error codes shared by the three backends, with their HTTP status. */
    public enum Code {
        INVALID_REQUEST(400),
        INVALID_TOKEN(401),
        INVALID_NONCE(401),
        TOKEN_REPLAYED(401),
        SESSION_REVOKED(401),
        SESSION_LIMIT(401),
        FRESH_TOKEN_REQUIRED(401),
        EMAIL_NOT_VERIFIED(403),
        EMAIL_DOMAIN_NOT_ALLOWED(403),
        ACCOUNT_DISABLED(403),
        ACCOUNT_DELETION_IN_PROGRESS(403),
        NOT_A_GOOGLE_ACCOUNT(403),
        GOOGLE_ACCOUNT_REQUIRED(403),
        IDENTITY_MISMATCH(409),
        NICKNAME_TAKEN(409),
        PROVIDER_UNAVAILABLE(503),
        GOOGLE_DISABLED(503);

        private final int httpStatus;

        Code(int httpStatus) {
            this.httpStatus = httpStatus;
        }

        public int httpStatus() {
            return httpStatus;
        }
    }

    private final Code code;
    private final String suspendedUntil;

    public AuthException(Code code, String message) {
        super(message);
        this.code = code;
        this.suspendedUntil = null;
    }

    /** v1.7.0 ACCOUNT_DISABLED of a suspended user: the body carries the end of the suspension. */
    public AuthException(Code code, String message, String suspendedUntil) {
        super(message);
        this.code = code;
        this.suspendedUntil = suspendedUntil;
    }

    public AuthException(Code code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
        this.suspendedUntil = null;
    }

    public Code getCode() {
        return code;
    }

    public String getSuspendedUntil() {
        return suspendedUntil;
    }
}
