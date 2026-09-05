"""Step 36 — SQLAlchemy adapter for the registry store port.

The single reader and writer of gaming_state_registry, and the writer of the log_events audit
row every registry change leaves behind.
"""
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.adapters.persistence.match.models import (GamingMatchEntity,
                                                    GamingStateRegistryEntity, LogEventsEntity)
from app.core.ports.match.registry_ports import RegistryStorePort


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_row(r: GamingStateRegistryEntity) -> Dict[str, Any]:
    return {
        "id": r.id,
        "uuid": r.uuid,
        "key": r.key,
        "string_value": r.string_value,
        "int_value": r.int_value,
        "id_character": r.id_character,
        "id_event": r.id_event,
        "id_choice": r.id_choice,
        "clock": r.clock,
        "multi_value": r.multi_value,
    }


class RegistryStoreAdapter(RegistryStorePort):

    def __init__(self, session_factory) -> None:
        self.session_factory = session_factory

    def find_match_and_story_id_by_uuid(self, match_uuid: str) -> Optional[tuple]:
        if not match_uuid or not str(match_uuid).strip():
            return None
        with self.session_factory() as session:
            m = (session.query(GamingMatchEntity)
                 .filter(GamingMatchEntity.uuid == match_uuid).first())
            if m is None or m.id is None or m.id_story is None:
                return None
            return (m.id, m.id_story)

    def find_by_match(self, id_match: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (session.query(GamingStateRegistryEntity)
                    .filter(GamingStateRegistryEntity.id_match == id_match).all())
            return [_to_row(r) for r in rows]

    def find_by_match_and_key(self, id_match: int, key: str) -> List[Dict[str, Any]]:
        if key is None:
            return []
        with self.session_factory() as session:
            rows = (session.query(GamingStateRegistryEntity)
                    .filter(GamingStateRegistryEntity.id_match == id_match,
                            GamingStateRegistryEntity.key == key).all())
            return [_to_row(r) for r in rows]

    def upsert(self, id_match: int, key: str, string_value: Optional[str],
               int_value: Optional[int], id_character: Optional[int],
               id_event: Optional[int], id_choice: Optional[int],
               clock: Optional[int]) -> None:
        with self.session_factory() as session:
            row = (session.query(GamingStateRegistryEntity)
                   .filter(GamingStateRegistryEntity.id_match == id_match,
                           GamingStateRegistryEntity.key == key).first())
            now = _now_iso()
            if row is None:
                row = GamingStateRegistryEntity(
                    id=self._next_id(session, id_match), id_match=id_match,
                    uuid=str(uuid_lib.uuid4()), key=key, multi_value=0,
                    ts_insert=now, ts_update=now)
                session.add(row)
            row.string_value = string_value
            row.int_value = int_value
            row.id_character = id_character
            row.id_event = id_event
            row.id_choice = id_choice
            row.clock = clock
            row.ts_update = now
            session.commit()

    def insert_value(self, id_match: int, key: str, string_value: Optional[str],
                     int_value: Optional[int], id_character: Optional[int],
                     id_event: Optional[int], id_choice: Optional[int],
                     clock: Optional[int]) -> None:
        with self.session_factory() as session:
            now = _now_iso()
            session.add(GamingStateRegistryEntity(
                id=self._next_id(session, id_match), id_match=id_match,
                uuid=str(uuid_lib.uuid4()), key=key, multi_value=1,
                string_value=string_value, int_value=int_value,
                id_character=id_character, id_event=id_event, id_choice=id_choice,
                clock=clock, ts_insert=now, ts_update=now))
            session.commit()

    def delete_value(self, id_match: int, key: str, string_value: Optional[str],
                     int_value: Optional[int]) -> None:
        with self.session_factory() as session:
            row = (session.query(GamingStateRegistryEntity)
                   .filter(GamingStateRegistryEntity.id_match == id_match,
                           GamingStateRegistryEntity.key == key,
                           GamingStateRegistryEntity.string_value == string_value,
                           GamingStateRegistryEntity.int_value == int_value).first())
            if row is not None:
                session.delete(row)
                session.commit()

    def insert_all(self, id_match: int, rows: List[Dict[str, Any]]) -> None:
        if not rows:
            return
        with self.session_factory() as session:
            now = _now_iso()
            for index, r in enumerate(rows, start=1):
                session.add(GamingStateRegistryEntity(
                    id=index, id_match=id_match, uuid=str(uuid_lib.uuid4()),
                    key=r.get("key"), string_value=r.get("string_value"),
                    int_value=r.get("int_value"), multi_value=r.get("multi_value") or 0,
                    ts_insert=now, ts_update=now))
            session.commit()

    def delete_by_match_ids(self, match_ids: List[int]) -> None:
        if not match_ids:
            return
        with self.session_factory() as session:
            (session.query(GamingStateRegistryEntity)
             .filter(GamingStateRegistryEntity.id_match.in_(match_ids))
             .delete(synchronize_session=False))
            session.commit()

    def log_change(self, id_match: int, id_character: Optional[int], id_event: Optional[int],
                   id_choice: Optional[int], clock: Optional[int], message: str) -> None:
        with self.session_factory() as session:
            rows = session.query(LogEventsEntity.id).all()
            ids = [r[0] for r in rows if r[0] is not None]
            now = _now_iso()
            session.add(LogEventsEntity(
                id=(max(ids) if ids else 0) + 1, id_match=id_match,
                uuid=str(uuid_lib.uuid4()), id_character_match=id_character,
                timestamp=now, id_event=id_event, id_choise=id_choice,
                log_message=message, clock=clock, ts_insert=now, ts_update=now))
            session.commit()

    def _next_id(self, session, id_match: int) -> int:
        rows = (session.query(GamingStateRegistryEntity.id)
                .filter(GamingStateRegistryEntity.id_match == id_match).all())
        ids = [r[0] for r in rows if r[0] is not None]
        return (max(ids) if ids else 0) + 1
