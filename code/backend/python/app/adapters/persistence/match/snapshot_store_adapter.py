"""v0.41.1 — SQLAlchemy adapter of SnapshotStorePort. Mirrors ``SnapshotStoreAdapter.java``: every
model column of the state tables copied as it is; a restore is one session and one commit."""
import re
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Set

from sqlalchemy import delete, func, insert, select, update

from app.adapters.persistence.auth.models import Base, User
from app.adapters.persistence.match.match_log_writer_adapter import LOG_ENTITIES
from app.adapters.persistence.match.models import (
    GamingBackpackResourcesEntity, GamingCharacterInstanceEntity, GamingCharacterTraitsEntity,
    GamingInventoryItemsEntity, GamingMatchEntity, GamingStateLocationEntity, GamingStateRegistryEntity,
    GamingStoryProgressEntity, GamingTurnQueueEntity, SystemSnapshotEntity,
)
from app.core.ports.match.snapshot_ports import SnapshotStorePort

MATCH = GamingMatchEntity.__table__
CHARACTERS = GamingCharacterInstanceEntity.__table__
SNAPSHOTS = SystemSnapshotEntity.__table__
# Child rows replaced by a restore (Python has no gaming_active_choices table).
CHILD_TABLES = tuple(e.__table__ for e in (
    GamingTurnQueueEntity, GamingStoryProgressEntity, GamingStateRegistryEntity,
    GamingStateLocationEntity, GamingCharacterTraitsEntity, GamingInventoryItemsEntity,
    GamingBackpackResourcesEntity))
# The match columns a restore writes back: story, creator, loadout, seed and name never change.
MATCH_COLUMNS = ("status", "current_clock", "id_current_weather", "id_character_current_turn",
                 "counter_consecutive_pass", "timestamp_end", "timestamp_gameover",
                 "timestamp_lock_expiration")
