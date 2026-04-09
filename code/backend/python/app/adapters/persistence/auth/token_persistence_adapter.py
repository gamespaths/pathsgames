from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from typing import Optional
from app.core.ports.auth.token_persistence_port import TokenPersistencePort
from app.core.models.auth.token_info import TokenInfo
from app.adapters.persistence.auth.models import User, UserToken

class TokenPersistenceAdapter(TokenPersistencePort):
    def __init__(self, session_factory):
        self.session_factory = session_factory

    def save_refresh_token(self, user_uuid: str, refresh_token: str, token_info: TokenInfo) -> None:
        user_id = self.find_user_id_by_uuid(user_uuid)
        if user_id is None:
            raise ValueError(f"User not found: {user_uuid}")

        with self.session_factory() as session:
            # Pydantic model exp is timestamp
            expires_at_iso = datetime.fromtimestamp(token_info.exp, tz=timezone.utc).isoformat()
            
            token = UserToken(
                id_user=user_id,
                refresh_token=refresh_token,
                jti=token_info.jti,
                revoked=False,
                expires_at=expires_at_iso
            )
            session.add(token)
            session.commit()

    def revoke_token(self, refresh_token: str) -> None:
        with self.session_factory() as session:
            session.query(UserToken).filter(UserToken.refresh_token == refresh_token).update({"revoked": True})
            session.commit()

    def revoke_all_by_user_uuid(self, user_uuid: str) -> None:
        user_id = self.find_user_id_by_uuid(user_uuid)
        if user_id is None:
            return

        with self.session_factory() as session:
            session.query(UserToken).filter(UserToken.id_user == user_id).update({"revoked": True})
            session.commit()

    def is_refresh_token_valid(self, refresh_token: str) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        with self.session_factory() as session:
            token = session.query(UserToken).filter(
                UserToken.refresh_token == refresh_token,
                UserToken.revoked == False,
                UserToken.expires_at > now
            ).first()
            return token is not None

    def find_user_id_by_uuid(self, user_uuid: str) -> Optional[int]:
        with self.session_factory() as session:
            user = session.query(User).filter(User.uuid == user_uuid).first()
            return user.id if user else None

    def enforce_token_limit(self, user_id: int, max_tokens: int) -> None:
        with self.session_factory() as session:
            # Count active tokens
            active_tokens = session.query(UserToken).filter(
                UserToken.id_user == user_id,
                UserToken.revoked == False
            ).order_by(UserToken.ts_insert.asc()).all()

            if len(active_tokens) > max_tokens:
                to_revoke_count = len(active_tokens) - max_tokens
                for i in range(to_revoke_count):
                    active_tokens[i].revoked = True
                session.commit()
