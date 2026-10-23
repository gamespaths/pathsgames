"""Refresh tokens (users_tokens) with SQLAlchemy; v1.2.0 the column holds the SHA-256 hash and a clear
value still found (stored before 1.2.0) is rewritten as hash; v1.7.0 the revocation reason and time."""
from datetime import datetime, timezone
from typing import Optional

from app.adapters.persistence.auth.identity_persistence_adapter import to_status
from app.adapters.persistence.auth.models import User, UserToken
from app.core.models.auth import revoke_reasons
from app.core.models.auth.identity import StoredRefreshToken, UserStatus
from app.core.ports.auth.token_persistence_port import TokenPersistencePort


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TokenPersistenceAdapter(TokenPersistencePort):
    def __init__(self, session_factory):
        self.session_factory = session_factory

    @staticmethod
    def _find(session, token_hash: Optional[str], legacy_clear: Optional[str]) -> Optional[UserToken]:
        if not token_hash:
            return None
        token = session.query(UserToken).filter(UserToken.refresh_token == token_hash).first()
        if token is None and legacy_clear:
            token = session.query(UserToken).filter(UserToken.refresh_token == legacy_clear).first()
            if token is not None:
                token.refresh_token = token_hash
                session.commit()
        return token

    def find_refresh_token(self, token_hash: str, legacy_clear: Optional[str]) -> Optional[StoredRefreshToken]:
        with self.session_factory() as session:
            t = self._find(session, token_hash, legacy_clear)
            if t is None:
                return None
            return StoredRefreshToken(t.id, t.id_user, bool(t.revoked), t.expires_at, t.ts_rotated,
                                      t.revoked_reason)

    def mark_rotated(self, token_id: int, now: str) -> None:
        with self.session_factory() as session:
            session.query(UserToken).filter(UserToken.id == token_id).update(
                {"revoked": True, "ts_rotated": now, "revoked_reason": revoke_reasons.ROTATED, "ts_update": _now()})
            session.commit()

    def revoke_refresh_token(self, token_hash: str, legacy_clear: Optional[str]) -> bool:
        with self.session_factory() as session:
            t = self._find(session, token_hash, legacy_clear)
            if t is None or t.revoked:
                return False
            t.revoked = True
            t.revoked_reason = revoke_reasons.LOGOUT
            t.ts_update = _now()
            session.commit()
            return True

    def revoke_all_by_user_uuid(self, user_uuid: str) -> None:
        user_id = self.find_user_id_by_uuid(user_uuid)
        if user_id is not None:
            self.revoke_all_by_user_id(user_id)

    def revoke_all_by_user_id(self, user_id: int, reason: str = revoke_reasons.LOGOUT_ALL) -> None:
        with self.session_factory() as session:
            session.query(UserToken).filter(UserToken.id_user == user_id, UserToken.revoked == False).update(  # noqa: E712
                {"revoked": True, "revoked_reason": reason, "ts_update": _now()})
            session.commit()

    def store_refresh_token(self, user_id: int, token_hash: str, expires_at: str) -> None:
        with self.session_factory() as session:
            session.add(UserToken(id_user=user_id, refresh_token=token_hash, revoked=False, expires_at=expires_at,
                                  ts_update=_now()))
            session.commit()

    def find_user_id_by_uuid(self, user_uuid: str) -> Optional[int]:
        with self.session_factory() as session:
            user = session.query(User).filter(User.uuid == user_uuid).first()
            return user.id if user else None

    def enforce_token_limit(self, user_id: int, max_tokens: int) -> None:
        """The oldest active tokens above the cap are revoked with reason LIMIT (SESSION_LIMIT)."""
        with self.session_factory() as session:
            active = (session.query(UserToken).filter(UserToken.id_user == user_id, UserToken.revoked == False)  # noqa: E712
                      .order_by(UserToken.id.asc()).all())
            if len(active) > max_tokens:
                now = _now()
                for token in active[:len(active) - max_tokens]:
                    token.revoked = True
                    token.revoked_reason = revoke_reasons.LIMIT
                    token.ts_update = now
                session.commit()

    def count_active_by_user_id(self, user_id: int) -> int:
        with self.session_factory() as session:
            return (session.query(UserToken)
                    .filter(UserToken.id_user == user_id, UserToken.revoked == False).count())  # noqa: E712

    def count_active_issued_after(self, user_id: int, issued_after) -> int:
        bound = issued_after.astimezone(timezone.utc).replace(tzinfo=None) if issued_after.tzinfo else issued_after
        with self.session_factory() as session:
            return (session.query(UserToken)
                    .filter(UserToken.id_user == user_id, UserToken.revoked == False,  # noqa: E712
                            UserToken.expires_at >= _now(), UserToken.ts_insert >= bound).count())

    def set_sessions_valid_after(self, user_id: int, valid_after: str) -> None:
        with self.session_factory() as session:
            session.query(User).filter(User.id == user_id).update({"sessions_valid_after": valid_after})
            session.commit()

    def delete_short_lived_revoked(self, revoked_before: str) -> int:
        with self.session_factory() as session:
            removed = (session.query(UserToken)
                       .filter(UserToken.revoked == True,  # noqa: E712
                               UserToken.revoked_reason.in_(revoke_reasons.SHORT_LIVED),
                               UserToken.ts_update < revoked_before)
                       .delete(synchronize_session=False))
            session.commit()
            return removed

    def find_user_by_id(self, user_id: int) -> Optional[UserStatus]:
        with self.session_factory() as session:
            u = session.query(User).filter(User.id == user_id).first()
            if u is None:
                return None
            return to_status(u)

    def update_last_access(self, user_id: int) -> None:
        with self.session_factory() as session:
            session.query(User).filter(User.id == user_id).update(
                {"last_access": datetime.now(timezone.utc).isoformat()})
            session.commit()
