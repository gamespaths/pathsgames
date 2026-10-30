import jwt
import time
import uuid
from typing import Optional
from app.core.ports.auth.jwt_port import JwtPort
from app.core.models.auth.token_info import TokenInfo

#: v1.2.0 defaults of iss (stage + backend) and aud when the settings are not given
DEFAULT_ISSUER = "pathsgames-dev-python"
DEFAULT_AUDIENCE = "paths-games"


class JwtAdapter(JwtPort):
    def __init__(self, secret: str, access_token_minutes: int, refresh_token_days: int,
                 issuer: str = DEFAULT_ISSUER, audience: str = DEFAULT_AUDIENCE):
        self.secret = secret
        self.access_token_minutes = access_token_minutes
        self.refresh_token_days = refresh_token_days
        self.issuer = issuer
        self.audience = audience

    def generate_access_token(self, user_uuid: str, username: str, role: str,
                              lifetime_seconds: Optional[int] = None) -> str:
        now = int(time.time())
        payload = {
            "iss": self.issuer,
            "aud": self.audience,
            "sub": user_uuid,
            "username": username,
            "role": role,
            "type": "access",
            "iat": now,
            "exp": now + (lifetime_seconds if lifetime_seconds else self.access_token_minutes * 60),
            "jti": str(uuid.uuid4())
        }
        return jwt.encode(payload, self.secret, algorithm="HS256")

    def generate_refresh_token(self, user_uuid: str) -> str:
        now = int(time.time())
        payload = {
            "iss": self.issuer,
            "aud": self.audience,
            "sub": user_uuid,
            "type": "refresh",
            "iat": now,
            "exp": now + (self.refresh_token_days * 24 * 60 * 60),
            "jti": str(uuid.uuid4())
        }
        return jwt.encode(payload, self.secret, algorithm="HS256")

    def get_access_token_expiration_ms(self) -> int:
        return (int(time.time()) + (self.access_token_minutes * 60)) * 1000

    def get_refresh_token_expiration_ms(self) -> int:
        return (int(time.time()) + (self.refresh_token_days * 24 * 60 * 60)) * 1000

    def _decode(self, token: str) -> dict:
        # v1.2.0 iss and aud required: a token of another stage or backend (or before 1.2.0) is refused
        return jwt.decode(token, self.secret, algorithms=["HS256"], issuer=self.issuer, audience=self.audience,
                          options={"require": ["iss", "aud", "exp", "sub"]})

    def parse_token(self, token: str) -> TokenInfo:
        try:
            payload = self._decode(token)
            return TokenInfo(
                sub=payload["sub"],
                username=payload.get("username", ""),
                role=payload.get("role", "PLAYER"),
                type=payload["type"],
                iat=payload["iat"],
                exp=payload["exp"],
                jti=payload.get("jti")
            )
        except Exception as e:
            raise ValueError(f"TOKEN_PARSE_ERROR: {str(e)}")

    def validate_token(self, token: str) -> bool:
        try:
            self._decode(token)
            return True
        except Exception:
            return False
