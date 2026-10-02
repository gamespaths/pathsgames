"""v0.41.4 Step 41 H.5 — the dry-run check and the import of a match export v1 (story modes, user copy,
replace, one session, IMPORTED row, imported snapshot, time-start). Mirrors ``MatchImportService.java``."""
import copy
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.models.match import match_statuses
from app.core.ports.match import log_writer_ports as lw
from app.core.ports.match import match_export_ports as mp
from app.core.ports.match.match_export_ports import ImportRows, Issue, MatchExportError
from app.core.services.match import canonical_json, log_type_mapper as ltm, neutral_codec as nc
from app.core.services.match.schema_validator import SchemaValidator
from app.core.services.story import story_fingerprint

BACKEND = "python"
STATUS_ABSENT, STATUS_SAME, STATUS_DIFFERENT = "ABSENT", "SAME", "DIFFERENT"
ACTION_IMPORT, ACTION_USE_EXISTING = "IMPORT", "USE_EXISTING"
USER_NEW, USER_EXISTING, USER_RENAMED, USER_MAPPED = "NEW", "EXISTING", "RENAMED", "MAPPED_BY_EMAIL"
_CONFLICTS = (mp.MATCH_EXISTS, mp.STORY_DIFFERS, mp.CHARACTER_EXISTS)
# Story label and the story list its ids must exist in (H.5 step 3).
STORY_LISTS = {"difficulty": "difficulties", "location": "locations", "template": "characterTemplates",
               "class": "classes", "trait": "traits", "item": "items", "event": "events", "choice": "choices",
               "mission": "missions", "mission step": "missionSteps", "weather": "weatherRules"}
CHILD_TABLES = ("gaming_backpack_resources", "gaming_character_traits", "gaming_inventory_items",
                "gaming_state_registry", "gaming_state_locations", "gaming_turn_queue", "gaming_story_progress")


@dataclass
class UserPlan:
    user: Dict[str, Any]
    status: str
    target_username: str
    target_uuid: Optional[str] = None

    @property
    def created(self) -> bool:
        return self.status in (USER_NEW, USER_RENAMED)


@dataclass
class Analysis:
    doc: Optional[Dict[str, Any]] = None
    errors: List[Issue] = field(default_factory=list)
    warnings: List[Issue] = field(default_factory=list)
    match_exists: bool = False
    story_status: Optional[str] = None
    story_action: Optional[str] = None
    matches_deleted: int = 0
    bundled_story: Dict[str, Any] = field(default_factory=dict)
    users: List[UserPlan] = field(default_factory=list)
    active_matches: List[Dict[str, Any]] = field(default_factory=list)
    reconciliation: Optional[nc.Reconciliation] = None

    @property
    def valid(self) -> bool:
        return not self.errors


def story_for_import(data: Dict[str, Any]) -> Dict[str, Any]:
    """A deep copy of the bundled story without the source server's story id (the target assigns one)."""
    out = canonical_json.drop_nulls(copy.deepcopy(data))
    out.pop("id", None)
    return out


def issues(rows: List[Issue]) -> List[Dict[str, str]]:
    return [{"code": i.code, "message": i.message} for i in rows]


def refusal(errors: List[Issue]) -> MatchExportError:
    """409 with the conflict code when only conflicts are left, 422 IMPORT_INVALID otherwise."""
    if all(e.code in _CONFLICTS for e in errors):
        return MatchExportError(errors[0].code, errors[0].message, errors)
    return MatchExportError("IMPORT_INVALID", "The match export cannot be imported", errors)


def uuid_by_id(story: Dict[str, Any], key: str) -> Dict[int, str]:
    return {nc.lng(r.get("id")): r["uuid"] for r in nc.items(story.get(key))
            if isinstance(r, dict) and nc.lng(r.get("id")) is not None and r.get("uuid") is not None}


