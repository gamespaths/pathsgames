"""StoryValidator - referential-integrity and domain-rule validator (Step 22).

Standalone module mirroring the Java/Python reference. Operates on a single dict that
holds the story header fields plus inline entity arrays — the same shape used both by
the import body and by the persisted DynamoDB story item. Only positive references are
validated (null / absent / <= 0 means "none"). Field access is key-agnostic.

Public API:
    validate_story_dict(data)            -> list[dict]   (full-graph rules)
    validate_entity(entity_type, data)   -> list[dict]   (entity-local rules)
    summary(errors)                      -> str
"""

_LOCATION, _EVENT, _ITEM, _CHOICE, _CLASS, _MISSION = (
    "location", "event", "item", "choice", "class", "mission")

_REF_RULES = {
    _LOCATION: "R_LOCATION_REF", _EVENT: "R_EVENT_REF", _ITEM: "R_ITEM_REF",
    _CHOICE: "R_CHOICE_REF", _CLASS: "R_CLASS_REF", _MISSION: "R_MISSION_REF",
}

# Step 33 — the list_locations columns that name an engine-fired event. Kept in one place
# because both the graph collection and the R9 rules walk exactly this set.
_LOCATION_TRIGGER_FIELDS = (
    "idEventIfFirstTime",
    "idEventNotFirstTime",
    "idEventIfCharacterEnterFirstTime",
    "idEventIfCharacterStartTime",
    "idEventIfCounterZero",
)

# The two types a player can execute. Mirrors events.EXECUTABLE_TYPES, duplicated rather
# than imported because the validator lives in the story lambda.
_EXECUTABLE_EVENT_TYPES = {"NORMAL", "ONCE"}


def _camel_to_snake(name):
    out = []
    for ch in name:
        if ch.isupper():
            out.append("_")
            out.append(ch.lower())
        else:
            out.append(ch)
    return "".join(out)


def _field(row, camel):
    if not isinstance(row, dict):
        return None
    if camel in row:
        return row[camel]
    return row.get(_camel_to_snake(camel))


def _as_int(value):
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            return None
    return None


def _truthy(value):
    i = _as_int(value)
    if i is not None:
        return i != 0
    return value is True or str(value).lower() == "true"


def _err(rule, etype, eid, field, message):
    return {"rule": rule, "entityType": etype, "entityId": eid, "field": field, "message": message}


def summary(errors):
    if not errors:
        return "story is valid"
    head = "; ".join(e["message"] for e in errors[:5])
    return head if len(errors) <= 5 else head + "; (+{} more)".format(len(errors) - 5)


def _arr(data, key):
    v = data.get(key)
    return v if isinstance(v, list) else []


