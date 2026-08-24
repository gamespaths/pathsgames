"""Step 31 — EventService choices: the CHOICES_PENDING branch.

Mirrors EventExecutionServiceChoicesTest on the Java side: what opening a choice-event
does (pay, mark, present) and everything it deliberately does not (effects, chain,
flag_end_time, edge states, game_over), plus the idempotent re-fetch of an open cycle.
The per-option verdict matrix lives in test_choice_availability; here only its wiring.
"""
from unittest.mock import MagicMock

import pytest

from app.core.models.match.event_models import (
    STATUS_APPLIED, STATUS_CHOICES_PENDING, EventCheckContext, EventError,
)
from app.core.ports.match.event_ports import MSG_CHOICE_SELECTED, MSG_EVENT_EXECUTED
from app.core.services.match import choice_availability as ca
from app.core.services.match.event_service import EventService

MATCH_UUID = "match-uuid"
USER_UUID = "user-uuid"
MATCH_ID, USER_ID, CHAR_ID, STORY_ID, LOC = 1, 2, 3, 4, 100
EVENT_ID = 1


def _character(cid, uuid, id_user, id_class, id_location, **over):
    base = dict(id=cid, uuid=uuid, id_user=id_user, id_class=id_class,
                id_location=id_location, dexterity=10, intelligence=10, constitution=10,
                energy=20, life=30, sad=0, exp=0, energy_max=100, life_max=100, sad_max=50,
                is_sleeping=False, is_coma=False, characteristics=None)
    base.update(over)
    return base


def _event(**over):
    """A NORMAL event costing 1 energy — the cost proves what each path charges."""
    base = dict(id=EVENT_ID, uuid="event-1", type="NORMAL", id_card=None, cost_enery=1,
                cost_coin=0, flag_end_time=0, id_event_next=None,
                id_specific_location=None, id_weather=None,
                registry_key_condition=None, registry_value_condition=None,
                id_item_condition=None, id_class_condition=None)
    base.update(over)
    return base


def _choice(cid, priority, **over):
    base = {"id": cid, "uuid": f"choice-{cid}", "id_event": EVENT_ID, "id_card": None,
            "priority": priority, "id_text_name": None, "id_text_description": None,
            "otherwise_flag": 0, "is_progress": 0, "logic_operator": "AND",
            "limit_sad": None, "limit_dex": None, "limit_int": None, "limit_cos": None}
    base.update(over)
    return base


def _cond(ctype, key=None, value=None, operator=None):
    return {"type": ctype, "key": key, "value": value, "operator": operator}


@pytest.fixture
def store():
    s = MagicMock()
    s.find_user_id_by_uuid.return_value = USER_ID
    s.find_match_for_event.return_value = {
        "id": MATCH_ID, "uuid": MATCH_UUID, "status": "RUNNING", "current_clock": 7,
        "id_story": STORY_ID, "id_user_creator": USER_ID, "id_current_weather": None,
    }
    actor = _character(CHAR_ID, "char-uuid", USER_ID, 50, LOC)
    s.find_character_by_match_and_user.return_value = actor
    s.find_characters_for_event.return_value = [actor]
    s.find_backpack.return_value = {"food": 5, "magic": 5, "coin": 10}
    s.find_event_by_story_and_uuid.return_value = _event()
    s.find_events_by_id.return_value = {EVENT_ID: _event()}
    s.find_effects_by_event_id.return_value = {}
    s.find_id_event_end_game.return_value = None
    s.find_item_uuids_by_id.return_value = {}
    s.find_trait_uuids_by_id.return_value = {}
    # v0.35.2 — real dict, not a MagicMock: the trait deltas are arithmetic.
    s.find_trait_stats_by_id.return_value = {}
    s.load_check_context.return_value = EventCheckContext(
        id_character=CHAR_ID, id_location=LOC, energy=20, coin=10, id_class=50)
    s.find_choices_by_event_id.return_value = []
    s.find_choice_conditions_by_choice_id.return_value = {}
    s.find_trait_ids_by_character.return_value = set()
    s.resolve_short_text.return_value = None
    return s


@pytest.fixture
def service(store):
    return EventService(store, edge_store=MagicMock(), content_read_port=None,
                        time_service=MagicMock())


def execute(service):
    return service.execute_event(MATCH_UUID, USER_UUID, "event-1", "en")


def given_open_cycle(store):
    """An event opened once and never resolved: one EXECUTED marker, no SELECTED."""
    store.load_check_context.return_value = EventCheckContext(
        id_character=CHAR_ID, id_location=LOC, energy=20, coin=10, id_class=50,
        consumed_event_ids={EVENT_ID})
    store.count_log_markers.side_effect = lambda m, e, prefix: \
        1 if prefix == MSG_EVENT_EXECUTED else 0


