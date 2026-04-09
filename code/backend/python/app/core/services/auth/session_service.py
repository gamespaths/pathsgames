from app.core.ports.auth.session_port import SessionPort
from app.core.ports.auth.jwt_port import JwtPort
from app.core.ports.auth.token_persistence_port import TokenPersistencePort
from app.core.models.auth.refreshed_session import RefreshedSession
from app.core.models.auth.token_info import TokenInfo
import time

class SessionService(SessionPort):
    def __init__(self, jwt_port: JwtPort, token_persistence: TokenPersistencePort, max_tokens_per_user: int = 5):
        self.jwt_port = jwt_port
        self.token_persistence = token_persistence
        self.max_tokens_per_user = max_tokens_per_user

    def refresh_session(self, refresh_token: str) -> RefreshedSession:
        # 1. Validate refresh token
        if not self.jwt_port.validate_token(refresh_token):
            raise ValueError("INVALID_REFRESH_TOKEN")

        # 2. Parse claims
        token_info = self.jwt_port.parse_token(refresh_token)
        if not token_info.is_refresh_token():
            raise ValueError("NOT_A_REFRESH_TOKEN")

        # 3. Verify in DB
        if not self.token_persistence.is_refresh_token_valid(refresh_token):
            raise ValueError("REVOKED_REFRESH_TOKEN")

        # 4. Token Rotation: Revoke ALL
        self.token_persistence.revoke_all_by_user_uuid(token_info.user_uuid)

        # 5. Generate new pair
        new_access_token = self.jwt_port.generate_access_token(
            token_info.user_uuid,
            token_info.username,
            token_info.role
        )
        new_refresh_token = self.jwt_port.generate_refresh_token(token_info.user_uuid)
        new_refresh_info = self.jwt_port.parse_token(new_refresh_token)

        # 6. Persist and enforce limit
        user_id = self.token_persistence.find_user_id_by_uuid(token_info.user_uuid)
        if user_id is None:
            raise ValueError("USER_NOT_FOUND")

        self.token_persistence.save_refresh_token(token_info.user_uuid, new_refresh_token, new_refresh_info)
        self.token_persistence.enforce_token_limit(user_id, self.max_tokens_per_user)

        return RefreshedSession(
            userUuid=token_info.user_uuid,
            username=token_info.username,
            role=token_info.role,
            accessToken=new_access_token,
            refreshToken=new_refresh_token,
            accessTokenExpiresAt=int(time.time() + (self.jwt_port.get_access_token_expiration_ms() / 1000)),
            refreshTokenExpiresAt=int(time.time() + (self.jwt_port.get_refresh_token_expiration_ms() / 1000))
        )

    def logout(self, refresh_token: str) -> None:
        self.token_persistence.revoke_token(refresh_token)

    def logout_all(self, user_uuid: str) -> None:
        self.token_persistence.revoke_all_by_user_uuid(user_uuid)

    def validate_access_token(self, access_token: str) -> TokenInfo:
        if not self.jwt_port.validate_token(access_token):
            raise ValueError("INVALID_ACCESS_TOKEN")

        token_info = self.jwt_port.parse_token(access_token)
        if not token_info.is_access_token():
            raise ValueError("NOT_AN_ACCESS_TOKEN")

        return token_info
