"""v1.2.0 the guest merge in one transaction: matches and characters move to the Google user (ts_update
kept), the losers become CANCELLED, the guest and its tokens are deleted (mirror of the Java adapter)."""
from typing import List

from app.adapters.persistence.auth.models import User, UserIdentity as IdentityRow, UserToken
from app.adapters.persistence.match.models import GamingCharacterInstanceEntity, GamingMatchEntity
from app.core.models.auth.identity import MatchOwnership
from app.core.ports.auth.guest_merge_persistence_port import GuestMergePersistencePort

GUEST_STATE = 6


class GuestMergePersistenceAdapter(GuestMergePersistencePort):
    def __init__(self, session_factory):
        self.session_factory = session_factory

    def matches_of_user(self, user_id: int) -> List[MatchOwnership]:
        with self.session_factory() as session:
            rows = (session.query(GamingMatchEntity).filter(GamingMatchEntity.id_user_creator == user_id)
                    .order_by(GamingMatchEntity.id).all())
            return [MatchOwnership(m.id, m.uuid, m.id_story, m.status, m.ts_update) for m in rows]

    def apply_merge(self, guest_user_id: int, target_user_id: int, cancel_match_ids: List[int], now: str) -> int:
        with self.session_factory() as session:
            moved = (session.query(GamingMatchEntity).filter(GamingMatchEntity.id_user_creator == guest_user_id)
                     .update({"id_user_creator": target_user_id}, synchronize_session=False))
            (session.query(GamingCharacterInstanceEntity).filter(GamingCharacterInstanceEntity.id_user == guest_user_id)
             .update({"id_user": target_user_id}, synchronize_session=False))
            if cancel_match_ids:
                (session.query(GamingMatchEntity).filter(GamingMatchEntity.id.in_(cancel_match_ids))
                 .update({"status": "CANCELLED", "ts_update": now}, synchronize_session=False))
            session.query(UserToken).filter(UserToken.id_user == guest_user_id).delete(synchronize_session=False)
            session.query(IdentityRow).filter(IdentityRow.id_user == guest_user_id).delete(synchronize_session=False)
            (session.query(User).filter(User.id == guest_user_id, User.state == GUEST_STATE)
             .delete(synchronize_session=False))
            session.commit()
            return moved
