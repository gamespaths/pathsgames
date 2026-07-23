"""Step 32 — EventService.select_choice: resolving one option of an open cycle.

Mirrors EventExecutionServiceSelectChoiceTest on the Java side. The three things worth
proving, because getting any of them wrong is silent: that resolution charges nothing (the
open already paid), that it is gated on the cycle really being open (the cost-bypass
guard), and that a choice effect reaches the world through the very same helpers an event
effect does.

The per-option verdict matrix lives in test_choice_availability; here only its wiring at
resolution time is exercised.
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
CHOICE_UUID = "choice-uuid"
MATCH_ID, USER_ID, CHAR_ID, STORY_ID = 1, 2, 3, 4
OTHER_CHAR_ID = 33
LOC, FAR_LOC = 100, 200
EVENT_ID, CHOICE_ID, CLOCK = 1, 10, 7


def _character(cid, uuid, id_user, id_class, id_location, **over):
    base = dict(id=cid, uuid=uuid, id_user=id_user, id_class=id_class,
                id_location=id_location, dexterity=10, intelligence=10, constitution=10,
                energy=20, life=30, sad=0, exp=0, energy_max=100, life_max=100, sad_max=50,
                is_sleeping=False, is_coma=False, characteristics=None)
    base.update(over)
    return base


def _event(**over):
    base = dict(id=EVENT_ID, uuid="event-uuid", type="NORMAL", id_card=None, cost_enery=1,
                coin_cost=2, flag_end_time=0, id_event_next=None,
                id_specific_location=None, id_weather=None,
                registry_key_condition=None, registry_value_condition=None,
                id_item_condition=None, id_class_condition=None)
    base.update(over)
    return base


def _choice(**over):
    base = {"id": CHOICE_ID, "uuid": CHOICE_UUID, "id_event": EVENT_ID, "id_card": 11,
            "priority": 1, "id_text_name": None, "id_text_description": None,
            "id_text_narrative": 42, "id_event_torun": None,
            "otherwise_flag": 0, "is_progress": 0, "logic_operator": "AND",
            "limit_sad": None, "limit_dex": None, "limit_int": None, "limit_cos": None}
    base.update(over)
    return base


def _effect(eid, **over):
    """A choice effect in the canonical shape the store adapter hands over."""
    base = {"id": eid, "uuid": f"choice-effect-{eid}", "id_card": None,
            "statistics": None, "value": 0, "flag_group": 0,
            "key": None, "value_to_add": None, "value_to_remove": None,
            "id_event": None, "id_location": None, "id_weather": None,
            "id_item_target": None, "item_action": None}
    base.update(over)
    return base


def _event_effect(id_event, statistic, value):
    return {"id": id_event * 100, "uuid": f"event-effect-{id_event}", "id_event": id_event,
            "id_card": None, "statistics": statistic, "value": value, "target": "ONLY_ONE",
            "target_class": None, "traits_to_add": None, "traits_to_remove": None,
            "id_item_target": None, "item_action": None, "key_to_add": None,
            "key_value_to_add": None, "characteristic_to_add": None,
            "characteristic_to_remove": None, "id_weather": None, "id_location": None}


def _ctx(**over):
    base = dict(id_character=CHAR_ID, id_location=LOC, energy=20, coin=10, id_class=50,
                consumed_event_ids={EVENT_ID})
    base.update(over)
    return EventCheckContext(**base)


@pytest.fixture
def store():
    s = MagicMock()
    s.find_user_id_by_uuid.return_value = USER_ID
    s.find_match_for_event.return_value = {
        "id": MATCH_ID, "uuid": MATCH_UUID, "status": "RUNNING", "current_clock": CLOCK,
        "id_story": STORY_ID, "id_user_creator": USER_ID, "id_current_weather": None,
    }
    actor = _character(CHAR_ID, "char-uuid", USER_ID, 50, LOC)
    s.find_character_by_match_and_user.return_value = actor
    s.find_characters_for_event.return_value = [actor]
    s.find_backpack.return_value = {"food": 5, "magic": 5, "coin": 10}
    s.find_events_by_id.return_value = {EVENT_ID: _event()}
    s.find_effects_by_event_id.return_value = {}
    s.find_id_event_end_game.return_value = None
    s.find_id_event_all_player_coma.return_value = None
    s.find_item_uuids_by_id.return_value = {7: "item-uuid"}
    s.find_trait_uuids_by_id.return_value = {}
    s.find_location_uuids_by_id.return_value = {LOC: "loc-here", FAR_LOC: "loc-far"}
    s.load_check_context.return_value = _ctx()
    s.find_choices_by_event_id.return_value = []
    s.find_choice_conditions_by_choice_id.return_value = {}
    s.find_choice_effects_by_choice_id.return_value = []
    s.find_choice_by_story_and_uuid.return_value = _choice()
    s.find_trait_ids_by_character.return_value = set()
    s.resolve_short_text.return_value = None
    # One EVENT_EXECUTED marker and no CHOICE_SELECTED: the cycle is open.
    s.count_log_markers.side_effect = lambda m, e, prefix: 1 if prefix == MSG_EVENT_EXECUTED else 0
    return s


@pytest.fixture
def service(store):
    return EventService(store, edge_store=MagicMock(), content_read_port=None,
                        time_service=MagicMock())


def _resolve(service):
    return service.select_choice(MATCH_UUID, USER_UUID, CHOICE_UUID, "en")


# ── the guards ──────────────────────────────────────────────────────────────

def test_unknown_option_is_not_found(service, store):
    store.find_choice_by_story_and_uuid.return_value = None
    with pytest.raises(EventError) as exc:
        _resolve(service)
    assert exc.value.code == EventError.CHOICE_NOT_FOUND


def test_option_whose_owning_event_is_missing_is_rejected(service, store):
    store.find_events_by_id.return_value = {}
    with pytest.raises(EventError) as exc:
        _resolve(service)
    assert exc.value.code == EventError.EVENT_NOT_FOUND


def test_match_not_running_is_rejected(service, store):
    store.find_match_for_event.return_value = {
        **store.find_match_for_event.return_value, "status": "PAUSED"}
    with pytest.raises(EventError) as exc:
        _resolve(service)
    assert exc.value.code == EventError.MATCH_NOT_RUNNING


def test_coma_outranks_sleep(service, store):
    store.load_check_context.return_value = _ctx(sleeping=True, coma=True)
    with pytest.raises(EventError) as exc:
        _resolve(service)
    assert exc.value.code == EventError.COMA


def test_sleeping_character_cannot_resolve(service, store):
    store.load_check_context.return_value = _ctx(sleeping=True)
    with pytest.raises(EventError) as exc:
        _resolve(service)
    assert exc.value.code == EventError.SLEEPING


def test_event_never_opened_has_no_cycle_to_close(service, store):
    """The cost-bypass guard: no open, no resolution."""
    store.count_log_markers.side_effect = lambda m, e, prefix: 0
    with pytest.raises(EventError) as exc:
        _resolve(service)
    assert exc.value.code == EventError.CHOICE_NOT_OPEN


def test_resolving_twice_is_rejected(service, store):
    store.count_log_markers.side_effect = lambda m, e, prefix: 1
    with pytest.raises(EventError) as exc:
        _resolve(service)
    assert exc.value.code == EventError.CHOICE_NOT_OPEN


def test_option_that_became_unavailable_is_rejected(service, store):
    store.find_choice_by_story_and_uuid.return_value = _choice(limit_dex=99)
    with pytest.raises(EventError) as exc:
        _resolve(service)
    assert exc.value.code == EventError.CHOICE_NOT_AVAILABLE
    # The message names the checker's own reason, so the board can say why.
    assert ca.LIMIT_DEX_NOT_MET in exc.value.message


def test_a_rejected_resolution_writes_nothing(service, store):
    store.count_log_markers.side_effect = lambda m, e, prefix: 0
    with pytest.raises(EventError):
        _resolve(service)
    store.log_event_executed.assert_not_called()
    store.log_choice_executed.assert_not_called()
    store.update_character_stats.assert_not_called()


# ── it charges nothing ──────────────────────────────────────────────────────

def test_resolution_charges_nothing(service):
    """The open already paid the energy and the coins; this is what that bought."""
    r = _resolve(service)

    assert r.execution.energy_spent == 0
    assert r.execution.coin_spent == 0
    assert r.execution.new_energy == 20
    assert r.execution.new_coin == 10


# ── the markers that close the cycle ────────────────────────────────────────

def test_choice_selected_marker_carries_the_owning_event_id(service, store):
    _resolve(service)

    store.log_event_executed.assert_called_once_with(
        MATCH_ID, CHAR_ID, EVENT_ID, CLOCK, f"{MSG_CHOICE_SELECTED} {EVENT_ID}")


def test_choice_history_records_both_the_event_and_the_option(service, store):
    _resolve(service)

    args = store.log_choice_executed.call_args[0]
    assert args[0] == MATCH_ID and args[1] == EVENT_ID and args[2] == CHOICE_ID
    assert args[3] == CLOCK


def test_ordinary_option_records_no_milestone(service, store):
    r = _resolve(service)

    assert r.progress_recorded is False
    store.insert_story_progress.assert_not_called()


def test_is_progress_option_records_the_milestone(service, store):
    store.find_choice_by_story_and_uuid.return_value = _choice(is_progress=1)

    r = _resolve(service)

    assert r.progress_recorded is True
    store.insert_story_progress.assert_called_once_with(MATCH_ID, EVENT_ID, CHOICE_ID, CLOCK)


# ── the narrative, revealed at last ─────────────────────────────────────────

def test_reveals_the_narrative_step31_withheld(service, store):
    store.resolve_short_text.return_value = "You push the door open."

    r = _resolve(service)

    assert r.narrative == "You push the door open."
    assert r.choice_uuid == CHOICE_UUID
    assert r.event_uuid == "event-uuid"


# ── the effects ─────────────────────────────────────────────────────────────

def test_stat_effect_moves_the_stat(service, store):
    store.find_choice_effects_by_choice_id.return_value = [
        _effect(1, statistics="life", value=-4)]

    r = _resolve(service)

    assert len(r.execution.stat_changes) == 1
    c = r.execution.stat_changes[0]
    assert (c.statistic, c.before, c.after) == ("life", 30, 26)
    store.update_character_stats.assert_called()


def test_flag_group_zero_touches_the_actor_alone(service, store):
    other = _character(OTHER_CHAR_ID, "other-uuid", 99, 50, LOC)
    store.find_characters_for_event.return_value = [
        _character(CHAR_ID, "char-uuid", USER_ID, 50, LOC), other]
    store.find_choice_effects_by_choice_id.return_value = [
        _effect(1, statistics="life", value=-4, flag_group=0)]

    r = _resolve(service)

    assert r.execution.effects[0].character_uuids == ["char-uuid"]


def test_flag_group_one_is_location_scoped(service, store):
    """INV-46: the group is who stands where the actor stands, not the whole match."""
    here = _character(OTHER_CHAR_ID, "other-uuid", 99, 50, LOC)
    away = _character(77, "away-uuid", 98, 50, FAR_LOC)
    store.find_characters_for_event.return_value = [
        _character(CHAR_ID, "char-uuid", USER_ID, 50, LOC), here, away]
    store.find_choice_effects_by_choice_id.return_value = [
        _effect(1, statistics="life", value=-4, flag_group=1)]

    r = _resolve(service)

    assert r.execution.effects[0].character_uuids == ["char-uuid", "other-uuid"]


def test_key_and_value_to_add_write_the_registry(service, store):
    store.find_choice_effects_by_choice_id.return_value = [
        _effect(1, key="DOOR", value_to_add="OPEN")]

    r = _resolve(service)

    store.upsert_registry.assert_called_once_with(
        MATCH_ID, "DOOR", "OPEN", CHAR_ID, EVENT_ID, CLOCK)
    assert r.execution.registry_changes[0].new_value == "OPEN"


def test_value_to_remove_clears_the_key_when_the_value_matches(service, store):
    store.load_check_context.return_value = _ctx(registry={"DOOR": "OPEN"})
    store.find_choice_effects_by_choice_id.return_value = [
        _effect(1, key="DOOR", value_to_remove="OPEN")]

    r = _resolve(service)

    store.upsert_registry.assert_called_once_with(
        MATCH_ID, "DOOR", None, CHAR_ID, EVENT_ID, CLOCK)
    assert r.execution.registry_changes[0].new_value is None


def test_value_to_remove_leaves_a_key_the_story_moved_on(service, store):
    store.load_check_context.return_value = _ctx(registry={"DOOR": "SEALED"})
    store.find_choice_effects_by_choice_id.return_value = [
        _effect(1, key="DOOR", value_to_remove="OPEN")]

    r = _resolve(service)

    store.upsert_registry.assert_not_called()
    assert r.execution.registry_changes == []


def test_item_effect_grants_the_item(service, store):
    store.find_choice_effects_by_choice_id.return_value = [
        _effect(1, id_item_target=7, item_action="ADD")]

    r = _resolve(service)

    store.add_item.assert_called_once_with(MATCH_ID, CHAR_ID, 7)
    assert r.execution.item_added is True
    assert r.execution.item_changes[0].value == "item-uuid"


def test_id_location_moves_the_recipients_at_no_cost(service, store):
    store.find_choice_effects_by_choice_id.return_value = [_effect(1, id_location=FAR_LOC)]

    r = _resolve(service)

    store.update_character_location.assert_called_once_with(MATCH_ID, CHAR_ID, FAR_LOC)
    store.insert_movement_log.assert_called_once_with(MATCH_ID, CHAR_ID, LOC, FAR_LOC, 0)
    assert r.execution.movement_applied is True
    assert r.execution.location_changes[0].to_location_uuid == "loc-far"


def test_id_weather_is_applied_once_per_row(service, store):
    other = _character(OTHER_CHAR_ID, "other-uuid", 99, 50, LOC)
    store.find_characters_for_event.return_value = [
        _character(CHAR_ID, "char-uuid", USER_ID, 50, LOC), other]
    store.find_choice_effects_by_choice_id.return_value = [
        _effect(1, id_weather=3, flag_group=1)]

    r = _resolve(service)

    store.set_current_weather.assert_called_once_with(MATCH_ID, 3)
    assert r.execution.weather_applied is True


def test_rows_apply_in_authored_order(service, store):
    store.find_choice_effects_by_choice_id.return_value = [
        _effect(1, statistics="life", value=-4),
        _effect(2, statistics="life", value=-6)]

    r = _resolve(service)

    assert r.execution.stat_changes[0].before == 30
    assert r.execution.stat_changes[1].before == 26  # builds on the first
    assert r.execution.stat_changes[1].after == 20


# ── the linked events ───────────────────────────────────────────────────────

def test_id_event_torun_runs_with_its_chain_and_is_not_charged(service, store):
    outcome = _event(id=2, uuid="outcome-uuid", cost_enery=9, coin_cost=9)
    store.find_events_by_id.return_value = {EVENT_ID: _event(), 2: outcome}
    store.find_effects_by_event_id.return_value = {2: [_event_effect(2, "exp", 5)]}
    store.find_choice_by_story_and_uuid.return_value = _choice(id_event_torun=2)

    r = _resolve(service)

    assert "outcome-uuid" in r.execution.executed_event_uuids
    assert r.execution.energy_spent == 0  # a consequence costs nothing
    assert r.execution.stat_changes[0].statistic == "exp"


def test_effect_id_event_runs_inline_and_its_card_is_the_narrative(service, store):
    linked = _event(id=3, uuid="linked-uuid", id_card=88)
    store.find_events_by_id.return_value = {EVENT_ID: _event(), 3: linked}
    store.find_effects_by_event_id.return_value = {3: [_event_effect(3, "exp", 2)]}
    store.find_choice_effects_by_choice_id.return_value = [_effect(1, id_event=3)]

    r = _resolve(service)

    assert r.choice_event_uuid == "linked-uuid"
    assert "linked-uuid" in r.execution.executed_event_uuids
    assert r.execution.stat_changes[0].statistic == "exp"


def test_dangling_link_is_authored_noise_not_an_error(service, store):
    store.find_choice_effects_by_choice_id.return_value = [_effect(1, id_event=404)]

    r = _resolve(service)

    assert r.choice_event_uuid is None
    assert r.execution.stat_changes == []


def test_a_spent_once_stays_spent(service, store):
    once = _event(id=5, uuid="once-uuid", type="ONCE")
    store.find_events_by_id.return_value = {EVENT_ID: _event(), 5: once}
    store.find_effects_by_event_id.return_value = {5: [_event_effect(5, "exp", 3)]}
    store.load_check_context.return_value = _ctx(consumed_event_ids={EVENT_ID, 5})
    store.find_choice_by_story_and_uuid.return_value = _choice(id_event_torun=5)

    r = _resolve(service)

    assert "once-uuid" not in r.execution.executed_event_uuids
    assert r.execution.stat_changes == []


def test_a_linked_choice_event_presents_its_options_for_free(service, store):
    nested_event = _event(id=6, uuid="nested-uuid", cost_enery=9)
    store.find_events_by_id.return_value = {EVENT_ID: _event(), 6: nested_event}
    nested_option = {"id": 60, "uuid": "nested-choice", "id_event": 6, "id_card": None,
                     "priority": 1, "id_text_name": None, "id_text_description": None,
                     "otherwise_flag": 1, "is_progress": 0, "logic_operator": "AND",
                     "limit_sad": None, "limit_dex": None, "limit_int": None,
                     "limit_cos": None}
    store.find_choices_by_event_id.side_effect = \
        lambda sid, eid: [nested_option] if eid == 6 else []
    store.find_choice_by_story_and_uuid.return_value = _choice(id_event_torun=6)

    r = _resolve(service)

    assert r.execution.status == STATUS_CHOICES_PENDING
    assert [c["uuid"] for c in r.execution.pending_choices] == ["nested-choice"]
    assert r.execution.pending_choices[0]["available"] is True
    # Opened for free — a consequence is not a choice — but marked, so its cycle opens.
    assert r.execution.energy_spent == 0
    store.log_event_executed.assert_any_call(
        MATCH_ID, CHAR_ID, 6, CLOCK, f"{MSG_EVENT_EXECUTED} 6")


# ── the Step 30 tail still runs ─────────────────────────────────────────────

def test_a_lethal_choice_effect_triggers_the_coma_rules(service, store):
    store.find_choice_effects_by_choice_id.return_value = [
        _effect(1, statistics="life", value=-99)]

    r = _resolve(service)

    assert r.execution.coma_triggered is True
    assert "char-uuid" in r.execution.edge_state.coma_uuids


def test_a_lethal_row_does_not_silence_its_siblings(service, store):
    """Same rule as an event: all rows land, then the Step 30 pass."""
    store.find_choice_effects_by_choice_id.return_value = [
        _effect(1, statistics="life", value=-99),
        _effect(2, id_item_target=7, item_action="ADD")]

    _resolve(service)

    store.add_item.assert_called_once_with(MATCH_ID, CHAR_ID, 7)


def test_a_coma_stops_the_consequences(service, store):
    linked = _event(id=3, uuid="linked-uuid")
    store.find_events_by_id.return_value = {EVENT_ID: _event(), 3: linked}
    store.find_choice_effects_by_choice_id.return_value = [
        _effect(1, statistics="life", value=-99, id_event=3)]
    store.find_choice_by_story_and_uuid.return_value = _choice(id_event_torun=3)

    r = _resolve(service)

    assert r.execution.coma_triggered is True
    assert "linked-uuid" not in r.execution.executed_event_uuids


def test_flag_end_time_ends_the_time_unit(store):
    time_service = MagicMock()
    time_service.force_time_end.return_value = CLOCK + 1
    svc = EventService(store, edge_store=MagicMock(), content_read_port=None,
                       time_service=time_service)
    ender = _event(id=4, uuid="ender-uuid", flag_end_time=1)
    store.find_events_by_id.return_value = {EVENT_ID: _event(), 4: ender}
    store.find_choice_by_story_and_uuid.return_value = _choice(id_event_torun=4)

    r = svc.select_choice(MATCH_UUID, USER_UUID, CHOICE_UUID, "en")

    assert r.execution.time_ended is True
    assert r.execution.current_clock == CLOCK + 1


# ── the shared shape ────────────────────────────────────────────────────────

def test_the_execution_block_is_the_execute_event_payload(service):
    r = _resolve(service)

    assert r.execution.match_uuid == MATCH_UUID
    assert r.execution.event_uuid == "event-uuid"
    assert r.execution.event_type == "NORMAL"
    assert r.execution.status == STATUS_APPLIED
    assert r.execution.turn_consumed is False  # turns are Step 61, for every action at once
    assert r.execution.pending_choices == []


def test_a_normal_link_runs_even_if_the_match_already_executed_it(service, store):
    """The AWS twin got this wrong until v0.32.0: it tested EVERY link against
    consumed_event_ids instead of ONCE only, so an option's "event to run" fired at most
    once per match and then silently stopped — effects still applying."""
    linked = _event(id=3, uuid="linked-uuid")
    store.find_events_by_id.return_value = {EVENT_ID: _event(), 3: linked}
    store.find_effects_by_event_id.return_value = {3: [_event_effect(3, "exp", 2)]}
    # 3 already ran earlier in this match.
    store.load_check_context.return_value = _ctx(consumed_event_ids={EVENT_ID, 3})
    store.find_choice_effects_by_choice_id.return_value = [_effect(1, id_event=3)]

    r = _resolve(service)

    assert "linked-uuid" in r.execution.executed_event_uuids
    assert r.execution.stat_changes[0].statistic == "exp"


def test_the_same_link_named_twice_runs_once(service, store):
    linked = _event(id=3, uuid="linked-uuid")
    store.find_events_by_id.return_value = {EVENT_ID: _event(), 3: linked}
    store.find_effects_by_event_id.return_value = {3: [_event_effect(3, "exp", 2)]}
    store.find_choice_effects_by_choice_id.return_value = [
        _effect(1, id_event=3), _effect(2, id_event=3)]

    r = _resolve(service)

    assert r.execution.executed_event_uuids.count("linked-uuid") == 1
    assert len(r.execution.stat_changes) == 1
