import jwt
import time
from datetime import datetime, timedelta, timezone
from app.core.ports.auth.jwt_port import JwtPort

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
            "exp": int(time.time()) + (self.access_token_minutes * 60)
        }
        return jwt.encode(payload, self.secret, algorithm="HS256")

    def generate_refresh_token(self, user_uuid: str) -> str:
        payload = {
            "sub": user_uuid,
            "type": "refresh",
            "iat": int(time.time()),
            "exp": int(time.time()) + (self.refresh_token_days * 24 * 60 * 60)
        }
        return jwt.encode(payload, self.secret, algorithm="HS256")

    def get_access_token_expiration_ms(self) -> int:
        return (int(time.time()) + (self.access_token_minutes * 60)) * 1000

    def get_refresh_token_expiration_ms(self) -> int:
        return (int(time.time()) + (self.refresh_token_days * 24 * 60 * 60)) * 1000
