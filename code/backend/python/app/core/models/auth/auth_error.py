"""v1.2.0 a refused login, refresh or account action with its API error code (same codes as Java).
The message never carries personal data (email, names)."""

#: error code -> HTTP status, shared by the three backends
CODES = {
    "INVALID_REQUEST": 400,
    "INVALID_TOKEN": 401,
    "INVALID_NONCE": 401,
    "TOKEN_REPLAYED": 401,
    "SESSION_REVOKED": 401,
    "SESSION_LIMIT": 401,
    "FRESH_TOKEN_REQUIRED": 401,
    "EMAIL_NOT_VERIFIED": 403,
    "EMAIL_DOMAIN_NOT_ALLOWED": 403,
    "ACCOUNT_DISABLED": 403,
    "ACCOUNT_DELETION_IN_PROGRESS": 403,
    "NOT_A_GOOGLE_ACCOUNT": 403,
    "GOOGLE_ACCOUNT_REQUIRED": 403,
    "IDENTITY_MISMATCH": 409,
    "NICKNAME_TAKEN": 409,
    "PROVIDER_UNAVAILABLE": 503,
    "GOOGLE_DISABLED": 503,
}


class AuthError(Exception):
    def __init__(self, code: str, message: str, suspended_until: str = None):
        super().__init__(message)
        self.code = code
        self.message = message
        # v1.7.0 ACCOUNT_DISABLED of a suspended user: the body names the end of the suspension
        self.suspended_until = suspended_until

    @property
    def http_status(self) -> int:
        return CODES.get(self.code, 400)

    def body(self) -> dict:
        import time
        body = {"error": self.code, "message": self.message, "timestamp": int(time.time() * 1000)}
        if self.suspended_until:
            body["suspendedUntil"] = self.suspended_until
        return body


class UserStates:
    """users.state; 1 (registration) and 5 (password_reset) are unused, 7 = deleting."""
    REGISTRATION = 1
    ACTIVE = 2
    BLOCKED = 3
    BANNED = 4
    PASSWORD_RESET = 5
    GUEST = 6
    DELETING = 7
    ROLE_ADMIN = "ADMIN"
    ROLE_PLAYER = "PLAYER"

    @staticmethod
    def require_usable(state: int) -> None:
        if state in (UserStates.BLOCKED, UserStates.BANNED):
            raise AuthError("ACCOUNT_DISABLED", "The account is disabled")
        if state == UserStates.DELETING:
            raise AuthError("ACCOUNT_DELETION_IN_PROGRESS", "The account is being deleted")
