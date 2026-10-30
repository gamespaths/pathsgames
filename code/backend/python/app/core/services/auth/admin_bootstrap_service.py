"""v1.2.0 a real admin user (role ADMIN, state 2) and a signed admin token; the same nickname again issues
a new token, never a duplicate user (CLI ``python -m app.scripts.create_admin`` and the Robot endpoint)."""
import re
import time
import uuid as uuidlib

from app.core.models.auth.auth_error import AuthError, UserStates
from app.core.models.auth.identity import AdminBootstrapResult, NewUser, UserStatus

DEFAULT_TOKEN_DAYS = 365
NICKNAME = re.compile(r"[A-Za-z0-9._-]{3,50}")


class AdminBootstrapService:
    def __init__(self, identities, jwt_port, token_days: int = DEFAULT_TOKEN_DAYS):
        self.identities = identities
        self.jwt_port = jwt_port
        self.token_days = token_days if token_days and token_days > 0 else DEFAULT_TOKEN_DAYS

    def create_admin(self, nickname) -> AdminBootstrapResult:
        nick = (nickname or "").strip()
        if not NICKNAME.fullmatch(nick):
            raise AuthError("INVALID_REQUEST", "The nickname must be 3-50 letters, digits, dots, dashes or underscores")
        admin = self.identities.find_user_by_nickname(nick)
        created = admin is None
        if admin is not None:
            if not admin.is_admin:
                raise AuthError("NICKNAME_TAKEN", "The nickname belongs to a non-admin user")
            UserStates.require_usable(admin.state)
        else:
            user_uuid = str(uuidlib.uuid4())
            new_user = NewUser(user_uuid, "admin_" + user_uuid[:8], nick, None, UserStates.ROLE_ADMIN,
                               UserStates.ACTIVE, "en")
            user_id = self.identities.create_user(new_user, None)
            admin = UserStatus(user_id, user_uuid, new_user.username, nick, new_user.role, new_user.state, "en")
        seconds = self.token_days * 86400
        token = self.jwt_port.generate_access_token(admin.uuid, admin.username, UserStates.ROLE_ADMIN,
                                                    lifetime_seconds=seconds)
        return AdminBootstrapResult(admin.uuid, admin.username, admin.nickname, created, token,
                                    int((time.time() + seconds) * 1000))
