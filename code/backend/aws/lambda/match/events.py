"""Step 29 — normal (player-triggered) events for the AWS backend.

Mirrors ``EventAvailabilityChecker.java`` / ``EventExecutionService.java``.

The check procedure is a pure function over a pre-loaded context, so match-info evaluates
N events against ONE context — the very same verdict ``execute-event`` enforces. A board
that offers an action can therefore never be refused, and a blocked one already knows why.

Storage note: on this backend a story is a single DynamoDB item, with ``events`` and
``eventEffects`` as embedded lists; the characters are separate items and the match item
carries ``registry`` / ``eventLog`` / ``currentWeatherId``.
"""

# Only these two types are player-executable; AUTOMATIC and FIRST are engine-driven, and
# authored stories also use END / END_GAME for the end-game event (identified by
# story.idEventEndGame, not by its type). Anything unknown is simply not executable.
EXECUTABLE_TYPES = {"NORMAL", "ONCE"}
TYPE_ONCE = "ONCE"

# Marker every eventLog row written by an executed event starts with. Load-bearing: the
# recovery and the weather engine also reference events they never ran, so the "spent ONCE"
# set must be built from this marker alone.
MSG_EVENT_EXECUTED = "EVENT_EXECUTED"

MAX_CHAIN = 32

ADD = "ADD"
REMOVE = "REMOVE"

_CLAMPED = {"life": "lifeMax", "energy": "energyMax", "sad": "sadMax"}
_CHARACTER_STATS = {"life", "energy", "sad", "exp", "dex", "int", "cos"}
_BACKPACK_STATS = {"food", "magic", "coin"}
_FIELD = {"dex": "dexterity", "int": "intelligence", "cos": "constitution"}


def _nz(value):
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _clamp(value, low, high):
    if high is None:
        return max(low, value)
    if high < low:
        return low
    return max(low, min(high, value))


def event_location(event):
    """Owning location of an event; idSpecificLocation wins over the legacy idLocation alias."""
    e = event or {}
    return e.get("idSpecificLocation") if e.get("idSpecificLocation") is not None \
        else e.get("idLocation")


# ── the check procedure ─────────────────────────────────────────────────────

def build_context(match, story, caller):
    """Everything the check procedure needs, built once. ``caller`` may be None."""
    if not caller:
        return {"idCharacter": None}

    class_id = None
    class_uuid = caller.get("classUuid")
    if class_uuid:
        cls = next((c for c in (story.get("classes") or [])
                    if c.get("uuid") == class_uuid), None)
        class_id = cls.get("id") if cls else None

    registry = {}
    for r in (match.get("registry") or []):
        key = r.get("key")
        if not key:
            continue
        if r.get("stringValue") is not None:
            registry[key] = r.get("stringValue")
        elif r.get("intValue") is not None:
            registry[key] = str(r.get("intValue"))
        else:
            registry[key] = None

    return {
        "idCharacter": caller.get("id") or caller.get("uuid"),
        "idLocation": caller.get("idLocation"),
        "sleeping": _nz(caller.get("isSleeping")) == 1,
        "coma": _nz(caller.get("isComa")) == 1,
        "energy": _nz(caller.get("energy")),
        "coin": _nz(caller.get("coin")),
        "idClass": class_id,
        "ownedItemIds": {_nz(i.get("idItem")) for i in (caller.get("items") or [])
                         if _nz(i.get("amount")) > 0},
        "currentWeatherId": match.get("currentWeatherId"),
        "consumedEventIds": consumed_event_ids(match),
        "registry": registry,
    }


def consumed_event_ids(match):
    """The ONCE events already spent in this match — EVENT_EXECUTED rows only.

    Other writers stamp an idEvent on log rows for events that were merely REFERENCED,
    never run; trusting idEvent alone would burn a ONCE event the player never triggered.
    """
    return {
        _nz(e.get("idEvent")) for e in (match.get("eventLog") or [])
        if e.get("idEvent") is not None
        and str(e.get("message") or "").startswith(MSG_EVENT_EXECUTED)
    }


