"""Step 30 — the sadness-overflow and coma rules, in isolation.

Mirrors ``EdgeStateEvaluatorTest.java``.
"""
from unittest.mock import MagicMock

from app.core.ports.match.edge_state_ports import (
    MSG_ALL_PLAYER_COMA, MSG_COMA, MSG_SADNESS_OVERFLOW,
)
from app.core.services.match import edge_state_evaluator as ev

ID = 7


def state(life, sad, sad_max, cos, coma=False):
    """life, sad, sad_max, cos — the four numbers the rules actually read."""
    return ev.CharacterState(ID, life, sad, sad_max, cos, coma)


# ── sadness overflow ────────────────────────────────────────────────────────

def test_below_the_cap_nothing_fires():
    v = ev.evaluate(state(30, 49, 50, 10))
    assert not v.anything()
    assert not v.sadness_overflow
    assert (v.life_after, v.sad_after) == (30, 49)


def test_reaching_the_cap_costs_cos_life_and_resets_sadness():
    v = ev.evaluate(state(30, 50, 50, 10))
    assert v.sadness_overflow
    assert v.life_after == 20  # life pays COS
    assert v.sad_after == 0    # sadness discharges
    assert v.forced_sleep
    assert not v.coma_triggered


def test_overshooting_the_cap_behaves_like_reaching_it():
    v = ev.evaluate(state(30, 9999, 50, 10))
    assert v.sadness_overflow and v.life_after == 20


def test_a_non_positive_cap_disables_the_rule():
    # _clamp returns low when high < low, so sad would be 0 and 0 >= 0 is true — an
    # unauthored sad_max would drain COS life on every single event.
    assert not ev.evaluate(state(30, 0, 0, 10)).sadness_overflow
    assert not ev.evaluate(state(30, 5, -3, 10)).sadness_overflow


# ── coma ────────────────────────────────────────────────────────────────────

def test_zero_life_triggers_coma():
    v = ev.evaluate(state(0, 0, 50, 10))
    assert v.coma_triggered and v.forced_sleep and not v.sadness_overflow


def test_negative_life_triggers_coma():
    assert ev.evaluate(state(-4, 0, 50, 10)).coma_triggered


def test_already_comatose_does_not_retrigger():
    v = ev.evaluate(state(0, 0, 50, 10, coma=True))
    assert not v.coma_triggered and not v.anything()


def test_already_comatose_still_takes_the_arithmetic():
    # A target=ALL sadness effect still reaches a comatose character.
    v = ev.evaluate(state(4, 50, 50, 10, coma=True))
    assert v.sadness_overflow
    assert v.life_after == 0  # floored, never negative
    assert not v.coma_triggered


# ── the cascade ─────────────────────────────────────────────────────────────

def test_an_overflow_whose_cos_hit_empties_the_bar_also_comas():
    # life 8, COS 10 → 8 - 10 = -2 → floored to 0 → coma, in one pass.
    v = ev.evaluate(state(8, 50, 50, 10))
    assert v.sadness_overflow and v.coma_triggered
    assert (v.life_after, v.sad_after) == (0, 0)
    assert v.forced_sleep


def test_surviving_the_cos_hit_by_one_avoids_the_coma():
    v = ev.evaluate(state(11, 50, 50, 10))
    assert v.sadness_overflow and not v.coma_triggered and v.life_after == 1


# ── all_in_coma ─────────────────────────────────────────────────────────────

def test_an_empty_roster_is_not_all_in_coma():
    assert ev.all_in_coma([]) is False
    assert ev.all_in_coma(None) is False


def test_every_flag_must_be_true():
    assert ev.all_in_coma([True, True]) is True
    assert ev.all_in_coma([True, False]) is False
    assert ev.all_in_coma([True, None]) is False


# ── persist ─────────────────────────────────────────────────────────────────

def test_a_coma_writes_the_flags_the_clock_and_one_log_row():
    store = MagicMock()
    ev.persist(store, 1, ev.evaluate(state(0, 0, 50, 10)), 9, 42)

    store.set_coma.assert_called_once_with(1, ID, 9)
    store.set_sleeping.assert_not_called()
    (_, _, id_event, clock, message), _ = store.log_edge_state.call_args
    assert message.startswith(MSG_COMA) and id_event == 42 and clock == 9


def test_an_overflow_without_coma_only_raises_sleep():
    store = MagicMock()
    ev.persist(store, 1, ev.evaluate(state(30, 50, 50, 10)), 9, None)

    store.set_sleeping.assert_called_once_with(1, ID)
    store.set_coma.assert_not_called()
    assert store.log_edge_state.call_args[0][4].startswith(MSG_SADNESS_OVERFLOW)


def test_a_cascade_writes_both_rows_but_never_sleeps_twice():
    store = MagicMock()
    ev.persist(store, 1, ev.evaluate(state(8, 50, 50, 10)), 3, 42)

    store.set_coma.assert_called_once_with(1, ID, 3)
    store.set_sleeping.assert_not_called()
    assert store.log_edge_state.call_count == 2


def test_a_quiet_verdict_writes_nothing():
    store = MagicMock()
    ev.persist(store, 1, ev.evaluate(state(30, 1, 50, 10)), 3, 42)

    store.set_coma.assert_not_called()
    store.set_sleeping.assert_not_called()
    store.log_edge_state.assert_not_called()


def test_the_party_row_belongs_to_the_match_not_to_an_event():
    store = MagicMock()
    ev.log_all_player_coma(store, 1, None, 4)

    store.log_edge_state.assert_called_once()
    id_match, id_character, id_event, clock, message = store.log_edge_state.call_args[0]
    assert (id_match, id_character, id_event, clock) == (1, None, None, 4)
    assert message.startswith(MSG_ALL_PLAYER_COMA)


def test_the_party_message_is_not_a_personal_coma_row():
    # ALL_PLAYER_COMA contains COMA: matching with `in` would conflate the two.
    assert MSG_COMA in MSG_ALL_PLAYER_COMA
    assert not MSG_ALL_PLAYER_COMA.startswith(MSG_COMA)
