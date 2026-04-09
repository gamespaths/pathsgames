import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from app.core.models.auth.guest_session import GuestSession
from app.core.ports.auth.guest_auth_port import GuestAuthPort
from app.core.ports.auth.jwt_port import JwtPort
from app.core.ports.auth.guest_persistence_port import GuestPersistencePort

class GuestAuthService(GuestAuthPort):
    GUEST_ROLE = "PLAYER"
    GUEST_USERNAME_PREFIX = "guest_"
    GUEST_SESSION_DAYS = 30

    def __init__(self, jwt_port: JwtPort, persistence_port: GuestPersistencePort):
        self.jwt_port = jwt_port
        self.persistence_port = persistence_port

    def create_guest_session(self) -> GuestSession:
        # 1. Generate anonymous UUID identity
        user_uuid = str(uuid.uuid4())
        username = self.GUEST_USERNAME_PREFIX + user_uuid[:8]
        guest_cookie_token = str(uuid.uuid4())

        # 2. Calculate guest session expiration
        expires_at = datetime.now(timezone.utc) + timedelta(days=self.GUEST_SESSION_DAYS)
        expires_at_iso = expires_at.isoformat()

        # 3. Persist guest user
        user_id = self.persistence_port.create_guest_user(user_uuid, username, guest_cookie_token, expires_at_iso)

        # 4. Issue JWT tokens
        access_token = self.jwt_port.generate_access_token(user_uuid, username, self.GUEST_ROLE)
        refresh_token = self.jwt_port.generate_refresh_token(user_uuid)

        # 5. Store refresh token
        refresh_expires_ms = self.jwt_port.get_refresh_token_expiration_ms()
        refresh_expires_at = datetime.fromtimestamp(refresh_expires_ms / 1000, tz=timezone.utc).isoformat()
        self.persistence_port.store_refresh_token(user_id, refresh_token, refresh_expires_at)

        # 6. Update last access
        self.persistence_port.update_last_access(user_id)

        return GuestSession(
            userUuid=user_uuid,
            username=username,
            accessToken=access_token,
            refreshToken=refresh_token,
            accessTokenExpiresAt=self.jwt_port.get_access_token_expiration_ms(),
            refreshTokenExpiresAt=refresh_expires_ms,
            guestCookieToken=guest_cookie_token
        )

    def resume_guest_session(self, guest_cookie_token: str) -> Optional[GuestSession]:
        if not guest_cookie_token:
            return None

        # Look up guest user
        guest_data = self.persistence_port.find_guest_by_cookie_token(guest_cookie_token)
        if not guest_data:
            return None

        user_uuid = guest_data.get("uuid")
        username = guest_data.get("username")
        user_id = guest_data.get("id")
        expires_at_str = guest_data.get("guest_expires_at")

        if not user_uuid or not username or user_id is None:
            return None

        # Check expiration
        if expires_at_str:
            expires_at = datetime.fromisoformat(expires_at_str)
            if datetime.now(timezone.utc) > expires_at:
                return None

        # Issue new JWT tokens
        access_token = self.jwt_port.generate_access_token(user_uuid, username, self.GUEST_ROLE)
        refresh_token = self.jwt_port.generate_refresh_token(user_uuid)

        # Store new refresh token
        refresh_expires_ms = self.jwt_port.get_refresh_token_expiration_ms()
        refresh_expires_at = datetime.fromtimestamp(refresh_expires_ms / 1000, tz=timezone.utc).isoformat()
        self.persistence_port.store_refresh_token(user_id, refresh_token, refresh_expires_at)

        # Update last access
        self.persistence_port.update_last_access(user_id)

        return GuestSession(
            userUuid=user_uuid,
            username=username,
            accessToken=access_token,
            refreshToken=refresh_token,
            accessTokenExpiresAt=self.jwt_port.get_access_token_expiration_ms(),
            refreshTokenExpiresAt=refresh_expires_ms,
            guestCookieToken=guest_cookie_token
        )

    def cleanup_expired_guest_sessions(self) -> int:
        return self.persistence_port.delete_expired_guests()
