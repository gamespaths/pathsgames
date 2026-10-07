"""v0.41.4 Step 41 H.2.3 — the python snapshot rows (snake_case) to the neutral match export v1 and the
neutral sections back to rows. Mirrors ``NeutralColumnCodec.java`` with the python log columns."""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from app.core.services.match import log_type_mapper as ltm

LOG_EVENTS = "log_events"
LOG_MOVEMENTS = "log_movements"
LOG_ITEM_USAGE = "log_item_usage"
LOG_WEATHER = "log_weather"
LOG_CLOCK_HISTORY = "log_clock_history"
LOG_CHOICES_EXECUTED = "log_choices_executed"
# Timeline tables in the tie-break order of the seq (H.2.1).
TIMELINE_TABLES = (LOG_EVENTS, LOG_MOVEMENTS, LOG_ITEM_USAGE, LOG_WEATHER, LOG_CLOCK_HISTORY)
RESOURCES = ("energy", "food", "magic", "coin")
# Neutral stat name and its snake_case column.
STATS = (("dexterity", "dexterity"), ("intelligence", "intelligence"), ("constitution", "constitution"),
         ("energy", "energy"), ("life", "life"), ("sad", "sad"), ("lifeMax", "life_max"),
         ("energyMax", "energy_max"), ("sadMax", "sad_max"), ("weightMax", "weight_max"), ("exp", "exp"))
_STAT_DEFAULT_ONE = ("dexterity", "intelligence", "constitution", "life")


@dataclass
class Lookup:
    user_uuid_by_id: Dict[int, str] = field(default_factory=dict)
    character_uuid_by_ordinal: Dict[int, str] = field(default_factory=dict)
    template_id_by_uuid: Dict[str, int] = field(default_factory=dict)
    class_id_by_uuid: Dict[str, int] = field(default_factory=dict)
    trait_id_by_uuid: Dict[str, int] = field(default_factory=dict)


# ── values ────────────────────────────────────────────────────────────────────

def ts(value) -> Optional[str]:
    """A timestamp as ISO-8601 UTC with milliseconds; a text that does not parse is kept as it is."""
    if value is None or not str(value).strip():
        return None
    text = str(value).strip()
    try:
        moment = datetime.fromisoformat(text.replace("Z", "+00:00") if text.endswith("Z") else text)
    except ValueError:
        return text
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    moment = moment.astimezone(timezone.utc)
    return moment.strftime("%Y-%m-%dT%H:%M:%S.") + f"{moment.microsecond // 1000:03d}Z"


def epoch_millis(value) -> Optional[int]:
    iso = ts(value)
    try:
        return None if iso is None else int(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000)
    except ValueError:
        return None