_IDENTIFIER = re.compile(r"[a-z_][a-z0-9_]*")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def plain(value):
    """Numbers, strings and booleans as they are; any driver type as its text."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    return str(value)


def _as_int(value) -> Optional[int]:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


class SnapshotStoreAdapter(SnapshotStorePort):

    def __init__(self, session_factory) -> None:
        self.session_factory = session_factory

    # ── match ─────────────────────────────────────────────────────────────────

    def find_match_by_uuid(self, uuid_match: str) -> Optional[Dict[str, Any]]:
        return self._match(MATCH.c.uuid == uuid_match)

    def find_match_by_id(self, id_match: int) -> Optional[Dict[str, Any]]:
        return self._match(MATCH.c.id == id_match)

    def _match(self, where) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            row = session.execute(select(MATCH.c.id, MATCH.c.uuid, MATCH.c.id_story, MATCH.c.status,
                                         MATCH.c.current_clock).where(where)).first()
        if row is None:
            return None
        return {"id": row.id, "uuid": row.uuid, "id_story": row.id_story, "status": row.status,
                "current_clock": row.current_clock or 0}

    def read_state(self, id_match: int) -> Dict[str, List[Dict[str, Any]]]:
        with self.session_factory() as session:
            state = {MATCH.name: self._rows(session, MATCH, MATCH.c.id == id_match),
                     CHARACTERS.name: self._rows(session, CHARACTERS, CHARACTERS.c.id_match == id_match,
                                                 CHARACTERS.c.id)}
            for table in CHILD_TABLES:
                state[table.name] = self._rows(session, table, table.c.id_match == id_match, table.c.uuid)
        return state

    @staticmethod
    def _rows(session, table, where, order=None) -> List[Dict[str, Any]]:
        stmt = select(table).where(where)
        if order is not None:
            stmt = stmt.order_by(order)
        return [{str(k): plain(v) for k, v in row._mapping.items()} for row in session.execute(stmt)]

    def log_marks(self, id_match: int) -> Dict[str, int]:
        with self.session_factory() as session:
            return {e.__tablename__: int(session.query(func.coalesce(func.max(e.id), 0))
                                         .filter(e.id_match == id_match).scalar() or 0)
                    for e in LOG_ENTITIES}

    # ── snapshot rows ─────────────────────────────────────────────────────────

    def insert(self, id_match: int, id_story: int, clock: int, type_: str, payload: str,
               checksum: str, description: str) -> None:
        now = _now()
        with self.session_factory() as session:
            session.add(SystemSnapshotEntity(
                uuid=str(uuid_lib.uuid4()), id_story=id_story, id_match=id_match, timestamp=now,
                type=type_, jsonb_data=payload, description=description, clock=clock,
                checksum=checksum, ts_insert=now, ts_update=now))
            session.commit()

    def list(self, id_match: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = session.execute(select(SNAPSHOTS).where(SNAPSHOTS.c.id_match == id_match)
                                   .order_by(SNAPSHOTS.c.id.desc())).all()
        return [self._stored(r, False) for r in rows]

    def find(self, id_match: int, uuid_snapshot: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            row = session.execute(select(SNAPSHOTS).where(SNAPSHOTS.c.id_match == id_match,
                                                          SNAPSHOTS.c.uuid == uuid_snapshot)).first()
        return None if row is None else self._stored(row, True)

    @staticmethod
    def _stored(row, with_payload: bool) -> Dict[str, Any]:
        payload = row.jsonb_data
        text = payload if isinstance(payload, str) else ("" if payload is None else str(payload))
        return {"id": row.id, "uuid": row.uuid, "clock": row.clock or 0, "type": row.type,
                "timestamp": row.ts_insert, "description": row.description,
                "size_bytes": len(text.encode("utf-8")), "checksum": row.checksum,
                "payload": payload if with_payload else None}

    def prune(self, id_match: int, keep: int) -> int:
        with self.session_factory() as session:
            kept = [r[0] for r in session.execute(
                select(SNAPSHOTS.c.id).where(SNAPSHOTS.c.id_match == id_match)
                .order_by(SNAPSHOTS.c.id.desc()).limit(int(keep)))]
            result = session.execute(delete(SNAPSHOTS).where(SNAPSHOTS.c.id_match == id_match,
                                                             SNAPSHOTS.c.id.notin_(kept)))
            session.commit()
            return int(result.rowcount or 0)

    # ── check ─────────────────────────────────────────────────────────────────

    def existing_story_ids(self, table: str, column: str, id_story: int,
                           ids: Iterable[int]) -> Set[int]:
        ids = list(ids or [])
        if not ids:
            return set()
        for name in (table, column):
            if not name or not _IDENTIFIER.fullmatch(name):
                raise ValueError(f"Not a plain identifier: {name}")
        target = Base.metadata.tables.get(table)
        if target is None or column not in target.c or "id_story" not in target.c:
            return set()
        with self.session_factory() as session:
            return {int(r[0]) for r in session.execute(
                select(target.c[column]).where(target.c.id_story == id_story, target.c[column].in_(ids)))}

    def existing_user_ids(self, ids: Iterable[int]) -> Set[int]:
        ids = list(ids or [])
        if not ids:
            return set()
        with self.session_factory() as session:
            return {int(r[0]) for r in session.execute(select(User.id).where(User.id.in_(ids)))}

    # ── restore ───────────────────────────────────────────────────────────────

    def restore(self, id_match: int, id_snapshot: int, state: Dict[str, List[Dict[str, Any]]],
                log_marks: Dict[str, int]) -> int:
        with self.session_factory() as session:
            removed = 0
            for entity in LOG_ENTITIES:
                mark = int(log_marks.get(entity.__tablename__, 0) or 0)
                removed += int(session.execute(delete(entity.__table__).where(
                    entity.__table__.c.id_match == id_match, entity.__table__.c.id > mark)).rowcount or 0)
            for table in CHILD_TABLES:
                session.execute(delete(table).where(table.c.id_match == id_match))
            # Characters in place: their ids are the FK targets of the log rows that stay.
            current = {r[0] for r in session.execute(
                select(CHARACTERS.c.id).where(CHARACTERS.c.id_match == id_match))}
            kept = set()
            for row in state.get(CHARACTERS.name, []):
                id_char = _as_int(row.get("id"))
                if id_char is None:
                    continue
                kept.add(id_char)
                values = self._known(CHARACTERS, row, id_match)
                if id_char in current:
                    values.pop("id", None)
                    values.pop("id_match", None)
                    session.execute(update(CHARACTERS).where(CHARACTERS.c.id == id_char,
                                                             CHARACTERS.c.id_match == id_match)
                                    .values(**values))
                else:
                    session.execute(insert(CHARACTERS).values(**values))
            self._restore_match_row(session, id_match, state.get(MATCH.name, []))
            for id_char in current - kept:
                session.execute(delete(CHARACTERS).where(CHARACTERS.c.id_match == id_match,
                                                         CHARACTERS.c.id == id_char))
            for table in CHILD_TABLES:
                for row in state.get(table.name, []):
                    session.execute(insert(table).values(**self._known(table, row, id_match)))
            session.execute(delete(SNAPSHOTS).where(SNAPSHOTS.c.id_match == id_match,
                                                    SNAPSHOTS.c.id > id_snapshot))
            session.commit()
            return removed

    @staticmethod
    def _known(table, row: Dict[str, Any], id_match: int) -> Dict[str, Any]:
        """The row's columns the table knows, pinned to this match whatever the payload says."""
        values = {k: v for k, v in row.items() if k in table.c}
        values["id_match"] = id_match
        return values

    @staticmethod
    def _restore_match_row(session, id_match: int, rows: List[Dict[str, Any]]) -> None:
        if not rows:
            return
        values = {c: rows[0][c] for c in MATCH_COLUMNS if c in rows[0] and c in MATCH.c}
        values["ts_update"] = _now()
        session.execute(update(MATCH).where(MATCH.c.id == id_match).values(**values))

    def set_status(self, id_match: int, status: str) -> None:
        with self.session_factory() as session:
            session.execute(update(MATCH).where(MATCH.c.id == id_match)
                            .values(status=status, ts_update=_now()))
            session.commit()