def validate_story_dict(data):
    """Run all full-graph rules. Returns a list of error dicts (empty == valid)."""
    if not data:
        return [_err("R0_EMPTY", "story", None, None, "story data is null or empty")]

    errors = []
    locations, events, items, choices, classes, missions = set(), set(), set(), set(), set(), set()
    for s, key in ((locations, "locations"), (events, "events"), (items, "items"),
                   (choices, "choices"), (classes, "classes"), (missions, "missions")):
        for it in _arr(data, key):
            v = _as_int(_field(it, "id"))
            if v is not None:
                s.add(v)
    key_names = set()
    for k in _arr(data, "keys"):
        name = _field(k, "name")
        if name:
            key_names.add(str(name).strip().lower())

    universe = {_LOCATION: locations, _EVENT: events, _ITEM: items,
                _CHOICE: choices, _CLASS: classes, _MISSION: missions}
    refs = []          # (rule, etype, eid, field, target, value)
    neighbors = []     # (eid, frm, to, direction)
    key_refs = []      # (eid, type, key)
    restrictions = []  # (etype, eid, permitted, prohibited)
    templates = []     # (eid, lifeMax, energyMax, dex, int, con, sadMax)
    event_next = {}
    choice_otherwise = {}
    choices_with_option = set()
    # Step 31 — (cid, idEvent, idLocation) per choice, for the R8 binding rule.
    choice_data = []
    # Step 33 — every event id a list_locations.id_event_* column names, mapped to the
    # column that names it (for the message), plus each event's raw type.
    location_trigger_events = {}
    event_types = {}

    def ref(etype, eid, field, target, value):
        v = _as_int(value)
        if v is not None and v > 0:
            refs.append((_REF_RULES[target], etype, eid, field, target, v))

    def restriction(etype, eid, permitted, prohibited):
        p, q = _as_int(permitted), _as_int(prohibited)
        restrictions.append((etype, eid, p, q))
        if p is not None and p > 0:
            refs.append(("R6_CLASS_REF", etype, eid, "idClassPermitted", _CLASS, p))
        if q is not None and q > 0:
            refs.append(("R6_CLASS_REF", etype, eid, "idClassProhibited", _CLASS, q))

    # story-level FKs
    ref("story", None, "idLocationStart", _LOCATION, data.get("idLocationStart"))
    ref("story", None, "idLocationAllPlayerComa", _LOCATION, data.get("idLocationAllPlayerComa"))
    ref("story", None, "idEventAllPlayerComa", _EVENT, data.get("idEventAllPlayerComa"))
    ref("story", None, "idEventEndGame", _EVENT, data.get("idEventEndGame"))

    # Step 33 — the five location-side trigger columns. They have existed since the first
    # schema and were never referenced here, so a location could point at an event that
    # does not exist and nothing would say so.
    for l in _arr(data, "locations"):
        lid = _field(l, "id")
        for field in _LOCATION_TRIGGER_FIELDS:
            id_event = _as_int(_field(l, field))
            ref("locations", str(lid), field, _EVENT, _field(l, field))
            if id_event is not None and id_event > 0:
                location_trigger_events[id_event] = field

    for e in _arr(data, "events"):
        eid = _field(e, "id")
        ref("events", str(eid), "idSpecificLocation", _LOCATION, _field(e, "idSpecificLocation"))
        ref("events", str(eid), "idItemToAdd", _ITEM, _field(e, "idItemToAdd"))
        ref("events", str(eid), "idEventNext", _EVENT, _field(e, "idEventNext"))
        my, nxt = _as_int(_field(e, "id")), _as_int(_field(e, "idEventNext"))
        if my is not None and nxt is not None:
            event_next[my] = nxt
        etype = _field(e, "type")
        if my is not None and etype:
            event_types[my] = str(etype)
    for c in _arr(data, "choices"):
        cid = _field(c, "id")
        ref("choices", str(cid), "idEvent", _EVENT, _field(c, "idEvent"))
        ref("choices", str(cid), "idLocation", _LOCATION, _field(c, "idLocation"))
        ref("choices", str(cid), "idEventTorun", _EVENT, _field(c, "idEventTorun"))
        # Step 31 (R8): the raw binding values, kept for the choice-event rule.
        choice_data.append((str(cid), _as_int(_field(c, "idEvent")),
                            _as_int(_field(c, "idLocation"))))
        my = _as_int(_field(c, "id"))
        if my is not None:
            choice_otherwise[my] = _truthy(_field(c, "otherwiseFlag"))
    for ce in _arr(data, "choiceEffects"):
        cid = _as_int(_field(ce, "idChoices"))
        if cid is not None:
            choices_with_option.add(cid)
        eid = str(_field(ce, "id"))
        ref("choice-effects", eid, "idChoices", _CHOICE, cid)
        # v0.32.0 — the effect targets a resolved choice can reach (Step 32). idWeather is
        # deliberately unchecked: this validator has no weather target, as for the event
        # effects right below.
        ref("choice-effects", eid, "idEvent", _EVENT, _field(ce, "idEvent"))
        ref("choice-effects", eid, "idLocation", _LOCATION, _field(ce, "idLocation"))
        ref("choice-effects", eid, "idItemTarget", _ITEM, _field(ce, "idItemTarget"))
    for cc in _arr(data, "choiceConditions"):
        ref("choice-conditions", str(_field(cc, "id")), "idChoices", _CHOICE, _field(cc, "idChoices"))
        key_refs.append((str(_field(cc, "id")), _field(cc, "type"), _field(cc, "key")))
    for ee in _arr(data, "eventEffects"):
        eid = str(_field(ee, "id"))
        ref("event-effects", eid, "idEvent", _EVENT, _field(ee, "idEvent"))
        ref("event-effects", eid, "idItemTarget", _ITEM, _field(ee, "idItemTarget"))
        ref("event-effects", eid, "targetClass", _CLASS, _field(ee, "targetClass"))
        # v0.29.3 — forced movement: the location the effect moves its recipients to.
        ref("event-effects", eid, "idLocation", _LOCATION, _field(ee, "idLocation"))
    for ie in _arr(data, "itemEffects"):
        ref("item-effects", str(_field(ie, "id")), "idItem", _ITEM, _field(ie, "idItem"))
    for cb in _arr(data, "classBonuses"):
        ref("class-bonuses", str(_field(cb, "id")), "idClass", _CLASS, _field(cb, "idClass"))
    for ms in _arr(data, "missionSteps"):
        ref("mission-steps", str(_field(ms, "id")), "idMission", _MISSION, _field(ms, "idMission"))
    for wr in _arr(data, "weatherRules"):
        ref("weather-rules", str(_field(wr, "id")), "idEvent", _EVENT, _field(wr, "idEvent"))
    for gr in _arr(data, "globalRandomEvents"):
        ref("global-random-events", str(_field(gr, "id")), "idEvent", _EVENT, _field(gr, "idEvent"))
    for n in _arr(data, "locationNeighbors"):
        frm, to = _as_int(_field(n, "idLocationFrom")), _as_int(_field(n, "idLocationTo"))
        nid = str(_field(n, "id"))
        ref("location-neighbors", nid, "idLocationFrom", _LOCATION, frm)
        ref("location-neighbors", nid, "idLocationTo", _LOCATION, to)
        neighbors.append((nid, frm, to, _field(n, "direction")))
    for it in _arr(data, "items"):
        restriction("items", str(_field(it, "id")), _field(it, "idClassPermitted"), _field(it, "idClassProhibited"))
    for tr in _arr(data, "traits"):
        restriction("traits", str(_field(tr, "id")), _field(tr, "idClassPermitted"), _field(tr, "idClassProhibited"))
    for ct in _arr(data, "characterTemplates"):
        eid = _field(ct, "id") if _field(ct, "id") is not None else _field(ct, "idTipo")
        restriction("character-templates", str(eid), _field(ct, "idClassPermitted"), _field(ct, "idClassProhibited"))
        templates.append((str(eid), _as_int(_field(ct, "lifeMax")), _as_int(_field(ct, "energyMax")),
                          _as_int(_field(ct, "dexterityStart")), _as_int(_field(ct, "intelligenceStart")),
                          _as_int(_field(ct, "constitutionStart")), _as_int(_field(ct, "sadMax"))))

    # --- rules ---
    for rule, etype, eid, field, target, value in refs:
        if value not in universe[target]:
            errors.append(_err(rule, etype, eid, field,
                               "{} {}={} references a non-existent {}".format(etype, field, value, target)))

    seen = {}
    for eid, frm, to, direction in neighbors:
        if frm is not None and to is not None and frm > 0 and frm == to:
            errors.append(_err("R2_NEIGHBOR_SELF", "location-neighbors", eid, "idLocationTo",
                               "neighbor links location {} to itself".format(frm)))
        if not direction or not str(direction).strip():
            errors.append(_err("R2_NEIGHBOR_DIR", "location-neighbors", eid, "direction",
                               "neighbor from location {} has no direction".format(frm)))
        elif frm is not None and frm > 0:
            k = "{}/{}".format(frm, str(direction).strip().upper())
            if k in seen and seen[k] != to:
                errors.append(_err("R2_NEIGHBOR_DUP", "location-neighbors", eid, "direction",
                                   "location {} has two neighbors in direction {}".format(frm, direction)))
            seen[k] = to

    errors.extend(_detect_cycles(events, event_next))

    for cid, otherwise in choice_otherwise.items():
        if not otherwise and cid not in choices_with_option:
            errors.append(_err("R4_CHOICE_EMPTY", "choices", str(cid), None,
                               "choice {} has no option (choice-effects) and no otherwise fallback".format(cid)))

    # Step 31 (R8): every choice belongs to an event, and only to an event.
    for cid, id_event, id_location in choice_data:
        if id_event is None or id_event <= 0:
            errors.append(_err("R8_CHOICE_EVENT", "choices", cid, "idEvent",
                               "choice {} has no idEvent — every choice must belong to an event (step 31)".format(cid)))
        if id_location is not None and id_location > 0:
            errors.append(_err("R8_CHOICE_EVENT", "choices", cid, "idLocation",
                               "idLocation={} is deprecated — a choice binds to an event (idEvent), never to a location (step 31)".format(id_location)))

    # Step 33 (R9): the two rules that keep an engine-fired location event runnable. Both
    # are about events a list_locations.id_event_* column names. The engine fires those
    # without a player: nobody pays, nobody is asked anything, and the response they would
    # answer does not exist.
    if location_trigger_events:
        owning = {ev for (_cid, ev, _loc) in choice_data if ev is not None and ev > 0}
        for id_event, field in location_trigger_events.items():
            if id_event in owning:
                errors.append(_err(
                    "R9_AUTOMATIC_EVENT_CHOICES", "locations", None, field,
                    "event {} is fired automatically by {} but owns choices — an automatic"
                    " event has no one to ask and no response to ask in (step 33)".format(
                        id_event, field)))
            etype = str(event_types.get(id_event) or "").strip().upper()
            if etype in _EXECUTABLE_EVENT_TYPES:
                errors.append(_err(
                    "R9_AUTOMATIC_EVENT_TYPE", "locations", None, field,
                    "event {} is fired automatically by {} but its type is {}, which is"
                    " player-executable — use AUTOMATIC (step 33)".format(
                        id_event, field, etype)))

    for eid, ctype, key in key_refs:
        # Only KEYS conditions read the registry. On every other type `key` means
        # something else entirely (a stat name for statistics, unused for ITEM), so
        # matching it against the registry would false-fail legal stories (step 31).
        if not ctype or str(ctype).strip().upper() != "KEYS":
            continue
        if key and str(key).strip() and str(key).strip().lower() not in key_names:
            errors.append(_err("R4_CONDITION_KEY", "choice-conditions", eid, "key",
                               "choice-condition references unknown registry key '{}'".format(key)))

    for eid, life_max, energy_max, dex, intel, con, sad_max in templates:
        _positive(errors, "character-templates", eid, "lifeMax", life_max)
        _positive(errors, "character-templates", eid, "energyMax", energy_max)
        _non_negative(errors, "character-templates", eid, "dexterityStart", dex)
        _non_negative(errors, "character-templates", eid, "intelligenceStart", intel)
        _non_negative(errors, "character-templates", eid, "constitutionStart", con)
        _non_negative(errors, "character-templates", eid, "sadMax", sad_max)

    for etype, eid, permitted, prohibited in restrictions:
        if permitted is not None and prohibited is not None and permitted > 0 and permitted == prohibited:
            errors.append(_err("R6_CLASS_CONFLICT", etype, eid, "idClassPermitted",
                               "{} {} has the same class permitted and prohibited ({})".format(etype, eid, permitted)))
    return errors


