"""Step 41 — a stateless CSRF token bound to the access token it was issued with (v0.37.7).

``token_for(access_token)`` is base64url(HMAC-SHA256(secret, "csrf:" + access_token)) with no
padding, exactly as the Java and AWS backends compute it, so nothing is stored anywhere.
"""
import base64
import hashlib
import hmac
from typing import Optional

HEADER = "X-CSRF-TOKEN"
_PREFIX = "csrf:"


class CsrfTokenService:
    def __init__(self, secret: str, enforced: bool = True):
        if not secret or not secret.strip():
            raise ValueError("CSRF secret must not be blank")
        self._secret = secret.encode("utf-8")
        self._enforced = bool(enforced)

    @property
    def enforced(self) -> bool:
        return self._enforced

    def token_for(self, access_token: Optional[str]) -> Optional[str]:
        """The token a client must echo back in X-CSRF-TOKEN while it holds this access token."""
        if not access_token or not access_token.strip():
            return None
        digest = hmac.new(self._secret, (_PREFIX + access_token.strip()).encode("utf-8"),
                          hashlib.sha256).digest()
        return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")

    def matches(self, access_token: Optional[str], presented: Optional[str]) -> bool:
        """Constant-time comparison of what the client sent against what this token deserves."""
        expected = self.token_for(access_token)
        if expected is None or not presented or not presented.strip():
            return False
        return hmac.compare_digest(expected, presented.strip())
