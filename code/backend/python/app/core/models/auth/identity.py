"""v1.2.0 Google SSO models (mirror of the Java core records): claims, identity, user status, profile,
session, merge. ``__repr__`` keeps personal data (email, names, tokens) out of any log line."""
from dataclasses import dataclass, field
from typing import List, Optional

PROVIDER_GOOGLE = "GOOGLE"
TYPE_GUEST = "GUEST"
TYPE_GOOGLE = "GOOGLE"
TYPE_INTERNAL = "INTERNAL"


@dataclass(repr=False)
class GoogleIdentityClaims:
    subject: Optional[str]
    email: Optional[str]
    email_verified: bool
    name: Optional[str]
    given_name: Optional[str]
    family_name: Optional[str]
    picture: Optional[str]
    locale: Optional[str]
    nonce: Optional[str]
    issuer: Optional[str]
    audience: Optional[str]
    expires_at: int
    issued_at: int

    def __repr__(self):
        return f"GoogleIdentityClaims(subject={self.subject!r})"


@dataclass(repr=False)
class UserIdentity:
    id: Optional[int]
    user_id: Optional[int]
    provider: str
    subject: str
    email: Optional[str]
    profile_name: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    picture_url: Optional[str] = None
    locale: Optional[str] = None
    ts_profile_update: Optional[str] = None

    @staticmethod
    def from_google(c: GoogleIdentityClaims, email: str, now: str) -> "UserIdentity":
        return UserIdentity(None, None, PROVIDER_GOOGLE, c.subject, email, c.name, c.given_name, c.family_name,
                            c.picture, c.locale, now)

    def __repr__(self):
        return f"UserIdentity(id={self.id}, user_id={self.user_id}, provider={self.provider!r})"


@dataclass
class UserStatus:
    id: int
    uuid: str
    username: str
    nickname: Optional[str]
    role: str
    state: int
    language: Optional[str] = "en"

    @property
    def is_admin(self) -> bool:
        return self.role == "ADMIN"

    @property
    def is_guest(self) -> bool:
        return self.state == 6


@dataclass(repr=False)
class NewUser:
    uuid: str
    username: str
    nickname: str
    email_address: Optional[str]
    role: str
    state: int
    language: str

    def __repr__(self):
        return f"NewUser(uuid={self.uuid!r}, username={self.username!r})"


@dataclass
class StoredRefreshToken:
    id: int
    user_id: int
    revoked: bool
    expires_at: Optional[str]
    ts_rotated: Optional[str]


def _blank(text: Optional[str]) -> bool:
    return text is None or not str(text).strip()


def display_name_of(identity: Optional[UserIdentity], nickname: Optional[str]) -> Optional[str]:
    """"given family" when present, else the provider name, else the nickname."""
    if identity is not None:
        given = None if _blank(identity.given_name) else identity.given_name
        family = None if _blank(identity.family_name) else identity.family_name
        if given or family:
            return f"{given or ''} {family or ''}".strip()
        if not _blank(identity.profile_name):
            return identity.profile_name.strip()
    return nickname


@dataclass(repr=False)
class UserProfile:
    user_uuid: str
    username: str
    nickname: Optional[str]
    display_name: Optional[str]
    picture_url: Optional[str]
    role: str
    state: int
    language: Optional[str]
    account_type: str

    @staticmethod
    def of(user: UserStatus, identity: Optional[UserIdentity]) -> "UserProfile":
        kind = TYPE_GOOGLE if identity is not None else TYPE_GUEST if user.is_guest else TYPE_INTERNAL
        return UserProfile(user.uuid, user.username, user.nickname, display_name_of(identity, user.nickname),
                           identity.picture_url if identity is not None else None, user.role, user.state,
                           user.language, kind)

    def to_body(self) -> dict:
        return {"userUuid": self.user_uuid, "username": self.username, "nickname": self.nickname,
                "displayName": self.display_name, "pictureUrl": self.picture_url, "role": self.role,
                "accountType": self.account_type, "language": self.language}

    def __repr__(self):
        return f"UserProfile(user_uuid={self.user_uuid!r}, account_type={self.account_type!r})"


@dataclass(repr=False)
class AuthenticatedSession:
    profile: UserProfile
    access_token: str
    refresh_token: str
    access_token_expires_at: int
    refresh_token_expires_at: int
    new_user: bool
    merged_guest_uuid: Optional[str]
    cancelled_matches: int

    def __repr__(self):
        return f"AuthenticatedSession(profile={self.profile!r}, new_user={self.new_user})"


@dataclass
class MatchOwnership:
    id: int
    uuid: str
    story_id: int
    status: str
    ts_update: Optional[str]


@dataclass
class MergeResult:
    moved_matches: int = 0
    cancelled_match_ids: List[int] = field(default_factory=list)


@dataclass(repr=False)
class AdminBootstrapResult:
    user_uuid: str
    username: str
    nickname: str
    created: bool
    access_token: str
    expires_at: int

    def __repr__(self):
        return f"AdminBootstrapResult(user_uuid={self.user_uuid!r}, nickname={self.nickname!r})"


class DuplicateUserError(Exception):
    """A unique-index clash on insert: field is "nickname", "email" or "other"."""

    def __init__(self, field_name: str):
        super().__init__(f"Duplicate user {field_name}")
        self.field = field_name