def boolean(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in ("true", "t", "1")
    return False


def lng(value) -> Optional[int]:
    if isinstance(value, bool):
        return 1 if value else 0
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


def positive(value) -> Optional[int]:
    n = lng(value)
    return n if n is not None and n > 0 else None


def nz(value) -> int:
    return value or 0


def text(value) -> Optional[str]:
    return None if value is None else str(value)


def mapping(value) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def items(value) -> List[Any]:
    return list(value) if isinstance(value, list) else []


def split_csv(value) -> List[str]:
    return [p.strip() for p in str(value or "").split(",") if p.strip()]


def join_csv(values) -> Optional[str]:
    cleaned = [str(v).strip() for v in values or [] if v is not None and str(v).strip()]
    return ",".join(cleaned) if cleaned else None


def _first(*values):
    return next((v for v in values if v is not None), None)


# ── export ────────────────────────────────────────────────────────────────────

def match(m: Dict[str, Any], lookup: Lookup, party_location_id, fallback_seed) -> Dict[str, Any]:
    seed = lng(m.get("rng_seed"))
    traits = [lookup.trait_id_by_uuid[u] for u in split_csv(m.get("trait_uuids")) if u in lookup.trait_id_by_uuid]
    return {
        "uuid": m.get("uuid"), "name": text(m.get("name")), "difficultyId": lng(m.get("id_difficulty")),
        "expCost": lng(m.get("exp_cost")), "rngSeed": seed if seed is not None else fallback_seed,
        "singlePlayer": None if m.get("single_player") is None else boolean(m.get("single_player")),
        "loadout": {"characterTemplateId": lookup.template_id_by_uuid.get(text(m.get("character_template_uuid"))),
                    "classId": lookup.class_id_by_uuid.get(text(m.get("class_uuid"))), "traitIds": traits},
        "creatorUserUuid": lookup.user_uuid_by_id.get(lng(m.get("id_user_creator"))),
        "clock": nz(lng(m.get("current_clock"))), "status": text(m.get("status")),
        "currentWeatherId": positive(m.get("id_current_weather")),
        "activeCharacterUuid": lookup.character_uuid_by_ordinal.get(lng(m.get("id_character_current_turn"))),
        "counterConsecutivePass": lng(m.get("counter_consecutive_pass")),
        "secureLocationParam": lng(m.get("secure_location_param")), "partyLocationId": party_location_id,
        "timestampStart": ts(m.get("timestamp_start")), "timestampEnd": ts(m.get("timestamp_end")),
        "timestampGameover": ts(m.get("timestamp_gameover")),
        "timestampLockExpiration": ts(m.get("timestamp_lock_expiration")), "createdAt": ts(m.get("ts_insert")),
    }


def character(c, lookup: Lookup, resources, traits, inventory) -> Dict[str, Any]:
    out = {"uuid": c.get("uuid"), "ordinal": lng(c.get("id")),
           "userUuid": lookup.user_uuid_by_id.get(lng(c.get("id_user"))),
           "characterTemplateId": lng(c.get("id_character_template")), "classId": positive(c.get("id_class"))}
    for name, column in STATS:
        out[name] = lng(c.get(column))
    out.update({
        "locationId": positive(c.get("id_location")), "isSleeping": boolean(c.get("is_sleeping")),
        "isComa": boolean(c.get("is_coma")), "clockInComa": lng(c.get("clock_in_coma")),
        "timestampLastPass": ts(c.get("timestamp_last_pass")),
        "counterConsecutivePass": lng(c.get("counter_consecutive_pass")),
        "characteristics": split_csv(c.get("characteristics")),
    })
    if resources is not None:
        out["resources"] = {r: lng(resources.get(r)) for r in ("food", "magic", "coin")}
    out["traits"] = [{"traitId": lng(t.get("id_traits")), "eventId": positive(t.get("id_event"))} for t in traits]
    out["items"] = [{"itemId": lng(i.get("id_item")), "amount": lng(i.get("amount")), "state": text(i.get("state"))}
                    for i in inventory]
    return out


def registry(r, lookup: Lookup) -> Dict[str, Any]:
    return {"key": text(r.get("key")), "stringValue": text(r.get("string_value")),
            "intValue": lng(r.get("int_value")),
            "multiValue": None if r.get("multi_value") is None else boolean(r.get("multi_value")),
            "characterUuid": lookup.character_uuid_by_ordinal.get(lng(r.get("id_character"))),
            "eventId": positive(r.get("id_event")), "choiceId": positive(r.get("id_choice")),
            "clock": lng(r.get("clock")), "missionId": positive(r.get("id_mission")),
            "missionStepId": positive(r.get("id_mission_steps"))}


def is_non_default_location(row, start_location_id) -> bool:
    """A location row worth exporting (the sparse rule of AWS): any flag, a counter, the start."""
    return (boolean(row.get("flag_already_actived")) or boolean(row.get("flag_visited"))
            or nz(lng(row.get("clock_counter"))) != 0 or lng(row.get("id_location")) == start_location_id)


def location(row) -> Dict[str, Any]:
    return {"locationId": lng(row.get("id_location")),
            "flagAlreadyActivated": boolean(row.get("flag_already_actived")),
            "flagVisited": boolean(row.get("flag_visited")), "clockCounter": lng(row.get("clock_counter"))}


def turn(t, lookup: Lookup) -> Dict[str, Any]:
    return {"characterUuid": lookup.character_uuid_by_ordinal.get(lng(t.get("id_character_match"))),
            "clock": nz(lng(t.get("clock"))), "status": text(t.get("status")) or "WAITING",
            "priority": nz(lng(t.get("priority"))), "passCounter": lng(t.get("pass_counter")),
            "timestampStart": ts(t.get("timestamp_start")), "timestampEnd": ts(t.get("timestamp_end"))}


def progress(p) -> Dict[str, Any]:
    return {"clock": lng(p.get("clock")), "eventId": positive(p.get("id_event")),
            "choiceId": positive(p.get("id_choise"))}


def choice_row(c) -> Dict[str, Any]:
    out = progress(c)
    out.update({"message": text(c.get("log_message")), "timestamp": ts(c.get("ts_insert"))})
    return out


def user(u) -> Dict[str, Any]:
    state = lng(u.get("state"))
    return {"uuid": u.get("uuid"), "username": text(u.get("username")), "nickname": text(u.get("nickname")),
            "language": text(u.get("language")), "state": state, "guest": state == 6,
            "role": text(u.get("role")), "emailAddress": text(u.get("email_address"))}


def _resources(row, suffix) -> Optional[Dict[str, int]]:
    out = {r: lng(row.get(f"{r}{suffix}")) for r in RESOURCES if lng(row.get(f"{r}{suffix}")) is not None}
    return out or None


def _signed(row, cost: bool) -> Dict[str, int]:
    return {r: max(0, -nz(lng(row.get(r)))) if cost else max(0, nz(lng(row.get(r)))) for r in RESOURCES}


def log_entry(table: str, row, lookup: Lookup) -> Optional[Dict[str, Any]]:
    character_uuid = lookup.character_uuid_by_ordinal.get(lng(row.get("id_character_match")))
    if table == LOG_WEATHER:
        return {"type": ltm.WEATHER, "clock": lng(row.get("clock")),
                "timestamp": ts(_first(row.get("timestamp_start"), row.get("ts_insert"))),
                "weatherId": positive(row.get("id_weather"))}
    if table == LOG_CLOCK_HISTORY:
        return {"type": ltm.CLOCK_ADVANCE, "clock": lng(row.get("clock")),
                "timestamp": ts(_first(row.get("timestamp_start"), row.get("ts_insert")))}
    if table == LOG_MOVEMENTS:
        return {"type": ltm.MOVEMENT, "timestamp": ts(_first(row.get("timestamp_start"), row.get("ts_insert"))),
                "characterUuid": character_uuid, "locationFromId": positive(row.get("id_location_from")),
                "locationToId": positive(row.get("id_location_to")), "cost": _resources(row, "_cost")}
    if table == LOG_ITEM_USAGE:
        type_ = ltm.item_type(text(row.get("action")))
        if type_ is None:
            return None
        action = text(row.get("action"))
        return {"type": type_, "timestamp": ts(row.get("timestamp")), "characterUuid": character_uuid,
                "eventId": positive(row.get("id_event")), "itemId": positive(row.get("id_item")),
                "itemAction": None if action is None else action.strip().upper(),
                "counter": lng(row.get("counter")), "effects": text(row.get("effects_json")),
                "cost": _signed(row, True), "gain": _signed(row, False)}
    msg = text(row.get("log_message"))
    type_ = ltm.event_type(msg)
    if type_ is None:
        return None
    return {"type": type_, "clock": lng(row.get("clock")), "timestamp": ts(row.get("timestamp")),
            "characterUuid": character_uuid, "eventId": positive(row.get("id_event")),
            "choiceId": positive(row.get("id_choise")), "locationToId": positive(row.get("id_location")),
            "cost": _resources(row, "_cost"), "gain": _resources(row, "_gain"),
            "message": ltm.timeline_message(type_, msg)}


def logs(tables: Dict[str, List[Dict[str, Any]]], lookup: Lookup) -> List[Dict[str, Any]]:
    """The timeline rows of the five log tables as neutral entries, sorted and numbered (seq 1…n)."""
    collected = []
    for index, table in enumerate(TIMELINE_TABLES):
        for row in tables.get(table, []):
            entry = log_entry(table, row, lookup)
            if entry is not None:
                collected.append((entry.get("timestamp") or "", index, nz(lng(row.get("id"))), entry))
    collected.sort(key=lambda c: (c[0], c[1], c[2]))
    return [{"seq": n, **c[3]} for n, c in enumerate(collected, start=1)]


# ── import ────────────────────────────────────────────────────────────────────

@dataclass
class Reconciliation:
    """H.2.4: imported EVENT/CHOICE entries beyond engine.eventMarkers (by index) and the markers missing."""
    uncounted: Set[int]
    missing: List[tuple]  # (event_id, executed: bool, count)

    def changed(self) -> bool:
        return bool(self.uncounted) or bool(self.missing)


def reconcile(entries: List[Dict[str, Any]], event_markers) -> Reconciliation:
    wanted: Dict[int, List[int]] = {}
    for m in items(event_markers):
        event = lng(mapping(m).get("eventId"))
        if event is not None:
            wanted[event] = [nz(lng(m.get("executed"))), nz(lng(m.get("selected")))]
    written: Dict[int, List[int]] = {}
    uncounted: Set[int] = set()
    for i, e in enumerate(entries):
        kind = 0 if e.get("type") == ltm.EVENT else 1 if e.get("type") == ltm.CHOICE else -1
        event = lng(e.get("eventId"))
        if event is None or kind < 0:
            continue
        have = written.setdefault(event, [0, 0])
        if have[kind] < wanted.get(event, [0, 0])[kind]:
            have[kind] += 1
        else:
            uncounted.add(i)
    missing = []
    for event in sorted(wanted):
        have = written.get(event, [0, 0])
        for kind in (0, 1):
            if wanted[event][kind] > have[kind]:
                missing.append((event, kind == 0, wanted[event][kind] - have[kind]))
    return Reconciliation(uncounted, missing)


def imported_visited(characters, entries) -> List[int]:
    """The visited set an imported java/python match will read: character locations and movements."""
    out: List[int] = []
    for c in items(characters):
        loc = lng(mapping(c).get("locationId"))
        if loc is not None and loc not in out:
            out.append(loc)
    for e in entries:
        if e.get("type") == ltm.MOVEMENT:
            for key in ("locationFromId", "locationToId"):
                loc = lng(e.get(key))
                if loc is not None and loc not in out:
                    out.append(loc)
    return out


def log_row(e, ordinal_by_uuid, fallback_ts):
    """A neutral log entry as ``(table, columns)`` of the python schema."""
    type_ = e.get("type")
    character_id = ordinal_by_uuid.get(e.get("characterUuid"))
    stamp = _first(text(e.get("timestamp")), fallback_ts)
    cost, gain = mapping(e.get("cost")), mapping(e.get("gain"))
    if type_ == ltm.WEATHER:
        return LOG_WEATHER, {"clock": nz(lng(e.get("clock"))), "id_weather": lng(e.get("weatherId")),
                             "timestamp_start": stamp, "ts_insert": stamp}
    if type_ == ltm.CLOCK_ADVANCE:
        return LOG_CLOCK_HISTORY, {"clock": nz(lng(e.get("clock"))), "timestamp_start": stamp, "ts_insert": stamp}
    if type_ == ltm.MOVEMENT and character_id is not None and lng(e.get("locationToId")) is not None:
        columns = {"id_character_match": character_id, "id_location_from": lng(e.get("locationFromId")),
                   "id_location_to": lng(e.get("locationToId")), "timestamp_start": stamp, "ts_insert": stamp}
        columns.update({f"{r}_cost": lng(cost.get(r)) for r in RESOURCES})
        columns["energy_cost"] = nz(columns["energy_cost"])
        return LOG_MOVEMENTS, columns
    if type_ in (ltm.ITEM_ADD, ltm.ITEM_USE, ltm.ITEM_DROP) and character_id is not None \
            and lng(e.get("itemId")) is not None:
        columns = {"id_character_match": character_id, "id_item": lng(e.get("itemId")),
                   "action": text(e.get("itemAction")) or type_[len("ITEM_"):], "counter": lng(e.get("counter")),
                   "id_event": lng(e.get("eventId")), "effects_json": text(e.get("effects")),
                   "timestamp": stamp, "ts_insert": stamp}
        columns.update({r: nz(lng(gain.get(r))) - nz(lng(cost.get(r))) for r in RESOURCES})
        return LOG_ITEM_USAGE, columns
    if ltm.is_event_row(type_):
        message = ltm.stored_message(type_, text(e.get("message")))
    else:
        message = ltm.stored_message(None, f"{type_}" + ("" if e.get("message") is None else f" {e.get('message')}"))
    return LOG_EVENTS, event_columns(e, character_id, stamp, message)


def event_columns(e, character_id, stamp, message) -> Dict[str, Any]:
    cost, gain = mapping(e.get("cost")), mapping(e.get("gain"))
    columns = {"id_character_match": character_id, "timestamp": stamp, "id_event": lng(e.get("eventId")),
               "id_choise": lng(e.get("choiceId")), "log_message": message, "clock": lng(e.get("clock")),
               "id_location": lng(e.get("locationToId")), "ts_insert": stamp}
    columns.update({f"{r}_cost": lng(cost.get(r)) for r in RESOURCES})
    columns.update({f"{r}_gain": lng(gain.get(r)) for r in RESOURCES})
    return columns


def match_row(m, id_story, ordinal_by_uuid, template_uuid_by_id, class_uuid_by_id, trait_uuid_by_id, now):
    loadout = mapping(m.get("loadout"))
    traits = [trait_uuid_by_id[lng(t)] for t in items(loadout.get("traitIds")) if lng(t) in trait_uuid_by_id]
    return {
        "uuid": m.get("uuid"), "id_story": id_story, "name": text(m.get("name")),
        "id_difficulty": lng(m.get("difficultyId")),
        "exp_cost": 5 if m.get("expCost") is None else lng(m.get("expCost")), "status": "PAUSED",
        "current_clock": nz(lng(m.get("clock"))), "id_current_weather": lng(m.get("currentWeatherId")),
        "rng_seed": lng(m.get("rngSeed")), "timestamp_start": text(m.get("timestampStart")),
        "timestamp_lock_expiration": text(m.get("timestampLockExpiration")),
        "timestamp_gameover": text(m.get("timestampGameover")), "timestamp_end": text(m.get("timestampEnd")),
        "id_character_current_turn": ordinal_by_uuid.get(m.get("activeCharacterUuid")),
        "secure_location_param": lng(m.get("secureLocationParam")),
        "counter_consecutive_pass": nz(lng(m.get("counterConsecutivePass"))),
        "single_player": 1 if m.get("singlePlayer") is None or boolean(m.get("singlePlayer")) else 0,
        "character_template_uuid": template_uuid_by_id.get(lng(loadout.get("characterTemplateId"))),
        "class_uuid": class_uuid_by_id.get(lng(loadout.get("classId"))), "trait_uuids": join_csv(traits),
        "ts_insert": _first(text(m.get("createdAt")), now), "ts_update": now,
    }


def character_row(ch, now) -> Dict[str, Any]:
    out = {"id": lng(ch.get("ordinal")), "uuid": ch.get("uuid"),
           "id_character_template": lng(ch.get("characterTemplateId")), "id_class": lng(ch.get("classId"))}
    for name, column in STATS:
        value = lng(ch.get(name))
        out[column] = value if value is not None else (1 if column in _STAT_DEFAULT_ONE else 0)
    out.update({
        "id_location": lng(ch.get("locationId")), "is_sleeping": 1 if boolean(ch.get("isSleeping")) else 0,
        "is_coma": 1 if boolean(ch.get("isComa")) else 0, "clock_in_coma": lng(ch.get("clockInComa")),
        "timestamp_last_pass": text(ch.get("timestampLastPass")),
        "counter_consecutive_pass": nz(lng(ch.get("counterConsecutivePass"))),
        "characteristics": join_csv(items(ch.get("characteristics"))), "ts_insert": now, "ts_update": now,
    })
    return out


def resources_row(ch, now) -> Dict[str, Any]:
    res = mapping(ch.get("resources"))
    ordinal = lng(ch.get("ordinal"))
    return {"id": ordinal, "id_character_match": ordinal, "food": nz(lng(res.get("food"))),
            "magic": nz(lng(res.get("magic"))), "coin": nz(lng(res.get("coin"))), "ts_insert": now, "ts_update": now}


def trait_row(t, ordinal, now) -> Dict[str, Any]:
    return {"id_character_match": ordinal, "id_traits": lng(t.get("traitId")), "id_event": lng(t.get("eventId")),
            "ts_insert": now, "ts_update": now}


def item_row(i, ordinal, now) -> Dict[str, Any]:
    return {"id_character_match": ordinal, "id_item": lng(i.get("itemId")),
            "amount": 1 if i.get("amount") is None else lng(i.get("amount")), "state": text(i.get("state")),
            "ts_insert": now, "ts_update": now}


def registry_row(r, ordinal_by_uuid, now) -> Dict[str, Any]:
    return {"key": text(r.get("key")), "string_value": text(r.get("stringValue")),
            "int_value": lng(r.get("intValue")),
            "multi_value": None if r.get("multiValue") is None else (1 if boolean(r.get("multiValue")) else 0),
            "id_character": ordinal_by_uuid.get(r.get("characterUuid")), "id_event": lng(r.get("eventId")),
            "id_choice": lng(r.get("choiceId")), "clock": lng(r.get("clock")), "id_mission": lng(r.get("missionId")),
            "id_mission_steps": lng(r.get("missionStepId")), "ts_insert": now, "ts_update": now}


def location_row(id_location, neutral, now) -> Dict[str, Any]:
    n = neutral or {}
    return {"id_location": id_location, "flag_already_actived": 1 if boolean(n.get("flagAlreadyActivated")) else 0,
            "flag_visited": 1 if boolean(n.get("flagVisited")) else 0, "clock_counter": lng(n.get("clockCounter")),
            "ts_insert": now, "ts_update": now}


def turn_row(t, ordinal, now) -> Dict[str, Any]:
    return {"id_character_match": ordinal, "clock": nz(lng(t.get("clock"))),
            "timestamp_start": text(t.get("timestampStart")), "timestamp_end": text(t.get("timestampEnd")),
            "pass_counter": nz(lng(t.get("passCounter"))), "priority": nz(lng(t.get("priority"))),
            "status": text(t.get("status")), "ts_insert": now, "ts_update": now}


def progress_row(p, now) -> Dict[str, Any]:
    return {"clock": lng(p.get("clock")), "id_event": lng(p.get("eventId")), "id_choise": lng(p.get("choiceId")),
            "ts_insert": now, "ts_update": now}


def choice_executed_row(h, now) -> Dict[str, Any]:
    return {"clock": lng(h.get("clock")), "id_event": lng(h.get("eventId")), "id_choise": lng(h.get("choiceId")),
            "log_message": text(h.get("message")), "ts_insert": _first(text(h.get("timestamp")), now),
            "ts_update": now}
