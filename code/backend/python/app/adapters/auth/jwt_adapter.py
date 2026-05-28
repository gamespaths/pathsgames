import jwt
import time
import uuid
from app.core.ports.auth.jwt_port import JwtPort
from app.core.models.auth.token_info import TokenInfo

class JwtAdapter(JwtPort):
    def __init__(self, secret: str, access_token_minutes: int, refresh_token_days: int):
        self.secret = secret
        self.access_token_minutes = access_token_minutes
        self.refresh_token_days = refresh_token_days

    def generate_access_token(self, user_uuid: str, username: str, role: str) -> str:
        payload = {
            "sub": user_uuid,
            "username": username,
            "role": role,
            "type": "access",
            "iat": int(time.time()),
            "exp": int(time.time()) + (self.access_token_minutes * 60),
            "jti": str(uuid.uuid4())
        }
        return jwt.encode(payload, self.secret, algorithm="HS256")

    def generate_refresh_token(self, user_uuid: str) -> str:
        payload = {
            "sub": user_uuid,
            "type": "refresh",
            "iat": int(time.time()),
            "exp": int(time.time()) + (self.refresh_token_days * 24 * 60 * 60),
            "jti": str(uuid.uuid4())
        }
        return jwt.encode(payload, self.secret, algorithm="HS256")

    def get_access_token_expiration_ms(self) -> int:
        return (int(time.time()) + (self.access_token_minutes * 60)) * 1000

    def get_refresh_token_expiration_ms(self) -> int:
        return (int(time.time()) + (self.refresh_token_days * 24 * 60 * 60)) * 1000

    def parse_token(self, token: str) -> TokenInfo:
        try:
            payload = jwt.decode(token, self.secret, algorithms=["HS256"])
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
            jwt.decode(token, self.secret, algorithms=["HS256"])
            return True
        except Exception:
            return False