def _detect_cycles(events, event_next):
    errors = []
    color = {}

    def visit(start):
        stack = [start]
        while stack:
            cur = stack[-1]
            c = color.get(cur)
            if c is None:
                color[cur] = 0
                nxt = event_next.get(cur)
                if nxt and nxt > 0 and nxt in events:
                    nc = color.get(nxt)
                    if nc == 0:
                        errors.append(_err("R3_EVENT_CYCLE", "events", str(cur), "idEventNext",
                                           "event chain forms a cycle at event {} -> {}".format(cur, nxt)))
                        color[cur] = 1
                        stack.pop()
                    elif nc is None:
                        stack.append(nxt)
                    else:
                        color[cur] = 1
                        stack.pop()
                else:
                    color[cur] = 1
                    stack.pop()
            else:
                color[cur] = 1
                stack.pop()

    for ev in events:
        if ev not in color:
            visit(ev)
    return errors


def _positive(errors, etype, eid, field, v):
    if v is not None and v <= 0:
        errors.append(_err("R6_STAT_RANGE", etype, eid, field, "{} must be positive but is {}".format(field, v)))


def _non_negative(errors, etype, eid, field, v):
    if v is not None and v < 0:
        errors.append(_err("R6_STAT_RANGE", etype, eid, field, "{} must not be negative but is {}".format(field, v)))


