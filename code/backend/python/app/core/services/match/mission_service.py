"""MissionService - Step 37.

A mission is a projection of the registry: no operator of its own, no state table of its own,
and not one line of comparison code of its own. Every condition is read through
`registry_service.evaluate` with "=", which on a single-valued key means equality and on a set
key means CONTAINED IN. `condition_values` is an AND over that.

A blank `condition_key` makes the row invalid - it never activates, progresses or completes.
That is the exact opposite of the registry's own "blank key = no condition" rule, and
deliberately so: an unfinished mission must not open itself.

State lives on gaming_state_registry, one row per mission with its `id_mission` set, which is
what keeps it out of every player-facing registry read. Statuses never move backwards.
"""

from dataclasses import asdict, is_dataclass
from typing import Any, Dict, List, Optional

from app.core.models.match import location_entry_models as lem
from app.core.services.match import registry_service as registry

STATUS_AVAILABLE = "AVAILABLE"
STATUS_ACTIVE = "ACTIVE"
STATUS_COMPLETED = "COMPLETED"
STATUS_FAILED = "FAILED"

# The reserved key prefix of a bookkeeping row. Never declared in list_keys.
KEY_PREFIX = "mission:"

# v0.37.2 - the audit row of a mission that moved. The state row alone said WHERE a match
# stands and never HOW it got there: the timeline carried the registry write that opened a
# mission but not the opening. One writer, _transition, so a move can be neither missed nor
# doubled - the same rule REGISTRY_CHANGE follows.
MSG_MISSION_CHANGE = "MISSION_CHANGE"

_TERMINAL = (STATUS_COMPLETED, STATUS_FAILED)


def parse_values(condition_value: Optional[str],
                 condition_values: Optional[str]) -> List[str]:
    """The values a condition demands. `condition_values` is a PIPE-separated list, trimmed
    around each pipe with empty segments dropped, and when it holds anything at all it WINS
    over `condition_value` - having authored both is not an error."""
    out = []
    if condition_values is not None:
        out = [part.strip() for part in str(condition_values).split("|") if part.strip()]
    if out:
        return out
    if condition_value is not None and str(condition_value).strip():
        return [str(condition_value).strip()]
    return []


def satisfied(row: Optional[Dict[str, Any]], values: Dict[str, List[str]]) -> bool:
    """Whether one authored row's condition holds. A blank key, or a key with nothing to
    compare against, is never satisfied."""
    if not row:
        return False
    key = row.get("condition_key")
    if key is None or not str(key).strip():
        return False
    expected = parse_values(row.get("condition_value"), row.get("condition_values"))
    if not expected:
        return False
    actual = values.get(key, [])
    return all(registry.evaluate(registry.OP_EQ, v, actual) for v in expected)


