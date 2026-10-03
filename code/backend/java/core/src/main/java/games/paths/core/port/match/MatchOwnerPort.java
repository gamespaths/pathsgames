package games.paths.core.port.match;

import games.paths.core.model.auth.AdminUserView;
import games.paths.core.model.match.MatchOwnerMoveResult;

/**
 * MatchOwnerPort - v0.41.6 inbound port of the admin User tab: the owner of a match, the preview of
 * a user by uuid / email / username and the move of a match (creator and characters) to that user.
 */
public interface MatchOwnerPort {

    AdminUserView owner(String uuidMatch);

    AdminUserView findUser(String identifier);

    MatchOwnerMoveResult move(String uuidMatch, String identifier);

    class MatchOwnerException extends RuntimeException {
        public enum Code {
            INVALID_INPUT,
            MATCH_NOT_FOUND,
            USER_NOT_FOUND,
            USER_AMBIGUOUS,
            MATCH_TERMINATED,
            MATCH_MULTI_CHARACTER,
            USER_NOT_ALLOWED,
            USER_EXPIRED,
            ACTIVE_MATCH_ALREADY_EXISTS
        }

        private final transient Code code;

        public MatchOwnerException(Code code, String message) {
            super(message);
            this.code = code;
        }

        public Code getCode() {
            return code;
        }
    }
}