def validate_entity(entity_type, data):
    """Entity-local (lenient) rules used by CRUD create/update."""
    errors = []
    if not entity_type or not data:
        return errors
    eid = str(_field(data, "id")) if _field(data, "id") is not None else None
    if entity_type == "character-templates":
        _positive(errors, entity_type, eid, "lifeMax", _as_int(_field(data, "lifeMax")))
        _positive(errors, entity_type, eid, "energyMax", _as_int(_field(data, "energyMax")))
        _non_negative(errors, entity_type, eid, "dexterityStart", _as_int(_field(data, "dexterityStart")))
        _non_negative(errors, entity_type, eid, "intelligenceStart", _as_int(_field(data, "intelligenceStart")))
        _non_negative(errors, entity_type, eid, "constitutionStart", _as_int(_field(data, "constitutionStart")))
        _non_negative(errors, entity_type, eid, "sadMax", _as_int(_field(data, "sadMax")))
        _class_conflict(errors, entity_type, eid, data)
    elif entity_type in ("items", "traits"):
        _class_conflict(errors, entity_type, eid, data)
    elif entity_type == "difficulties":
        mn, mx = _as_int(_field(data, "minCharacter")), _as_int(_field(data, "maxCharacter"))
        if mn is not None and mx is not None and mx > 0 and mn > mx:
            errors.append(_err("R6_DIFFICULTY_RANGE", entity_type, eid, "minCharacter",
                               "minCharacter ({}) exceeds maxCharacter ({})".format(mn, mx)))
    elif entity_type == "choices":
        # Step 31 — only an actively-typed idLocation is rejected here: the binding is
        # deprecated, so writing one is always a mistake. A missing idEvent is tolerated
        # (a draft choice may exist before its event while authoring); the whole-graph
        # R8 rule closes the gap at import and validate-story.
        id_location = _as_int(_field(data, "idLocation"))
        if id_location is not None and id_location > 0:
            errors.append(_err("R8_CHOICE_EVENT", entity_type, eid, "idLocation",
                               "idLocation={} is deprecated — a choice binds to an event (idEvent), never to a location (step 31)".format(id_location)))
    return errors


def _class_conflict(errors, entity_type, eid, data):
    p, q = _as_int(_field(data, "idClassPermitted")), _as_int(_field(data, "idClassProhibited"))
    if p and q and p > 0 and p == q:
        errors.append(_err("R6_CLASS_CONFLICT", entity_type, eid, "idClassPermitted",
                           "{} has the same class permitted and prohibited ({})".format(entity_type, p)))
