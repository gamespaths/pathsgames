"""v0.41.6 — read-only :class:`UserDirectoryPort` on the users table: by id, uuid, case-insensitive email
and username, for the admin owner move. Mirrors ``UserDirectoryAdapter.java``."""
from typing import List, Optional

from sqlalchemy import func

from app.adapters.persistence.auth.models import User
from app.core.models.auth.admin_user import AdminUserView
from app.core.ports.match.match_owner_ports import UserDirectoryPort


def to_view(u: User) -> AdminUserView:
    return AdminUserView(id=u.id, uuid=u.uuid, username=u.username, nickname=u.nickname, email=u.email_address,
                         role=u.role, state=u.state, guest_expires_at=u.guest_expires_at,
                         ts_registration=u.ts_registration, ts_last_access=u.last_access)


class UserDirectoryAdapter(UserDirectoryPort):

    def __init__(self, session_factory) -> None:
        self.session_factory = session_factory

    def find_by_id(self, user_id: int) -> Optional[AdminUserView]:
        with self.session_factory() as session:
            row = session.query(User).filter(User.id == user_id).first()
            return to_view(row) if row else None

    def find_by_uuid(self, uuid: str) -> Optional[AdminUserView]:
        if not uuid or not str(uuid).strip():
            return None
        with self.session_factory() as session:
            row = session.query(User).filter(User.uuid == uuid).first()
            return to_view(row) if row else None

    def find_by_email(self, email: str) -> List[AdminUserView]:
        if not email or not str(email).strip():
            return []
        with self.session_factory() as session:
            rows = (session.query(User).filter(func.lower(User.email_address) == str(email).strip().lower())
                    .order_by(User.id).all())
            return [to_view(r) for r in rows]

    def find_by_username(self, username: str) -> List[AdminUserView]:
        if not username or not str(username).strip():
            return []
        with self.session_factory() as session:
            rows = session.query(User).filter(User.username == str(username).strip()).order_by(User.id).all()
            return [to_view(r) for r in rows]
