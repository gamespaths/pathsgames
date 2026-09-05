from sqlalchemy.orm import Session
from sqlalchemy import and_, func, or_
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from app.core.ports.auth.guest_persistence_port import GuestPersistencePort
from app.core.ports.auth.guest_admin_persistence_port import GuestAdminPersistencePort
from app.adapters.persistence.auth.models import User, UserToken

class GuestPersistenceAdapter(GuestPersistencePort, GuestAdminPersistencePort):
    def __init__(self, session_factory):
        self.session_factory = session_factory

    def create_guest_user(self, user_uuid: str, username: str, guest_cookie_token: str, expires_at_iso: str) -> int:
        with self.session_factory() as session:
            now = datetime.now(timezone.utc).isoformat()
            user = User(
                uuid=user_uuid,
                username=username,
                state=6,  # GUEST state
                role='PLAYER',
                guest_cookie_token=guest_cookie_token,
                guest_expires_at=expires_at_iso,
                ts_registration=now,
                last_access=now
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            return user.id

    def find_guest_by_cookie_token(self, guest_cookie_token: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            user = session.query(User).filter(User.guest_cookie_token == guest_cookie_token).first()
            if not user:
                return None
            return self._user_to_dict(user)

    def store_refresh_token(self, user_id: int, refresh_token: str, expires_at: str) -> None:
        with self.session_factory() as session:
            # Optionally clear old tokens
            session.query(UserToken).filter(UserToken.id_user == user_id).delete()
            
            token = UserToken(
                id_user=user_id,
                refresh_token=refresh_token,
                expires_at=expires_at
            )
            session.add(token)
            session.commit()

    def update_last_access(self, user_id: int) -> None:
        with self.session_factory() as session:
            user = session.query(User).filter(User.id == user_id).first()
            if user:
                user.last_access = datetime.now(timezone.utc).isoformat()
                session.commit()

    def delete_expired_guests(self) -> int:
        with self.session_factory() as session:
            now = datetime.now(timezone.utc).isoformat()
            deleted_count = session.query(User).filter(
                User.state == 6,
                User.guest_expires_at < now
            ).delete(synchronize_session=False)
            session.commit()
            return deleted_count

    def delete_guests_by_username_like(self, username_like_pattern: str) -> int:
        # Delete the tokens of the matching guests first, then the guests.
        with self.session_factory() as session:
            ids = [
                row[0]
                for row in session.query(User.id).filter(
                    User.state == 6,
                    User.username.like(username_like_pattern),
                ).all()
            ]
            if ids:
                session.query(UserToken).filter(
                    UserToken.id_user.in_(ids)
                ).delete(synchronize_session=False)
            deleted_count = session.query(User).filter(
                User.state == 6,
                User.username.like(username_like_pattern),
            ).delete(synchronize_session=False)
            session.commit()
            return deleted_count

    # Admin methods
    def find_all_guests(self) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            users = session.query(User).filter(User.state == 6).order_by(User.ts_registration.desc()).all()
            return [self._user_to_dict(u) for u in users]

    def find_guest_by_uuid(self, uuid: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            user = session.query(User).filter(User.uuid == uuid).first()
            if not user:
                return None
            return self._user_to_dict(user)

    def delete_guest_by_uuid(self, uuid: str) -> bool:
        with self.session_factory() as session:
            user = session.query(User).filter(User.uuid == uuid).first()
            if not user:
                return False
            session.delete(user)
            session.commit()
            return True

    # === v0.36.2: paging and the stale purge ===

    @staticmethod
    def _seen_at():
        """When a guest was last seen: its last access, or its registration if it never
        came back. One expression, so the page order and the purge bound agree."""
        return func.coalesce(User.last_access, User.ts_registration)

    def find_guests_page(self, last_access_before, ts_cursor, id_cursor, limit):
        seen = self._seen_at()
        with self.session_factory() as session:
            q = session.query(User).filter(User.state == 6)
            if last_access_before is not None:
                q = q.filter(seen < last_access_before)
            if ts_cursor is not None:
                q = q.filter(or_(seen < ts_cursor,
                                 and_(seen == ts_cursor, User.id < (id_cursor or 0))))
            users = q.order_by(seen.desc(), User.id.desc()).limit(max(1, limit)).all()
            return [self._user_to_dict(u) for u in users]

    def find_guest_ids_with_last_access_before(self, before: str) -> List[int]:
        if before is None:
            return []
        with self.session_factory() as session:
            rows = (session.query(User.id)
                    .filter(User.state == 6, self._seen_at() < before).all())
            return [r[0] for r in rows]

    def delete_guests_by_ids(self, ids: List[int]) -> int:
        if not ids:
            return 0
        with self.session_factory() as session:
            session.query(UserToken).filter(
                UserToken.id_user.in_(ids)).delete(synchronize_session=False)
            deleted = session.query(User).filter(
                User.state == 6, User.id.in_(ids)).delete(synchronize_session=False)
            session.commit()
            return deleted

    def count_all_guests(self) -> int:
        with self.session_factory() as session:
            return session.query(func.count(User.id)).filter(User.state == 6).scalar()

    def count_active_guests(self) -> int:
        with self.session_factory() as session:
            now = datetime.now(timezone.utc).isoformat()
            return session.query(func.count(User.id)).filter(
                User.state == 6,
                User.guest_expires_at >= now
            ).scalar()

    def count_expired_guests(self) -> int:
        with self.session_factory() as session:
            now = datetime.now(timezone.utc).isoformat()
            return session.query(func.count(User.id)).filter(
                User.state == 6,
                User.guest_expires_at < now
            ).scalar()

    def _user_to_dict(self, user: User) -> Dict[str, Any]:
        return {
            "id": user.id,
            "uuid": user.uuid,
            "username": user.username,
            "nickname": user.nickname,
            "role": user.role,
            "state": user.state,
            "guest_cookie_token": user.guest_cookie_token,
            "guest_expires_at": user.guest_expires_at,
            "language": user.language,
            "ts_registration": user.ts_registration,
            "ts_last_access": user.last_access
        }
