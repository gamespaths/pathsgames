"""v0.41.1 Step 41 B — a LIGHT snapshot at every time-end (canonical JSON, SHA-256), the last N kept;
admin list, check and restore (log cut, time-start, PAUSED). Mirrors ``SnapshotService.java``."""
import hashlib
import json
import logging
from typing import Any, Dict, List, Optional

from app.core.models.match import match_statuses
from app.core.ports.match import log_writer_ports as lw
from app.core.ports.match import snapshot_ports as sp
from app.core.ports.match.snapshot_ports import (
    CheckError, RestoreResult, SnapshotCheck, SnapshotError, SnapshotPort, SnapshotStorePort,
    SnapshotSummary,
)

logger = logging.getLogger(__name__)

PAYLOAD_VERSION = 1
MATCH_TABLE = "gaming_match"
CHARACTER_TABLE = "gaming_character_instance"

# A story id a state row points at: (state table, column) read in (story table, column, label).
STORY_REFS = (
    (MATCH_TABLE, "id_current_weather", "list_weather_rules", "id", "weather"),
    (CHARACTER_TABLE, "id_location", "list_locations", "id", "location"),
    (CHARACTER_TABLE, "id_class", "list_classes", "id", "class"),
    (CHARACTER_TABLE, "id_character_template", "list_character_templates", "id_tipo", "template"),
    ("gaming_inventory_items", "id_item", "list_items", "id", "item"),
    ("gaming_character_traits", "id_traits", "list_traits", "id", "trait"),
    ("gaming_character_traits", "id_event", "list_events", "id", "event"),
    ("gaming_state_registry", "id_event", "list_events", "id", "event"),
    ("gaming_state_registry", "id_choice", "list_choices", "id", "choice"),
    ("gaming_state_registry", "id_mission", "list_missions", "id", "mission"),
    ("gaming_state_locations", "id_location", "list_locations", "id", "location"),
    ("gaming_active_choices", "id_event", "list_events", "id", "event"),
    ("gaming_active_choices", "id_choise", "list_choices", "id", "choice"),
    ("gaming_story_progress", "id_event", "list_events", "id", "event"),
    ("gaming_story_progress", "id_choise", "list_choices", "id", "choice"),
)


