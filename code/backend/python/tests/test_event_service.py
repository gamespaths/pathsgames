"""Step 29 — EventService: resolution, costs, effects, chain, coma and time end.

Mirrors EventExecutionServiceTest / …EffectsTest / …ChainTest on the Java side.
"""
from unittest.mock import MagicMock

import pytest

from app.core.models.match.event_models import (EdgeStateOutcome, EventCheckContext,
                                                EventError)
from app.core.models.match.time_models import TimeEndOutcome
from app.core.services.match.event_service import EventService

MATCH_UUID = "match-uuid"
USER_UUID = "user-uuid"
MATCH_ID, USER_ID, CHAR_ID, STORY_ID, LOC = 1, 2, 3, 4, 100
MATE_ID, FAR_ID = 30, 40


def _character(cid, uuid, id_user, id_class, id_location, **over):
    base = dict(id=cid, uuid=uuid, id_user=id_user, id_class=id_class,
                id_location=id_location, dexterity=10, intelligence=10, constitution=10,
                energy=20, life=30, sad=0, exp=0, energy_max=100, life_max=100, sad_max=50,
                is_sleeping=False, is_coma=False, characteristics=None)
    base.update(over)
    return base


def _event(**over):
    base = dict(id=1, uuid="event-1", type="NORMAL", id_card=None, cost_enery=0,
                cost_coin=0, flag_end_time=0, id_event_next=None,
                id_specific_location=None, id_weather=None,
                registry_key_condition=None, registry_value_condition=None,
                id_item_condition=None, id_class_condition=None)
    base.update(over)
    return base


def _effect(**over):
    base = dict(id=1, uuid="effect-1", id_card=None, id_event=1, statistics=None, value=0,
                target="ONLY_ONE", target_class=None, traits_to_add=None,
                traits_to_remove=None, id_item_target=None, item_action=None,
                key_to_add=None, key_value_to_add=None, characteristic_to_add=None,
                characteristic_to_remove=None, id_weather=None)
    base.update(over)
    return base


@pytest.fixture
def store():
    s = MagicMock()
    s.find_user_id_by_uuid.return_value = USER_ID
    # v0.35.1 — no cap unless a case says otherwise, and the add goes through.
    s.add_item.return_value = True
    s.find_item_max_per_character_by_id.return_value = {}
    s.find_match_for_event.return_value = {
        "id": MATCH_ID, "uuid": MATCH_UUID, "status": "RUNNING", "current_clock": 7,
        "id_story": STORY_ID, "id_user_creator": USER_ID, "id_current_weather": None,
    }
    actor = _character(CHAR_ID, "char-uuid", USER_ID, 50, LOC)
    s.find_character_by_match_and_user.return_value = actor
    s.find_characters_for_event.return_value = [
        actor,
        _character(MATE_ID, "mate-uuid", 20, 51, LOC),      # same location -> hit by ALL
        _character(FAR_ID, "far-uuid", 21, 50, 999),        # elsewhere -> never hit
    ]
    s.find_backpack.return_value = {"food": 5, "magic": 5, "coin": 10}
    s.find_event_by_story_and_uuid.return_value = _event()
    s.find_events_by_id.return_value = {1: _event()}
    s.find_effects_by_event_id.return_value = {}
    s.find_id_event_end_game.return_value = None
    s.find_item_uuids_by_id.return_value = {42: "item-uuid"}
    s.find_trait_uuids_by_id.return_value = {7: "trait-uuid"}
    # v0.35.2 — real dict, not a MagicMock: the trait deltas are arithmetic.
    s.find_trait_stats_by_id.return_value = {}
    s.load_check_context.return_value = EventCheckContext(
        id_character=CHAR_ID, id_location=LOC, energy=20, coin=10,
        food=5, magic=5, id_class=50)
    s.remove_item.return_value = True
    s.add_trait.return_value = True
    s.remove_trait.return_value = True
    # Step 31: a plain event owns no choices — the tests here exercise the APPLIED flow.
    s.find_choices_by_event_id.return_value = []
    s.find_choice_conditions_by_choice_id.return_value = {}
    s.find_trait_ids_by_character.return_value = set()
    s.resolve_short_text.return_value = None
    return s


