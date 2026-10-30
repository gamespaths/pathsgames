"""v1.7.0 step 10 — UserAdminPersistencePort on users, users_identities and users_banned_subjects (mirror of
UserAdminPersistenceAdapter.java): keyset pages on (lower(nickname), uuid) and (last_access, uuid)."""
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import and_, func, or_

from app.adapters.persistence.auth.models import User, UserBannedSubject, UserIdentity as IdentityRow
from app.core.models.auth.user_admin import TYPE_GOOGLE, TYPE_INTERNAL, AdminUserItem
from app.core.ports.auth.user_admin_ports import UserAdminPersistencePort

GUEST = 6


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class UserAdminPersistenceAdapter(UserAdminPersistencePort):
    def __init__(self, session_factory):
        self.session_factory = session_factory

    @staticmethod
    def _google_ids(session, users) -> set:
        ids = [u.id for u in users]
        if not ids:
            return set()
        rows = session.query(IdentityRow.id_user).filter(IdentityRow.id_user.in_(ids),
                                                         IdentityRow.provider == "GOOGLE").all()
        return {r[0] for r in rows}

    def _items(self, session, users) -> List[AdminUserItem]:
        google = self._google_ids(session, users)
        return [AdminUserItem(u.id, u.uuid, u.nickname, u.state or 0, u.role or "PLAYER",
                              TYPE_GOOGLE if u.id in google else TYPE_INTERNAL, u.ts_registration, u.last_access,
                              u.suspended_until) for u in users]

    def list_by_nickname(self, state, prefix, after_nickname, after_uuid, limit) -> List[AdminUserItem]:
        nick = func.coalesce(func.lower(User.nickname), "")
        with self.session_factory() as session:
            query = session.query(User).filter(User.state != GUEST)
            if state is not None:
                query = query.filter(User.state == state)
            if prefix:
                query = query.filter(nick.like(escape_like(prefix) + "%", escape="\\"))
            if after_nickname is not None and after_uuid is not None:
                query = query.filter(or_(nick > after_nickname, and_(nick == after_nickname, User.uuid > after_uuid)))
            return self._items(session, query.order_by(nick, User.uuid).limit(limit).all())

    def list_by_last_access(self, state, after_access, after_uuid, limit) -> List[AdminUserItem]:
        access = func.coalesce(User.last_access, "")
        with self.session_factory() as session:
            query = session.query(User).filter(User.state == state)
            if after_access is not None and after_uuid is not None:
                query = query.filter(or_(access < after_access, and_(access == after_access, User.uuid < after_uuid)))
            return self._items(session, query.order_by(access.desc(), User.uuid.desc()).limit(limit).all())

    def find_by_email(self, email: str) -> Optional[AdminUserItem]:
        with self.session_factory() as session:
            user = session.query(User).filter(User.email_address == email, User.state != GUEST).first()
            return self._items(session, [user])[0] if user is not None else None

    def find_by_uuid(self, uuid: str) -> Optional[AdminUserItem]:
        with self.session_factory() as session:
            user = session.query(User).filter(User.uuid == uuid).first()
            return self._items(session, [user])[0] if user is not None else None

    def find_email(self, user_id: int) -> Optional[str]:
        with self.session_factory() as session:
            user = session.get(User, user_id)
            email = user.email_address if user is not None else None
            return email if email and email.strip() else None

    def update_state_and_suspension(self, user_id: int, state: int, suspended_until: Optional[str]) -> None:
        with self.session_factory() as session:
            session.query(User).filter(User.id == user_id).update({"state": state,
                                                                    "suspended_until": suspended_until})
            session.commit()

    def is_relink_pending(self, user_id: int) -> bool:
        with self.session_factory() as session:
            user = session.get(User, user_id)
            return user is not None and user.relink_pending == 1

    def set_relink_pending(self, user_id: int, pending: bool) -> None:
        with self.session_factory() as session:
            session.query(User).filter(User.id == user_id).update({"relink_pending": 1 if pending else 0})
            session.commit()

    def replace_identity_subject(self, identity_id: int, user_id: int, subject: str) -> None:
        with self.session_factory() as session:
            session.query(IdentityRow).filter(IdentityRow.id == identity_id).update(
                {"provider_subject": subject, "ts_update": _now()})
            session.commit()
        self.set_relink_pending(user_id, False)

    def _hash_taken(self, session, column, value) -> bool:
        return value is not None and session.query(UserBannedSubject).filter(column == value).first() is not None

    def store_banned_hashes(self, user_uuid, hash_sub, hash_email) -> None:
        self.delete_banned_hashes(user_uuid)
        with self.session_factory() as session:
            sub = None if self._hash_taken(session, UserBannedSubject.hash_sub, hash_sub) else hash_sub
            email = None if self._hash_taken(session, UserBannedSubject.hash_email, hash_email) else hash_email
            if sub is None and email is None:
                return
            session.add(UserBannedSubject(uuid=user_uuid, hash_sub=sub, hash_email=email, ts_insert=_now()))
            session.commit()

    def delete_banned_hashes(self, user_uuid: str) -> int:
        with self.session_factory() as session:
            deleted = session.query(UserBannedSubject).filter(UserBannedSubject.uuid == user_uuid).delete()
            session.commit()
            return deleted

    def has_banned_hashes(self, user_uuid: str) -> bool:
        with self.session_factory() as session:
            return session.query(UserBannedSubject).filter(UserBannedSubject.uuid == user_uuid).first() is not None

    def is_banned(self, hash_sub, hash_email) -> bool:
        with self.session_factory() as session:
            return (self._hash_taken(session, UserBannedSubject.hash_sub, hash_sub)
                    or self._hash_taken(session, UserBannedSubject.hash_email, hash_email))
