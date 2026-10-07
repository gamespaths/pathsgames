"""v0.41.4 Step 41 H.6 — the match export: pause, latest time-end snapshot, neutral file, restore, EXPORTED
row, resume (decisions 45, 58). Mirrors ``MatchExportService.java``."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.models.match import match_statuses
from app.core.ports.match import log_writer_ports as lw
from app.core.ports.match import match_export_ports as mp
from app.core.ports.match.match_export_ports import ExportResult, Issue, MatchExportError
from app.core.services.match import canonical_json, neutral_codec as nc
from app.core.services.match.snapshot_service import apply_owner, log_marks_of, parse, state_of
from app.core.services.story import story_fingerprint

BACKEND = "python"
MATCH_TABLE = "gaming_match"
CHARACTER_TABLE = "gaming_character_instance"


def _now_iso() -> str:
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


def title(data: Dict[str, Any]) -> Optional[str]:
    """The English (else the first) short text of the story's idTextTitle."""
    wanted = nc.lng(data.get("idTextTitle"))
    fallback = None
    for t in nc.items(data.get("texts")):
        if wanted is not None and nc.lng(t.get("idText")) == wanted:
            value = t.get("shortText") if t.get("shortText") is not None else t.get("longText")
            if t.get("lang") == "en":
                return value
            fallback = fallback if fallback is not None else value
    return fallback


def id_by_uuid(story: Dict[str, Any], key: str) -> Dict[str, int]:
    return {r["uuid"]: nc.lng(r.get("id")) for r in nc.items(story.get(key))
            if isinstance(r, dict) and r.get("uuid") is not None and nc.lng(r.get("id")) is not None}


