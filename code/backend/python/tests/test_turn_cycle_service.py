"""Step 24 — unit tests for the single-player turn cycle service."""
import pytest

from app.core.models.match import turn_models as tm
from app.core.models.match.turn_models import PassResult, TurnCycleError, TurnSequenceResult
from app.core.services.match.turn_cycle_service import TurnCycleService


USER_ID = 7
OTHER_USER_ID = 9
MATCH_ID = 500
MATCH_UUID = "match-uuid"


class FakeStore:
    """In-memory implementation of TurnCycleStorePort."""

    def __init__(self, match=None, characters=None, users=None):
        self.match = match
        self.characters = characters or []
        self.users = users if users is not None else {"user-uuid": USER_ID}
        self.queue = []  # list of row dicts

    def find_match_by_uuid(self, uuid):
        if self.match and self.match["uuid"] == uuid:
            return dict(self.match)
        return None

    def find_characters_by_match_id(self, id_match):
        return [dict(c) for c in self.characters]

    def replace_queue(self, id_match, rows):
        self.queue = [dict(r) for r in rows]

    def find_queue_by_match_id(self, id_match):
        return sorted((dict(r) for r in self.queue),
                      key=lambda r: r["priority"], reverse=True)

    def save_queue_row(self, id_match, row):
        for i, r in enumerate(self.queue):
            if r["id_character_match"] == row["id_character_match"]:
                self.queue[i] = dict(row)
                return

    def update_match_status_and_turn(self, id_match, status, id_character_current_turn):
        self.match["status"] = status
        self.match["id_character_current_turn"] = id_character_current_turn

    def find_user_id_by_uuid(self, user_uuid):
        return self.users.get(user_uuid)


def _match(**over):
    base = {
        "id": MATCH_ID,
        "uuid": MATCH_UUID,
        "status": "CREATED",
        "current_clock": 0,
        "id_user_creator": USER_ID,
        "id_character_current_turn": None,
    }
    base.update(over)
    return base


def _char(cid, uuid, dex=3, intl=3, cos=3, life=10, id_user=USER_ID):
    return {"id": cid, "uuid": uuid, "id_user": id_user,
            "dexterity": dex, "intelligence": intl, "constitution": cos, "life": life}


def _service(store):
    return TurnCycleService(store)


# ── compute_priority ─────────────────────────────────────────────────────────

def test_compute_priority_formula():
    # (3*3 + 3*2 + 3) * 1000 + 10*10 + 5 = 18000 + 100 + 5
    assert tm.compute_priority(3, 3, 3, 10, 5) == 18105


def test_compute_priority_dexterity_dominates():
    high_dex = tm.compute_priority(5, 1, 1, 1, 1)
    low_dex = tm.compute_priority(1, 1, 1, 1, 1)
    assert high_dex > low_dex


# ── start_match ──────────────────────────────────────────────────────────────

def test_start_match_transitions_to_running_with_one_active():
    store = FakeStore(_match(), [_char(1, "c1"), _char(2, "c2", dex=5)])
    result = _service(store).start_match(MATCH_UUID, "user-uuid")
    assert isinstance(result, TurnSequenceResult)
    assert result.status == "RUNNING"
    actives = [e for e in result.queue if e.status == tm.ACTIVE]
    assert len(actives) == 1
    assert result.active_character_uuid is not None


def test_start_match_activates_highest_priority():
    # c2 has higher dexterity -> higher priority -> active.
    store = FakeStore(_match(), [_char(1, "c1", dex=1), _char(2, "c2", dex=9)])
    result = _service(store).start_match(MATCH_UUID, "user-uuid")
    assert result.active_character_uuid == "c2"


def test_start_match_queue_ordered_by_priority_desc():
    store = FakeStore(_match(), [_char(1, "c1", dex=1), _char(2, "c2", dex=9),
                                 _char(3, "c3", dex=5)])
    result = _service(store).start_match(MATCH_UUID, "user-uuid")
    priorities = [e.priority for e in result.queue]
    assert priorities == sorted(priorities, reverse=True)


def test_start_match_not_created_raises():
    store = FakeStore(_match(status="RUNNING"), [_char(1, "c1")])
    with pytest.raises(TurnCycleError) as exc:
        _service(store).start_match(MATCH_UUID, "user-uuid")
    assert exc.value.code == TurnCycleError.MATCH_NOT_STARTABLE


