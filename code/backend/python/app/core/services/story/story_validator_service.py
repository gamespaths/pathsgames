"""StoryValidatorService - referential-integrity and domain-rule validator (Step 22).

Mirrors the Java reference. Both the import-map path and the persisted-story path
normalise their input into a single graph and feed it through one rule engine, so a
rule is written once and applies to authored JSON and to stored rows alike.

Only positive references are validated: null / absent / non-positive means "none".
Field access is key-agnostic (camelCase or snake_case) so DB rows and JSON both work.
"""
from typing import Any, Dict, List, Optional, Set

from app.core.ports.story.story_read_port import StoryReadPort
from app.core.ports.story.story_validator_port import (
    StoryValidationReport,
    StoryValidatorPort,
)

# target universe codes
_LOCATION, _EVENT, _ITEM, _CHOICE, _CLASS, _MISSION = "location", "event", "item", "choice", "class", "mission"

_REF_RULES = {
    _LOCATION: "R_LOCATION_REF",
    _EVENT: "R_EVENT_REF",
    _ITEM: "R_ITEM_REF",
    _CHOICE: "R_CHOICE_REF",
    _CLASS: "R_CLASS_REF",
    _MISSION: "R_MISSION_REF",
}


def _camel_to_snake(name: str) -> str:
    out = []
    for ch in name:
        if ch.isupper():
            out.append("_")
            out.append(ch.lower())
        else:
            out.append(ch)
    return "".join(out)


def _get(row: Dict[str, Any], camel: str) -> Any:
    if camel in row:
        return row[camel]
    snake = _camel_to_snake(camel)
    return row.get(snake)


def _as_int(value: Any) -> Optional[int]:
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


def _truthy(value: Any) -> bool:
    i = _as_int(value)
    if i is not None:
        return i != 0
    return value is True or str(value).lower() == "true"


class _Graph:
    def __init__(self) -> None:
        self.locations: Set[int] = set()
        self.events: Set[int] = set()
        self.items: Set[int] = set()
        self.choices: Set[int] = set()
        self.classes: Set[int] = set()
        self.missions: Set[int] = set()
        self.key_names: Set[str] = set()
        self.refs: List[tuple] = []          # (rule, entity_type, entity_id, field, target, value)
        self.neighbors: List[tuple] = []     # (entity_id, frm, to, direction)
        self.key_refs: List[tuple] = []      # (entity_id, type, key)
        self.restrictions: List[tuple] = []  # (entity_type, entity_id, permitted, prohibited)
        self.templates: List[tuple] = []     # (entity_id, lifeMax, energyMax, dex, int, con, sadMax)
        self.event_next: Dict[int, int] = {}
        self.choice_otherwise: Dict[int, bool] = {}
        self.choices_with_option: Set[int] = set()


