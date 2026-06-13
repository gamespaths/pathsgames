"""Step 24 — SQLAlchemy adapter implementing :class:`TurnCycleStorePort`."""
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.adapters.persistence.auth.models import User
from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity,
    GamingMatchEntity,
    GamingTurnQueueEntity,
)
from app.core.ports.match.turn_ports import TurnCycleStorePort


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_uuid() -> str:
    return str(uuid_lib.uuid4())


class TurnCycleStoreAdapter(TurnCycleStorePort):
    def __init__(self, session_factory):
        self.session_factory = session_factory

    def find_match_by_uuid(self, uuid: str) -> Optional[Dict[str, Any]]:
        if not uuid:
            return None
        with self.session_factory() as session:
            m = session.query(GamingMatchEntity).filter(GamingMatchEntity.uuid == uuid).first()
            if m is None:
                return None
            return {
                "id": m.id,
                "uuid": m.uuid,
                "status": m.status,
                "current_clock": m.current_clock or 0,
                "id_user_creator": m.id_user_creator,
                "id_character_current_turn": m.id_character_current_turn,
            }

    def find_characters_by_match_id(self, id_match: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (
                session.query(GamingCharacterInstanceEntity)
                .filter(GamingCharacterInstanceEntity.id_match == id_match)
                .all()
            )
            return [
                {
                    "id": c.id,
                    "uuid": c.uuid,
                    "id_user": c.id_user,
                    "dexterity": c.dexterity,
                    "intelligence": c.intelligence,
                    "constitution": c.constitution,
                    "life": c.life,
                }
                for c in rows
            ]

    def replace_queue(self, id_match: int, rows: List[Dict[str, Any]]) -> None:
        with self.session_factory() as session:
            session.query(GamingTurnQueueEntity).filter(
                GamingTurnQueueEntity.id_match == id_match
            ).delete()
            now = _now_iso()
            for r in rows:
                session.add(GamingTurnQueueEntity(
                    id_match=id_match,
                    id_character_match=r["id_character_match"],
                    uuid=_new_uuid(),
                    clock=r["clock"],
                    timestamp_start=r.get("timestamp_start"),
                    timestamp_end=r.get("timestamp_end"),
                    pass_counter=r.get("pass_counter", 0),
                    priority=r["priority"],
                    status=r["status"],
                    ts_insert=now,
                    ts_update=now,
                ))
            session.commit()

    def find_queue_by_match_id(self, id_match: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (
                session.query(GamingTurnQueueEntity)
                .filter(GamingTurnQueueEntity.id_match == id_match)
                .order_by(GamingTurnQueueEntity.priority.desc())
                .all()
            )
            return [
                {
                    "id_character_match": r.id_character_match,
                    "uuid": r.uuid,
                    "clock": r.clock,
                    "priority": r.priority,
                    "status": r.status,
                    "pass_counter": r.pass_counter,
                    "timestamp_start": r.timestamp_start,
                    "timestamp_end": r.timestamp_end,
                }
                for r in rows
            ]

    def save_queue_row(self, id_match: int, row: Dict[str, Any]) -> None:
        with self.session_factory() as session:
            entity = (
                session.query(GamingTurnQueueEntity)
                .filter(
                    GamingTurnQueueEntity.id_match == id_match,
                    GamingTurnQueueEntity.id_character_match == row["id_character_match"],
                )
                .first()
            )
            if entity is None:
                return
            entity.status = row["status"]
            entity.pass_counter = row.get("pass_counter", entity.pass_counter)
            entity.timestamp_start = row.get("timestamp_start")
            entity.timestamp_end = row.get("timestamp_end")
            entity.ts_update = _now_iso()
            session.commit()

    def update_match_status_and_turn(self, id_match: int, status: str,
                                     id_character_current_turn: Optional[int]) -> None:
        with self.session_factory() as session:
            m = session.query(GamingMatchEntity).filter(GamingMatchEntity.id == id_match).first()
            if m is None:
                return
            m.status = status
            m.id_character_current_turn = id_character_current_turn
            m.ts_update = _now_iso()
            session.commit()

    def find_user_id_by_uuid(self, user_uuid: str) -> Optional[int]:
        if not user_uuid:
            return None
        with self.session_factory() as session:
            u = session.query(User).filter(User.uuid == user_uuid).first()
            return u.id if u else None
