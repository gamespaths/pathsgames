"""Step 37 — the mission engine, as a module of free functions like registry.py.

A mission is a projection of the registry: no operator of its own, no state store of its own,
and not one line of comparison code of its own. Every condition goes through
``registry.evaluate`` with "=", which on a single-valued key means equality and on a set key
means CONTAINED IN. ``conditionValues`` is an AND over that.

A blank ``conditionKey`` makes the row invalid — it never activates, progresses or completes.
That is the exact opposite of the registry's own "blank key = no condition" rule, and
deliberately so: an unfinished mission must not open itself.

State rides on the match item's ``registry`` list, one row per mission carrying ``idMission``,
which is exactly what keeps it out of every player-facing registry read.
"""
import uuid as _uuid

from common.data_utils import resolve_card_from_raw as _card, resolve_raw_text as _text
from common.data_utils import safe_int as _int
from match import registry as _registry

STATUS_AVAILABLE = 'AVAILABLE'
STATUS_ACTIVE = 'ACTIVE'
STATUS_COMPLETED = 'COMPLETED'
STATUS_FAILED = 'FAILED'

# The reserved key prefix of a bookkeeping row. Never declared in the story's keys.
KEY_PREFIX = 'mission:'

_TERMINAL = (STATUS_COMPLETED, STATUS_FAILED)


# ── conditions ──────────────────────────────────────────────────────────────

def parse_values(condition_value, condition_values):
    """The values a condition demands. ``conditionValues`` is a PIPE-separated list, trimmed
    around each pipe with empty segments dropped, and when it holds anything at all it WINS
    over ``conditionValue`` — having authored both is not an error."""
    out = []
    if condition_values is not None:
        out = [p.strip() for p in str(condition_values).split('|') if p.strip()]
    if out:
        return out
    if condition_value is not None and str(condition_value).strip():
        return [str(condition_value).strip()]
    return []


def satisfied(row, values):
    """Whether one authored row's condition holds. A blank key, or a key with nothing to
    compare against, is never satisfied."""
    if not row:
        return False
    key = row.get('conditionKey')
    if key is None or not str(key).strip():
        return False
    expected = parse_values(row.get('conditionValue'), row.get('conditionValues'))
    if not expected:
        return False
    actual = (values or {}).get(key, [])
    return all(_registry.evaluate(_registry.OP_EQ, v, actual) for v in expected)


# ── the engine ──────────────────────────────────────────────────────────────

def evaluate(match, story, clock=None):
    """Re-evaluate every mission of the match, writing the state rows in place and returning
    the completion events that are now due, steps first and in order.

    Idempotent: the cascade a completion event sets off simply re-enters and finds nothing
    left to do.
    """
    missions = sorted((story or {}).get('missions') or [],
                      key=lambda m: (_int(m.get('id')) is None, _int(m.get('id')) or 0))
    if not missions:
        return []
    steps = _steps_by_mission(story)
    values = _registry.load_all(match)
    states = {_int(r.get('idMission')): r for r in _registry.mission_states(match)}

    pending = []
    for mission in missions:
        pending.extend(_advance(match, mission, steps.get(_int(mission.get('id'))) or [],
                                values, states.get(_int(mission.get('id'))), clock))
    return pending


def on_story_end(match):
    """Everything still open when the story ends has failed; what never opened is ignored."""
    for row in _registry.mission_states(match):
        if row.get('stringValue') in (STATUS_AVAILABLE, STATUS_ACTIVE):
            row['stringValue'] = STATUS_FAILED


def _advance(match, mission, steps, values, state, clock):
    """One mission's transition. Steps may be satisfied out of order, so the walk closes every
    step already met from the one reached onward and stops at the first that is not."""
    fresh = state is None
    if fresh and not satisfied(mission, values):
        return []
    status = STATUS_AVAILABLE if fresh else state.get('stringValue')
    if status in _TERMINAL:
        return []
    reached = None if fresh else _int(state.get('idMissionSteps'))

    index = _index_of(steps, reached) + 1
    moved = fresh
    closed = []
    while index < len(steps) and satisfied(steps[index], values):
        reached = _int(steps[index].get('id'))
        closed.append(steps[index].get('idEventCompleted'))
        index += 1
        moved = True
    if not moved:
        return []
    # No steps at all: the mission's own condition is its completion condition.
    if index >= len(steps):
        status = STATUS_COMPLETED
    elif reached is not None:
        status = STATUS_ACTIVE

    _write(match, mission, state, status, reached, clock)
    pending = [e for e in closed if e is not None and _int(e) and _int(e) > 0]
    if status == STATUS_COMPLETED:
        own = mission.get('idEventCompleted')
        if own is not None and _int(own) and _int(own) > 0:
            pending.append(own)
    return [_int(e) for e in pending]