class StoryValidatorService(StoryValidatorPort):
    def __init__(self, read_port: StoryReadPort):
        self.read_port = read_port

    # ----- entry points -----

    def validate_import_data(self, story_data: Dict[str, Any]) -> StoryValidationReport:
        report = StoryValidationReport()
        if not story_data:
            report.add("R0_EMPTY", "story", None, None, "story data is null or empty")
            return report
        self._run_rules(self._build_from_map(story_data), report)
        return report

    def validate_story(self, story_id: int) -> StoryValidationReport:
        report = StoryValidationReport()
        if story_id is None:
            report.add("R0_EMPTY", "story", None, None, "storyId is null")
            return report
        self._run_rules(self._build_from_db(story_id), report)
        return report

    def validate_story_by_uuid(self, uuid: str) -> Optional[StoryValidationReport]:
        """Resolves a story uuid to its id and validates it. None if story not found."""
        story = self.read_port.find_story_by_uuid(uuid)
        if not story:
            return None
        sid = _as_int(_get(story, "id"))
        return self.validate_story(sid)

    def validate_entity(self, entity_type: str, data: Dict[str, Any]) -> StoryValidationReport:
        report = StoryValidationReport()
        if not entity_type or not data:
            return report
        eid = self._str(_get(data, "id"))
        if entity_type == "character-templates":
            self._template_local(entity_type, eid, data, report)
        elif entity_type in ("items", "traits"):
            self._class_conflict_local(entity_type, eid, data, report)
        elif entity_type == "difficulties":
            self._difficulty_local(entity_type, eid, data, report)
        return report

    # ----- rule engine -----

    def _run_rules(self, g: _Graph, report: StoryValidationReport) -> None:
        self._validate_refs(g, report)
        self._validate_neighbors(g, report)
        self._validate_event_chains(g, report)
        self._validate_choice_options(g, report)
        self._validate_keys(g, report)
        self._validate_templates(g, report)
        self._validate_restrictions(g, report)

    def _validate_refs(self, g: _Graph, report: StoryValidationReport) -> None:
        universe = {
            _LOCATION: g.locations, _EVENT: g.events, _ITEM: g.items,
            _CHOICE: g.choices, _CLASS: g.classes, _MISSION: g.missions,
        }
        for rule, etype, eid, fld, target, value in g.refs:
            if value is not None and value > 0 and value not in universe[target]:
                report.add(rule, etype, eid, fld,
                           f"{etype} {fld}={value} references a non-existent {target}")

    def _validate_neighbors(self, g: _Graph, report: StoryValidationReport) -> None:
        seen: Dict[str, Optional[int]] = {}
        for eid, frm, to, direction in g.neighbors:
            if frm is not None and to is not None and frm > 0 and frm == to:
                report.add("R2_NEIGHBOR_SELF", "location-neighbors", eid, "idLocationTo",
                           f"neighbor links location {frm} to itself")
            if not direction or not str(direction).strip():
                report.add("R2_NEIGHBOR_DIR", "location-neighbors", eid, "direction",
                           f"neighbor from location {frm} has no direction")
            elif frm is not None and frm > 0:
                key = f"{frm}/{str(direction).strip().upper()}"
                if key in seen and seen[key] != to:
                    report.add("R2_NEIGHBOR_DUP", "location-neighbors", eid, "direction",
                               f"location {frm} has two neighbors in direction {direction}")
                seen[key] = to

    def _validate_event_chains(self, g: _Graph, report: StoryValidationReport) -> None:
        color: Dict[int, int] = {}  # 0=visiting 1=done

        def visit(node: int) -> None:
            stack = [node]
            while stack:
                cur = stack[-1]
                c = color.get(cur)
                if c is None:
                    color[cur] = 0
                    nxt = g.event_next.get(cur)
                    if nxt and nxt > 0 and nxt in g.events:
                        nc = color.get(nxt)
                        if nc == 0:
                            report.add("R3_EVENT_CYCLE", "events", str(cur), "idEventNext",
                                       f"event chain forms a cycle at event {cur} -> {nxt}")
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

        for ev in g.events:
            if ev not in color:
                visit(ev)

    def _validate_choice_options(self, g: _Graph, report: StoryValidationReport) -> None:
        for cid, otherwise in g.choice_otherwise.items():
            if not otherwise and cid not in g.choices_with_option:
                report.add("R4_CHOICE_EMPTY", "choices", str(cid), None,
                           f"choice {cid} has no option (choice-effects) and no otherwise fallback")

    def _validate_keys(self, g: _Graph, report: StoryValidationReport) -> None:
        for eid, _ctype, key in g.key_refs:
            if key and str(key).strip() and str(key).strip().lower() not in g.key_names:
                report.add("R4_CONDITION_KEY", "choice-conditions", eid, "key",
                           f"choice-condition references unknown registry key '{key}'")

    def _validate_templates(self, g: _Graph, report: StoryValidationReport) -> None:
        for eid, life_max, energy_max, dex, intel, con, sad_max in g.templates:
            self._positive(report, "character-templates", eid, "lifeMax", life_max)
            self._positive(report, "character-templates", eid, "energyMax", energy_max)
            self._non_negative(report, "character-templates", eid, "dexterityStart", dex)
            self._non_negative(report, "character-templates", eid, "intelligenceStart", intel)
            self._non_negative(report, "character-templates", eid, "constitutionStart", con)
            self._non_negative(report, "character-templates", eid, "sadMax", sad_max)

    def _validate_restrictions(self, g: _Graph, report: StoryValidationReport) -> None:
        for etype, eid, permitted, prohibited in g.restrictions:
            if permitted is not None and prohibited is not None and permitted > 0 and permitted == prohibited:
                report.add("R6_CLASS_CONFLICT", etype, eid, "idClassPermitted",
                           f"{etype} {eid} has the same class permitted and prohibited ({permitted})")

    # ----- entity-local (lenient CRUD) -----

    def _template_local(self, t, eid, d, r):
        self._positive(r, t, eid, "lifeMax", _as_int(_get(d, "lifeMax")))
        self._positive(r, t, eid, "energyMax", _as_int(_get(d, "energyMax")))
        self._non_negative(r, t, eid, "dexterityStart", _as_int(_get(d, "dexterityStart")))
        self._non_negative(r, t, eid, "intelligenceStart", _as_int(_get(d, "intelligenceStart")))
        self._non_negative(r, t, eid, "constitutionStart", _as_int(_get(d, "constitutionStart")))
        self._non_negative(r, t, eid, "sadMax", _as_int(_get(d, "sadMax")))
        self._class_conflict_local(t, eid, d, r)

    def _class_conflict_local(self, t, eid, d, r):
        permitted = _as_int(_get(d, "idClassPermitted"))
        prohibited = _as_int(_get(d, "idClassProhibited"))
        if permitted and prohibited and permitted > 0 and permitted == prohibited:
            r.add("R6_CLASS_CONFLICT", t, eid, "idClassPermitted",
                  f"{t} has the same class permitted and prohibited ({permitted})")

    def _difficulty_local(self, t, eid, d, r):
        mn = _as_int(_get(d, "minCharacter"))
        mx = _as_int(_get(d, "maxCharacter"))
        if mn is not None and mx is not None and mx > 0 and mn > mx:
            r.add("R6_DIFFICULTY_RANGE", t, eid, "minCharacter",
                  f"minCharacter ({mn}) exceeds maxCharacter ({mx})")
        # Step 23 — trait cost budgets must not be negative (None = no limit)
        self._non_negative(r, t, eid, "traitCostPositiveBudget", _as_int(_get(d, "traitCostPositiveBudget")))
        self._non_negative(r, t, eid, "traitCostNegativeBudget", _as_int(_get(d, "traitCostNegativeBudget")))

    def _positive(self, r, t, eid, fld, v):
        if v is not None and v <= 0:
            r.add("R6_STAT_RANGE", t, eid, fld, f"{fld} must be positive but is {v}")

    def _non_negative(self, r, t, eid, fld, v):
        if v is not None and v < 0:
            r.add("R6_STAT_RANGE", t, eid, fld, f"{fld} must not be negative but is {v}")

    # ----- graph builders -----

    def _build_from_map(self, data: Dict[str, Any]) -> _Graph:
        g = _Graph()
        self._collect_ids(g.locations, data.get("locations"))
        self._collect_ids(g.events, data.get("events"))
        self._collect_ids(g.items, data.get("items"))
        self._collect_ids(g.choices, data.get("choices"))
        self._collect_ids(g.classes, data.get("classes"))
        self._collect_ids(g.missions, data.get("missions"))
        for k in data.get("keys") or []:
            name = _get(k, "name")
            if name:
                g.key_names.add(str(name).strip().lower())

        self._ref(g, "story", None, "idLocationStart", _LOCATION, _as_int(data.get("idLocationStart")))
        self._ref(g, "story", None, "idLocationAllPlayerComa", _LOCATION, _as_int(data.get("idLocationAllPlayerComa")))
        self._ref(g, "story", None, "idEventAllPlayerComa", _EVENT, _as_int(data.get("idEventAllPlayerComa")))
        self._ref(g, "story", None, "idEventEndGame", _EVENT, _as_int(data.get("idEventEndGame")))

        for e in data.get("events") or []:
            self._collect_event(g, e)
        for c in data.get("choices") or []:
            self._collect_choice(g, c)
        for ce in data.get("choiceEffects") or []:
            cid = _as_int(_get(ce, "idChoices"))
            if cid is not None:
                g.choices_with_option.add(cid)
            self._ref(g, "choice-effects", self._str(_get(ce, "id")), "idChoices", _CHOICE, cid)
        for cc in data.get("choiceConditions") or []:
            self._ref(g, "choice-conditions", self._str(_get(cc, "id")), "idChoices", _CHOICE, _as_int(_get(cc, "idChoices")))
            g.key_refs.append((self._str(_get(cc, "id")), _get(cc, "type"), _get(cc, "key")))
        for ee in data.get("eventEffects") or []:
            self._collect_event_effect(g, ee)
        for ie in data.get("itemEffects") or []:
            self._ref(g, "item-effects", self._str(_get(ie, "id")), "idItem", _ITEM, _as_int(_get(ie, "idItem")))
        for cb in data.get("classBonuses") or []:
            self._ref(g, "class-bonuses", self._str(_get(cb, "id")), "idClass", _CLASS, _as_int(_get(cb, "idClass")))
        for ms in data.get("missionSteps") or []:
            self._ref(g, "mission-steps", self._str(_get(ms, "id")), "idMission", _MISSION, _as_int(_get(ms, "idMission")))
        for wr in data.get("weatherRules") or []:
            self._ref(g, "weather-rules", self._str(_get(wr, "id")), "idEvent", _EVENT, _as_int(_get(wr, "idEvent")))
        for gr in data.get("globalRandomEvents") or []:
            self._ref(g, "global-random-events", self._str(_get(gr, "id")), "idEvent", _EVENT, _as_int(_get(gr, "idEvent")))
        for n in data.get("locationNeighbors") or []:
            self._collect_neighbor(g, n)
        for it in data.get("items") or []:
            self._restriction(g, "items", self._str(_get(it, "id")), _get(it, "idClassPermitted"), _get(it, "idClassProhibited"))
        for tr in data.get("traits") or []:
            self._restriction(g, "traits", self._str(_get(tr, "id")), _get(tr, "idClassPermitted"), _get(tr, "idClassProhibited"))
        for ct in data.get("characterTemplates") or []:
            self._collect_template(g, ct)
        return g

    def _build_from_db(self, story_id: int) -> _Graph:
        g = _Graph()
        rp = self.read_port
        locations = rp.find_locations_for_story(story_id)
        events = rp.find_events_for_story(story_id)
        items = rp.find_items_for_story(story_id)
        choices = rp.find_entities_for_story(story_id, "list_choices")
        classes = rp.find_classes_for_story(story_id)
        missions = rp.find_entities_for_story(story_id, "list_missions")
        for row in locations:
            self._add_id(g.locations, _get(row, "id"))
        for row in events:
            self._add_id(g.events, _get(row, "id"))
        for row in items:
            self._add_id(g.items, _get(row, "id"))
        for row in choices:
            self._add_id(g.choices, _get(row, "id"))
        for row in classes:
            self._add_id(g.classes, _get(row, "id"))
        for row in missions:
            self._add_id(g.missions, _get(row, "id"))
        for k in rp.find_entities_for_story(story_id, "list_keys"):
            name = _get(k, "name")
            if name:
                g.key_names.add(str(name).strip().lower())

        for e in events:
            self._collect_event(g, e)
        for c in choices:
            self._collect_choice(g, c)
        for ce in rp.find_entities_for_story(story_id, "list_choices_effects"):
            cid = _as_int(_get(ce, "idChoices"))
            if cid is not None:
                g.choices_with_option.add(cid)
            self._ref(g, "choice-effects", self._str(_get(ce, "id")), "idChoices", _CHOICE, cid)
        for cc in rp.find_entities_for_story(story_id, "list_choices_conditions"):
            self._ref(g, "choice-conditions", self._str(_get(cc, "id")), "idChoices", _CHOICE, _as_int(_get(cc, "idChoices")))
            g.key_refs.append((self._str(_get(cc, "id")), _get(cc, "type"), _get(cc, "key")))
        for ee in rp.find_entities_for_story(story_id, "list_events_effects"):
            self._collect_event_effect(g, ee)
        for ie in rp.find_entities_for_story(story_id, "list_items_effects"):
            self._ref(g, "item-effects", self._str(_get(ie, "id")), "idItem", _ITEM, _as_int(_get(ie, "idItem")))
        for cb in rp.find_class_bonuses_for_story(story_id):
            self._ref(g, "class-bonuses", self._str(_get(cb, "id")), "idClass", _CLASS, _as_int(_get(cb, "idClass")))
        for ms in rp.find_entities_for_story(story_id, "list_missions_steps"):
            self._ref(g, "mission-steps", self._str(_get(ms, "id")), "idMission", _MISSION, _as_int(_get(ms, "idMission")))
        for wr in rp.find_entities_for_story(story_id, "list_weather_rules"):
            self._ref(g, "weather-rules", self._str(_get(wr, "id")), "idEvent", _EVENT, _as_int(_get(wr, "idEvent")))
        for gr in rp.find_entities_for_story(story_id, "list_global_random_events"):
            self._ref(g, "global-random-events", self._str(_get(gr, "id")), "idEvent", _EVENT, _as_int(_get(gr, "idEvent")))
        for n in rp.find_entities_for_story(story_id, "list_locations_neighbors"):
            self._collect_neighbor(g, n)
        for it in items:
            self._restriction(g, "items", self._str(_get(it, "id")), _get(it, "idClassPermitted"), _get(it, "idClassProhibited"))
        for tr in rp.find_traits_for_story(story_id):
            self._restriction(g, "traits", self._str(_get(tr, "id")), _get(tr, "idClassPermitted"), _get(tr, "idClassProhibited"))
        for ct in rp.find_character_templates_for_story(story_id):
            self._collect_template(g, ct, id_key="idTipo")
        return g

    # ----- collectors shared by both builders -----

    def _collect_event(self, g, e):
        eid = self._str(_get(e, "id"))
        self._ref(g, "events", eid, "idSpecificLocation", _LOCATION, _as_int(_get(e, "idSpecificLocation")))
        self._ref(g, "events", eid, "idItemToAdd", _ITEM, _as_int(_get(e, "idItemToAdd")))
        self._ref(g, "events", eid, "idEventNext", _EVENT, _as_int(_get(e, "idEventNext")))
        my = _as_int(_get(e, "id"))
        nxt = _as_int(_get(e, "idEventNext"))
        if my is not None and nxt is not None:
            g.event_next[my] = nxt

    def _collect_choice(self, g, c):
        cid = self._str(_get(c, "id"))
        self._ref(g, "choices", cid, "idEvent", _EVENT, _as_int(_get(c, "idEvent")))
        self._ref(g, "choices", cid, "idLocation", _LOCATION, _as_int(_get(c, "idLocation")))
        self._ref(g, "choices", cid, "idEventTorun", _EVENT, _as_int(_get(c, "idEventTorun")))
        my = _as_int(_get(c, "id"))
        if my is not None:
            g.choice_otherwise[my] = _truthy(_get(c, "otherwiseFlag"))

    def _collect_event_effect(self, g, ee):
        eid = self._str(_get(ee, "id"))
        self._ref(g, "event-effects", eid, "idEvent", _EVENT, _as_int(_get(ee, "idEvent")))
        self._ref(g, "event-effects", eid, "idItemTarget", _ITEM, _as_int(_get(ee, "idItemTarget")))
        self._ref(g, "event-effects", eid, "targetClass", _CLASS, _as_int(_get(ee, "targetClass")))

    def _collect_neighbor(self, g, n):
        frm = _as_int(_get(n, "idLocationFrom"))
        to = _as_int(_get(n, "idLocationTo"))
        nid = self._str(_get(n, "id"))
        self._ref(g, "location-neighbors", nid, "idLocationFrom", _LOCATION, frm)
        self._ref(g, "location-neighbors", nid, "idLocationTo", _LOCATION, to)
        g.neighbors.append((nid, frm, to, _get(n, "direction")))

    def _collect_template(self, g, ct, id_key: str = "id"):
        eid = self._str(_get(ct, id_key) if _get(ct, id_key) is not None else _get(ct, "idTipo"))
        self._restriction(g, "character-templates", eid, _get(ct, "idClassPermitted"), _get(ct, "idClassProhibited"))
        g.templates.append((eid, _as_int(_get(ct, "lifeMax")), _as_int(_get(ct, "energyMax")),
                            _as_int(_get(ct, "dexterityStart")), _as_int(_get(ct, "intelligenceStart")),
                            _as_int(_get(ct, "constitutionStart")), _as_int(_get(ct, "sadMax"))))

    # ----- small helpers -----

    def _ref(self, g, etype, eid, fld, target, value):
        v = _as_int(value)
        if v is not None and v > 0:
            g.refs.append((_REF_RULES[target], etype, eid, fld, target, v))

    def _restriction(self, g, etype, eid, permitted, prohibited):
        p = _as_int(permitted)
        q = _as_int(prohibited)
        g.restrictions.append((etype, eid, p, q))
        if p is not None and p > 0:
            g.refs.append(("R6_CLASS_REF", etype, eid, "idClassPermitted", _CLASS, p))
        if q is not None and q > 0:
            g.refs.append(("R6_CLASS_REF", etype, eid, "idClassProhibited", _CLASS, q))

    def _collect_ids(self, target: Set[int], items: Optional[List[Dict[str, Any]]]):
        for it in items or []:
            self._add_id(target, _get(it, "id"))

    def _add_id(self, target: Set[int], raw: Any):
        v = _as_int(raw)
        if v is not None:
            target.add(v)

    def _str(self, v: Any) -> Optional[str]:
        return None if v is None else str(v)
