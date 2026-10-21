"""v1.2.0 a refused login, refresh or account action with its API error code (same codes as Java).
The message never carries personal data (email, names)."""

#: error code -> HTTP status, shared by the three backends
CODES = {
    "INVALID_REQUEST": 400,
    "INVALID_TOKEN": 401,
    "INVALID_NONCE": 401,
    "TOKEN_REPLAYED": 401,
    "SESSION_REVOKED": 401,
    "FRESH_TOKEN_REQUIRED": 401,
    "EMAIL_NOT_VERIFIED": 403,
    "EMAIL_DOMAIN_NOT_ALLOWED": 403,
    "ACCOUNT_DISABLED": 403,
    "ACCOUNT_DELETION_IN_PROGRESS": 403,
    "NOT_A_GOOGLE_ACCOUNT": 403,
    "IDENTITY_MISMATCH": 409,
    "NICKNAME_TAKEN": 409,
    "PROVIDER_UNAVAILABLE": 503,
    "GOOGLE_DISABLED": 503,
}


class AuthError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message

    @property
    def http_status(self) -> int:
        return CODES.get(self.code, 400)

    def body(self) -> dict:
        import time
        return {"error": self.code, "message": self.message, "timestamp": int(time.time() * 1000)}


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