def given_closed_cycle(store):
    """An event whose one cycle was resolved (Step 32 wrote CHOICE_SELECTED): 1 = 1."""
    given_open_cycle(store)
    store.count_log_markers.side_effect = lambda m, e, prefix: 1


# ── the 0-choice regression ─────────────────────────────────────────────────

def test_plain_event_answers_applied(service, store):
    r = execute(service)
    assert r.status == STATUS_APPLIED
    assert r.pending_choices == []
    store.find_choices_by_event_id.assert_called_once_with(STORY_ID, EVENT_ID)


# ── first open ──────────────────────────────────────────────────────────────

def test_first_open_answers_choices_pending(service, store):
    store.find_choices_by_event_id.return_value = [_choice(11, 1), _choice(12, 2)]
    r = execute(service)
    assert r.status == STATUS_CHOICES_PENDING
    assert len(r.pending_choices) == 2
    assert r.executed_event_uuids == ["event-1"]


def test_first_open_pays_and_writes_one_marker(service, store):
    store.find_choices_by_event_id.return_value = [_choice(11, 1)]
    r = execute(service)
    assert r.energy_spent == 1 and r.new_energy == 19
    store.log_event_executed.assert_called_once_with(
        MATCH_ID, CHAR_ID, EVENT_ID, 7, f"{MSG_EVENT_EXECUTED} {EVENT_ID}", 1, 0, 0, 0)
    # The deduction is flushed: energy 19, everything else untouched.
    store.update_character_stats.assert_called_once_with(MATCH_ID, CHAR_ID, {
        "dexterity": 10, "intelligence": 10, "constitution": 10,
        "energy": 19, "life": 30, "sad": 0, "exp": 0,
        # v0.35.2 — the four maxima ride along with the current values.
        "life_max": 100, "energy_max": 100, "sad_max": 50, "weight_max": 0,
    })


def test_effects_and_chain_are_withheld(service, store):
    store.find_event_by_story_and_uuid.return_value = _event(id_event_next=2, flag_end_time=1)
    store.find_choices_by_event_id.return_value = [_choice(11, 1)]
    store.find_effects_by_event_id.return_value = {
        EVENT_ID: [{"id": 9, "uuid": "eff-9", "id_card": None, "id_event": EVENT_ID,
                    "statistics": "life", "value": -5, "target": "ONLY_ONE"}]}
    store.find_id_event_end_game.return_value = EVENT_ID

    r = execute(service)
    assert r.effects == [] and r.stat_changes == []
    assert r.executed_event_uuids == ["event-1"]
    assert r.time_ended is False and r.game_over is False
    assert r.edge_state.anything() is False
    service.time_service.force_time_end.assert_not_called()
    # Life stayed 30 in the flushed stats: the -5 never ran.
    store.update_character_stats.assert_called_once_with(MATCH_ID, CHAR_ID, {
        "dexterity": 10, "intelligence": 10, "constitution": 10,
        "energy": 19, "life": 30, "sad": 0, "exp": 0,
        # v0.35.2 — the four maxima ride along with the current values.
        "life_max": 100, "energy_max": 100, "sad_max": 50, "weight_max": 0,
    })


def test_unavailable_event_still_rejected_on_first_open(service, store):
    store.find_event_by_story_and_uuid.return_value = _event(cost_enery=999)
    store.find_choices_by_event_id.return_value = [_choice(11, 1)]
    with pytest.raises(EventError) as e:
        execute(service)
    assert e.value.code == EventError.NOT_ENOUGH_ENERGY
    store.log_event_executed.assert_not_called()


# ── the idempotent re-fetch ─────────────────────────────────────────────────

def test_open_cycle_serves_again_without_charging_or_marking(service, store):
    given_open_cycle(store)
    store.find_choices_by_event_id.return_value = [_choice(11, 1)]
    r = execute(service)
    assert r.status == STATUS_CHOICES_PENDING
    assert r.energy_spent == 0 and r.new_energy == 20
    assert r.executed_event_uuids == ["event-1"]
    store.log_event_executed.assert_not_called()
    store.update_character_stats.assert_not_called()


def test_open_cycle_bypasses_the_verdict(service, store):
    # A spent ONCE and an unaffordable cost both still serve on re-fetch.
    store.find_event_by_story_and_uuid.return_value = _event(type="ONCE", cost_enery=999)
    given_open_cycle(store)
    store.find_choices_by_event_id.return_value = [_choice(11, 1)]
    r = execute(service)
    assert r.status == STATUS_CHOICES_PENDING and r.energy_spent == 0


