"""v1.7.0 step 10 — admin user management models (mirror of AdminUserItem.java, AdminUserDetail.java, ...):
list rows without email, the detail, the action result, the refusal codes and the intervention-log actions."""
from dataclasses import dataclass, field
from typing import List, Optional

BAN = "BAN"
SUSPEND = "SUSPEND"
UNBLOCK = "UNBLOCK"
RELINK_SUBJECT = "RELINK_SUBJECT"
DELETE_OLD_USER = "DELETE_OLD_USER"
SYSTEM = "SYSTEM"
REASON_MAX = 500
RETENTION_MONTHS = 24
TYPE_GOOGLE = "GOOGLE"
TYPE_INTERNAL = "INTERNAL"

#: error code -> HTTP status, shared by the three backends
CODES = {
    "INVALID_INPUT": 400,
    "GUEST_NOT_BANNABLE": 400,
    "ADMIN_NOT_BANNABLE": 400,
    "SUSPEND_UNTIL_INVALID": 400,
    "USER_NOT_FOUND": 404,
    "INVALID_STATE_TRANSITION": 409,
}


class UserAdminError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message

    @property
    def http_status(self) -> int:
        return CODES.get(self.code, 400)


@dataclass(frozen=True)
class AdminUserItem:
    id: int
    uuid: str
    nickname: Optional[str]
    state: int
    role: str
    account_type: str
    ts_registration: Optional[str] = None
    ts_last_access: Optional[str] = None
    suspended_until: Optional[str] = None

    @property
    def is_admin(self) -> bool:
        return self.role == "ADMIN"

    @property
    def is_guest(self) -> bool:
        return self.state == 6

    def to_body(self) -> dict:
        return {"uuid": self.uuid, "nickname": self.nickname, "state": self.state, "role": self.role,
                "accountType": self.account_type, "tsRegistration": self.ts_registration,
                "tsLastAccess": self.ts_last_access, "suspendedUntil": self.suspended_until}


@dataclass(frozen=True)
class AdminUserPage:
    items: List[AdminUserItem]
    next_cursor: Optional[str]
    limit: int

    def to_body(self) -> dict:
        return {"items": [i.to_body() for i in self.items], "nextCursor": self.next_cursor, "limit": self.limit}


@dataclass(frozen=True)
class AdminUserDetail:
    account_type: str
    suspended_until: Optional[str]
    relink_pending: bool
    banned: bool
    sessions: int
    stats: object
    identities: list = field(default_factory=list)

    def to_body(self) -> dict:
        return {"accountType": self.account_type, "suspendedUntil": self.suspended_until,
                "relinkPending": self.relink_pending, "banned": self.banned, "sessions": self.sessions,
                "stats": self.stats.to_body(),
                "identities": [{"provider": i.provider, "subject": i.subject, "email": i.email,
                                "profileName": i.profile_name, "givenName": i.given_name,
                                "familyName": i.family_name, "pictureUrl": i.picture_url, "locale": i.locale,
                                "tsProfileUpdate": i.ts_profile_update} for i in self.identities]}


@dataclass(frozen=True)
class AdminUserActionResult:
    uuid: str
    action: str
    state: int
    suspended_until: Optional[str] = None
    relink_pending: bool = False
    banned_match_uuids: List[str] = field(default_factory=list)

    def to_body(self) -> dict:
        return {"uuid": self.uuid, "action": self.action, "state": self.state,
                "suspendedUntil": self.suspended_until, "relinkPending": self.relink_pending,
                "bannedMatchUuids": list(self.banned_match_uuids)}
