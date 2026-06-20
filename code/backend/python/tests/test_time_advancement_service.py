"""Step 25 — unit tests for the time advancement & clock cycle service."""
import pytest

from app.core.models.match import turn_models as tm
from app.core.models.match.time_models import TimeAdvanced
from app.core.models.match.turn_models import TurnCycleError
from app.core.services.match.time_advancement_service import TimeAdvancementService


USER_ID = 7
MATCH_ID = 500
MATCH_UUID = "match-uuid"


class FakeTimeStore:
    """In-memory implementation of TimeStorePort."""

    def __init__(self, match=None, characters=None, users=None):
        self.match = match
        self.characters = characters or []
        self.users = users if users is not None else {"user-uuid": USER_ID}
        self.queue = []
        self.clock_history = []
        self.labels = ("hour", "hours")

    # ── turn-cycle store methods ──
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

    # ── time store methods ──
    def find_character_by_match_and_user(self, id_match, id_user):
        for c in self.characters:
            if c["id_user"] == id_user:
                return dict(c)
        return None

    def set_character_sleeping(self, id_match, id_character, sleeping):
        for c in self.characters:
            if c["id"] == id_character:
                c["is_sleeping"] = bool(sleeping)

    def wake_all_characters(self, id_match):
        for c in self.characters:
            c["is_sleeping"] = False

    def increment_match_clock(self, id_match):
        self.match["current_clock"] = (self.match["current_clock"] or 0) + 1
        return self.match["current_clock"]

    def insert_clock_history(self, id_match, clock):
        self.clock_history.append({"id_match": id_match, "clock": clock})

    def find_story_clock_labels(self, id_match, lang):
        return self.labels

    # ── Step 26 recovery store (no-op here: no story context) ──
    def load_recovery_context(self, id_match):
        return None


class RecordingPublisher:
    def __init__(self):
        self.events = []

    def publish(self, event):
        self.events.append(event)


def _match(**over):
    base = {
        "id": MATCH_ID,
        "uuid": MATCH_UUID,
        "status": "RUNNING",
        "current_clock": 3,
        "id_user_creator": USER_ID,
        "id_character_current_turn": 10,
    }
    base.update(over)
    return base


def _char(cid, uuid, energy=50, sleeping=False, id_user=USER_ID,
          dex=3, intl=3, cos=3, life=100):
    return {"id": cid, "uuid": uuid, "id_user": id_user,
            "dexterity": dex, "intelligence": intl, "constitution": cos,
            "life": life, "energy": energy, "is_sleeping": sleeping}


def _service(store, publisher=None):
    return TimeAdvancementService(store, publisher or RecordingPublisher())


# ── trigger logic ──────────────────────────────────────────────────────────

def test_all_done_true_when_all_sleeping():
    assert TimeAdvancementService._all_done(
        [_char(1, "a", sleeping=True), _char(2, "b", sleeping=True)])


def test_all_done_true_when_all_zero_energy():
    assert TimeAdvancementService._all_done(
        [_char(1, "a", energy=0), _char(2, "b", energy=-1)])


def test_all_done_false_when_one_active_with_energy():
    assert not TimeAdvancementService._all_done(
        [_char(1, "a", sleeping=True), _char(2, "b", energy=80, sleeping=False)])


def test_all_done_false_on_empty():
    assert not TimeAdvancementService._all_done([])


# ── sleep action ─────────────────────────────────────────────────────────────

def test_sleep_triggers_time_end_and_advances_clock():
    store = FakeTimeStore(match=_match(current_clock=3),
                          characters=[_char(10, "char-a", energy=50)])
    publisher = RecordingPublisher()
    result = _service(store, publisher).sleep(MATCH_UUID, "user-uuid")

    assert result.time_end_triggered is True
    assert result.current_clock == 4
    assert result.is_sleeping is False  # woke up at time start
    assert store.clock_history == [{"id_match": MATCH_ID, "clock": 4}]
    assert all(not c["is_sleeping"] for c in store.characters)
    assert len(publisher.events) == 1
    assert isinstance(publisher.events[0], TimeAdvanced)
    assert publisher.events[0].new_clock == 4


def test_sleep_without_trigger_keeps_clock():
    store = FakeTimeStore(
        match=_match(current_clock=3),
        characters=[_char(10, "char-a", energy=50),
                    _char(20, "char-b", energy=90, id_user=99)])
    publisher = RecordingPublisher()
    result = _service(store, publisher).sleep(MATCH_UUID, "user-uuid")

    assert result.time_end_triggered is False
    assert result.current_clock == 3
    assert result.is_sleeping is True
    assert store.clock_history == []
    assert publisher.events == []


def test_sleep_rebuilds_queue_active_highest_priority():
    store = FakeTimeStore(
        match=_match(current_clock=0),
        characters=[_char(1, "a", energy=0, dex=9, intl=9, cos=9),
                    _char(2, "b", energy=0, dex=1, intl=1, cos=1)])
    _service(store).sleep(MATCH_UUID, "user-uuid")

    assert len(store.queue) == 2
    top = store.queue[0]
    assert top["id_character_match"] == 1
    assert top["status"] == tm.ACTIVE
    assert top["clock"] == 1
    assert store.queue[1]["status"] == tm.WAITING
    assert store.match["id_character_current_turn"] == 1


def test_sleep_not_running_raises_409():
    store = FakeTimeStore(match=_match(status="CREATED"),
                          characters=[_char(10, "char-a")])
    with pytest.raises(TurnCycleError) as exc:
        _service(store).sleep(MATCH_UUID, "user-uuid")
    assert exc.value.code == TurnCycleError.MATCH_NOT_RUNNING


def test_sleep_unknown_match_raises_404():
    store = FakeTimeStore(match=None)
    with pytest.raises(TurnCycleError) as exc:
        _service(store).sleep(MATCH_UUID, "user-uuid")
    assert exc.value.code == TurnCycleError.MATCH_NOT_FOUND


def test_sleep_caller_without_character_raises_404():
    store = FakeTimeStore(match=_match(),
                          characters=[_char(10, "char-a", id_user=99)])
    with pytest.raises(TurnCycleError) as exc:
        _service(store).sleep(MATCH_UUID, "user-uuid")
    assert exc.value.code == TurnCycleError.MATCH_NOT_FOUND


# ── clock query ──────────────────────────────────────────────────────────────

def test_clock_returns_labels_and_character_state():
    store = FakeTimeStore(match=_match(current_clock=5),
                          characters=[_char(10, "char-a", energy=40, sleeping=True)])
    result = _service(store).clock(MATCH_UUID, "user-uuid")

    assert result.current_clock == 5
    assert result.clock_label_singular == "hour"
    assert result.clock_label_plural == "hours"
    assert result.any_character_sleeping is True
    assert len(result.characters) == 1
    assert result.characters[0].energy == 40
    assert result.characters[0].is_sleeping is True


def test_clock_rejects_non_creator():
    store = FakeTimeStore(match=_match(id_user_creator=999),
                          characters=[_char(10, "char-a")])
    with pytest.raises(TurnCycleError) as exc:
        _service(store).clock(MATCH_UUID, "user-uuid")
    assert exc.value.code == TurnCycleError.MATCH_NOT_FOUND