def check(event, ctx):
    """The single verdict: ``(available, reason)``. ``reason`` is None when available.

    Order is the contract — the first failing check names the reason, and the cheapest /
    most explanatory reasons come first. All conditions combine in AND.
    """
    if not event:
        return False, "EVENT_NOT_FOUND"
    if not ctx or ctx.get("idCharacter") is None:
        return False, "CHARACTER_CANNOT_ACT"
    # Coma outranks sleep: a comatose character is also flagged asleep, and the two are not the
    # same news for the player — one waits, the other needs a rescue.
    if ctx.get("coma"):
        return False, "COMA"
    if ctx.get("sleeping"):
        return False, "SLEEPING"

    event_type = str(event.get("type") or "").strip().upper()
    if event_type not in EXECUTABLE_TYPES:
        return False, "EVENT_NOT_EXECUTABLE_TYPE"

    event_id = event.get("id")
    if event_type == TYPE_ONCE and event_id is not None \
            and _nz(event_id) in ctx.get("consumedEventIds", set()):
        return False, "ONCE_ALREADY_CONSUMED"

    # A null owning location means the event has no location constraint at all.
    loc = event_location(event)
    if loc is not None and loc != ctx.get("idLocation"):
        return False, "WRONG_LOCATION"

    if ctx.get("energy", 0) < _nz(event.get("costEnery")):
        return False, "NOT_ENOUGH_ENERGY"
    if ctx.get("coin", 0) < _nz(event.get("coinCost")):
        return False, "NOT_ENOUGH_COINS"

    key = event.get("registryKeyCondition")
    if key and str(key).strip():
        expected = event.get("registryValueCondition")
        # A key with no expected value can never be met — it must not read as "no condition".
        if expected is None or expected != ctx.get("registry", {}).get(key):
            return False, "REGISTRY_CONDITION_NOT_MET"

    # On the event, idWeather is a CONDITION; on an effect it is an EFFECT (it SETS it).
    id_weather = event.get("idWeather")
    if id_weather is not None and _nz(id_weather) != _nz(ctx.get("currentWeatherId")):
        return False, "WEATHER_CONDITION_NOT_MET"

    id_item = event.get("idItemCondition")
    if id_item is not None and _nz(id_item) not in ctx.get("ownedItemIds", set()):
        return False, "ITEM_CONDITION_NOT_MET"

    id_class = event.get("idClassCondition")
    if id_class is not None and _nz(id_class) != _nz(ctx.get("idClass")):
        return False, "CLASS_CONDITION_NOT_MET"

    return True, None


# ── execution ───────────────────────────────────────────────────────────────

def effects_by_event(story):
    """Story effects grouped by idEvent, in authored order (a later effect can build on an
    earlier one)."""
    out = {}
    for ef in sorted(story.get("eventEffects") or [], key=lambda e: _nz(e.get("id"))):
        if ef.get("idEvent") is not None:
            out.setdefault(_nz(ef.get("idEvent")), []).append(ef)
    return out


def resolve_recipients(effect, actor, characters):
    """INV-27: ALL means every character in the ACTOR's location, not every character of the
    match. target_class then narrows that set; matching nobody is legal."""
    target = str(effect.get("target") or "ALL").strip().upper()
    if target == "ONLY_ONE" or actor.get("idLocation") is None:
        base = [actor]
    else:
        base = [c for c in characters if c.get("idLocation") == actor.get("idLocation")]

    target_class = effect.get("targetClass")
    if not target_class or _nz(target_class) <= 0:
        return base
    return [c for c in base if _nz(c.get("classId")) == _nz(target_class)]


def apply_stat(char, effect, changes):
    """life/energy/sad/exp/dex/int/cos on the character; food/magic/coin on the backpack.
    Everything clamps: life/energy/sad at their max, nothing below zero."""
    stat = str(effect.get("statistics") or "").strip().lower()
    if not stat:
        return False
    delta = _nz(effect.get("value"))

    if stat in _CHARACTER_STATS:
        field = _FIELD.get(stat, stat)
        before = _nz(char.get(field))
        cap = _nz(char.get(_CLAMPED[stat])) if stat in _CLAMPED else None
        after = _clamp(before + delta, 0, cap)
        char[field] = after
    elif stat in _BACKPACK_STATS:
        before = _nz(char.get(stat))
        after = max(0, before + delta)
        char[stat] = after
    else:
        return False  # an unknown statistic is authored noise, not an error

    changes.append({
        "characterUuid": char.get("uuid"), "statistic": stat,
        "before": before, "after": after, "delta": after - before,
    })
    return True


