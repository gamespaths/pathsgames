"""Step 26 — unit tests for the time-start recovery service."""
from app.core.services.match.time_start_recovery_service import (
    TimeStartRecoveryService,
    compute_recovery,
)


# ── pure recovery math ──────────────────────────────────────────────────────

def test_safe_location_recovers_energy_life_and_reduces_sadness():
    # secureParam=3, difficultyEnergy=2, p=5
    # energy += DEX+P; life += COS+secureParam; sad -= INT+secureParam
    energy, life, sad, _raw = compute_recovery(
        3, 2, 4, 10, 20, 8, 100, 100, 100, True, 5, 2, 0, 0, 0)
    assert energy == 10 + 3 + 5   # DEX + P
    assert life == 20 + 4 + 3     # COS + secureParam (not P)
    assert sad == 8 - (2 + 3)     # INT + secureParam (not P)


def test_unsafe_location_recovers_energy_by_difficulty_only():
    # safe=False: energy += difficulty_energy only; life and sad unchanged
    energy, life, sad, _raw = compute_recovery(
        3, 2, 4, 10, 20, 8, 100, 100, 100, False, 0, 5, 0, 0, 0)
    assert energy == 10 + 5  # 15 — no DEX
    assert life == 20
    assert sad == 8


def test_clamps_to_caps_and_floors_at_zero():
    energy, life, sad, _raw = compute_recovery(
        50, 50, 50, 90, 90, 3, 100, 100, 100, True, 10, 10, 0, 0, 0)
    assert energy == 100
    assert life == 100
    assert sad == 0


def test_class_bonuses_added_before_clamp():
    energy, life, sad, _raw = compute_recovery(
        1, 1, 1, 10, 10, 20, 100, 100, 100, True, 0, 0, 5, 7, -2)
    assert energy == 10 + 1 + 5
    assert life == 10 + 1 + 7
    assert sad == 20 - 1 - 2


# ── full flow with a fake store ─────────────────────────────────────────────

class FakeRecoveryStore:
    def __init__(self, context, characters, safety, bonuses, state_locations):
        self._context = context
        self._characters = characters
        self._safety = safety
        self._bonuses = bonuses
        self._state = {
            s["id_location"]: {
                "clock_counter": s["clock_counter"],
                "flag_already_actived": s.get("flag_already_actived", 0),
            }
            for s in state_locations
        }
        self.stat_updates = []
        self.inserts = []
        self.counter_updates = []
        self.recovery_logs = []
        self.counter_zero_logs = []
        self.activated = []

    def load_recovery_context(self, id_match):
        return self._context

    def find_recovery_characters(self, id_match):
        return self._characters

    def find_location_safety(self, id_story):
        return self._safety

    def find_class_bonuses(self, id_story):
        return self._bonuses

    def find_state_locations(self, id_match):
        return [
            {
                "id_location": k,
                "clock_counter": v["clock_counter"],
                "flag_already_actived": v["flag_already_actived"],
            }
            for k, v in self._state.items()
        ]

    def update_character_stats(self, id_match, id_character, energy, life, sad):
        self.stat_updates.append((id_character, energy, life, sad))

    def insert_state_location(self, id_match, id_location, clock_counter):
        self.inserts.append((id_location, clock_counter))
        self._state[id_location] = {"clock_counter": clock_counter, "flag_already_actived": 0}

    def update_state_location_counter(self, id_match, id_location, new_clock_counter):
        self.counter_updates.append((id_location, new_clock_counter))

    def log_recovery(self, id_match, id_character, message):
        self.recovery_logs.append((id_character, message))

    def log_counter_zero(self, id_match, id_location, id_event_if_counter_zero, message):
        self.counter_zero_logs.append((id_location, id_event_if_counter_zero))

    def mark_state_location_activated(self, id_match, id_location):
        self.activated.append(id_location)


def test_full_flow_seeds_recovers_and_decrements():
    store = FakeRecoveryStore(
        context={"id_story": 9, "difficulty_energy": 2},
        characters=[{
            "id": 10, "uuid": "char-a", "id_class": 5, "id_location": 100,
            "dexterity": 3, "intelligence": 2, "constitution": 4,
            "energy": 10, "life": 20, "sad": 8,
            "energy_max": 100, "life_max": 100, "sad_max": 100,
        }],
        safety=[{"id_location": 100, "secure_param": 1, "counter_time": 3,
                 "id_event_if_counter_zero": 777}],
        bonuses=[{"id_class": 5, "statistic": "energy", "value": 1}],
        state_locations=[],
    )
    recaps = TimeStartRecoveryService(store).apply_at_time_start(1)

    # p = 1 + 2 = 3, secureParam=1, safe.
    # energy = 10 + dex3 + p3 + bonus1 = 17 (+7)
    # life   = 20 + cos4 + secureParam1 = 25 (+5)
    # sad    = 8 - (int2 + secureParam1) = 5 (-3)
    assert store.inserts == [(100, 3)]
    assert store.stat_updates == [(10, 17, 25, 5)]
    assert store.counter_updates == [(100, 2)]
    assert store.counter_zero_logs == []
    assert len(recaps) == 1
    assert (recaps[0].energy_delta, recaps[0].life_delta, recaps[0].sad_delta) == (7, 5, -3)