class MissionService:
    """The mission engine: one pass per registry write, and the two reads the API needs."""

    def __init__(self, store, story_read_port=None, content_query_port=None):
        self.store = store
        self.story_read_port = story_read_port
        self.content_query_port = content_query_port
        # Set after construction: the engine and the event runner know each other in a circle.
        self.event_port = None
        self._depth = 0
        self._deferrals = 0
        self._pending: List[tuple] = []

    # ── deferral ─────────────────────────────────────────────────────────────

    def begin_deferral(self) -> None:
        """Hold completion events back until the caller is done. An event execution writes the
        characters it touched at the end, so firing a mission event in the middle of one would
        let a fresh execution read state the outer one has not written yet."""
        self._deferrals += 1

    def end_deferral(self) -> None:
        """Release one hold; when the last one goes, fire everything that queued up meanwhile."""
        self._deferrals = max(0, self._deferrals - 1)
        if self._deferrals == 0:
            self._drain()

    # ── the engine ───────────────────────────────────────────────────────────

    def on_registry_change(self, id_match: int, clock: Optional[int] = None,
                           id_story: Optional[int] = None) -> None:
        """Re-evaluate every mission of the match. Idempotent, so the cascade a completion
        event sets off simply re-enters and finds nothing left to do."""
        if id_story is None:
            id_story = self.store.find_story_id_by_match(id_match)
        if id_story is None or self.story_read_port is None:
            return
        if self._depth >= lem.MAX_ENTRY_DEPTH:
            return
        missions = self._missions(id_story)
        if not missions:
            return
        steps = self._steps_by_mission(id_story)
        values = self._registry_values(id_match)
        states = self._states(id_match)

        for mission in missions:
            self._advance(id_match, mission, steps.get(mission.get("id"), []), values,
                          states.get(mission.get("id")), clock)
        if self._deferrals == 0:
            self._drain()

    def on_story_end(self, id_match: int) -> None:
        """Everything still open when the story ends has failed; what never opened is ignored."""
        uuids = self._mission_uuids(self.store.find_story_id_by_match(id_match))
        for state in self.store.find_mission_states(id_match) or []:
            if state.get("status") in (STATUS_AVAILABLE, STATUS_ACTIVE):
                id_mission = state.get("id_mission")
                self.store.upsert_mission_state(
                    id_match, f"{KEY_PREFIX}{id_mission}", STATUS_FAILED,
                    id_mission, state.get("id_mission_steps"), None)
                # v0.37.2 - named by uuid like every other MISSION_CHANGE, so one reader parses
                # the whole timeline; the story is read once, at the end, for that alone.
                self.store.log_change(
                    id_match, None, None, None, None,
                    f"{MSG_MISSION_CHANGE} {uuids.get(id_mission, id_mission)} "
                    f"{state.get('status')} -> {STATUS_FAILED}")

    def _mission_uuids(self, id_story: Optional[int]) -> Dict[Any, str]:
        """Mission id to uuid for one story. Empty when the story cannot be read."""
        if id_story is None or self.story_read_port is None:
            return {}
        return {m.get("id"): _uuid_of(m) for m in self._missions(id_story)}

    def _advance(self, id_match: int, mission: Dict[str, Any], steps: List[Dict[str, Any]],
                 values: Dict[str, List[str]], state: Optional[Dict[str, Any]],
                 clock: Optional[int]) -> None:
        """One mission's transition. Steps may be satisfied out of order, so the walk closes
        every step already met from the one reached onward and stops at the first that is not."""
        fresh = state is None
        if fresh and not satisfied(mission, values):
            return
        status = STATUS_AVAILABLE if fresh else state.get("status")
        if status in _TERMINAL:
            return
        reached = None if fresh else state.get("id_mission_steps")

        index = _index_of(steps, reached) + 1
        moved = fresh
        closed = []
        # v0.37.2 — the steps this very pass closed, in order: each one gets a log row of its
        # own, so the timeline can narrate it with the STEP's card rather than the mission's.
        closed_steps = []
        while index < len(steps) and satisfied(steps[index], values):
            reached = steps[index].get("id")
            closed.append(steps[index].get("id_event_completed"))
            closed_steps.append(steps[index])
            index += 1
            moved = True
        if not moved:
            return
        # No steps at all: the mission's own condition is its completion condition.
        if index >= len(steps):
            status = STATUS_COMPLETED
        elif reached is not None:
            status = STATUS_ACTIVE
        self._transition(id_match, mission, None if fresh else state.get("status"), status,
                         reached, closed_steps, fresh, clock)
        for id_event in closed:
            self._queue(id_match, id_event)
        if status == STATUS_COMPLETED:
            self._queue(id_match, mission.get("id_event_completed"))

    def _transition(self, id_match: int, mission: Dict[str, Any], previous: Optional[str],
                    status: str, reached: Optional[int], closed_steps: List[Dict[str, Any]],
                    fresh: bool, clock: Optional[int]) -> None:
        """Write the state and say so on the log. The two belong together: a status the
        timeline does not mention is one nobody can explain after the fact.

        v0.37.2 — one pass can be several things happening at once, and each of them is its own
        row, because each is narrated by a different card: the MISSION's when it opens and again
        when it is over, the STEP's for every step the pass closed. A row naming a step is what
        tells the timeline which of the two to resolve."""
        self.store.upsert_mission_state(id_match, f"{KEY_PREFIX}{_uuid_of(mission)}", status,
                                        mission.get("id"), reached, clock)
        for step in _rows_of(closed_steps, status, fresh):
            detail = f"{MSG_MISSION_CHANGE} {_uuid_of(mission)} {previous or 'none'} -> {status}"
            if step is not None:
                # The step number the author wrote, not the row id: a person reads this.
                detail = f"{detail} step {step}"
            self.store.log_change(id_match, None, None, None, clock, detail)

    def _queue(self, id_match: int, id_event: Optional[int]) -> None:
        if id_event is not None and int(id_event) > 0:
            self._pending.append((id_match, int(id_event)))

    def _drain(self) -> None:
        """Completion events run after the state is written, so a re-entry sees it closed."""
        batch, self._pending = self._pending, []
        if self.event_port is None or not batch:
            return
        self._depth += 1
        try:
            for id_match, id_event in batch:
                self.event_port.run_mission_event(id_match, id_event, self._depth)
        finally:
            self._depth -= 1

    # ── reads for the API ────────────────────────────────────────────────────

    def list(self, id_match: int, id_story: Optional[int], status: Optional[str] = None,
             lang: str = "en") -> List[Dict[str, Any]]:
        """Every mission this match has reached, in the order the story authored them."""
        if id_story is None or self.story_read_port is None:
            return []
        states = self._states(id_match)
        if not states:
            return []
        steps = self._steps_by_mission(id_story)
        wanted = status.strip().upper() if status and status.strip() else None
        out = []
        for mission in self._missions(id_story):
            state = states.get(mission.get("id"))
            if state is None or (wanted and wanted != state.get("status")):
                continue
            out.append(self._to_model(mission, steps.get(mission.get("id"), []), state,
                                      id_story, lang))
        return out

    def detail(self, id_match: int, id_story: Optional[int], mission_uuid: Optional[str],
               lang: str = "en") -> Optional[Dict[str, Any]]:
        """One mission with all its steps. None when the story has no such mission, or the
        match has not reached it - the caller turns both into the same 404."""
        if id_story is None or self.story_read_port is None:
            return None
        if not mission_uuid or not str(mission_uuid).strip():
            return None
        mission = self.story_read_port.find_entity_by_story_and_uuid(
            id_story, "list_missions", mission_uuid)
        if not mission:
            return None
        state = self._states(id_match).get(mission.get("id"))
        if state is None:
            return None
        steps = self._steps_by_mission(id_story).get(mission.get("id"), [])
        return self._to_model(mission, steps, state, id_story, lang)

    def _to_model(self, mission: Dict[str, Any], steps: List[Dict[str, Any]],
                  state: Dict[str, Any], id_story: int, lang: str) -> Dict[str, Any]:
        # Everything up to the step reached is closed; a completed mission closes all of them.
        reached = _index_of(steps, state.get("id_mission_steps"))
        if state.get("status") == STATUS_COMPLETED:
            reached = len(steps) - 1
        out_steps = []
        for index, step in enumerate(steps):
            out_steps.append({
                "uuid": step.get("uuid"),
                "step": step.get("step"),
                "name": self._text(id_story, step.get("id_text_name"), lang, False),
                "description": self._text(id_story, step.get("id_text_description"), lang, True),
                "idCard": step.get("id_card"),
                "card": self._card(id_story, step.get("id_card"), lang),
                "done": index <= reached,
            })
        return {
            "uuid": mission.get("uuid"),
            "name": self._text(id_story, mission.get("id_text_name"), lang, False),
            "description": self._text(id_story, mission.get("id_text_description"), lang, True),
            "status": state.get("status"),
            "stepReached": steps[reached].get("step") if 0 <= reached < len(steps) else None,
            "stepsTotal": len(steps),
            "idCard": mission.get("id_card"),
            "card": self._card(id_story, mission.get("id_card"), lang),
            "steps": out_steps,
        }

    # ── plumbing ─────────────────────────────────────────────────────────────

    def _missions(self, id_story: int) -> List[Dict[str, Any]]:
        rows = self.story_read_port.find_entities_for_story(id_story, "list_missions") or []
        return sorted(rows, key=lambda m: (m.get("id") is None, m.get("id")))

    def _steps_by_mission(self, id_story: int) -> Dict[int, List[Dict[str, Any]]]:
        out: Dict[int, List[Dict[str, Any]]] = {}
        rows = self.story_read_port.find_entities_for_story(
            id_story, "list_missions_steps") or []
        for row in rows:
            id_mission = row.get("id_mission")
            if id_mission is not None:
                out.setdefault(id_mission, []).append(row)
        for steps in out.values():
            steps.sort(key=lambda s: (s.get("step") is None, s.get("step")))
        return out

    def _states(self, id_match: int) -> Dict[int, Dict[str, Any]]:
        out = {}
        for row in self.store.find_mission_states(id_match) or []:
            if row.get("id_mission") is not None:
                out[row["id_mission"]] = row
        return out

    def _registry_values(self, id_match: int) -> Dict[str, List[str]]:
        """The registry as the engine compares it: key to its whole set, mission rows out."""
        out: Dict[str, List[str]] = {}
        for row in self.store.find_by_match(id_match) or []:
            value = registry.render_row(row)
            values = out.setdefault(row.get("key"), [])
            if value is not None:
                values.append(value)
        return out

    def _text(self, id_story: int, id_text: Optional[int], lang: Optional[str],
              long_text: bool) -> Optional[str]:
        if id_text is None or self.story_read_port is None:
            return None
        effective = lang if lang and lang.strip() else "en"
        found = self.story_read_port.find_text_by_story_id_text_and_lang(id_story, id_text, effective)
        if not found and effective != "en":
            found = self.story_read_port.find_text_by_story_id_text_and_lang(id_story, id_text, "en")
        if not found:
            return None
        return found.get("long_text") if long_text else found.get("short_text")

    def _card(self, id_story: int, id_card: Optional[int], lang: str):
        # v0.37.2 — the port answers a CardInfo; the API answers JSON, so flatten it here.
        if self.content_query_port is None or id_card is None:
            return None
        card = self.content_query_port.get_card_by_story_id_and_card_id(id_story, id_card, lang)
        return asdict(card) if is_dataclass(card) and not isinstance(card, type) else card


def _rows_of(closed_steps: List[Dict[str, Any]], status: str, fresh: bool) -> List[Any]:
    """The rows one pass writes, as the step each names — None for the mission itself. A mission
    that opens says so, every step it closed says so, and a mission that is over says THAT too,
    after its last step."""
    rows: List[Any] = [None] if fresh else []
    rows.extend(step.get("step") for step in closed_steps)
    if status == STATUS_COMPLETED and closed_steps:
        rows.append(None)
    # Neither opened nor closed anything, yet the state moved: say it once, plainly.
    return rows or [None]


def _index_of(steps: List[Dict[str, Any]], reached: Optional[int]) -> int:
    """Position of the step already reached, or -1 when the match has closed none of them."""
    if reached is None:
        return -1
    for index, step in enumerate(steps):
        if step.get("id") == reached:
            return index
    return -1


def _uuid_of(mission: Dict[str, Any]) -> str:
    return mission.get("uuid") or str(mission.get("id"))
