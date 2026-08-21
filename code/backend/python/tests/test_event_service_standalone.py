"""Step 34 — EventService.apply_standalone_effects: the door item usage goes through.

What is under test is that an execution with NO owning event still produces a well-formed
execute-event payload, and still reaches the step-30 verdict. Mirrors
EventExecutionServiceStandaloneTest on the Java side.
"""
from unittest.mock import MagicMock

import pytest

from app.core.models.match.event_models import EventCheckContext, EventError
from app.core.services.match.event_service import EventService

MATCH_ID, USER_ID, CHAR_ID, STORY_ID, LOC = 1, 2, 3, 4, 100


def _character(life=30, sad=0):
    return dict(id=CHAR_ID, uuid="char-uuid", id_user=USER_ID, id_class=50,
                id_location=LOC, dexterity=10, intelligence=10, constitution=10,
                energy=20, life=life, sad=sad, exp=0, energy_max=100, life_max=100,
                sad_max=50, is_sleeping=False, is_coma=False, characteristics=None)


def _effect(statistics=None, value=0, add=None, remove=None, id_card=None):
    return {"effect_uuid": "effect-1", "statistics": statistics, "value": value,
            "traits_to_add": add, "traits_to_remove": remove, "id_card": id_card}


@pytest.fixture
def store():
    s = MagicMock()
    s.find_match_by_id.return_value = {
        "id": MATCH_ID, "uuid": "match-uuid", "status": "RUNNING", "current_clock": 7,
        "id_story": STORY_ID, "id_user_creator": USER_ID, "id_current_weather": None}
    s.find_character_by_match_and_id.return_value = _character()
    s.find_characters_for_event.return_value = [_character()]
    s.load_check_context.return_value = EventCheckContext(
        id_character=CHAR_ID, id_location=LOC, sleeping=False, coma=False,
        energy=20, coin=10, id_class=50)
    s.find_backpack.return_value = {"food": 5, "magic": 5, "coin": 10}
    s.find_trait_uuids_by_id.return_value = {7: "trait-7", 8: "trait-8"}
    s.add_trait.return_value = True
    s.remove_trait.return_value = True
    s.find_id_event_all_player_coma.return_value = None
    return s


@pytest.fixture
def service(store):
    return EventService(store, edge_store=MagicMock(), content_read_port=MagicMock(),
                        time_service=MagicMock())


def test_no_owning_event_leaves_the_event_fields_null(service):
    card = {"uuid": "card-item"}

    r = service.apply_standalone_effects(MATCH_ID, CHAR_ID, [_effect("life", 3)], card, "en",
                                         source_consumed=True)

    assert r.event_uuid is None
    assert r.event_type is None
    assert r.card is card
    assert r.match_uuid == "match-uuid"
    assert r.status == "APPLIED"
    assert r.executed_event_uuids == []
    assert r.pending_choices == []
    assert r.game_over is False
    assert r.energy_spent == 0
    # The caller already removed the row that produced these effects.
    assert r.item_removed is True
    assert r.refresh_recommended is True


def test_a_character_stat_is_clamped_and_flushed(service, store):
    r = service.apply_standalone_effects(MATCH_ID, CHAR_ID, [_effect("life", 5)], None, "en")

    assert len(r.stat_changes) == 1
    assert (r.stat_changes[0].statistic, r.stat_changes[0].before,
            r.stat_changes[0].after) == ("life", 30, 35)
    assert r.refresh_recommended is True
    stats = store.update_character_stats.call_args[0][2]
    assert stats["life"] == 35


def test_a_backpack_stat_writes_the_backpack(service, store):
    service.apply_standalone_effects(MATCH_ID, CHAR_ID, [_effect("food", 3)], None, "en")

    backpack = store.update_backpack.call_args[0][2]
    assert backpack["food"] == 8
    assert backpack["magic"] == 5


def test_the_trait_csvs_are_flipped_through_the_shared_helper(service, store):
    r = service.apply_standalone_effects(
        MATCH_ID, CHAR_ID, [_effect(add="7", remove="8")], None, "en")

    store.add_trait.assert_called_once_with(MATCH_ID, CHAR_ID, 7, None)
    store.remove_trait.assert_called_once_with(MATCH_ID, CHAR_ID, 8)
    assert len(r.trait_changes) == 2
    assert r.trait_changes[0].value == "trait-7"
    assert r.trait_changes[0].action == "ADD"


def test_each_row_reports_itself_targeting_only_the_user(service):
    r = service.apply_standalone_effects(
        MATCH_ID, CHAR_ID, [_effect("life", 2, id_card=55)], None, "en")

    assert len(r.effects) == 1
    assert r.effects[0].event_uuid is None
    assert r.effects[0].effect_uuid == "effect-1"
    assert r.effects[0].target == "ONLY_ONE"
    assert r.effects[0].character_uuids == ["char-uuid"]


def test_a_sadness_effect_reaches_the_step_30_verdict(service, store):
    # sad 48 of 50: +5 overflows.
    store.find_character_by_match_and_id.return_value = _character(sad=48)
    store.find_characters_for_event.return_value = [_character(sad=48)]

    r = service.apply_standalone_effects(MATCH_ID, CHAR_ID, [_effect("sad", 5)], None, "en")

    assert r.edge_state.anything() is True
    assert r.edge_state.sadness_overflow_uuids == ["char-uuid"]


def test_an_empty_effect_list_is_a_well_formed_no_op(service):
    r = service.apply_standalone_effects(MATCH_ID, CHAR_ID, [], None, "en")

    assert r.status == "APPLIED"
    assert r.stat_changes == []
    assert r.refresh_recommended is False
    assert r.edge_state.anything() is False


def test_a_none_effect_list_is_treated_as_empty(service):
    assert service.apply_standalone_effects(MATCH_ID, CHAR_ID, None, None, "en").status == "APPLIED"


def test_an_unknown_statistic_is_authored_noise(service):
    r = service.apply_standalone_effects(MATCH_ID, CHAR_ID, [_effect("health", 5)], None, "en")
    assert r.stat_changes == []


def test_unknown_match_or_character(service, store):
    store.find_match_by_id.return_value = None
    with pytest.raises(EventError) as exc:
        service.apply_standalone_effects(99, CHAR_ID, [], None, "en")
    assert exc.value.code == EventError.MATCH_NOT_FOUND

    store.find_match_by_id.return_value = {
        "id": MATCH_ID, "uuid": "match-uuid", "status": "RUNNING", "current_clock": 7,
        "id_story": STORY_ID, "id_user_creator": USER_ID, "id_current_weather": None}
    store.find_character_by_match_and_id.return_value = None
    with pytest.raises(EventError):
        service.apply_standalone_effects(MATCH_ID, 88, [], None, "en")