@pytest.fixture
def time_service():
    t = MagicMock()
    t.force_time_end.return_value = TimeEndOutcome(8, [], [], EdgeStateOutcome.none())
    return t


@pytest.fixture
def service(store, edge_store, time_service):
    return EventService(store, edge_store=edge_store, content_read_port=None,
                        time_service=time_service)


@pytest.fixture
def edge_store():
    return MagicMock()


def run(service):
    return service.execute_event(MATCH_UUID, USER_UUID, "event-1", "en")


# ── resolution ──────────────────────────────────────────────────────────────

def test_unknown_user_is_masked_as_match_not_found(service, store):
    store.find_user_id_by_uuid.return_value = None
    with pytest.raises(EventError) as exc:
        run(service)
    assert exc.value.code == EventError.MATCH_NOT_FOUND


def test_unknown_match(service, store):
    store.find_match_for_event.return_value = None
    with pytest.raises(EventError) as exc:
        run(service)
    assert exc.value.code == EventError.MATCH_NOT_FOUND


def test_caller_with_no_character_is_masked_as_match_not_found(service, store):
    store.find_character_by_match_and_user.return_value = None
    with pytest.raises(EventError) as exc:
        run(service)
    assert exc.value.code == EventError.MATCH_NOT_FOUND


@pytest.mark.parametrize("status", ["CREATED", "PAUSED", "ENDED", "GAMEOVER"])
def test_match_not_running(service, store, status):
    store.find_match_for_event.return_value = {
        **store.find_match_for_event.return_value, "status": status}
    with pytest.raises(EventError) as exc:
        run(service)
    assert exc.value.code == EventError.MATCH_NOT_RUNNING


def test_unknown_event(service, store):
    store.find_event_by_story_and_uuid.return_value = None
    with pytest.raises(EventError) as exc:
        run(service)
    assert exc.value.code == EventError.EVENT_NOT_FOUND


def test_the_checker_verdict_surfaces_verbatim(service, store):
    store.find_event_by_story_and_uuid.return_value = _event(cost_enery=999)
    with pytest.raises(EventError) as exc:
        run(service)
    assert exc.value.code == EventError.NOT_ENOUGH_ENERGY
    store.update_character_stats.assert_not_called()
    store.log_event_executed.assert_not_called()


# ── costs & result contract ─────────────────────────────────────────────────

def test_costs_are_deducted_and_reported(service, store):
    store.find_event_by_story_and_uuid.return_value = _event(cost_enery=5, cost_coin=3)

    r = run(service)

    assert (r.energy_spent, r.coin_spent) == (5, 3)
    assert (r.new_energy, r.new_coin) == (15, 7)
    store.update_backpack.assert_called_once()
    # A coin-only change must not wipe the food/magic it never mentioned.
    written = store.update_backpack.call_args[0][2]
    assert written["food"] == 5 and written["magic"] == 5 and written["coin"] == 7


def test_v0353_food_and_magic_are_deducted_reported_and_flushed(service, store):
    store.find_event_by_story_and_uuid.return_value = _event(cost_food=2, cost_magic=1)

    r = run(service)

    assert (r.food_spent, r.magic_spent) == (2, 1)
    assert (r.new_food, r.new_magic) == (3, 4)
    written = store.update_backpack.call_args[0][2]
    assert written["food"] == 3 and written["magic"] == 4 and written["coin"] == 10


def test_v0353_an_actor_who_cannot_pay_the_food_is_refused(service, store):
    store.find_event_by_story_and_uuid.return_value = _event(cost_food=6)

    with pytest.raises(EventError) as exc:
        run(service)

    assert exc.value.code == EventError.NOT_ENOUGH_FOOD
    store.update_backpack.assert_not_called()