def test_counter_zero_logs_pending_event():
    store = FakeRecoveryStore(
        context={"id_story": 9, "difficulty_energy": 0},
        characters=[{
            "id": 10, "uuid": "char-a", "id_class": None, "id_location": 100,
            "dexterity": 1, "intelligence": 1, "constitution": 1,
            "energy": 10, "life": 10, "sad": 10,
            "energy_max": 100, "life_max": 100, "sad_max": 100,
        }],
        safety=[{"id_location": 100, "secure_param": 0, "counter_time": 1,
                 "id_event_if_counter_zero": 777}],
        bonuses=[],
        state_locations=[{"id_location": 100, "clock_counter": 1, "flag_already_actived": 0}],
    )
    TimeStartRecoveryService(store).apply_at_time_start(1)
    assert store.counter_updates == [(100, 0)]
    assert store.counter_zero_logs == [(100, 777)]
    assert store.activated == [100]


def test_reseeds_zero_counter_for_occupied_location():
    """Row pre-seeded with 0 (match created before counter_time set) should be
    re-seeded when the character is in that location and flag_already_actived=0."""
    store = FakeRecoveryStore(
        context={"id_story": 9, "difficulty_energy": 0},
        characters=[{
            "id": 10, "uuid": "char-a", "id_class": None, "id_location": 100,
            "dexterity": 1, "intelligence": 1, "constitution": 1,
            "energy": 10, "life": 10, "sad": 10,
            "energy_max": 100, "life_max": 100, "sad_max": 100,
        }],
        safety=[{"id_location": 100, "secure_param": 0, "counter_time": 5,
                 "id_event_if_counter_zero": None}],
        bonuses=[],
        state_locations=[{"id_location": 100, "clock_counter": 0, "flag_already_actived": 0}],
    )
    TimeStartRecoveryService(store).apply_at_time_start(1)
    # Must re-seed to 5 then immediately decrement to 4
    assert (100, 5) in store.counter_updates
    assert (100, 4) in store.counter_updates
    assert store.activated == []


def test_no_reseed_when_already_activated():
    """Row with clockCounter=0 and flag_already_actived=1 must not be re-seeded."""
    store = FakeRecoveryStore(
        context={"id_story": 9, "difficulty_energy": 0},
        characters=[{
            "id": 10, "uuid": "char-a", "id_class": None, "id_location": 100,
            "dexterity": 1, "intelligence": 1, "constitution": 1,
            "energy": 10, "life": 10, "sad": 10,
            "energy_max": 100, "life_max": 100, "sad_max": 100,
        }],
        safety=[{"id_location": 100, "secure_param": 0, "counter_time": 5,
                 "id_event_if_counter_zero": None}],
        bonuses=[],
        state_locations=[{"id_location": 100, "clock_counter": 0, "flag_already_actived": 1}],
    )
    TimeStartRecoveryService(store).apply_at_time_start(1)
    assert store.counter_updates == []
    assert store.activated == []


def test_returns_empty_without_context():
    store = FakeRecoveryStore(None, [], [], [], [])
    assert TimeStartRecoveryService(store).apply_at_time_start(1) == []


# ── v0.30.1 — wake from coma by resting in a safe location ────────────────────

from unittest.mock import MagicMock
from app.core.ports.match.edge_state_ports import MSG_COMA_RECOVERED, MSG_ALL_PLAYER_COMA


def _coma_char(cid, uuid, id_location, life=0):
    """cos 10, sad 0/50, comatose."""
    return {
        "id": cid, "uuid": uuid, "id_class": None, "id_location": id_location,
        "dexterity": 3, "intelligence": 2, "constitution": 10,
        "energy": 10, "life": life, "sad": 0,
        "energy_max": 100, "life_max": 100, "sad_max": 50, "is_coma": 1,
    }


def _run_with_edge(characters, secure_param):
    store = FakeRecoveryStore(
        context={"id_story": 9, "difficulty_energy": 0, "current_clock": 4},
        characters=characters,
        safety=[{"id_location": 100, "secure_param": secure_param, "counter_time": None,
                 "id_event_if_counter_zero": None}],
        bonuses=[],
        state_locations=[],
    )
    edge = MagicMock()
    TimeStartRecoveryService(store, edge).apply_at_time_start(1)
    return store, edge


def test_safe_sleep_wakes_from_coma():
    # safe recovery lifts life 0 -> 0 + cos(10) + secure(2) = 12, then the coma clears.
    store, edge = _run_with_edge([_coma_char(10, "char-a", 100)], secure_param=2)

    edge.clear_coma.assert_called_once_with(1, 10)
    msg = edge.log_edge_state.call_args_list[-1][0][4]
    assert msg.startswith(MSG_COMA_RECOVERED)
    # It woke, so the party is not all-in-coma.
    assert not any(c[0][4].startswith(MSG_ALL_PLAYER_COMA)
                   for c in edge.log_edge_state.call_args_list)


def test_waking_is_independent_of_the_others_still_down():
    waker = _coma_char(10, "char-a", 100)          # safe location
    elsewhere = _coma_char(20, "char-b", None)     # no location -> unsafe -> stays
    store, edge = _run_with_edge([waker, elsewhere], secure_param=2)

    edge.clear_coma.assert_called_once_with(1, 10)
    # One is up, so the party is NOT all-in-coma.
    assert not any(c[0][4].startswith(MSG_ALL_PLAYER_COMA)
                   for c in edge.log_edge_state.call_args_list)


def test_unsafe_sleep_never_wakes():
    store, edge = _run_with_edge([_coma_char(10, "char-a", 100)], secure_param=0)

    edge.clear_coma.assert_not_called()
    # Still down and alone -> the party collapse row is written.
    assert any(c[0][4].startswith(MSG_ALL_PLAYER_COMA)
               for c in edge.log_edge_state.call_args_list)
