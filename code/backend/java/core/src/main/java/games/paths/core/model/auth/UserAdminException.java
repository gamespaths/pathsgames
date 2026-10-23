package games.paths.core.model.auth;

/** UserAdminException - v1.7.0 a refused admin user action or list query, with its API code and status. */
public class UserAdminException extends RuntimeException {

    /** The error codes of the admin user endpoints, shared by the three backends. */
    public enum Code {
        INVALID_INPUT(400),
        GUEST_NOT_BANNABLE(400),
        ADMIN_NOT_BANNABLE(400),
        SUSPEND_UNTIL_INVALID(400),
        USER_NOT_FOUND(404),
        INVALID_STATE_TRANSITION(409);

        private final int httpStatus;

        Code(int httpStatus) {
            this.httpStatus = httpStatus;
        }

        public int httpStatus() {
            return httpStatus;
        }
    }

    private final Code code;

    public UserAdminException(Code code, String message) {
        super(message);
        this.code = code;
    }

    public Code getCode() {
        return code;
    }
}