def _write(match, mission, state, status, reached, clock):
    if state is None:
        state = {
            'id': _next_id(match),
            'uuid': str(_uuid.uuid4()),
            'key': f"{KEY_PREFIX}{mission.get('uuid') or mission.get('id')}",
            'multiValue': 0,
            'idMission': _int(mission.get('id')),
        }
        match.setdefault('registry', []).append(state)
    state['stringValue'] = status
    state['idMissionSteps'] = reached
    state['clock'] = clock


def _next_id(match):
    return max([r.get('id') or 0 for r in (match or {}).get('registry') or []] or [0]) + 1


def _steps_by_mission(story):
    out = {}
    for row in (story or {}).get('missionSteps') or []:
        id_mission = _int(row.get('idMission'))
        if id_mission is not None:
            out.setdefault(id_mission, []).append(row)
    for steps in out.values():
        steps.sort(key=lambda s: (_int(s.get('step')) is None, _int(s.get('step')) or 0))
    return out


def _index_of(steps, reached):
    """Position of the step already reached, or -1 when the match has closed none of them."""
    if reached is None:
        return -1
    for index, step in enumerate(steps):
        if _int(step.get('id')) == reached:
            return index
    return -1


# ── the API reads ───────────────────────────────────────────────────────────

def list_missions(match, story, status=None, lang='en'):
    """Every mission this match has reached, in the order the story authored them. A mission
    never reached is absent: listing it would spoil it."""
    states = {_int(r.get('idMission')): r for r in _registry.mission_states(match)}
    if not states:
        return []
    steps = _steps_by_mission(story)
    wanted = status.strip().upper() if status and str(status).strip() else None
    raw_texts = (story or {}).get('raw_texts') or []
    raw_cards = (story or {}).get('raw_cards') or []
    out = []
    for mission in sorted((story or {}).get('missions') or [],
                          key=lambda m: (_int(m.get('id')) is None, _int(m.get('id')) or 0)):
        state = states.get(_int(mission.get('id')))
        if state is None or (wanted and wanted != state.get('stringValue')):
            continue
        out.append(_to_payload(mission, steps.get(_int(mission.get('id'))) or [], state,
                               raw_texts, raw_cards, lang))
    return out


def find_mission(match, story, mission_uuid, lang='en'):
    """One mission with all its steps. None when the story has no such mission, or the match
    has not reached it — the caller turns both into the same 404."""
    if not mission_uuid or not str(mission_uuid).strip():
        return None
    mission = next((m for m in (story or {}).get('missions') or []
                    if m.get('uuid') == mission_uuid), None)
    if not mission:
        return None
    states = {_int(r.get('idMission')): r for r in _registry.mission_states(match)}
    state = states.get(_int(mission.get('id')))
    if state is None:
        return None
    return _to_payload(mission, _steps_by_mission(story).get(_int(mission.get('id'))) or [],
                       state, (story or {}).get('raw_texts') or [],
                       (story or {}).get('raw_cards') or [], lang)


def _to_payload(mission, steps, state, raw_texts, raw_cards, lang):
    # Everything up to the step reached is closed; a completed mission closes all of them.
    reached = _index_of(steps, _int(state.get('idMissionSteps')))
    if state.get('stringValue') == STATUS_COMPLETED:
        reached = len(steps) - 1
    return {
        'uuid': mission.get('uuid'),
        'name': _text(raw_texts, mission.get('idTextName'), lang),
        'description': _text(raw_texts, mission.get('idTextDescription'), lang),
        'status': state.get('stringValue'),
        'stepReached': _int(steps[reached].get('step')) if 0 <= reached < len(steps) else None,
        'stepsTotal': len(steps),
        'idCard': mission.get('idCard'),
        'card': _card(raw_cards, raw_texts, mission.get('idCard'), lang),
        'steps': [{
            'uuid': step.get('uuid'),
            'step': _int(step.get('step')),
            'name': _text(raw_texts, step.get('idTextName'), lang),
            'description': _text(raw_texts, step.get('idTextDescription'), lang),
            'idCard': step.get('idCard'),
            'card': _card(raw_cards, raw_texts, step.get('idCard'), lang),
            'done': index <= reached,
        } for index, step in enumerate(steps)],
    }