def canonical(payload: Dict[str, Any]) -> str:
    """Keys sorted, no whitespace: the text the checksum is taken on."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def parse(raw) -> Optional[Dict[str, Any]]:
    """The payload as a dict (PostgreSQL JSONB may already hand one back); None when unreadable."""
    if isinstance(raw, dict):
        return raw
    if not raw or not str(raw).strip():
        return None
    try:
        value = json.loads(raw)
    except (TypeError, ValueError):
        return None
    return value if isinstance(value, dict) else None


def as_int(value) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str) and value.strip():
        try:
            return int(value.strip())
        except ValueError:
            return None
    return None


def state_of(payload: Optional[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """The state tables of a payload; anything not shaped as table -> list of rows is skipped."""
    tables = (payload or {}).get("state")
    out: Dict[str, List[Dict[str, Any]]] = {}
    if not isinstance(tables, dict):
        return out
    for name, rows in tables.items():
        if isinstance(rows, list):
            out[str(name)] = [r for r in rows if isinstance(r, dict)]
    return out


def log_marks_of(payload: Optional[Dict[str, Any]]) -> Dict[str, int]:
    marks = (payload or {}).get("logMarks")
    out: Dict[str, int] = {}
    if isinstance(marks, dict):
        for table, mark in marks.items():
            value = as_int(mark)
            if value is not None:
                out[str(table)] = value
    return out


class SnapshotService(SnapshotPort):

    def __init__(self, store: SnapshotStorePort, keep_per_match: int = 10) -> None:
        self.store = store
        self.keep_per_match = int(keep_per_match or 0)
        self.time_service = None
        self.log_writer = None

    def set_time_service(self, time_service) -> None:
        """The engine that runs the time-start after a restore; set once at wiring time (a cycle)."""
        self.time_service = time_service

    def set_log_writer(self, log_writer) -> None:
        self.log_writer = log_writer

    # ── time-end ──────────────────────────────────────────────────────────────

    def write_at_time_end(self, id_match: int) -> None:
        """Best effort: a snapshot that cannot be written is a WARN line, never a failed time-end."""
        if self.keep_per_match <= 0:
            return
        try:
            match = self.store.find_match_by_id(id_match)
            if match is not None:
                self._write(match)
        except Exception as exc:  # noqa: BLE001 — never break the time-end
            logger.warning("SNAPSHOT match %s not written: %s", id_match, exc)

    def _write(self, match: Dict[str, Any]) -> None:
        clock = int(match.get("current_clock") or 0)
        payload = {
            "v": PAYLOAD_VERSION,
            "matchUuid": match["uuid"],
            "idStory": match["id_story"],
            "clock": clock,
            "state": self.store.read_state(match["id"]),
            "logMarks": self.store.log_marks(match["id"]),
        }
        text = canonical(payload)
        self.store.insert(match["id"], match["id_story"], clock, sp.TYPE_LIGHT, text, sha256(text),
                          f"Time-end of clock {clock}")
        self.store.prune(match["id"], self.keep_per_match)

    # ── admin ─────────────────────────────────────────────────────────────────

    def list(self, uuid_match: str) -> List[SnapshotSummary]:
        match = self._require_match(uuid_match)
        return [SnapshotSummary(r["uuid"], int(r.get("clock") or 0), r.get("type"), r.get("timestamp"),
                                r.get("description"), int(r.get("size_bytes") or 0))
                for r in self.store.list(match["id"])]

    def check(self, uuid_match: str, uuid_snapshot: str) -> SnapshotCheck:
        match = self._require_match(uuid_match)
        errors = self.verify(match, self._require_snapshot(match, uuid_snapshot))
        return SnapshotCheck(not errors, errors)

    def restore(self, uuid_match: str, uuid_snapshot: str) -> RestoreResult:
        match = self._require_match(uuid_match)
        snapshot = self._require_snapshot(match, uuid_snapshot)
        errors = self.verify(match, snapshot)
        if errors:
            raise SnapshotError(sp.SNAPSHOT_INTEGRITY_FAILED, "The snapshot failed its integrity check",
                                errors)
        payload = parse(snapshot.get("payload"))
        removed = self.store.restore(match["id"], snapshot["id"], state_of(payload),
                                     log_marks_of(payload))
        clock = int(snapshot.get("clock") or 0)
        if self.log_writer is not None:
            self.log_writer.write(match["id"], None, None, clock, lw.snapshot_restored(clock))
        # Decision 18: the time-start at once (clock N+1, weather and random event again), then PAUSED.
        if self.time_service is not None:
            self.time_service.start_time_after_restore(match["uuid"])
        self.store.set_status(match["id"], match_statuses.PAUSED)
        return RestoreResult(sp.STATUS_RESTORED, snapshot["uuid"], clock, match_statuses.PAUSED,
                             int(removed or 0))

    # ── check ─────────────────────────────────────────────────────────────────

    def verify(self, match: Dict[str, Any], snapshot: Dict[str, Any]) -> List[CheckError]:
        errors: List[CheckError] = []
        payload = parse(snapshot.get("payload"))
        if payload is None:
            return [CheckError(sp.CHECKSUM_MISMATCH, "The payload is not readable JSON")]
        if sha256(canonical(payload)) != snapshot.get("checksum"):
            errors.append(CheckError(sp.CHECKSUM_MISMATCH, "The payload does not match its checksum"))
        if as_int(payload.get("v")) != PAYLOAD_VERSION:
            errors.append(CheckError(sp.VERSION_UNKNOWN, f"Unknown payload version: {payload.get('v')}"))
            return errors
        if payload.get("matchUuid") != match["uuid"] or as_int(payload.get("idStory")) != match["id_story"]:
            errors.append(CheckError(sp.MATCH_MISMATCH, "The snapshot belongs to another match or story"))
        state = state_of(payload)
        errors.extend(self._missing_story_entities(match["id_story"], state))
        errors.extend(self._missing_users(state))
        return errors

    def _missing_story_entities(self, id_story: int, state) -> List[CheckError]:
        wanted: Dict[tuple, set] = {}
        for table, column, story_table, story_column, label in STORY_REFS:
            for row in state.get(table, []):
                value = as_int(row.get(column))
                if value is not None and value > 0:
                    wanted.setdefault((story_table, story_column, label), set()).add(value)
        errors: List[CheckError] = []
        for (story_table, story_column, label), ids in wanted.items():
            found = self.store.existing_story_ids(story_table, story_column, id_story, sorted(ids))
            errors.extend(CheckError(sp.STORY_ENTITY_MISSING, f"{label} {i} is no longer in the story")
                          for i in sorted(ids) if i not in found)
        return errors

    def _missing_users(self, state) -> List[CheckError]:
        ids = set()
        for row in state.get(MATCH_TABLE, []):
            ids.add(as_int(row.get("id_user_creator")))
        for row in state.get(CHARACTER_TABLE, []):
            ids.add(as_int(row.get("id_user")))
        ids = sorted(i for i in ids if i is not None and i > 0)
        if not ids:
            return []
        found = self.store.existing_user_ids(ids)
        return [CheckError(sp.USER_MISSING, f"user {i} no longer exists") for i in ids if i not in found]

    def _require_match(self, uuid_match: str) -> Dict[str, Any]:
        match = self.store.find_match_by_uuid(uuid_match)
        if match is None:
            raise SnapshotError(sp.MATCH_NOT_FOUND, f"Match not found: {uuid_match}")
        return match

    def _require_snapshot(self, match: Dict[str, Any], uuid_snapshot: str) -> Dict[str, Any]:
        snapshot = self.store.find(match["id"], uuid_snapshot)
        if snapshot is None:
            raise SnapshotError(sp.SNAPSHOT_NOT_FOUND, f"Snapshot not found: {uuid_snapshot}")
        return snapshot