def test_closed_cycle_starts_a_new_cycle_for_normal(service, store):
    given_closed_cycle(store)
    store.find_choices_by_event_id.return_value = [_choice(11, 1)]
    r = execute(service)
    assert r.status == STATUS_CHOICES_PENDING and r.energy_spent == 1
    store.log_event_executed.assert_called_once()


def test_closed_cycle_of_a_once_event_is_spent(service, store):
    store.find_event_by_story_and_uuid.return_value = _event(type="ONCE")
    given_closed_cycle(store)
    store.find_choices_by_event_id.return_value = [_choice(11, 1)]
    with pytest.raises(EventError) as e:
        execute(service)
    assert e.value.code == EventError.ONCE_ALREADY_CONSUMED


def test_marker_counts_are_lazy(service, store):
    store.find_choices_by_event_id.return_value = [_choice(11, 1)]
    execute(service)
    store.count_log_markers.assert_not_called()


# ── the options themselves ──────────────────────────────────────────────────

def test_options_sorted_by_priority_then_id(service, store):
    store.find_choices_by_event_id.return_value = [
        _choice(13, 2), _choice(11, 1), _choice(12, 2)]
    r = execute(service)
    assert [c["uuid"] for c in r.pending_choices] == ["choice-11", "choice-12", "choice-13"]


def test_options_carry_texts_and_verdicts(service, store):
    store.find_choices_by_event_id.return_value = [
        _choice(11, 1, id_text_name=600, id_text_description=601), _choice(12, 2)]
    store.find_choice_conditions_by_choice_id.return_value = {
        11: [_cond("statistics", "int", "99", ">")]}
    store.resolve_short_text.side_effect = \
        lambda sid, tid, lang: {600: "Gold Door", 601: "Shiny."}.get(tid)

    r = execute(service)
    gated, plain = r.pending_choices
    assert gated["uuid"] == "choice-11" and gated["available"] is False
    assert gated["reason"] == ca.CONDITION_STATISTICS_NOT_MET
    assert gated["name"] == "Gold Door" and gated["description"] == "Shiny."
    assert plain["available"] is True and plain["reason"] is None


def test_checker_sees_post_deduction_stats(service, store):
    # Energy was 20, the open costs 1: a "> 19" gate must fail after paying.
    store.find_choices_by_event_id.return_value = [_choice(11, 1)]
    store.find_choice_conditions_by_choice_id.return_value = {
        11: [_cond("statistics", "energy", "19", ">")]}
    r = execute(service)
    assert r.pending_choices[0]["available"] is False


def test_traits_are_read_only_when_a_traits_condition_exists(service, store):
    store.find_choices_by_event_id.return_value = [_choice(11, 1)]
    execute(service)
    store.find_trait_ids_by_character.assert_not_called()

    store.find_choice_conditions_by_choice_id.return_value = {
        11: [_cond("traits", None, "9", "=")]}
    store.find_trait_ids_by_character.return_value = {9}
    given_open_cycle(store)
    r = execute(service)
    assert r.pending_choices[0]["available"] is True
    store.find_trait_ids_by_character.assert_called_once_with(MATCH_ID, CHAR_ID)


def test_statistics_sum_pools_the_party(service, store):
    mate = _character(30, "mate-uuid", 9, 50, LOC, intelligence=7)
    store.find_characters_for_event.return_value = [
        _character(CHAR_ID, "char-uuid", USER_ID, 50, LOC), mate]
    store.find_choices_by_event_id.return_value = [_choice(11, 1)]
    # Actor int 10 + mate int 7 = 17.
    store.find_choice_conditions_by_choice_id.return_value = {
        11: [_cond("statistics_SUM", "int", "16", ">")]}
    r = execute(service)
    assert r.pending_choices[0]["available"] is True


def test_all_in_same_loc_fails_when_scattered(service, store):
    far = _character(40, "far-uuid", 9, 50, 999)
    store.find_characters_for_event.return_value = [
        _character(CHAR_ID, "char-uuid", USER_ID, 50, LOC), far]
    store.find_choices_by_event_id.return_value = [_choice(11, 1)]
    store.find_choice_conditions_by_choice_id.return_value = {
        11: [_cond("ALL_IN_SAME_LOC")]}
    r = execute(service)
    assert r.pending_choices[0]["available"] is False
    assert r.pending_choices[0]["reason"] == ca.CONDITION_ALL_IN_SAME_LOC_NOT_MET
