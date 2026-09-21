"""Step 38 — ExperienceService: the gates, the price and the purchase of use-exp."""
from unittest.mock import MagicMock

import pytest

from app.core.ports.match.experience_ports import ExperienceError
from app.core.services.match.experience_service import ExperienceService, normalize_stat

USER, USER_ID, MATCH_ID, CHAR_ID = "user-uuid", 100, 1, 10


def _match(status="RUNNING", turn=CHAR_ID, **over):
    m = {"id": MATCH_ID, "uuid": "m1", "status": status, "id_story": 5, "id_difficulty": 2,
         "exp_cost": 99, "current_clock": 3, "id_character_current_turn": turn}
    m.update(over)
    return m


def _actor(dex=10, exp=40, sleeping=False, coma=False, loc=7):
    return {"id": CHAR_ID, "uuid": "c1", "dexterity": dex, "intelligence": 12, "constitution": 4,
            "exp": exp, "is_sleeping": sleeping, "is_coma": coma, "id_location": loc}


@pytest.fixture()
def env():
    store, users = MagicMock(), MagicMock()
    users.find_by_uuid.side_effect = lambda u: {"id": USER_ID, "uuid": USER} if u == USER else None
    return ExperienceService(store, users), store


def _wire(store, match, actor, secure=1, difficulty=None):
    store.find_match_by_uuid.return_value = match
    store.find_character_by_match_and_user.return_value = actor
    store.find_location_secure_param.return_value = secure
    store.find_difficulty.return_value = difficulty


def _code(service, stat="dex", user=USER):
    with pytest.raises(ExperienceError) as exc:
        service.use_exp("m1", user, stat)
    return exc.value.code


def test_normalize_stat():
    assert normalize_stat(" DEX ") == "dex" and normalize_stat("cos") == "cos"
    assert normalize_stat("life") is None and normalize_stat(None) is None and normalize_stat(3) is None


def test_unknown_user_match_or_character_is_not_found(env):
    service, store = env
    assert _code(service, user="ghost") == "MATCH_NOT_FOUND"
    assert _code(service, user=None) == "MATCH_NOT_FOUND"
    store.find_match_by_uuid.return_value = None
    assert _code(service) == "MATCH_NOT_FOUND"
    store.find_match_by_uuid.return_value = _match()
    store.find_character_by_match_and_user.return_value = None
    assert _code(service) == "MATCH_NOT_FOUND"


def test_gates_in_engine_order(env):
    service, store = env
    _wire(store, _match(status="PAUSED"), _actor())
    assert _code(service) == "MATCH_NOT_RUNNING"
    _wire(store, _match(turn=999), _actor())
    assert _code(service) == "NOT_YOUR_TURN"
    _wire(store, _match(), _actor(sleeping=True, coma=True))
    assert _code(service) == "COMA"
    _wire(store, _match(), _actor(sleeping=True))
    assert _code(service) == "SLEEPING"
    _wire(store, _match(), _actor())
    assert _code(service, "life") == "INVALID_STAT"
    _wire(store, _match(), _actor(), secure=0)
    assert _code(service) == "LOCATION_NOT_SAFE"
    _wire(store, _match(), _actor(), secure=None)
    assert _code(service) == "LOCATION_NOT_SAFE"
    _wire(store, _match(), _actor(loc=None))
    assert _code(service) == "LOCATION_NOT_SAFE"
    # difficulty: 2 × stat + 3, capped at 12 → int (12) at the cap, dex (10) costs 23
    _wire(store, _match(), _actor(exp=22), difficulty={"exp_cost": 2, "exp_cost_base": 3, "max_stat_value": 12})
    assert _code(service, "int") == "MAX_STAT_VALUE"
    assert _code(service, "dex") == "NOT_ENOUGH_EXP"
    store.update_character.assert_not_called()


def test_purchase_writes_logs_and_answers_the_refreshed_price_list(env):
    service, store = env
    _wire(store, _match(), _actor(), difficulty={"exp_cost": 2, "exp_cost_base": 3, "max_stat_value": 12})

    r = service.use_exp("m1", USER, " DEX ")

    store.update_character.assert_called_once_with(MATCH_ID, CHAR_ID, 11, 12, 4, 17)
    store.log_exp_use.assert_called_once_with(MATCH_ID, CHAR_ID, 3, "EXP_USE dex 10->11 cost 23")
    assert (r["match_uuid"], r["character_uuid"], r["stat"]) == ("m1", "c1", "dex")
    assert (r["stat_before"], r["stat_after"], r["exp_before"], r["exp_after"], r["exp_cost"]) == (10, 11, 40, 17, 23)
    assert r["exp_costs"] == {"dex": 25, "int": None, "cos": 11}
    assert [c["statistic"] for c in r["stat_changes"]] == ["dex", "exp"]
    assert r["stat_changes"][1]["delta"] == -23 and r["stat_changes"][0]["delta"] == 1