def test_v0353_the_price_is_stamped_on_the_log_row_of_the_paid_event(service, store):
    store.find_event_by_story_and_uuid.return_value = _event(
        cost_enery=5, cost_coin=3, cost_food=2, cost_magic=1)

    run(service)

    store.log_event_executed.assert_called_once_with(
        MATCH_ID, CHAR_ID, 1, 7, "EVENT_EXECUTED 1", 5, 2, 1, 3,
        # v0.35.4 — the gains ride on the same row; this event gave nothing back.
        {"energy": 0, "food": 0, "magic": 0, "coin": 0})


def test_turn_is_never_consumed(service):
    # v0.29.0 — execute-event does not touch the turn queue.
    assert run(service).turn_consumed is False


def test_a_no_op_event_reports_no_change(service):
    r = run(service)
    assert r.executed_event_uuids == ["event-1"]
    assert r.refresh_recommended is False
    assert r.pending_choices == []


def test_the_event_is_logged_with_the_marker(service, store):
    run(service)
    args = store.log_event_executed.call_args[0]
    assert args[0] == MATCH_ID and args[2] == 1
    assert args[4].startswith("EVENT_EXECUTED")


def test_game_over_is_only_a_flag(service, store):
    store.find_id_event_end_game.return_value = 1
    r = run(service)
    assert r.game_over is True and r.refresh_recommended is True


# ── effects ─────────────────────────────────────────────────────────────────

def test_stats_are_clamped_at_the_max_and_at_zero(service, store):
    store.find_effects_by_event_id.return_value = {1: [_effect(statistics="life", value=9999)]}
    assert run(service).stat_changes[0].after == 100

    store.find_effects_by_event_id.return_value = {1: [_effect(statistics="energy", value=-9999)]}
    assert run(service).stat_changes[0].after == 0


def test_backpack_resources(service, store):
    store.find_effects_by_event_id.return_value = {
        1: [_effect(statistics="food", value=3), _effect(id=2, statistics="coin", value=5)]}
    r = run(service)
    assert {c.statistic for c in r.stat_changes} == {"food", "coin"}
    assert r.new_coin == 15


def test_unknown_statistic_is_ignored(service, store):
    store.find_effects_by_event_id.return_value = {1: [_effect(statistics="charisma", value=5)]}
    r = run(service)
    assert r.stat_changes == []
    assert len(r.effects) == 1  # the row is still reported


def test_target_all_hits_the_actors_location_only(service, store):
    store.find_effects_by_event_id.return_value = {
        1: [_effect(statistics="exp", value=1, target="ALL")]}

    r = run(service)

    assert r.effects[0].character_uuids == ["char-uuid", "mate-uuid"]
    touched = {c[0][1] for c in store.update_character_stats.call_args_list}
    assert touched == {CHAR_ID, MATE_ID}  # never FAR_ID


def test_target_class_narrows_and_may_match_nobody(service, store):
    store.find_effects_by_event_id.return_value = {
        1: [_effect(statistics="exp", value=1, target="ALL", target_class=999)]}

    r = run(service)

    assert r.effects[0].character_uuids == []
    assert r.stat_changes == []
    store.update_character_stats.assert_not_called()


def test_items(service, store):
    store.find_effects_by_event_id.return_value = {
        1: [_effect(id_item_target=42, item_action="ADD")]}
    r = run(service)
    store.add_item.assert_called_once_with(MATCH_ID, CHAR_ID, 42, None)
    assert r.item_added is True and r.item_changes[0].value == "item-uuid"
    # v0.35.4 — the log row names the event whose effect handed the item over.
    store.log_item_action.assert_called_once_with(MATCH_ID, CHAR_ID, 42, "ADD", 1,
                                                  None, None, 1)


