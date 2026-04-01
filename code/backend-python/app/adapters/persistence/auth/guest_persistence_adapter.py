from sqlalchemy.orm import Session
from sqlalchemy import func
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