def engine(characters: List[Dict[str, Any]], logs: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
    """H.2.4 export: markers counted like count_log_markers, visited like find_visited_location_ids."""
    markers: Dict[int, List[int]] = {}
    for row in logs.get(nc.LOG_EVENTS, []):
        msg, event = row.get("log_message"), nc.lng(row.get("id_event"))
        if msg is None or event is None:
            continue
        if msg.startswith("EVENT_EXECUTED"):
            markers.setdefault(event, [0, 0])[0] += 1
        elif msg.startswith("CHOICE_SELECTED"):
            markers.setdefault(event, [0, 0])[1] += 1
    visited: List[int] = []
    sources = [c.get("id_location") for c in characters]
    for row in logs.get(nc.LOG_MOVEMENTS, []):
        sources += [row.get("id_location_from"), row.get("id_location_to")]
    for value in sources:
        loc = nc.positive(value)
        if loc is not None and loc not in visited:
            visited.append(loc)
    return {"eventMarkers": [{"eventId": e, "executed": c[0], "selected": c[1]} for e, c in sorted(markers.items())],
            "visitedLocationIds": visited}


class MatchExportService:

    def __init__(self, snapshot_store, snapshot_service, store, story_export, importer, app_version: str,
                 server: str, max_bytes: int) -> None:
        self.snapshots = snapshot_store
        self.snapshot_service = snapshot_service
        self.store = store
        self.story_export = story_export
        self.importer = importer
        self.app_version = app_version
        self.server = server
        self.max_bytes = int(max_bytes)
        self.log_writer = None
        self.match_commands = None

    def check(self, request):
        return self.importer.check(request)

    def import_match(self, request):
        return self.importer.import_match(request)

    def export_match(self, uuid_match: str) -> ExportResult:
        match = self.snapshots.find_match_by_uuid(uuid_match)
        if match is None:
            raise MatchExportError("MATCH_NOT_FOUND", f"Match not found: {uuid_match}")
        rows = self.snapshots.list(match["id"])
        if match.get("status") == match_statuses.CREATED or not rows:
            raise MatchExportError("NO_SNAPSHOT", "The match has no time-end snapshot to export")
        latest = rows[0]
        original = match.get("status")
        running = original == match_statuses.RUNNING
        terminal = match_statuses.is_terminal(original)
        if running:
            self.snapshots.set_status(match["id"], match_statuses.PAUSED)
        try:
            check = self.snapshot_service.check(uuid_match, latest["uuid"])
            if not check.valid:
                raise MatchExportError("SNAPSHOT_INTEGRITY_FAILED", "The snapshot failed its integrity check",
                                       [Issue(e.code, e.message) for e in check.errors])
            full = self.snapshots.find(match["id"], latest["uuid"])
            if full is None:
                raise MatchExportError("NO_SNAPSHOT", "The snapshot disappeared during the export")
            document = self.build(match, full)
            text = canonical_json.write(document)
            if len(text.encode("utf-8")) > self.max_bytes:
                raise MatchExportError("EXPORT_TOO_LARGE", f"The export is larger than {self.max_bytes} bytes")
        except Exception:
            if running:
                self.snapshots.set_status(match["id"], original)
            raise
        clock = int(latest.get("clock") or 0)
        if not terminal:
            self.snapshot_service.restore(uuid_match, latest["uuid"])
            if self.log_writer is not None:
                after = self.snapshots.find_match_by_id(match["id"]) or {}
                self.log_writer.write(match["id"], None, None, int(after.get("current_clock") or clock),
                                      lw.exported(clock))
            if running and self.match_commands is not None:
                self.match_commands.update_match(uuid_match, match_statuses.RUNNING, None, lw.ADMIN_RESUME)
        return ExportResult(document, text, f"match-{uuid_match[:8]}-clock-{clock}.json")

    def build(self, match: Dict[str, Any], snapshot: Dict[str, Any]) -> Dict[str, Any]:
        """The neutral document of one snapshot: payload state, logs up to its marks, users, story, engine."""
        payload = parse(snapshot.get("payload"))
        creator = match.get("id_user_creator")
        state = apply_owner(state_of(payload), creator,
                            self.snapshots.character_users(match["id"]) if creator is not None else {})
        marks = log_marks_of(payload)
        match_row = (state.get(MATCH_TABLE) or [{}])[0]
        characters = sorted(state.get(CHARACTER_TABLE, []), key=lambda c: nc.nz(nc.lng(c.get("id"))))
        story_uuid = self.store.story_uuid_by_id(match["id_story"])
        story = (self.story_export.export_story(story_uuid) if story_uuid else None) or {}
        user_ids: List[int] = []
        for value in [match_row.get("id_user_creator")] + [c.get("id_user") for c in characters]:
            uid = nc.lng(value)
            if uid is not None and uid not in user_ids:
                user_ids.append(uid)
        users = self.store.users_by_ids(user_ids)
        lookup = nc.Lookup({i: u["uuid"] for i, u in users.items()},
                           {nc.lng(c.get("id")): c.get("uuid") for c in characters},
                           id_by_uuid(story, "characterTemplates"), id_by_uuid(story, "classes"),
                           id_by_uuid(story, "traits"))
        party = nc.lng(characters[0].get("id_location")) if characters else None
        logs = {t: self.store.log_rows(match["id"], t, marks.get(t, 0)) for t in nc.TIMELINE_TABLES}
        choices = self.store.log_rows(match["id"], nc.LOG_CHOICES_EXECUTED, marks.get(nc.LOG_CHOICES_EXECUTED, 0))
        document = {
            "format": mp.FORMAT, "formatVersion": mp.FORMAT_VERSION,
            "source": {"backend": BACKEND, "dialect": self.store.dialect(), "appVersion": self.app_version,
                       "server": self.server, "exportedAt": _now_iso(), "snapshotUuid": snapshot.get("uuid"),
                       "snapshotClock": int(snapshot.get("clock") or 0)},
            "story": {"uuid": story_uuid, "title": title(story), "fingerprint": story_fingerprint.of(story),
                      "data": story},
            "users": [nc.user(users[i]) for i in user_ids if i in users],
            "match": nc.match(match_row, lookup, party, match["id_story"]),
            "characters": [self._character(state, c, lookup) for c in characters],
            "state": self._state(state, lookup, choices, nc.lng(story.get("idLocationStart"))),
            "engine": engine(characters, logs),
            "logs": nc.logs(logs, lookup),
        }
        document["checksum"] = canonical_json.sha256(document)
        return document

    @staticmethod
    def _rows_of(state, table, ordinal):
        rows = [r for r in state.get(table, []) if nc.lng(r.get("id_character_match")) == ordinal]
        return sorted(rows, key=lambda r: nc.nz(nc.lng(r.get("id"))))

    def _character(self, state, c, lookup):
        ordinal = nc.lng(c.get("id"))
        resources = next(iter(self._rows_of(state, "gaming_backpack_resources", ordinal)), None)
        return nc.character(c, lookup, resources, self._rows_of(state, "gaming_character_traits", ordinal),
                            self._rows_of(state, "gaming_inventory_items", ordinal))

    @staticmethod
    def _state(state, lookup, choices, start_location):
        by_id = lambda rows: sorted(rows or [], key=lambda r: nc.nz(nc.lng(r.get("id"))))  # noqa: E731
        locations = sorted(state.get("gaming_state_locations", []), key=lambda r: nc.nz(nc.lng(r.get("id_location"))))
        turns = sorted(state.get("gaming_turn_queue", []), key=lambda r: nc.nz(nc.lng(r.get("id_character_match"))))
        return {
            "registry": [nc.registry(r, lookup) for r in by_id(state.get("gaming_state_registry"))],
            "locations": [nc.location(r) for r in locations if nc.is_non_default_location(r, start_location)],
            "turns": [nc.turn(t, lookup) for t in turns],
            "storyProgress": [nc.progress(p) for p in by_id(state.get("gaming_story_progress"))],
            "choiceHistory": [nc.choice_row(c) for c in choices],
        }
