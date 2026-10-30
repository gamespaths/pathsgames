"""v1.7.0 MatchStampStorePort on gaming_match: the one place that writes ts_update and play_ms of a
gameplay or admin write (mirror of MatchStampStoreAdapter.java)."""
from typing import Optional

from sqlalchemy import func

from app.adapters.persistence.match.models import GamingMatchEntity
from app.core.ports.match.match_stamp_ports import MatchStampStorePort


class MatchStampStoreAdapter(MatchStampStorePort):
    def __init__(self, session_factory):
        self.session_factory = session_factory

    def find_ts_update(self, match_uuid: str) -> Optional[str]:
        with self.session_factory() as session:
            row = session.query(GamingMatchEntity.ts_update).filter(GamingMatchEntity.uuid == match_uuid).first()
            return None if row is None else row[0]

    def stamp(self, match_uuid: str, ts_update: str, play_ms_delta: int) -> bool:
        with self.session_factory() as session:
            count = session.query(GamingMatchEntity).filter(GamingMatchEntity.uuid == match_uuid).update(
                {GamingMatchEntity.ts_update: ts_update,
                 GamingMatchEntity.play_ms: func.coalesce(GamingMatchEntity.play_ms, 0) + int(play_ms_delta)},
                synchronize_session=False)
            session.commit()
            return bool(count)

    def claim(self, match_uuid: str, old_version: str, new_version: str, play_ms_delta: int) -> bool:
        with self.session_factory() as session:
            count = session.query(GamingMatchEntity).filter(
                GamingMatchEntity.uuid == match_uuid, GamingMatchEntity.ts_update == old_version).update(
                {GamingMatchEntity.ts_update: new_version,
                 GamingMatchEntity.play_ms: func.coalesce(GamingMatchEntity.play_ms, 0) + int(play_ms_delta)},
                synchronize_session=False)
            session.commit()
            return count == 1
