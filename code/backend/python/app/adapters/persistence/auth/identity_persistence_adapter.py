"""v1.2.0 IdentityPersistencePort on users, users_identities and auth_id_token_seen (mirror of
IdentityPersistenceAdapter.java); a unique-index clash on insert becomes a DuplicateUserError."""
import uuid as uuidlib
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import exists, func, or_
from sqlalchemy.exc import IntegrityError

from app.adapters.persistence.auth.models import AuthIdTokenSeen, User, UserIdentity as IdentityRow, UserToken
from app.core.models.auth.identity import DuplicateUserError, NewUser, UserIdentity, UserStatus
from app.core.ports.auth.identity_persistence_port import IdentityPersistencePort


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def epoch_seconds(iso: Optional[str]) -> int:
    """v1.7.0 users.sessions_valid_after as epoch seconds; 0 when absent or unreadable."""
    if not iso or not str(iso).strip():
        return 0
    try:
        parsed = datetime.fromisoformat(str(iso).strip().replace("Z", "+00:00"))
    except ValueError:
        return 0
    return int((parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)).timestamp())


def to_status(u: User) -> UserStatus:
    return UserStatus(u.id, u.uuid, u.username, u.nickname, u.role or "PLAYER", u.state or 0, u.language,
                      epoch_seconds(getattr(u, "sessions_valid_after", None)))


def to_identity(r: IdentityRow) -> UserIdentity:
    return UserIdentity(r.id, r.id_user, r.provider, r.provider_subject, r.email, r.profile_name, r.given_name,
                        r.family_name, r.picture_url, r.locale, r.ts_profile_update)


def field_of(error: Exception) -> str:
    message = str(getattr(error, "orig", error)).lower()
    if "nickname" in message:
        return "nickname"
    if "email" in message:
        return "email"
    return "other"


def _row(user_id: int, identity: UserIdentity) -> IdentityRow:
    now = _now()
    return IdentityRow(uuid=str(uuidlib.uuid4()), id_user=user_id, provider=identity.provider,
                       provider_subject=identity.subject,
                       email=identity.email.lower() if identity.email else None,
                       profile_name=identity.profile_name, given_name=identity.given_name,
                       family_name=identity.family_name, picture_url=identity.picture_url, locale=identity.locale,
                       ts_profile_update=identity.ts_profile_update, ts_insert=now, ts_update=now)