def test_v0354_an_add_the_cap_refuses_is_not_logged(service, store):
    store.find_item_max_per_character_by_id.return_value = {42: 1}
    store.add_item.return_value = False
    store.find_effects_by_event_id.return_value = {
        1: [_effect(id_item_target=42, item_action="ADD")]}

    r = run(service)

    # No error and no row: a refused ADD is not a thing that happened.
    assert r.item_added is False
    store.log_item_action.assert_not_called()


def test_v0354_a_remove_is_logged_and_a_remove_that_found_nothing_is_not(service, store):
    store.remove_item.return_value = True
    store.find_effects_by_event_id.return_value = {
        1: [_effect(id_item_target=42, item_action="REMOVE")]}
    run(service)
    store.log_item_action.assert_called_once_with(MATCH_ID, CHAR_ID, 42, "REMOVE", 1,
                                                  None, None, 1)

    store.log_item_action.reset_mock()
    store.remove_item.return_value = False
    run(service)
    store.log_item_action.assert_not_called()


def test_v0354_what_the_effects_gave_the_actor_is_stamped_on_the_event_row(service, store):
    store.find_effects_by_event_id.return_value = {1: [
        _effect(id=1, uuid="e-1", statistics="coin", value=5),
        _effect(id=2, uuid="e-2", statistics="energy", value=4),
        _effect(id=3, uuid="e-3", statistics="magic", value=-2),
    ]}

    run(service)

    # Only the positive half: a drain is the effect's own business, not a gain.
    assert store.log_event_executed.call_args[0][-1] == {
        "energy": 4, "food": 0, "magic": 0, "coin": 5}


def test_v0354_an_event_that_gives_nothing_logs_a_gain_of_zero(service, store):
    store.find_effects_by_event_id.return_value = {1: [_effect(statistics="life", value=3)]}

    run(service)

    assert store.log_event_executed.call_args[0][-1] == {
        "energy": 0, "food": 0, "magic": 0, "coin": 0}


def test_a_granted_trait_moves_the_maxima_and_the_stats(service, store):
    """v0.35.2 — until this version a trait handed over by an event wrote its row and
    changed nothing, while its card went on promising "+2 life" to a player whose life bar
    never moved."""
    store.find_trait_stats_by_id.return_value = {
        7: {"life": 2, "energy": 3, "sad": 5, "dexterity": 1,
            "intelligence": 0, "constitution": 0, "weight": 4}}
    store.find_effects_by_event_id.return_value = {1: [_effect(traits_to_add="7")]}

    r = run(service)

    written = store.update_character_stats.call_args[0][2]
    # The actor starts at life 30 / life_max 100, energy 20 / energy_max 100,
    # sad 0 / sad_max 50, dexterity 10.
    assert (written["life_max"], written["energy_max"], written["sad_max"]) == (102, 103, 55)
    assert written["weight_max"] == 4
    # Life and energy follow their ceiling — a character is created full.
    assert (written["life"], written["energy"], written["dexterity"]) == (32, 23, 11)
    # Sadness does not: it is created at zero, so the trait only makes room.
    assert written["sad"] == 0
    assert len(r.stat_changes) == 3


def test_a_removed_trait_takes_back_exactly_what_it_gave(service, store):
    store.find_trait_stats_by_id.return_value = {
        7: {"life": 2, "energy": 3, "sad": 5, "dexterity": 1,
            "intelligence": 0, "constitution": 0, "weight": 4}}
    store.find_effects_by_event_id.return_value = {
        1: [_effect(traits_to_add="7", traits_to_remove="7")]}

    run(service)

    written = store.update_character_stats.call_args[0][2]
    assert (written["life_max"], written["energy_max"], written["sad_max"]) == (100, 100, 50)
    assert (written["life"], written["energy"], written["dexterity"]) == (30, 20, 10)


def test_a_trait_no_story_row_matches_is_authored_noise(service, store):
    store.find_trait_stats_by_id.return_value = {}
    store.find_effects_by_event_id.return_value = {1: [_effect(traits_to_add="7")]}

    r = run(service)

    # The row is still written and reported; nothing else moves, and nothing raises.
    assert len(r.trait_changes) == 1
    assert r.stat_changes == []


