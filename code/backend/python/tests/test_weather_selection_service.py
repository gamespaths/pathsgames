"""Step 27 — unit tests for the weather selection service."""
from app.core.services.match.weather_selection_service import WeatherSelectionService


def _rule(id, probability=50, time_from=None, time_to=None,
          condition_key=None, condition_key_value=None, delta_energy=0, id_event=None):
    return {
        "id": id, "uuid": f"w-{id}", "probability": probability,
        "time_from": time_from, "time_to": time_to,
        "condition_key": condition_key, "condition_key_value": condition_key_value,
        "delta_energy": delta_energy, "id_event": id_event, "id_text_name": 100 + id,
    }


class FakeStore:
    def __init__(self, ctx=None, rules=None, characters=None, registry=None):
        self._ctx = ctx
        self._rules = rules or []
        self._characters = characters or []
        self._registry = registry or {}
        self.current_weather_set = "UNSET"
        self.logged = []
        self.energy_updates = []
        self.events = []

    def load_context(self, id_match):
        return self._ctx

    def find_active_weather_rules(self, id_story):
        return self._rules


    def find_characters(self, id_match):
        return self._characters

    def update_character_energy(self, id_match, id_character, energy):
        self.energy_updates.append((id_character, energy))

    def set_current_weather(self, id_match, id_weather):
        self.current_weather_set = id_weather

    def insert_log_weather(self, id_match, clock, id_weather):
        self.logged.append((clock, id_weather))

    def log_weather_event(self, id_match, id_event, message):
        self.events.append(id_event)


# ── pure helpers ──────────────────────────────────────────────────────────────

def test_time_matches_open_bounds():
    assert WeatherSelectionService.time_matches(_rule(1), 5) is True


def test_time_matches_below_from():
    assert WeatherSelectionService.time_matches(_rule(1, time_from=3, time_to=9), 2) is False


def test_time_matches_above_to():
    assert WeatherSelectionService.time_matches(_rule(1, time_from=3, time_to=9), 10) is False


def test_time_matches_inside_inclusive():
    assert WeatherSelectionService.time_matches(_rule(1, time_from=3, time_to=9), 9) is True


def test_weighted_pick_zero_weights_returns_first():
    a, b = _rule(1, probability=0), _rule(2, probability=0)
    assert WeatherSelectionService._weighted_pick([a, b], 42)["id"] == 1


def test_weighted_pick_is_deterministic():
    a, b = _rule(1, probability=50), _rule(2, probability=50)
    first = WeatherSelectionService._weighted_pick([a, b], 42)["id"]
    second = WeatherSelectionService._weighted_pick([a, b], 42)["id"]
    assert first == second


def test_weighted_pick_dominating_weight():
    a, b = _rule(1, probability=1), _rule(2, probability=999)
    for seed in range(20):
        assert WeatherSelectionService._weighted_pick([a, b], seed)["id"] == 2


# ── apply_at_time_start ───────────────────────────────────────────────────────

def test_empty_context_returns_none():
    store = FakeStore(ctx=None)
    out = WeatherSelectionService(store, _FakeRegistry(store._registry)).apply_at_time_start(1)
    assert out["selected"] is False
    assert store.current_weather_set == "UNSET"
    assert store.logged == []


def test_no_eligible_clears_weather():
    store = FakeStore(ctx={"id_story": 7, "current_clock": 5, "rng_seed": 42},
                      rules=[_rule(1, time_from=0, time_to=2, delta_energy=-3)])
    out = WeatherSelectionService(store, _FakeRegistry(store._registry)).apply_at_time_start(1)
    assert out["selected"] is False
    assert store.current_weather_set is None
    assert store.logged == []