class MatchImportService:

    def __init__(self, store, snapshot_store, story_export, story_import, story_validator, app_version: str,
                 max_bytes: int) -> None:
        self.store = store
        self.snapshot_store = snapshot_store
        self.story_export = story_export
        self.story_import = story_import
        self.story_validator = story_validator
        self.app_version = app_version
        self.max_bytes = int(max_bytes)
        self.schema = SchemaValidator.match_export_v1()
        self.snapshot_service = None
        self.time_service = None
        self.log_writer = None
        self.match_commands = None

    def set_engine(self, snapshot_service, time_service, log_writer, match_commands) -> None:
        """The collaborators that already know each other through setters at wiring time."""
        self.snapshot_service = snapshot_service
        self.time_service = time_service
        self.log_writer = log_writer
        self.match_commands = match_commands

    # ── check ─────────────────────────────────────────────────────────────────

    def check(self, request) -> Dict[str, Any]:
        return self._check_body(self.analyze(request))

    def analyze(self, request) -> Analysis:
        a = Analysis()
        export = (request or {}).get("export")
        if not isinstance(export, dict):
            a.errors.append(Issue(mp.SCHEMA_INVALID, "export must be a match export object"))
            return a
        a.doc = export
        if canonical_json.size(export) > self.max_bytes:
            raise MatchExportError("IMPORT_TOO_LARGE", f"The export is larger than {self.max_bytes} bytes")
        if not self._readable(a):
            return a
        raw_mode = request.get("storyMode")
        mode = mp.MODE_AUTO if raw_mode is None else str(raw_mode).strip().upper()
        if mode not in (mp.MODE_AUTO, mp.MODE_KEEP, mp.MODE_REPLACE):
            a.errors.append(Issue(mp.SCHEMA_INVALID, "storyMode must be AUTO, KEEP or REPLACE"))
            return a
        source = nc.mapping(a.doc.get("source"))
        if source.get("appVersion") != self.app_version:
            a.warnings.append(Issue(mp.APP_VERSION_DIFFERS,
                                    f"Exported by {source.get('appVersion')}, this server runs {self.app_version}"))
        if source.get("backend") != BACKEND:
            a.warnings.append(Issue(mp.CROSS_FAMILY, f"Exported by the {source.get('backend')} backend: the "
                                                     "time-start after the import may roll other weather or random events"))
        story_id = self._story(a, mode)
        self._users(a, story_id)
        self._match_and_characters(a, request.get("replace") is True)
        self._engine(a)
        return a

    def _readable(self, a: Analysis) -> bool:
        doc = a.doc
        version = doc.get("formatVersion")
        if doc.get("format") != mp.FORMAT or isinstance(version, bool) or version != mp.FORMAT_VERSION:
            a.errors.append(Issue(mp.FORMAT_UNKNOWN, f"Unknown format {doc.get('format')} version {version}"))
            return False
        for problem in self.schema.validate(doc):
            a.errors.append(Issue(mp.SCHEMA_INVALID, problem))
        if a.errors:
            return False
        body = {k: v for k, v in doc.items() if k != "checksum"}
        if canonical_json.sha256(body) != doc.get("checksum"):
            a.errors.append(Issue(mp.CHECKSUM_MISMATCH, "The file does not match its checksum"))
            return False
        self._references(a)
        return not a.errors

    @staticmethod
    def _references(a: Analysis) -> None:
        def ref(message):
            a.errors.append(Issue(mp.REFERENCE_INVALID, message))

        users = {u.get("uuid") for u in nc.items(a.doc.get("users"))}
        characters, ordinals = set(), set()
        for c in nc.items(a.doc.get("characters")):
            if c.get("uuid") in characters:
                ref(f"character {c.get('uuid')} is listed twice")
            characters.add(c.get("uuid"))
            if c.get("ordinal") in ordinals:
                ref(f"ordinal {c.get('ordinal')} is used twice")
            ordinals.add(c.get("ordinal"))
            if c.get("userUuid") not in users:
                ref(f"user {c.get('userUuid')} of character {c.get('uuid')} is not in users")
        match = nc.mapping(a.doc.get("match"))
        if match.get("creatorUserUuid") not in users:
            ref(f"creator {match.get('creatorUserUuid')} is not in users")

        def check_character(uuid, where):
            if uuid is not None and uuid not in characters:
                ref(f"{where} names an unknown character {uuid}")

        check_character(match.get("activeCharacterUuid"), "match.activeCharacterUuid")
        state = nc.mapping(a.doc.get("state"))
        for r in nc.items(state.get("registry")):
            check_character(r.get("characterUuid"), "registry")
        turns = set()
        for t in nc.items(state.get("turns")):
            check_character(t.get("characterUuid"), "turns")
            if t.get("characterUuid") in turns:
                ref(f"character {t.get('characterUuid')} has two turns")
            turns.add(t.get("characterUuid"))
        for entry in nc.items(a.doc.get("logs")):
            check_character(entry.get("characterUuid"), "logs")

    def _story(self, a: Analysis, mode: str) -> Optional[int]:
        story = nc.mapping(a.doc.get("story"))
        uuid = story.get("uuid")
        a.bundled_story = nc.mapping(story.get("data"))
        story_id = self.store.story_id_by_uuid(uuid)
        used = None
        if story_id is None:
            a.story_status, a.story_action = STATUS_ABSENT, ACTION_IMPORT
            self._validate_bundled(a)
            used = a.bundled_story
        else:
            target = self.story_export.export_story(uuid)
            same = target is not None and story_fingerprint.of(target) == story.get("fingerprint")
            a.story_status = STATUS_SAME if same else STATUS_DIFFERENT
            if same:
                a.story_action, used = ACTION_USE_EXISTING, target
            elif mode == mp.MODE_KEEP:
                a.story_action, used = mp.MODE_KEEP, target
            elif mode == mp.MODE_REPLACE:
                a.story_action = mp.MODE_REPLACE
                a.matches_deleted = self.store.count_matches_of_story(story_id)
                a.warnings.append(Issue(mp.STORY_MATCHES_DELETED, f"{a.matches_deleted} match(es) of story {uuid} "
                                                                  "are deleted by the story re-import"))
                self._validate_bundled(a)
                used = a.bundled_story
            else:
                a.story_action = mp.MODE_AUTO
                a.errors.append(Issue(mp.STORY_DIFFERS, f"Story {uuid} exists on this server with other content: "
                                                        "choose storyMode KEEP or REPLACE"))
        if used is not None:
            self._story_entities(a, used)
        return story_id

    def _validate_bundled(self, a: Analysis) -> None:
        if self.story_validator is None:
            return
        report = self.story_validator.validate_import_data(story_for_import(a.bundled_story))
        if not report.is_valid():
            rules = ", ".join(dict.fromkeys(e.rule for e in report.errors))
            a.errors.append(Issue(mp.STORY_INVALID, f"The bundled story is refused: {rules}"))

    @staticmethod
    def _story_entities(a: Analysis, story: Dict[str, Any]) -> None:
        index = {label: {nc.lng(r.get("id")) if r.get("id") is not None else nc.lng(r.get("idTipo"))
                         for r in nc.items(story.get(key)) if isinstance(r, dict)}
                 for label, key in STORY_LISTS.items()}
        missing = set()

        def need(label, value):
            ident = nc.lng(value)
            if ident is not None and ident not in index[label]:
                missing.add(f"{label} {ident}")

        match = nc.mapping(a.doc.get("match"))
        loadout = nc.mapping(match.get("loadout"))
        need("difficulty", match.get("difficultyId"))
        need("template", loadout.get("characterTemplateId"))
        need("class", loadout.get("classId"))
        for t in nc.items(loadout.get("traitIds")):
            need("trait", t)
        need("weather", match.get("currentWeatherId"))
        need("location", match.get("partyLocationId"))
        for c in nc.items(a.doc.get("characters")):
            need("template", c.get("characterTemplateId"))
            need("class", c.get("classId"))
            need("location", c.get("locationId"))
            for t in nc.items(c.get("traits")):
                need("trait", t.get("traitId"))
                need("event", t.get("eventId"))
            for i in nc.items(c.get("items")):
                need("item", i.get("itemId"))
        state = nc.mapping(a.doc.get("state"))
        for r in nc.items(state.get("registry")):
            need("event", r.get("eventId"))
            need("choice", r.get("choiceId"))
            need("mission", r.get("missionId"))
            need("mission step", r.get("missionStepId"))
        for loc in nc.items(state.get("locations")):
            need("location", loc.get("locationId"))
        for section in ("storyProgress", "choiceHistory"):
            for row in nc.items(state.get(section)):
                need("event", row.get("eventId"))
                need("choice", row.get("choiceId"))
        engine = nc.mapping(a.doc.get("engine"))
        for m in nc.items(engine.get("eventMarkers")):
            need("event", m.get("eventId"))
        for loc in nc.items(engine.get("visitedLocationIds")):
            need("location", loc)
        for item in sorted(missing):
            a.errors.append(Issue(mp.STORY_ENTITY_MISSING, f"{item} is not in the story"))

    def _users(self, a: Analysis, story_id: Optional[int]) -> None:
        """Decision 54 (revised): uuid on the target, else the same e-mail, else new (renamed on a clash)."""
        existing, planned = [], set()
        for u in nc.items(a.doc.get("users")):
            uuid, username = u.get("uuid"), u.get("username")
            if self.store.user_by_uuid(uuid) is not None:
                a.users.append(UserPlan(u, USER_EXISTING, username, uuid))
                existing.append(uuid)
                continue
            by_email = self.store.user_by_email(u.get("emailAddress"))
            if by_email is not None:
                a.users.append(UserPlan(u, USER_MAPPED, by_email.get("username"), by_email.get("uuid")))
                existing.append(by_email.get("uuid"))
                a.warnings.append(Issue(mp.USER_MAPPED_BY_EMAIL, f"User {username} is mapped by e-mail onto the "
                                                                 f"existing user {by_email.get('username')}"))
                continue
            if self.store.username_taken(username) or username in planned:
                target = f"{username}_{uuid[:6]}"
                a.users.append(UserPlan(u, USER_RENAMED, target, uuid))
                planned.add(target)
                a.warnings.append(Issue(mp.USERNAME_RENAMED, f"User {username} is created as {target}"))
            else:
                a.users.append(UserPlan(u, USER_NEW, username, uuid))
                planned.add(username)
            if str(u.get("role") or "").upper() == "ADMIN":
                a.warnings.append(Issue(mp.ROLE_DOWNGRADED, f"User {username} is created as PLAYER"))
        if story_id is not None and existing and a.story_action != mp.MODE_REPLACE:
            match_uuid = nc.mapping(a.doc.get("match")).get("uuid")
            a.active_matches = list(self.store.active_matches_of(existing, story_id, match_uuid))
            if a.active_matches:
                names = ", ".join(f"{m['uuid']} ({m['status']})" for m in a.active_matches)
                a.warnings.append(Issue(mp.USER_HAS_ACTIVE_MATCH,
                                        f"These matches of the same story are set to PAUSED by the import: {names}"))

    def _match_and_characters(self, a: Analysis, replace: bool) -> None:
        match_uuid = nc.mapping(a.doc.get("match")).get("uuid")
        a.match_exists = self.store.match_exists(match_uuid)
        if a.match_exists and not replace:
            a.errors.append(Issue(mp.MATCH_EXISTS,
                                  f"Match {match_uuid} already exists on this server: use replace=true"))
        for c in nc.items(a.doc.get("characters")):
            owner = self.store.match_of_character(c.get("uuid"))
            if owner is not None and owner != match_uuid:
                a.errors.append(Issue(mp.CHARACTER_EXISTS, f"Character {c.get('uuid')} belongs to match {owner}"))

    @staticmethod
    def _engine(a: Analysis) -> None:
        engine = nc.mapping(a.doc.get("engine"))
        entries = nc.items(a.doc.get("logs"))
        a.reconciliation = nc.reconcile(entries, engine.get("eventMarkers"))
        if a.reconciliation.changed():
            a.warnings.append(Issue(mp.MARKERS_RECONCILED, "The timeline markers were aligned with engine.eventMarkers"))
        visited = set(nc.imported_visited(a.doc.get("characters"), entries))
        wanted = {nc.lng(v) for v in nc.items(engine.get("visitedLocationIds"))}
        if visited != wanted:
            a.warnings.append(Issue(mp.VISITED_LOCATIONS_DIFFER, f"Visited locations of the timeline "
                                                                 f"{sorted(visited)} differ from the file {sorted(wanted)}"))

    @staticmethod
    def _check_body(a: Analysis) -> Dict[str, Any]:
        source = nc.mapping((a.doc or {}).get("source"))
        return {
            "valid": a.valid, "errors": issues(a.errors), "warnings": issues(a.warnings),
            "source": {k: source.get(k) for k in ("backend", "dialect", "appVersion", "server", "snapshotClock")},
            "matchExists": a.match_exists,
            "story": {"uuid": nc.mapping((a.doc or {}).get("story")).get("uuid"), "status": a.story_status,
                      "action": a.story_action, "matchesDeleted": a.matches_deleted},
            "users": [{"uuid": p.user.get("uuid"), "username": p.user.get("username"),
                       "targetUsername": p.target_username, "targetUuid": p.target_uuid, "status": p.status}
                      for p in a.users],
        }

    # ── import ────────────────────────────────────────────────────────────────

    def import_match(self, request) -> Dict[str, Any]:
        a = self.analyze(request)
        if not a.valid:
            raise refusal(a.errors)
        doc = a.doc
        match = nc.mapping(doc.get("match"))
        match_uuid = match.get("uuid")
        story_uuid = nc.mapping(doc.get("story")).get("uuid")
        if a.story_action in (ACTION_IMPORT, mp.MODE_REPLACE):
            self.story_import.import_story(story_for_import(a.bundled_story))
        id_story = self.store.story_id_by_uuid(story_uuid)
        if id_story is None:
            raise RuntimeError(f"Story {story_uuid} is not on this server after its import")
        target = self.story_export.export_story(story_uuid) or {}
        replace_uuid = match_uuid if request.get("replace") is True and a.match_exists else None
        rows = self.rows(a, id_story, target, replace_uuid)
        id_match = self.store.insert_imported(rows)
        if self.match_commands is not None:
            for other in a.active_matches:
                self.match_commands.update_match(other["uuid"], match_statuses.PAUSED, None, lw.ADMIN_PAUSE)
        clock = nc.nz(nc.lng(match.get("clock")))
        server = nc.mapping(doc.get("source")).get("server")
        if self.log_writer is not None:
            self.log_writer.write(id_match, None, None, clock, lw.imported(server, clock))
        uuid_snapshot = (self.snapshot_service.write_now(id_match, f"Imported at clock {clock}")
                         if self.snapshot_service is not None else None)
        try:
            if self.time_service is not None:
                self.time_service.start_time_after_restore(match_uuid)
        except Exception as exc:  # noqa: BLE001 — the imported match stays, PAUSED
            self.snapshot_store.set_status(id_match, match_statuses.PAUSED)
            raise MatchExportError("IMPORT_TIME_START_FAILED",
                                   f"The match was imported (PAUSED) but its time-start failed: {exc}") from exc
        status = match_statuses.PAUSED if request.get("startPaused") is True else match_statuses.RUNNING
        self.snapshot_store.set_status(id_match, status)
        after = self.snapshot_store.find_match_by_id(id_match) or {}
        return {
            "status": "IMPORTED", "uuidMatch": match_uuid, "snapshotClock": clock,
            "clock": int(after.get("current_clock") or clock), "matchStatus": status, "uuidSnapshot": uuid_snapshot,
            "storyAction": a.story_action, "usersCreated": sum(1 for u in a.users if u.created),
            "logsImported": len(rows.logs), "warnings": issues(a.warnings),
        }

    def rows(self, a: Analysis, id_story: int, story: Dict[str, Any], replace_uuid) -> ImportRows:
        doc = a.doc
        now = datetime.now(timezone.utc).isoformat()
        fallback_ts = nc.mapping(doc.get("source")).get("exportedAt") or now
        match = nc.mapping(doc.get("match"))
        new_users = [{"uuid": p.user.get("uuid"), "username": p.target_username, "nickname": p.user.get("nickname"),
                      "language": p.user.get("language"), "state": nc.lng(p.user.get("state")),
                      "email_address": p.user.get("emailAddress")} for p in a.users if p.created]
        target_of = {p.user.get("uuid"): p.target_uuid or p.user.get("uuid") for p in a.users}
        ordinal_by_uuid = {c.get("uuid"): nc.lng(c.get("ordinal")) for c in nc.items(doc.get("characters"))}
        match_row = nc.match_row(match, id_story, {}, uuid_by_id(story, "characterTemplates"),
                                 uuid_by_id(story, "classes"), uuid_by_id(story, "traits"), now)
        match_row["id_user_creator"] = target_of.get(match.get("creatorUserUuid"), match.get("creatorUserUuid"))
        child = {t: [] for t in CHILD_TABLES}
        characters = []
        for c in nc.items(doc.get("characters")):
            ordinal = nc.lng(c.get("ordinal"))
            characters.append(dict(nc.character_row(c, now), id_user=target_of.get(c.get("userUuid"), c.get("userUuid"))))
            child["gaming_backpack_resources"].append(nc.resources_row(c, now))
            child["gaming_character_traits"] += [nc.trait_row(t, ordinal, now) for t in nc.items(c.get("traits"))]
            child["gaming_inventory_items"] += [nc.item_row(i, ordinal, now) for i in nc.items(c.get("items"))]
        state = nc.mapping(doc.get("state"))
        child["gaming_state_registry"] = [nc.registry_row(r, ordinal_by_uuid, now)
                                          for r in nc.items(state.get("registry"))]
        locations = {nc.lng(loc.get("locationId")): loc for loc in nc.items(state.get("locations"))}
        child["gaming_state_locations"] = [nc.location_row(i, locations.get(i), now)
                                           for i in self.store.story_location_ids(id_story)]
        child["gaming_turn_queue"] = [nc.turn_row(t, ordinal_by_uuid.get(t.get("characterUuid")), now)
                                      for t in nc.items(state.get("turns"))]
        child["gaming_story_progress"] = [nc.progress_row(p, now) for p in nc.items(state.get("storyProgress"))]
        logs = self._log_rows(a, ordinal_by_uuid, fallback_ts)
        logs += [(nc.LOG_CHOICES_EXECUTED, nc.choice_executed_row(h, now)) for h in nc.items(state.get("choiceHistory"))]
        return ImportRows(replace_uuid, new_users, match_row, characters, child, logs,
                          ordinal_by_uuid.get(match.get("activeCharacterUuid")))

    @staticmethod
    def _log_rows(a: Analysis, ordinal_by_uuid, fallback_ts) -> List[tuple]:
        """The timeline rows in seq order, then the markers the reconciliation adds (H.2.4)."""
        out, last_ts = [], fallback_ts
        for i, entry in enumerate(nc.items(a.doc.get("logs"))):
            table, columns = nc.log_row(entry, ordinal_by_uuid, fallback_ts)
            if i in a.reconciliation.uncounted:
                columns["log_message"] = f"{ltm.MSG_UNCOUNTED} {columns['log_message']}"
            if entry.get("timestamp") is not None:
                last_ts = entry["timestamp"]
            out.append((table, columns))
        clock = nc.nz(nc.lng(nc.mapping(a.doc.get("match")).get("clock")))
        for event_id, executed, count in a.reconciliation.missing:
            prefix = ltm.MSG_EVENT_EXECUTED if executed else ltm.MSG_CHOICE_SELECTED
            for _ in range(count):
                out.append((nc.LOG_EVENTS, nc.event_columns({"eventId": event_id, "clock": clock}, None, last_ts,
                                                            f"{prefix} {event_id} imported")))
        return out