def test_traits_and_characteristics(service, store):
    store.find_effects_by_event_id.return_value = {
        1: [_effect(traits_to_add="7,brave,", characteristic_to_add="BRAVE")]}

    r = run(service)

    store.add_trait.assert_called_once_with(MATCH_ID, CHAR_ID, 7, 1)  # noise skipped
    assert r.characteristic_changes[0].value == "BRAVE"
    store.set_character_characteristics.assert_called_once_with(MATCH_ID, CHAR_ID, "BRAVE")


def test_registry_is_written_once_and_seen_by_the_next_effect(service, store):
    store.find_effects_by_event_id.return_value = {1: [
        _effect(key_to_add="GATE", key_value_to_add="OPEN", target="ALL"),
        _effect(id=2, key_to_add="GATE", key_value_to_add="SHUT"),
    ]}

    r = run(service)

    assert store.upsert_registry.call_count == 2  # once per row, not once per recipient
    assert r.registry_changes[1].old_value == "OPEN"
    assert r.registry_changes[1].new_value == "SHUT"


def test_weather_effect_sets_the_match_weather_once(service, store):
    store.find_effects_by_event_id.return_value = {1: [_effect(id_weather=3, target="ALL")]}
    r = run(service)
    store.set_current_weather.assert_called_once_with(MATCH_ID, 3)
    assert r.weather_applied is True


# ── forced movement (v0.29.3) ───────────────────────────────────────────────

def test_movement_effect_moves_the_actor(service, store):
    store.find_location_uuids_by_id.return_value = {LOC: "loc-here", 200: "loc-target"}
    store.find_effects_by_event_id.return_value = {1: [_effect(id_location=200)]}
    r = run(service)
    store.update_character_location.assert_called_once_with(MATCH_ID, CHAR_ID, 200)
    store.insert_movement_log.assert_called_once_with(MATCH_ID, CHAR_ID, LOC, 200, 0, 0, 0, 0)
    assert r.movement_applied is True
    assert r.refresh_recommended is True
    assert r.energy_spent == 0  # forced movement must not charge energy
    assert [(c.character_uuid, c.from_location_uuid, c.to_location_uuid)
            for c in r.location_changes] == [("char-uuid", "loc-here", "loc-target")]


def test_movement_effect_target_all_moves_the_room(service, store):
    store.find_location_uuids_by_id.return_value = {LOC: "loc-here", 200: "loc-target"}
    store.find_effects_by_event_id.return_value = {1: [_effect(id_location=200, target="ALL")]}
    r = run(service)
    moved = {c.args[1] for c in store.update_character_location.call_args_list}
    assert moved == {CHAR_ID, MATE_ID}  # FAR stands elsewhere and stays put
    assert len(r.location_changes) == 2


def test_movement_to_an_unknown_location_is_skipped(service, store):
    store.find_location_uuids_by_id.return_value = {LOC: "loc-here"}
    store.find_effects_by_event_id.return_value = {1: [_effect(id_location=555)]}
    r = run(service)
    store.update_character_location.assert_not_called()
    store.insert_movement_log.assert_not_called()
    assert r.movement_applied is False
    assert r.refresh_recommended is False


def test_movement_to_the_current_location_is_a_no_op(service, store):
    store.find_location_uuids_by_id.return_value = {LOC: "loc-here"}
    store.find_effects_by_event_id.return_value = {1: [_effect(id_location=LOC)]}
    r = run(service)
    store.update_character_location.assert_not_called()
    store.insert_movement_log.assert_not_called()
    assert r.movement_applied is False


def test_a_later_effect_resolves_all_at_the_new_location(service, store):
    store.find_location_uuids_by_id.return_value = {LOC: "loc-here", 999: "loc-far"}
    store.find_effects_by_event_id.return_value = {1: [
        _effect(id_location=999),
        _effect(id=2, uuid="effect-2", statistics="life", value=-5, target="ALL"),
    ]}
    run(service)
    # The actor was teleported next to FAR before the life effect ran: the ALL set is now
    # {actor, far}, and the mate left behind is untouched.
    written = {c.args[1] for c in store.update_character_stats.call_args_list}
    assert written == {CHAR_ID, FAR_ID}


