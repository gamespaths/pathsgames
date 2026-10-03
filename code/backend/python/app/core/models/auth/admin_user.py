"""v0.41.6 — the admin view of one user (User tab and owner-move preview) with its move eligibility.
Mirrors ``AdminUserView.java``; state 1 registration, 2 active, 3 blocked, 4 banned, 5 password_reset, 6 guest."""
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from typing import Optional

STATE_ACTIVE = 2
STATE_GUEST = 6
ROLE_ADMIN = "ADMIN"
REASON_NOT_ALLOWED = "USER_NOT_ALLOWED"
REASON_EXPIRED = "USER_EXPIRED"


def _parse(value: str) -> Optional[datetime]:
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@dataclass(frozen=True)
class AdminUserView:
    id: int
    uuid: str
    username: Optional[str] = None
    nickname: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    state: Optional[int] = None
    guest_expires_at: Optional[str] = None
    ts_registration: Optional[str] = None
    ts_last_access: Optional[str] = None
    match_count: int = 0

    def with_match_count(self, count: int) -> "AdminUserView":
        return replace(self, match_count=int(count or 0))

    @property
    def is_guest(self) -> bool:
        return self.state == STATE_GUEST

    def is_expired(self, now: datetime) -> bool:
        """A guest without expiry (an imported one) or with an unreadable date is not expired."""
        if not self.is_guest or not self.guest_expires_at or not str(self.guest_expires_at).strip():
            return False
        expires = _parse(str(self.guest_expires_at))
        return expires is not None and now > expires

    def reason(self, now: datetime) -> Optional[str]:
        """None when the user may receive a match, else USER_NOT_ALLOWED or USER_EXPIRED."""
        if str(self.role or "").upper() == ROLE_ADMIN or self.state not in (STATE_ACTIVE, STATE_GUEST):
            return REASON_NOT_ALLOWED
        return REASON_EXPIRED if self.is_expired(now) else None

    def to_response(self, now: datetime) -> dict:
        """The camelCase AdminUserResponse of both admin GETs."""
        reason = self.reason(now)
        return {
            "uuid": self.uuid, "username": self.username, "nickname": self.nickname, "email": self.email,
            "role": self.role, "state": self.state, "guest": self.is_guest,
            "guestExpiresAt": self.guest_expires_at, "expired": self.is_expired(now),
            "tsRegistration": self.ts_registration, "tsLastAccess": self.ts_last_access,
            "matchCount": self.match_count, "eligible": reason is None, "reason": reason,
        }
