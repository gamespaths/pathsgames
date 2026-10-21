"""Session and token management; v1.2.0 refresh revokes only the used token (30 s grace for a concurrent
refresh), hashed tokens with lazy migration, SESSION_REVOKED, state check, cap of 5 sessions."""
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

from app.core.models.auth.auth_error import AuthError, UserStates
from app.core.models.auth.refreshed_session import RefreshedSession
from app.core.models.auth.token_info import TokenInfo
from app.core.ports.auth.jwt_port import JwtPort
from app.core.ports.auth.session_port import SessionPort
from app.core.ports.auth.token_persistence_port import TokenPersistencePort
from app.core.services.auth import token_hasher

GRACE_SECONDS = 30


def _parse(ts: Optional[str]) -> Optional[datetime]:
    if not ts:
        return None
    try:
        parsed = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


class SessionService(SessionPort):
    def __init__(self, jwt_port: JwtPort, token_persistence: TokenPersistencePort, max_tokens_per_user: int = 5,
                 clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc)):
        self.jwt_port = jwt_port
        self.token_persistence = token_persistence
        self.max_tokens_per_user = max_tokens_per_user
        self.clock = clock

    def refresh_session(self, refresh_token: str) -> RefreshedSession:
        """ValueError for an unknown, malformed or expired token; AuthError SESSION_REVOKED when it was
        revoked and ACCOUNT_DISABLED / ACCOUNT_DELETION_IN_PROGRESS by the user state."""
        if not refresh_token or not self.jwt_port.validate_token(refresh_token):
            raise ValueError("INVALID_REFRESH_TOKEN")
        token_info = self.jwt_port.parse_token(refresh_token)
        if not token_info.is_refresh_token():
            raise ValueError("NOT_A_REFRESH_TOKEN")
        now = self.clock()
        stored = self.token_persistence.find_refresh_token(token_hasher.sha256(refresh_token),
                                                           token_hasher.legacy(refresh_token, now))
        if stored is None:
            raise ValueError("INVALID_REFRESH_TOKEN")
        expires = _parse(stored.expires_at)
        if stored.expires_at and (expires is None or now > expires):
            raise ValueError("INVALID_REFRESH_TOKEN")
        if stored.revoked:
            rotated = _parse(stored.ts_rotated)
            if rotated is None or now > rotated + timedelta(seconds=GRACE_SECONDS):
                raise AuthError("SESSION_REVOKED", "The session was closed")
        user = self.token_persistence.find_user_by_id(stored.user_id)
        if user is None or user.uuid != token_info.user_uuid:
            raise ValueError("INVALID_REFRESH_TOKEN")
        UserStates.require_usable(user.state)
        if not stored.revoked:
            self.token_persistence.mark_rotated(stored.id, now.isoformat())

        new_access = self.jwt_port.generate_access_token(user.uuid, user.username, user.role)
        new_refresh = self.jwt_port.generate_refresh_token(user.uuid)
        refresh_ms = self.jwt_port.get_refresh_token_expiration_ms()
        self.token_persistence.store_refresh_token(user.id, token_hasher.sha256(new_refresh),
                                                   datetime.fromtimestamp(refresh_ms / 1000, tz=timezone.utc).isoformat())
        self.token_persistence.enforce_token_limit(user.id, self.max_tokens_per_user)
        self.token_persistence.update_last_access(user.id)
        return RefreshedSession(
            userUuid=user.uuid,
            username=user.username,
            role=user.role,
            accessToken=new_access,
            refreshToken=new_refresh,
            accessTokenExpiresAt=self.jwt_port.get_access_token_expiration_ms(),
            refreshTokenExpiresAt=refresh_ms,
        )

    def logout(self, refresh_token: str) -> None:
        if refresh_token:
            self.token_persistence.revoke_refresh_token(token_hasher.sha256(refresh_token),
                                                        token_hasher.legacy(refresh_token, self.clock()))

    def logout_all(self, user_uuid: str) -> None:
        self.token_persistence.revoke_all_by_user_uuid(user_uuid)

    def validate_access_token(self, access_token: str) -> TokenInfo:
        if not self.jwt_port.validate_token(access_token):
            raise ValueError("INVALID_ACCESS_TOKEN")
        token_info = self.jwt_port.parse_token(access_token)
        if not token_info.is_access_token():
            raise ValueError("NOT_AN_ACCESS_TOKEN")
        return token_info