def apply_item(char, effect, item_uuids, changes):
    """Returns (added, removed)."""
    id_item = effect.get("idItemTarget")
    action = str(effect.get("itemAction") or "").strip().upper()
    if not id_item or _nz(id_item) <= 0 or not action:
        return False, False

    item_id = _nz(id_item)
    items = char.setdefault("items", [])
    row = next((i for i in items if _nz(i.get("idItem")) == item_id), None)

    if action == ADD:
        if row:
            row["amount"] = _nz(row.get("amount")) + 1
        else:
            items.append({"idItem": item_id, "amount": 1})
        changes.append({"characterUuid": char.get("uuid"),
                        "itemUuid": item_uuids.get(item_id), "action": ADD})
        return True, False

    if action == REMOVE and row and _nz(row.get("amount")) > 0:
        left = _nz(row.get("amount")) - 1
        if left <= 0:
            items.remove(row)
        else:
            row["amount"] = left
        changes.append({"characterUuid": char.get("uuid"),
                        "itemUuid": item_uuids.get(item_id), "action": REMOVE})
        return False, True

    return False, False


def apply_traits(char, effect, trait_uuids, changes):
    held = char.setdefault("traitUuids", [])
    for id_trait in _csv_ids(effect.get("traitsToAdd")):
        uuid = trait_uuids.get(id_trait)
        if uuid and uuid not in held:
            held.append(uuid)
            changes.append({"characterUuid": char.get("uuid"), "traitUuid": uuid, "action": ADD})
    for id_trait in _csv_ids(effect.get("traitsToRemove")):
        uuid = trait_uuids.get(id_trait)
        if uuid and uuid in held:
            held.remove(uuid)
            changes.append({"characterUuid": char.get("uuid"), "traitUuid": uuid,
                            "action": REMOVE})


def apply_characteristics(char, effect, changes):
    current = list(char.get("characteristics") or [])
    for value in _csv(effect.get("characteristicToAdd")):
        if value not in current:
            current.append(value)
            changes.append({"characterUuid": char.get("uuid"), "characteristic": value,
                            "action": ADD})
    for value in _csv(effect.get("characteristicToRemove")):
        if value in current:
            current.remove(value)
            changes.append({"characterUuid": char.get("uuid"), "characteristic": value,
                            "action": REMOVE})
    char["characteristics"] = current


def apply_location(match, char, effect, location_uuids, changes, ts):
    """v0.29.3 forced movement: the recipient is moved to ``idLocation``, skipping the whole
    Step 28 procedure — no neighbor check, no energy cost, no availability verdict. An id
    matching no location of the story is authored noise and is skipped; so is a move to the
    location the recipient already stands in. A cost-0 ``movementLog`` entry keeps the
    timeline and the fog-of-war visited set truthful. Mutating the shared character dict
    also means a later effect of the same chain resolves target=ALL where the recipient
    now stands."""
    id_location = effect.get("idLocation")
    if not id_location or _nz(id_location) <= 0:
        return False
    target = _nz(id_location)
    target_uuid = location_uuids.get(target)
    if not target_uuid:
        return False  # authored noise, not an error
    origin = char.get("idLocation")
    if origin is not None and _nz(origin) == target:
        return False  # already there: nothing to move, nothing to log
    char["idLocation"] = target
    char["locationUuid"] = target_uuid
    match.setdefault("movementLog", []).append({
        "characterUuid": char.get("uuid"),
        "idLocationFrom": origin,
        "idLocationTo": target,
        "energyCost": 0,
        "timestampStart": ts,
    })
    changes.append({
        "characterUuid": char.get("uuid"),
        "fromLocationUuid": location_uuids.get(_nz(origin)) if origin is not None else None,
        "toLocationUuid": target_uuid,
    })
    return True