# ── chain, coma and time end ────────────────────────────────────────────────

def test_the_chain_runs_every_link_and_charges_only_the_first(service, store):
    head = _event(id=1, uuid="event-1", id_event_next=2, cost_enery=5)
    tail = _event(id=2, uuid="event-2")
    store.find_event_by_story_and_uuid.return_value = head
    store.find_events_by_id.return_value = {1: head, 2: tail}
    store.find_effects_by_event_id.return_value = {
        1: [_effect(statistics="exp", value=3)],
        2: [_effect(id=2, id_event=2, statistics="exp", value=4)],
    }

    r = run(service)

    assert r.executed_event_uuids == ["event-1", "event-2"]
    assert r.energy_spent == 5  # the tail is free
    assert r.stat_changes[1].after == 7  # exp accumulates across the chain


def test_an_authored_cycle_terminates(service, store):
    a = _event(id=1, uuid="event-1", id_event_next=2)
    b = _event(id=2, uuid="event-2", id_event_next=1)
    store.find_event_by_story_and_uuid.return_value = a
    store.find_events_by_id.return_value = {1: a, 2: b}

    r = run(service)

    assert r.executed_event_uuids == ["event-1", "event-2"]
    assert store.log_event_executed.call_count == 2


def test_a_chained_event_is_not_rechecked(service, store):
    a = _event(id=1, uuid="event-1", id_event_next=2)
    b = _event(id=2, uuid="event-2", id_specific_location=999, id_class_condition=999)
    store.find_event_by_story_and_uuid.return_value = a
    store.find_events_by_id.return_value = {1: a, 2: b}

    assert run(service).executed_event_uuids == ["event-1", "event-2"]


def test_a_spent_once_event_stops_the_chain(service, store):
    a = _event(id=1, uuid="event-1", id_event_next=2)
    b = _event(id=2, uuid="event-2", type="ONCE")
    store.find_event_by_story_and_uuid.return_value = a
    store.find_events_by_id.return_value = {1: a, 2: b}
    store.load_check_context.return_value = EventCheckContext(
        id_character=CHAR_ID, id_location=LOC, energy=20, coin=10, id_class=50,
        consumed_event_ids={2})

    assert run(service).executed_event_uuids == ["event-1"]


def test_flag_end_time_advances_the_clock_once_after_the_chain(service, store, time_service):
    a = _event(id=1, uuid="event-1", id_event_next=2, flag_end_time=1)
    b = _event(id=2, uuid="event-2", flag_end_time=1)
    store.find_event_by_story_and_uuid.return_value = a
    store.find_events_by_id.return_value = {1: a, 2: b}

    r = run(service)

    time_service.force_time_end.assert_called_once_with(MATCH_UUID)
    assert r.time_ended is True and r.forced_sleep is True
    assert r.current_clock == 8  # the response carries the NEW clock


def test_coma_short_circuits_the_chain_and_the_time_end(service, store, edge_store, time_service):
    a = _event(id=1, uuid="event-1", id_event_next=2, flag_end_time=1)
    b = _event(id=2, uuid="event-2")
    store.find_event_by_story_and_uuid.return_value = a
    store.find_events_by_id.return_value = {1: a, 2: b}
    store.find_effects_by_event_id.return_value = {
        1: [_effect(statistics="life", value=-9999)]}

    r = run(service)

    assert r.coma_triggered is True and r.forced_sleep is True
    assert r.time_ended is False  # flag_end_time must not fire on coma
    assert r.executed_event_uuids == ["event-1"]  # the chain stopped
    edge_store.set_coma.assert_called_once_with(MATCH_ID, CHAR_ID, 7)
    time_service.force_time_end.assert_not_called()