def test_int_and_cos_move_their_own_column_and_no_active_turn_does_not_gate(env):
    service, store = env
    _wire(store, _match(turn=None), _actor(exp=100), difficulty={"exp_cost": 1, "exp_cost_base": 0, "max_stat_value": 0})
    assert service.use_exp("m1", USER, "int")["stat_after"] == 13
    store.update_character.assert_called_with(MATCH_ID, CHAR_ID, 10, 13, 4, 88)
    assert service.use_exp("m1", USER, "cos")["stat_after"] == 5
    store.update_character.assert_called_with(MATCH_ID, CHAR_ID, 10, 12, 5, 96)


def test_without_a_difficulty_row_the_match_exp_cost_prices_the_point(env):
    service, store = env
    _wire(store, _match(), _actor(dex=1, exp=100), difficulty=None)
    assert service.use_exp("m1", USER, "dex")["exp_cost"] == 99
    _wire(store, _match(id_difficulty=None, exp_cost=4), _actor(dex=1, exp=100))
    assert service.use_exp("m1", USER, "dex")["exp_cost"] == 4
    store.find_difficulty.assert_called_once()


# ── v0.38.3 — the registry ────────────────────────────────────────────────────

@pytest.fixture()
def reg_env():
    store, users, registry = MagicMock(), MagicMock(), MagicMock()
    users.find_by_uuid.side_effect = lambda u: {"id": USER_ID, "uuid": USER} if u == USER else None
    registry.is_declared.return_value = False
    registry.find.return_value = []
    _wire(store, _match(), _actor(exp=100), difficulty={"exp_cost": 1, "exp_cost_base": 0, "max_stat_value": 0})
    return ExperienceService(store, users, registry_service=registry), store, registry


def test_first_use_writes_use_exp_1_and_the_stat_key_after_the_character(reg_env):
    service, store, registry = reg_env
    registry.is_declared.side_effect = lambda s, k: (s, k) in {(5, "use-exp"), (5, "use-exp-DEX")}

    service.use_exp("m1", USER, "dex")

    store.update_character.assert_called_once_with(MATCH_ID, CHAR_ID, 11, 12, 4, 90)
    assert registry.upsert.call_args_list == [
        ((MATCH_ID, 5, "use-exp", "1"), {"id_character": CHAR_ID, "clock": 3}),
        ((MATCH_ID, 5, "use-exp-DEX", "11"), {"id_character": CHAR_ID, "clock": 3}),
    ]


def test_the_counter_grows_from_the_highest_value_stored_and_junk_counts_as_zero(reg_env):
    service, _, registry = reg_env
    registry.is_declared.side_effect = lambda s, k: k == "use-exp"
    registry.find.return_value = ["2"]
    service.use_exp("m1", USER, "int")
    registry.upsert.assert_called_once_with(MATCH_ID, 5, "use-exp", "3", id_character=CHAR_ID, clock=3)

    registry.upsert.reset_mock()
    registry.find.return_value = ["1", " 4 ", "abc", None]
    service.use_exp("m1", USER, "cos")
    registry.upsert.assert_called_once_with(MATCH_ID, 5, "use-exp", "5", id_character=CHAR_ID, clock=3)


def test_only_the_declared_stat_key_is_written(reg_env):
    service, _, registry = reg_env
    registry.is_declared.side_effect = lambda s, k: k == "use-exp-COS"
    service.use_exp("m1", USER, "cos")
    registry.upsert.assert_called_once_with(MATCH_ID, 5, "use-exp-COS", "5", id_character=CHAR_ID, clock=3)
    registry.find.assert_not_called()


def test_undeclared_keys_are_skipped_without_error(reg_env):
    service, _, registry = reg_env
    assert service.use_exp("m1", USER, "dex")["stat_after"] == 11
    registry.upsert.assert_not_called()


def test_a_failing_gate_never_reaches_the_registry(reg_env):
    service, store, registry = reg_env
    registry.is_declared.return_value = True
    _wire(store, _match(), _actor(exp=0), difficulty={"exp_cost": 1, "exp_cost_base": 0, "max_stat_value": 0})
    assert _code(service) == ExperienceError.NOT_ENOUGH_EXP
    registry.upsert.assert_not_called()


def test_without_a_registry_service_nothing_is_written(env):
    service, store = env
    _wire(store, _match(), _actor(exp=100), difficulty={"exp_cost": 1, "exp_cost_base": 0, "max_stat_value": 0})
    assert service.use_exp("m1", USER, "dex")["stat_after"] == 11
