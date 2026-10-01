"""v0.41.4 — SQLAlchemy adapter of MatchExportStorePort. Mirrors ``MatchExportStoreAdapter.java``: logs up
to a mark, users without secrets, existence checks and one session/one commit for the whole import."""
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy import delete, func, insert, select, update

from app.adapters.persistence.auth.models import Base, User
from app.adapters.persistence.match.log_ids import next_log_id
from app.adapters.persistence.match.match_log_writer_adapter import LOG_ENTITIES
from app.adapters.persistence.match.snapshot_store_adapter import plain
from app.core.ports.match.match_export_ports import ImportRows, MatchExportStorePort

# Child tables whose rows carry a per-match id (1…n) and a fresh uuid.
PER_MATCH_ID = ("gaming_character_traits", "gaming_inventory_items", "gaming_state_registry",
                "gaming_story_progress")
# Every python table holding rows of a match, in a delete order the foreign keys accept.
DELETE_ORDER = ("log_events", "log_movements", "log_item_usage", "log_weather", "log_clock_history",
                "log_choices_executed", "gaming_turn_queue", "gaming_story_progress", "gaming_state_registry",
                "gaming_state_locations", "gaming_character_traits", "gaming_inventory_items",
                "gaming_backpack_resources", "system_snapshot")
_USER_COLUMNS = ("id", "uuid", "username", "nickname", "language", "state", "role", "email_address")
_LOG_BY_TABLE = {e.__tablename__: e for e in LOG_ENTITIES}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _table(name):
    return Base.metadata.tables[name]


def safe_user(row) -> Dict[str, Any]:
    """Only the columns the export may carry: never a token (python keeps no password)."""
    return {c: row.get(c) for c in _USER_COLUMNS if c in row}


