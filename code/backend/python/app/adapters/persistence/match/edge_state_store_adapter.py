"""Step 30 — edge-state persistence. Mirrors ``EdgeStateStoreAdapter.java``.

Shared by the services that can push a character over an edge: event execution and the
time-start recovery.
"""
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Optional

from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity, LogEventsEntity,
)
from app.core.ports.match.edge_state_ports import EdgeStateStorePort


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class EdgeStateStoreAdapter(EdgeStateStorePort):

    def __init__(self, session_factory) -> None:
        self.session_factory = session_factory

    def set_coma(self, id_match: int, id_character: int, clock_in_coma: int) -> None:
        with self.session_factory() as session:
            c = session.query(GamingCharacterInstanceEntity).filter(
                GamingCharacterInstanceEntity.id_match == id_match,
                GamingCharacterInstanceEntity.id == id_character).first()
            if not c:
                return
            c.is_coma = 1
            c.is_sleeping = 1
            c.clock_in_coma = clock_in_coma
            c.ts_update = _now_iso()
            session.commit()

    def set_sleeping(self, id_match: int, id_character: int) -> None:
        with self.session_factory() as session:
            c = session.query(GamingCharacterInstanceEntity).filter(
                GamingCharacterInstanceEntity.id_match == id_match,
                GamingCharacterInstanceEntity.id == id_character).first()
            if not c:
                return
            c.is_sleeping = 1
            c.ts_update = _now_iso()
            session.commit()

    def log_edge_state(self, id_match: int, id_character: Optional[int],
                       id_event: Optional[int], clock: int, message: str) -> None:
        with self.session_factory() as session:
            max_id = session.query(LogEventsEntity.id).order_by(
                LogEventsEntity.id.desc()).first()
            now = _now_iso()
            session.add(LogEventsEntity(
                id=((max_id[0] if max_id else 0) or 0) + 1,
                id_match=id_match, uuid=str(uuid_lib.uuid4()),
                id_character_match=id_character, id_event=id_event, clock=clock,
                log_message=message, timestamp=now, ts_insert=now, ts_update=now))
            session.commit()
