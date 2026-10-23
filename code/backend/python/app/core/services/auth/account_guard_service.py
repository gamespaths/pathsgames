"""v1.7.0 step 10 — the login and refresh checks (mirror of AccountGuardService.java): banned-subject hashes, the
automatic unblock of an ended suspension (logged as SYSTEM) and the armed re-link of an IDENTITY_MISMATCH."""
from datetime import datetime, timezone
from typing import Callable, Optional

from app.core.models.auth import user_admin as ua
from app.core.models.auth.auth_error import AuthError, UserStates
from app.core.models.auth.identity import UserIdentity, UserStatus

AUTO_UNBLOCK_REASON = "Suspension ended"


def parse_instant(text: Optional[str]) -> Optional[datetime]:
    if not text or not str(text).strip():
        return None
    try:
        parsed = datetime.fromisoformat(str(text).strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def iso(dt: datetime) -> str:
    """ISO-8601 UTC with the Z suffix, as Java's Instant.toString() for whole seconds."""
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


class AccountGuardService:
    def __init__(self, persistence, interventions, user_state, hasher,
                 clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc)):
        self.persistence = persistence
        self.interventions = interventions
        self.user_state = user_state
        self.hasher = hasher
        self.clock = clock

    def check_not_banned(self, subject: Optional[str], email: Optional[str]) -> None:
        if self.persistence.is_banned(self.hasher.subject(subject), self.hasher.email(email)):
            raise AuthError("ACCOUNT_DISABLED", "The account is disabled")

    def admit(self, user: UserStatus) -> UserStatus:
        if user.state == UserStates.BLOCKED:
            item = self.persistence.find_by_uuid(user.uuid)
            end = parse_instant(item.suspended_until) if item is not None else None
            if end is not None and self.clock() >= end:
                self.persistence.update_state_and_suspension(user.id, UserStates.ACTIVE, None)
                if self.user_state is not None:
                    self.user_state.evict(user.uuid)
                self.interventions.record(ua.SYSTEM, ua.UNBLOCK, user.uuid, AUTO_UNBLOCK_REASON)
                return UserStatus(user.id, user.uuid, user.username, user.nickname, user.role, UserStates.ACTIVE,
                                  user.language)
            if end is not None:
                raise AuthError("ACCOUNT_DISABLED", "The account is suspended", suspended_until=iso(end))
        UserStates.require_usable(user.state)
        return user

    def relink(self, identity: Optional[UserIdentity], new_subject: str) -> bool:
        if identity is None or identity.id is None or identity.user_id is None \
                or not self.persistence.is_relink_pending(identity.user_id):
            return False
        self.persistence.replace_identity_subject(identity.id, identity.user_id, new_subject)
        return True