def apply_registry(match, key, value, changes):
    """The registry is match-scoped: written once per effect row, not once per recipient."""
    registry = match.setdefault("registry", [])
    row = next((r for r in registry if r.get("key") == key), None)
    old = None
    if row:
        old = row.get("stringValue")
        if old is None and row.get("intValue") is not None:
            old = str(row.get("intValue"))
    else:
        row = {"key": key}
        registry.append(row)

    try:
        row["intValue"] = int(str(value).strip())
        row["stringValue"] = None
    except (TypeError, ValueError):
        row["stringValue"] = value
        row["intValue"] = None

    changes.append({"key": key, "oldValue": old, "newValue": value})


def _csv(value):
    if not value:
        return []
    return [v.strip() for v in str(value).split(",") if v.strip()]


def _csv_ids(value):
    """CSV of story-local ids; anything non-numeric is skipped rather than raising."""
    out = []
    for part in _csv(value):
        try:
            out.append(int(part))
        except ValueError:
            pass  # authored noise
    return out


# ── Step 30: edge states (sadness overflow, coma) ───────────────────────────
#
# Mirrors EdgeStateEvaluator.java / edge_state_evaluator.py. Two rules, in a deliberate
# order, because the first can cause the second:
#
#   1. Sadness overflow — sad >= sadMax costs COS life, resets sad to 0, forces sleep.
#   2. Coma            — life <= 0 raises isComa/isSleeping and stamps clockInComa.
#
# The cascade is the point of evaluating them together: the life the coma rule reads is the
# life AFTER the overflow subtraction, so one event can push a character over the sadness
# cap and into a coma in a single pass.
#
# Unlike the Java and Python engines this reads the CLAMPED sad straight off the character
# dict rather than carrying a shadow pre-clamp field. The verdict is identical — clamping a
# number at or above the cap yields the cap — and the characters here are the very dicts
# that get written to DynamoDB, so a shadow key would be persisted as a real column.

# None of these may start with MSG_EVENT_EXECUTED: consumedEventIds is built by scanning
# the event log for that prefix, so an edge-state row bearing it would silently consume a
# ONCE event the player never triggered.
MSG_SADNESS_OVERFLOW = "SADNESS_OVERFLOW"
MSG_COMA = "COMA"
# Note that this value CONTAINS MSG_COMA: match with startswith, never with `in`.
MSG_ALL_PLAYER_COMA = "ALL_PLAYER_COMA"
# v0.30.1 — a comatose character rested in a safe location and woke. Contains MSG_COMA.
MSG_COMA_RECOVERED = "COMA_RECOVERED"


def evaluate_edge_state(char):
    """The verdict for one character, as a dict. Nothing is mutated here.

    ``alreadyComa`` suppresses only the coma *trigger* — the log row and the clockInComa
    stamp — never the arithmetic: a comatose character caught by a target=ALL sadness
    effect still takes the life hit.
    """
    life = _nz(char.get("life"))
    sad_max = _nz(char.get("sadMax"))
    already_coma = _nz(char.get("isComa")) == 1
    # A non-positive cap makes every comparison true and would drain COS life on every
    # single event. sadMax comes from story import and nothing forces it positive.
    overflow = sad_max > 0 and _nz(char.get("sad")) >= sad_max
    sad = _clamp(_nz(char.get("sad")), 0, sad_max)
    forced_sleep = False

    if overflow:
        life = max(0, life - _nz(char.get("constitution")))
        sad = 0
        forced_sleep = True

    coma_triggered = life <= 0 and not already_coma
    if coma_triggered:
        forced_sleep = True

    return {
        "sadnessOverflow": overflow,
        "comaTriggered": coma_triggered,
        "forcedSleep": forced_sleep,
        "lifeAfter": life,
        "sadAfter": sad,
        "anything": overflow or coma_triggered,
    }


def all_in_coma(characters):
    """True when every character of the match is comatose.

    An empty roster is NOT all-in-coma — the guard lives here so no call site forgets it.
    """
    if not characters:
        return False
    return all(_nz(c.get("isComa")) == 1 for c in characters)