def test_selects_logs_and_applies_clamped_delta():
    store = FakeStore(
        ctx={"id_story": 7, "current_clock": 0, "rng_seed": 42},
        rules=[_rule(9, probability=100, delta_energy=-5)],
        characters=[{"id": 100, "energy": 3, "energy_max": 50},
                    {"id": 101, "energy": 20, "energy_max": 50}])
    out = WeatherSelectionService(store, _FakeRegistry(store._registry)).apply_at_time_start(1)
    assert out["selected"] is True and out["id_weather"] == 9
    assert store.current_weather_set == 9
    assert store.logged == [(0, 9)]
    assert (100, 0) in store.energy_updates   # 3-5 clamped to 0
    assert (101, 15) in store.energy_updates  # 20-5


def test_zero_delta_logs_but_no_energy_change():
    store = FakeStore(ctx={"id_story": 7, "current_clock": 0, "rng_seed": 42},
                      rules=[_rule(9, probability=100, delta_energy=0)])
    out = WeatherSelectionService(store, _FakeRegistry(store._registry)).apply_at_time_start(1)
    assert out["selected"] is True
    assert store.energy_updates == []
    assert store.logged == [(0, 9)]


def test_condition_filters_non_matching():
    store = FakeStore(
        ctx={"id_story": 7, "current_clock": 0, "rng_seed": 42},
        rules=[_rule(1, condition_key="SEASON", condition_key_value="WINTER"),
               _rule(2, condition_key="SEASON", condition_key_value="SUMMER")],
        registry={"SEASON": "SUMMER"})
    out = WeatherSelectionService(store, _FakeRegistry(store._registry)).apply_at_time_start(1)
    assert out["id_weather"] == 2


def test_weather_event_recorded():
    store = FakeStore(ctx={"id_story": 7, "current_clock": 0, "rng_seed": 42},
                      rules=[_rule(9, probability=100, id_event=55)])
    WeatherSelectionService(store, _FakeRegistry(store._registry)).apply_at_time_start(1)
    assert store.events == [55]


def test_null_seed_falls_back_to_story_id():
    store = FakeStore(ctx={"id_story": 7, "current_clock": 0, "rng_seed": None},
                      rules=[_rule(9, probability=100)])
    out = WeatherSelectionService(store, _FakeRegistry(store._registry)).apply_at_time_start(1)
    assert out["selected"] is True


# ── query delegates ───────────────────────────────────────────────────────────

class _FakeRegistry:
    """Only `find` is reached from a weather condition."""

    def __init__(self, registry):
        self.registry = registry

    def find(self, id_match, key):
        return self.registry.get(key)


class FakeQueryStore:
    def find_current_weather_by_uuid(self, match_uuid):
        return {"id_weather": 9, "uuid": "w-9", "id_story": 7, "id_card": 55,
                "delta_energy": -5, "current_clock": 3}

    def find_rng_seed(self, match_uuid):
        return 42

    def find_weather_rules_for_match(self, match_uuid):
        return [{"id": 9, "uuid": "w-9", "name": "Storm", "probability": 30,
                 "cost_move_safe_location": 1, "cost_move_not_safe_location": 3,
                 "active": True, "current": True},
                {"id": 8, "uuid": "w-8", "name": "Clear", "probability": 70,
                 "cost_move_safe_location": 0, "cost_move_not_safe_location": 1,
                 "active": True, "current": False}]

    def find_weather_log(self, match_uuid):
        return [{"id": 1, "clock": 0, "id_weather": 9}]


def test_current_weather_delegates():
    got = WeatherSelectionService(FakeQueryStore(), _FakeRegistry({})).current_weather("m-1")
    assert got["id_weather"] == 9
    assert got["id_card"] == 55


def test_weather_admin_aggregates():
    admin = WeatherSelectionService(FakeQueryStore(), _FakeRegistry({})).weather_admin("m-1")
    assert admin["rng_seed"] == 42
    assert admin["current"]["id_weather"] == 9
    assert len(admin["rules"]) == 2
    assert admin["rules"][0]["current"] is True
    assert len(admin["log"]) == 1
