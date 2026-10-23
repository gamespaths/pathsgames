"""v1.7.0 HMAC-SHA256 (hex) of a banned Google subject or email with the stage pepper; the email is trimmed and
lowercased first. No rotation: one pepper per stage (mirror of SubjectHasher.java)."""
import hashlib
import hmac
from typing import Optional

#: committed default, accepted only in dev and test (config.check_secrets)
DEFAULT_PEPPER = "PathsGamesDevBannedSubjectPepper2026"


class SubjectHasher:
    def __init__(self, pepper: Optional[str] = None):
        self.pepper = (pepper if pepper and pepper.strip() else DEFAULT_PEPPER).encode("utf-8")

    def _hmac(self, value: str) -> str:
        return hmac.new(self.pepper, value.encode("utf-8"), hashlib.sha256).hexdigest()

    def subject(self, sub: Optional[str]) -> Optional[str]:
        return self._hmac(sub.strip()) if sub and sub.strip() else None

    def email(self, email: Optional[str]) -> Optional[str]:
        return self._hmac(email.strip().lower()) if email and email.strip() else None
