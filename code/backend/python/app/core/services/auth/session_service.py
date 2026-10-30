"""Session and token management; v1.2.0 refresh revokes only the used token, hashed tokens, state check;
v1.7.0 cap of 12 (SESSION_LIMIT), 2-minute grace, reuse detection, guest refresh capped, sessions_valid_after."""
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

from app.core.models.auth import revoke_reasons
from app.core.models.auth.auth_error import AuthError, UserStates
from app.core.models.auth.refreshed_session import RefreshedSession
from app.core.models.auth.token_info import TokenInfo
from app.core.ports.auth.jwt_port import JwtPort
from app.core.ports.auth.session_port import SessionPort
from app.core.ports.auth.token_persistence_port import TokenPersistencePort
from app.core.services.auth import token_hasher

DEFAULT_MAX_TOKENS_PER_USER = 12
#: a just-rotated refresh token is still accepted this long (two tabs refreshing at once)
GRACE_SECONDS = 120
#: activeSessions counts only the sessions refreshed in the last 30 days
ACTIVE_SESSION_DAYS = 30
#: a guest refresh token never outlives the 180-day guest cookie
GUEST_REFRESH_DAYS = 180


def refresh_expiry_ms(token_expires_ms: int, guest: bool, now: datetime) -> int:
    """The stored expiry of a new refresh token: a guest's never beyond 180 days from now."""
    if not guest:
        return int(token_expires_ms)
    return min(int(token_expires_ms), int((now + timedelta(days=GUEST_REFRESH_DAYS)).timestamp() * 1000))


def valid_after(now: datetime) -> str:
    """sessions_valid_after at seconds precision: a token is valid when its iat is not before it."""
    return now.astimezone(timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse(ts: Optional[str]) -> Optional[datetime]:
    if not ts:
        return None
    try:
        parsed = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


class SessionService(SessionPort):
    def __init__(self, jwt_port: JwtPort, token_persistence: TokenPersistencePort,
                 max_tokens_per_user: int = DEFAULT_MAX_TOKENS_PER_USER,
                 clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc), account_guard=None,
                 user_state=None):
        self.jwt_port = jwt_port
        self.token_persistence = token_persistence
        self.max_tokens_per_user = max_tokens_per_user
        self.clock = clock
        # v1.7.0 a refresh after the end of a suspension unblocks the user (step 10)
        self.account_guard = account_guard
        # v1.7.0 "log out of all devices" evicts the user so sessions_valid_after applies at once
        self.user_state = user_state

    def refresh_session(self, refresh_token: str) -> RefreshedSession:
        """ValueError for an unknown, malformed or expired token; AuthError SESSION_LIMIT when the cap revoked
        it, SESSION_REVOKED otherwise (a ROTATED token reused after the grace revokes every session first)
        and ACCOUNT_DISABLED / ACCOUNT_DELETION_IN_PROGRESS by the user state."""
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
                if stored.revoked_reason == revoke_reasons.LIMIT:
                    raise AuthError("SESSION_LIMIT", "Too many devices, sign in again")
                if stored.revoked_reason == revoke_reasons.ROTATED:
                    reused = self.token_persistence.find_user_by_id(stored.user_id)
                    if reused is not None:
                        self._cut_all_sessions(reused)
                raise AuthError("SESSION_REVOKED", "The session was closed")
        user = self.token_persistence.find_user_by_id(stored.user_id)
        if user is None or user.uuid != token_info.user_uuid:
            raise ValueError("INVALID_REFRESH_TOKEN")
        if self.account_guard is not None:
            user = self.account_guard.admit(user)
        else:
            UserStates.require_usable(user.state)
        # v1.10.0 issued before the last "log out of all devices": refused also in the grace (state refusals first)
        if not user.accepts_token_issued_at(token_info.iat):
            raise AuthError("SESSION_REVOKED", "The session was closed")
        if not stored.revoked:
            self.token_persistence.mark_rotated(stored.id, now.isoformat())

        new_access = self.jwt_port.generate_access_token(user.uuid, user.username, user.role)
        new_refresh = self.jwt_port.generate_refresh_token(user.uuid)
        refresh_ms = refresh_expiry_ms(self.jwt_port.get_refresh_token_expiration_ms(), user.is_guest, now)
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
        user_id = self.token_persistence.find_user_id_by_uuid(user_uuid)
        user = self.token_persistence.find_user_by_id(user_id) if user_id is not None else None
        if user is None:
            self.token_persistence.revoke_all_by_user_uuid(user_uuid)
            return
        self._cut_all_sessions(user)

    def _cut_all_sessions(self, user) -> None:
        """Every session revoked (LOGOUT_ALL) and the access tokens issued until now refused."""
        self.token_persistence.revoke_all_by_user_id(user.id, revoke_reasons.LOGOUT_ALL)
        self.token_persistence.set_sessions_valid_after(user.id, valid_after(self.clock()))
        if self.user_state is not None:
            self.user_state.evict(user.uuid)

    def active_sessions(self, user_uuid: Optional[str]) -> int:
        """v1.7.0 the sessions refreshed in the last 30 days (GET /api/auth/me activeSessions)."""
        if not user_uuid or not user_uuid.strip():
            return 0
        user_id = self.token_persistence.find_user_id_by_uuid(user_uuid)
        if user_id is None:
            return 0
        return self.token_persistence.count_active_issued_after(
            user_id, self.clock() - timedelta(days=ACTIVE_SESSION_DAYS))

    def purge_revoked_tokens(self) -> int:
        """v1.7.0 daily job: the ROTATED and LOGOUT rows revoked more than 7 days ago are deleted."""
        bound = self.clock() - timedelta(days=revoke_reasons.SHORT_RETENTION_DAYS)
        return self.token_persistence.delete_short_lived_revoked(bound.isoformat())

    def validate_access_token(self, access_token: str) -> TokenInfo:
        if not self.jwt_port.validate_token(access_token):
            raise ValueError("INVALID_ACCESS_TOKEN")
        token_info = self.jwt_port.parse_token(access_token)
        if not token_info.is_access_token():
            raise ValueError("NOT_AN_ACCESS_TOKEN")
        return token_info