def test_start_match_no_characters_raises():
    store = FakeStore(_match(), [])
    with pytest.raises(TurnCycleError) as exc:
        _service(store).start_match(MATCH_UUID, "user-uuid")
    assert exc.value.code == TurnCycleError.NO_CHARACTERS_JOINED


def test_start_match_unknown_raises_not_found():
    store = FakeStore(None, [])
    with pytest.raises(TurnCycleError) as exc:
        _service(store).start_match("nope", "user-uuid")
    assert exc.value.code == TurnCycleError.MATCH_NOT_FOUND


def test_start_match_not_owner_raises_not_found():
    store = FakeStore(_match(id_user_creator=OTHER_USER_ID), [_char(1, "c1")])
    with pytest.raises(TurnCycleError) as exc:
        _service(store).start_match(MATCH_UUID, "user-uuid")
    assert exc.value.code == TurnCycleError.MATCH_NOT_FOUND


def test_unknown_user_raises_not_found():
    store = FakeStore(_match(), [_char(1, "c1")], users={})
    with pytest.raises(TurnCycleError) as exc:
        _service(store).start_match(MATCH_UUID, "user-uuid")
    assert exc.value.code == TurnCycleError.MATCH_NOT_FOUND


# ── pass_turn ────────────────────────────────────────────────────────────────

def test_pass_turn_advances_cycle():
    store = FakeStore(_match(), [_char(1, "c1", dex=9), _char(2, "c2", dex=1)])
    svc = _service(store)
    svc.start_match(MATCH_UUID, "user-uuid")
    result = svc.pass_turn(MATCH_UUID, "user-uuid")
    assert isinstance(result, PassResult)
    assert result.status == "RUNNING"
    assert result.passed_character_uuid == "c1"
    assert result.next_active_character_uuid == "c2"


def test_pass_turn_increments_pass_counter():
    store = FakeStore(_match(), [_char(1, "c1", dex=9), _char(2, "c2", dex=1)])
    svc = _service(store)
    svc.start_match(MATCH_UUID, "user-uuid")
    svc.pass_turn(MATCH_UUID, "user-uuid")
    seq = svc.get_turn_sequence(MATCH_UUID, "user-uuid")
    assert max(e.pass_counter for e in seq.queue) >= 1


def test_pass_turn_new_round_resets_when_all_completed():
    store = FakeStore(_match(), [_char(1, "c1", dex=9)])
    svc = _service(store)
    svc.start_match(MATCH_UUID, "user-uuid")
    # Only one character: passing completes it, then a new round re-activates it.
    result = svc.pass_turn(MATCH_UUID, "user-uuid")
    assert result.next_active_character_uuid == "c1"


def test_pass_turn_not_running_raises():
    store = FakeStore(_match(), [_char(1, "c1")])
    with pytest.raises(TurnCycleError) as exc:
        _service(store).pass_turn(MATCH_UUID, "user-uuid")
    assert exc.value.code == TurnCycleError.MATCH_NOT_RUNNING


def test_pass_turn_not_your_turn_raises():
    store = FakeStore(_match(), [_char(1, "c1", id_user=OTHER_USER_ID)],
                      users={"user-uuid": USER_ID, "other-uuid": OTHER_USER_ID})
    svc = _service(store)
    # Owner starts the match (owns the match, but the only character belongs to another user).
    svc.start_match(MATCH_UUID, "user-uuid")
    with pytest.raises(TurnCycleError) as exc:
        svc.pass_turn(MATCH_UUID, "user-uuid")
    assert exc.value.code == TurnCycleError.NOT_YOUR_TURN


# ── get_turn_sequence ────────────────────────────────────────────────────────

def test_get_turn_sequence_returns_queue():
    store = FakeStore(_match(), [_char(1, "c1"), _char(2, "c2")])
    svc = _service(store)
    svc.start_match(MATCH_UUID, "user-uuid")
    seq = svc.get_turn_sequence(MATCH_UUID, "user-uuid")
    assert seq.status == "RUNNING"
    assert len(seq.queue) == 2


def test_get_turn_sequence_other_user_raises_not_found():
    store = FakeStore(_match(), [_char(1, "c1")],
                      users={"user-uuid": USER_ID, "other-uuid": OTHER_USER_ID})
    svc = _service(store)
    svc.start_match(MATCH_UUID, "user-uuid")
    with pytest.raises(TurnCycleError) as exc:
        svc.get_turn_sequence(MATCH_UUID, "other-uuid")
    assert exc.value.code == TurnCycleError.MATCH_NOT_FOUND