class MatchExportStoreAdapter(MatchExportStorePort):

    def __init__(self, session_factory) -> None:
        self.session_factory = session_factory

    def dialect(self) -> str:
        with self.session_factory() as session:
            return "postgresql" if session.get_bind().dialect.name == "postgresql" else "sqlite"

    def log_rows(self, id_match: int, table: str, mark: int) -> List[Dict[str, Any]]:
        t = _table(table)
        with self.session_factory() as session:
            rows = session.execute(select(t).where(t.c.id_match == id_match, t.c.id <= int(mark or 0))
                                   .order_by(t.c.id)).all()
        return [{str(k): plain(v) for k, v in r._mapping.items()} for r in rows]

    def _users(self, where) -> List[Dict[str, Any]]:
        users = User.__table__
        with self.session_factory() as session:
            rows = session.execute(select(users).where(where)).all()
        return [safe_user({str(k): plain(v) for k, v in r._mapping.items()}) for r in rows]

    def users_by_ids(self, ids: Iterable[int]) -> Dict[int, Dict[str, Any]]:
        ids = [i for i in (ids or []) if i is not None]
        if not ids:
            return {}
        return {int(u["id"]): u for u in self._users(User.__table__.c.id.in_(ids))}

    def user_by_uuid(self, uuid: str) -> Optional[Dict[str, Any]]:
        rows = self._users(User.__table__.c.uuid == uuid)
        return rows[0] if rows else None

    def user_by_email(self, email: Optional[str]) -> Optional[Dict[str, Any]]:
        """v0.41.4 decision 54 — the user with this e-mail, compared case-insensitively."""
        if not email or not str(email).strip():
            return None
        users = User.__table__
        rows = self._users(func.lower(users.c.email_address) == str(email).strip().lower())
        return min(rows, key=lambda u: u["id"]) if rows else None

    def username_taken(self, username: str) -> bool:
        return bool(self._users(User.__table__.c.username == username))

    def story_id_by_uuid(self, story_uuid: str) -> Optional[int]:
        t = _table("list_stories")
        with self.session_factory() as session:
            return session.execute(select(t.c.id).where(t.c.uuid == story_uuid)).scalar()

    def story_uuid_by_id(self, id_story: int) -> Optional[str]:
        t = _table("list_stories")
        with self.session_factory() as session:
            return session.execute(select(t.c.uuid).where(t.c.id == id_story)).scalar()

    def story_location_ids(self, id_story: int) -> List[int]:
        t = _table("list_locations")
        with self.session_factory() as session:
            return [int(r[0]) for r in session.execute(select(t.c.id).where(t.c.id_story == id_story)
                                                       .order_by(t.c.id))]

    def count_matches_of_story(self, id_story: int) -> int:
        t = _table("gaming_match")
        with self.session_factory() as session:
            return int(session.execute(select(func.count()).select_from(t).where(t.c.id_story == id_story))
                       .scalar() or 0)

    def active_matches_of(self, user_uuids, id_story: int, exclude_match_uuid) -> List[Dict[str, Any]]:
        user_uuids = list(user_uuids or [])
        if not user_uuids:
            return []
        m, u = _table("gaming_match"), User.__table__
        with self.session_factory() as session:
            rows = session.execute(
                select(m.c.uuid, m.c.status, u.c.uuid.label("user_uuid")).join(u, u.c.id == m.c.id_user_creator)
                .where(m.c.id_story == id_story, u.c.uuid.in_(user_uuids), m.c.status.in_(("CREATED", "RUNNING")),
                       m.c.uuid != (exclude_match_uuid or "")).order_by(m.c.id)).all()
        return [{"uuid": r.uuid, "status": r.status, "user_uuid": r.user_uuid} for r in rows]

    def match_exists(self, uuid_match: str) -> bool:
        t = _table("gaming_match")
        with self.session_factory() as session:
            return session.execute(select(t.c.id).where(t.c.uuid == uuid_match)).first() is not None

    def match_of_character(self, character_uuid: str) -> Optional[str]:
        c, m = _table("gaming_character_instance"), _table("gaming_match")
        with self.session_factory() as session:
            return session.execute(select(m.c.uuid).join(c, c.c.id_match == m.c.id)
                                   .where(c.c.uuid == character_uuid)).scalar()

    # ── import ────────────────────────────────────────────────────────────────

    @staticmethod
    def _delete_fully(session, uuid_match: str) -> None:
        m = _table("gaming_match")
        id_match = session.execute(select(m.c.id).where(m.c.uuid == uuid_match)).scalar()
        if id_match is None:
            return
        for name in DELETE_ORDER:
            t = Base.metadata.tables.get(name)
            if t is not None and "id_match" in t.c:
                session.execute(delete(t).where(t.c.id_match == id_match))
        session.execute(update(m).where(m.c.id == id_match).values(id_character_current_turn=None))
        chars = _table("gaming_character_instance")
        session.execute(delete(chars).where(chars.c.id_match == id_match))
        session.execute(delete(m).where(m.c.id == id_match))

    @staticmethod
    def _user_id(session, value):
        if not isinstance(value, str):
            return value
        return session.execute(select(User.__table__.c.id).where(User.__table__.c.uuid == value)).scalar()

    @staticmethod
    def _known(table, row: Dict[str, Any]) -> Dict[str, Any]:
        return {k: v for k, v in row.items() if k in table.c}

    def insert_imported(self, rows: ImportRows) -> int:
        with self.session_factory() as session:
            try:
                if rows.replace_uuid:
                    self._delete_fully(session, rows.replace_uuid)
                now = _now()
                for user in rows.new_users:
                    session.execute(insert(User.__table__).values(
                        uuid=user["uuid"], username=user["username"], nickname=user.get("nickname"),
                        language=user.get("language"), state=user.get("state") if user.get("state") is not None else 1,
                        email_address=user.get("email_address"),
                        role="PLAYER", ts_registration=now, last_access=now))
                m = _table("gaming_match")
                match = dict(rows.match)
                match["id_user_creator"] = self._user_id(session, match.get("id_user_creator"))
                session.execute(insert(m).values(**self._known(m, match)))
                id_match = session.execute(select(m.c.id).where(m.c.uuid == match["uuid"])).scalar()
                chars = _table("gaming_character_instance")
                for character in rows.characters:
                    values = dict(character, id_match=id_match)
                    values["id_user"] = self._user_id(session, values.get("id_user"))
                    session.execute(insert(chars).values(**self._known(chars, values)))
                if rows.active_ordinal is not None:
                    session.execute(update(m).where(m.c.id == id_match)
                                    .values(id_character_current_turn=rows.active_ordinal))
                for name, table_rows in rows.child_rows.items():
                    t = _table(name)
                    for n, row in enumerate(table_rows, start=1):
                        values = dict(row, id_match=id_match, uuid=str(uuid_lib.uuid4()))
                        if name in PER_MATCH_ID:
                            values["id"] = n
                        session.execute(insert(t).values(**self._known(t, values)))
                for name, columns in rows.logs:
                    entity = _LOG_BY_TABLE[name]
                    values = dict(columns, id_match=id_match, uuid=str(uuid_lib.uuid4()),
                                  id=next_log_id(session, entity))
                    values.setdefault("ts_update", now)
                    if values.get("ts_insert") is None:
                        values["ts_insert"] = now
                    session.execute(insert(entity.__table__).values(**self._known(entity.__table__, values)))
                    session.flush()
                session.commit()
                return int(id_match)
            except Exception:
                session.rollback()
                raise
