"""Step 39 — unit tests for the random event selection service."""
import random

from app.core.services.match.random_event_selection_service import (
    SEED_SALT,
    RandomEventSelectionService as Svc,
)


def _row(id, probability, id_event=None, event_type="AUTOMATIC", exists=True, choices=False,
         key=None, value=None, op=None):
    return {"id": id, "id_event": id_event if id_event is not None else 50 + id,
            "probability": probability, "condition_key": key, "condition_value": value,
            "registry_value_operator_condition": op, "event_exists": exists,
            "event_type": event_type, "event_owns_choices": choices}


class FakeStore:
    def __init__(self, ctx=None, rows=None, consumed=None):
        self._ctx = ctx
        self._rows = rows
        self._consumed = consumed or set()
        self.rows_asked = False

    def load_context(self, id_match):
        return self._ctx

    def find_random_events(self, id_story):
        self.rows_asked = True
        return self._rows

    def find_consumed_event_ids(self, id_match):
        return self._consumed


class FakeRegistry:
    def __init__(self, values=None):
        self.values = values or {}
        self.asked = []

    def find(self, id_match, key):
        self.asked.append(key)
        return self.values.get(key, [])


def _running(clock=2, seed=42):
    return {"id_story": 7, "current_clock": clock, "rng_seed": seed, "status": "RUNNING"}


def _pick(rows, ctx=None, consumed=None, registry=None):
    store = FakeStore(ctx or _running(), rows, consumed)
    return Svc(store, registry or FakeRegistry()).pick_at_time_start(1)


# ── guards ───────────────────────────────────────────────────────────────────

def test_unknown_match_picks_nothing():
    assert Svc(FakeStore(None), FakeRegistry()).pick_at_time_start(1) is None


def test_not_running_picks_nothing_without_reading_rows():
    store = FakeStore({"id_story": 7, "current_clock": 3, "status": "ENDED"}, [_row(1, 100)])
    assert Svc(store, FakeRegistry()).pick_at_time_start(1) is None
    assert store.rows_asked is False


def test_clock_zero_never_fires():
    assert _pick([_row(1, 100)], ctx=_running(clock=0)) is None


def test_no_rows_picks_nothing():
    assert _pick([]) is None
    assert _pick(None) is None


# ── eligibility ──────────────────────────────────────────────────────────────

def test_a_row_at_100_always_fires_and_one_at_0_never():
    assert _pick([_row(1, 100, 11), _row(2, 0, 12)]) == {"id_random_event": 1, "id_event": 11}
    assert _pick([_row(2, 0, 12)]) is None


def test_spent_once_is_out_spent_normal_stays():
    rows = [_row(1, 100, 11, event_type="ONCE"), _row(2, 100, 12, event_type="NORMAL")]
    assert _pick(rows, consumed={11, 12})["id_event"] == 12


def test_choices_dangling_and_missing_events_are_out():
    rows = [_row(1, 100, 11, choices=True), _row(2, 100, 12, exists=False),
            {**_row(3, 100), "id_event": None}, _row(4, 100, 0)]
    assert _pick(rows) is None


def test_condition_with_operator():
    rows = [_row(1, 100, key="storm", value="yes", op="!="),
            _row(2, 100, key="storm", value="yes")]
    assert _pick(rows, registry=FakeRegistry({"storm": ["yes"]}))["id_random_event"] == 2


def test_condition_not_met():
    assert _pick([_row(1, 100, key="level", value="3", op=">")],
                 registry=FakeRegistry({"level": ["2"]})) is None


def test_blank_key_is_no_condition():
    registry = FakeRegistry()
    assert _pick([_row(1, 100, key=" ")], registry=registry) is not None
    assert registry.asked == []


# ── the absolute-percentage pick ─────────────────────────────────────────────

def test_order_probability_desc_then_id_asc():
    ordered = Svc.order([_row(3, 10), _row(1, 30), _row(2, 10)])
    assert [r["id"] for r in ordered] == [1, 2, 3]


def test_walk_ranges_and_past_the_total():
    ordered = [_row(1, 30), _row(2, 10)]
    assert Svc.walk(ordered, 0)["id"] == 1
    assert Svc.walk(ordered, 29)["id"] == 1
    assert Svc.walk(ordered, 39)["id"] == 2
    assert Svc.walk(ordered, 40) is None
    assert Svc.walk(ordered, 99) is None


def test_pick_rolls_over_max_100_total_with_the_seed():
    eligible = [_row(1, 10), _row(2, 30)]
    for seed in range(50):
        roll = random.Random(seed).randrange(100)
        assert Svc.pick(eligible, seed) == Svc.walk(Svc.order(eligible), roll)


def test_total_above_100_scales_and_always_fires():
    eligible = [_row(1, 70), _row(2, 60)]
    assert Svc.total(eligible) == 130
    assert all(Svc.pick(eligible, seed) is not None for seed in range(200))


def test_nothing_eligible_picks_nothing():
    assert Svc.pick([], 1) is None


def test_seed_uses_rng_seed_or_story_plus_clock_plus_salt():
    assert Svc.seed_for(_running(clock=3, seed=42)) == 42 + 3 + SEED_SALT
    assert Svc.seed_for(_running(clock=3, seed=None)) == 7 + 3 + SEED_SALT


def test_float_probability_is_read_as_int():
    """The Python column is Float: 100.0 must behave as 100."""
    assert _pick([_row(1, 100.0)]) is not None


def test_is_runnable_tolerates_no_consumed_set():
    assert Svc.is_runnable(_row(1, 5, 11, event_type="ONCE"), None)