class IdentityPersistenceAdapter(IdentityPersistencePort):
    def __init__(self, session_factory):
        self.session_factory = session_factory

    def find_identity_by_email(self, provider: str, email: str) -> Optional[UserIdentity]:
        if not email:
            return None
        with self.session_factory() as session:
            row = session.query(IdentityRow).filter(IdentityRow.provider == provider,
                                                    IdentityRow.email == email.lower()).first()
            return to_identity(row) if row else None

    def find_identities_of_user(self, user_id: int) -> List[UserIdentity]:
        with self.session_factory() as session:
            rows = session.query(IdentityRow).filter(IdentityRow.id_user == user_id).order_by(IdentityRow.id).all()
            return [to_identity(r) for r in rows]

    def _one(self, *criteria) -> Optional[UserStatus]:
        with self.session_factory() as session:
            row = session.query(User).filter(*criteria).order_by(User.id).first()
            return to_status(row) if row else None

    def find_user_by_id(self, user_id: int) -> Optional[UserStatus]:
        return self._one(User.id == user_id)

    def find_user_by_uuid(self, uuid: str) -> Optional[UserStatus]:
        if not uuid or not str(uuid).strip():
            return None
        return self._one(User.uuid == uuid)

    def find_user_by_nickname(self, nickname: str) -> Optional[UserStatus]:
        return self._one(User.nickname == nickname)

    def find_user_by_email(self, email: str) -> Optional[UserStatus]:
        if not email:
            return None
        return self._one(User.email_address == email.lower())

    def nickname_exists(self, nickname: str) -> bool:
        with self.session_factory() as session:
            return session.query(User.id).filter(User.nickname == nickname).first() is not None

    def create_user(self, user: NewUser, identity: Optional[UserIdentity]) -> int:
        now = _now()
        with self.session_factory() as session:
            try:
                row = User(uuid=user.uuid, username=user.username, nickname=user.nickname,
                           email_address=user.email_address.lower() if user.email_address else None,
                           role=user.role, state=user.state, language=user.language, ts_registration=now,
                           last_access=now)
                session.add(row)
                session.flush()
                if identity is not None:
                    session.add(_row(row.id, identity))
                session.commit()
                return row.id
            except IntegrityError as clash:
                session.rollback()
                raise DuplicateUserError(field_of(clash))

    def create_identity(self, user_id: int, identity: UserIdentity) -> None:
        with self.session_factory() as session:
            try:
                session.add(_row(user_id, identity))
                session.commit()
            except IntegrityError as clash:
                session.rollback()
                raise DuplicateUserError(field_of(clash))

    def update_identity_profile(self, identity_id: int, profile: UserIdentity) -> None:
        with self.session_factory() as session:
            row = session.query(IdentityRow).filter(IdentityRow.id == identity_id).first()
            if row is not None:
                row.profile_name = profile.profile_name
                row.given_name = profile.given_name
                row.family_name = profile.family_name
                row.picture_url = profile.picture_url
                row.locale = profile.locale
                row.ts_profile_update = profile.ts_profile_update
                row.ts_update = _now()
                session.commit()

    def update_last_access(self, user_id: int) -> None:
        with self.session_factory() as session:
            session.query(User).filter(User.id == user_id).update({"last_access": _now()})
            session.commit()

    def update_state(self, user_id: int, state: int) -> None:
        with self.session_factory() as session:
            session.query(User).filter(User.id == user_id).update({"state": state})
            session.commit()

    def find_theme_selected(self, user_id: int) -> Optional[str]:
        with self.session_factory() as session:
            user = session.get(User, user_id)
            theme = user.theme_selected if user is not None else None
            return theme if theme and theme.strip() else None

    def update_preferences(self, user_id: int, language: Optional[str], theme: Optional[str]) -> None:
        values = {k: v for k, v in (("language", language), ("theme_selected", theme)) if v is not None}
        if not values:
            return
        with self.session_factory() as session:
            session.query(User).filter(User.id == user_id).update(values)
            session.commit()

    def mark_id_token_seen(self, token_hash: str, expires_at: str) -> bool:
        with self.session_factory() as session:
            try:
                session.add(AuthIdTokenSeen(token_hash=token_hash, expires_at=expires_at, ts_insert=_now()))
                session.commit()
                return True
            except IntegrityError:
                session.rollback()
                return False

    def delete_expired_id_tokens(self, now: str) -> int:
        with self.session_factory() as session:
            deleted = session.query(AuthIdTokenSeen).filter(AuthIdTokenSeen.expires_at < now).delete()
            session.commit()
            return deleted

    def find_user_ids_by_state(self, state: int, limit: int) -> List[int]:
        with self.session_factory() as session:
            return [r[0] for r in session.query(User.id).filter(User.state == state).order_by(User.id)
                    .limit(limit).all()]

    def find_inactive_identity_user_ids(self, last_access_before: str, limit: int) -> List[int]:
        with self.session_factory() as session:
            seen = func.coalesce(User.last_access, User.ts_registration)
            rows = (session.query(User.id)
                    .filter(User.state.notin_([6, 7]), exists().where(IdentityRow.id_user == User.id),
                            seen < last_access_before)
                    .order_by(User.id).limit(limit).all())
            return [r[0] for r in rows]

    def delete_user_fully(self, user_id: int) -> None:
        with self.session_factory() as session:
            session.query(IdentityRow).filter(IdentityRow.id_user == user_id).delete()
            session.query(UserToken).filter(UserToken.id_user == user_id).delete()
            session.query(User).filter(User.id == user_id).delete()
            session.commit()

    def find_non_guest_user_ids_by_nickname_like(self, pattern: str) -> List[int]:
        with self.session_factory() as session:
            rows = (session.query(User.id).filter(or_(User.state.is_(None), User.state != 6),
                                                  User.nickname.like(pattern)).order_by(User.id).all())
            return [r[0] for r in rows]
