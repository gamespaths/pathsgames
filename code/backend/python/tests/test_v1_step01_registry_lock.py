"""V1 step 1 - the registry lock: mode table, visibility filter, checkers, match-info and
pending choices. Mirrors RegistryLockTest / AvailabilityRegistryLockTest on the Java side."""
from dataclasses import dataclass
from unittest.mock import MagicMock

import pytest

from app.adapters.rest.match.match_controller import _location_info_to_camel
from app.core.models.match.event_models import (
    ChoiceAvailability, ChoiceCheckContext, EventAvailability, EventCheckContext, EventError,
)
from app.core.services.match import choice_availability, event_availability
from app.core.services.match import registry_service as rs
from app.core.services.match.event_service import EventService
from app.core.services.match.match_query_service import MatchQueryService


def _lock(mode, key, op, value, hidden=False, title=None):
    return {"mode": mode, "hidden": hidden, "key": key, "keyTitle": title,
            "operator": op, "value": value}


# ── the mode table (same rows on Java and AWS) ─────────────────────────────

@pytest.mark.parametrize("op,expected,actual,mode,operator,value", [
    ("=", "open", [], "MISSING", "=", "open"),
    (None, "open", [], "MISSING", "=", "open"),
    (" ", "open", ["closed"], "MISSING", "=", "open"),
    (">", "5", ["3"], "MISSING", ">", "5"),
    ("<", "5", ["7"], "MISSING", "<", "5"),
    ("!=", "open", ["OPEN"], "FORBIDDEN", "!=", "OPEN"),
    ("!=", "open", ["a", "Open"], "FORBIDDEN", "!=", "Open"),
])
def test_mode_table(op, expected, actual, mode, operator, value):
    assert rs.lock("gate", op, expected, actual) == _lock(mode, "gate", operator, value)


@pytest.mark.parametrize("key,op,expected", [
    ("gate", "~", "open"), ("gate", "=", None), ("gate", ">", "abc"), ("gate", "<", None),
    (None, "=", "open"), (" ", "=", "open"),
])
def test_authoring_error_is_generic(key, op, expected):
    assert rs.lock(key, op, expected, []) == rs.generic_lock()
    assert rs.generic_lock() == _lock("MISSING", None, None, None)


def test_forbidden_falls_back_to_expected_and_trims_key():
    assert rs.lock("k", "!=", " x ", None)["value"] == "x"
    assert rs.lock(" k ", "=", "v", None)["key"] == "k"


# ── the visibility filter ───────────────────────────────────────────────────

@dataclass
class _Card:
    title: str


def _service(keys, card=None):
    story = MagicMock()
    story.find_keys_by_story_id.return_value = keys
    content = MagicMock()
    content.get_card_by_story_id_and_card_id.return_value = card
    return rs.RegistryService(MagicMock(), story, content), story, content


def test_public_key_gets_card_title_once():
    service, story, content = _service(
        [{"name": "gate", "visibility": " public ", "id_card": 4}], _Card("Chiave"))
    view = service.lock_view(9, "it")
    raw = rs.lock("gate", "!=", "open", ["open"])
    assert view.apply(raw) == _lock("FORBIDDEN", "gate", "!=", "open", title="Chiave")
    view.apply(raw)
    story.find_keys_by_story_id.assert_called_once_with(9)
    content.get_card_by_story_id_and_card_id.assert_called_once_with(9, 4, "it")


def test_public_key_without_card_or_with_dict_card():
    service, _, content = _service([{"key_name": "plain", "visibility": "PUBLIC"},
                                    {"name": "dict", "visibility": "PUBLIC", "id_card": 2}],
                                   {"title": "From dict"})
    view = service.lock_view(9)
    assert view.apply(rs.lock("plain", "=", "x", []))["keyTitle"] is None
    assert view.apply(rs.lock("dict", "=", "x", []))["keyTitle"] == "From dict"
    content.get_card_by_story_id_and_card_id.return_value = None
    view2 = service.lock_view(9)
    assert view2.apply(rs.lock("dict", "=", "x", []))["keyTitle"] is None


def test_hidden_keys():
    service, _, content = _service([{"name": "secret", "visibility": "PRIVATE", "id_card": 4},
                                    {"name": "blank", "visibility": None}])
    view = service.lock_view(9, "en")
    for key in ("secret", "blank", "undeclared"):
        assert view.apply(rs.lock(key, "!=", "v", ["v"])) == _lock(
            "FORBIDDEN", None, None, None, hidden=True)
    content.get_card_by_story_id_and_card_id.assert_not_called()


def test_pass_through_and_unwired():
    service, story, _ = _service([])
    view = service.lock_view(9)
    assert view.apply(None) is None
    assert view.apply(rs.generic_lock()) == rs.generic_lock()
    story.find_keys_by_story_id.assert_not_called()
    raw = rs.lock("gate", "=", "x", [])
    assert rs.lock_view_of(None, 9, "en").apply(raw)["hidden"] is True
    assert rs.lock_view_of(MagicMock(), 9, "en").apply(raw)["hidden"] is True
    bare = rs.RegistryService(MagicMock())
    assert rs.lock_view_of(bare, 9, "en").apply(raw)["hidden"] is True
    assert rs._card_title(None) is None


# ── checkers ────────────────────────────────────────────────────────────────

def _event(key, op, value, **over):
    base = dict(id=1, type="NORMAL", cost_enery=0, cost_coin=0, registry_key_condition=key,
                registry_value_operator_condition=op, registry_value_condition=value)
    base.update(over)
    return base


def _ectx(registry=None, energy=10):
    return EventCheckContext(id_character=1, id_location=None, energy=energy, coin=10,
                             registry=registry or {})


def test_event_missing_and_forbidden():
    a = event_availability.check(_event("gate", None, "open"), _ectx())
    assert a.reason == EventError.REGISTRY_CONDITION_NOT_MET
    assert a.registry_lock == _lock("MISSING", "gate", "=", "open")
    b = event_availability.check(_event("gate", "!=", "open"), _ectx({"gate": ["Open"]}))
    assert b.registry_lock == _lock("FORBIDDEN", "gate", "!=", "Open")


def test_event_other_reasons_have_no_lock():
    a = event_availability.check(_event("gate", "=", "open", cost_enery=99), _ectx())
    assert a.reason == EventError.NOT_ENOUGH_ENERGY and a.registry_lock is None
    assert EventAvailability.ok().registry_lock is None
    assert event_availability.check(_event("gate", "=", "open"),
                                    _ectx({"gate": ["open"]})).registry_lock is None


def _choice(logic="AND", **over):
    base = {"id": 1, "otherwise_flag": 0, "logic_operator": logic}
    base.update(over)
    return base


def _cond(ctype, key=None, value=None, operator=None):
    return {"type": ctype, "key": key, "value": value, "operator": operator}


def _cctx(registry=None):
    return ChoiceCheckContext(actor_stats={"dex": 3}, id_class=50, id_location=100,
                              registry=registry or {}, party_locations=[100])


def test_choice_and_first_failure():
    a = choice_availability.check(_choice(), [
        _cond("KEYS", "day", "1", ">"), _cond("KEYS", "gate", "open", "!="),
        _cond("KEYS", "bell", "rung", "=")], _cctx({"day": ["2"], "gate": ["open"]}))
    assert a.reason == choice_availability.CONDITION_KEYS_NOT_MET
    assert a.registry_lock == _lock("FORBIDDEN", "gate", "!=", "open")


def test_choice_and_other_type_and_blank_key():
    a = choice_availability.check(_choice(), [_cond("ITEM", None, "9", "="),
                                              _cond("KEYS", "gate", "open", "=")], _cctx())
    assert a.reason == choice_availability.CONDITION_ITEM_NOT_MET and a.registry_lock is None
    b = choice_availability.check(_choice(), [_cond("KEYS", "  ", "open", "=")], _cctx())
    assert b.registry_lock == rs.generic_lock()


def test_choice_or_generic_and_no_lock_cases():
    a = choice_availability.check(_choice("or"), [_cond("ITEM", None, "9", "="),
                                                  _cond("KEYS", "gate", "open", "=")], _cctx())
    assert a.reason == choice_availability.CONDITIONS_NOT_MET
    assert a.registry_lock == rs.generic_lock()
    assert choice_availability.check(_choice("OR"), [_cond("ITEM", None, "9", "=")],
                                     _cctx()).registry_lock is None
    assert choice_availability.check(_choice(limit_dex=9), [_cond("KEYS", "gate", "x", "=")],
                                     _cctx()).registry_lock is None
    assert ChoiceAvailability.ok().registry_lock is None
    assert ChoiceAvailability.no("X").registry_lock is None


# ── match-info: events and neighbors ────────────────────────────────────────

HERE, THERE, MATCH_ID, USER_ID = 10, 12, 99, 7


def _query(events, edge_overrides=None, keys=None, coma=False):
    persistence, story_read, user_access = MagicMock(), MagicMock(), MagicMock()
    character_read, movement_store, event_store = MagicMock(), MagicMock(), MagicMock()
    user_access.find_by_uuid.return_value = {"id": USER_ID, "uuid": "u"}
    persistence.find_match_by_uuid.return_value = {
        "id": MATCH_ID, "uuid": "match-uuid", "id_story": 2, "id_difficulty": 3,
        "id_user_creator": USER_ID, "name": "n", "status": "RUNNING", "current_clock": 1,
        "exp_cost": 5, "ts_insert": "now", "ts_update": "now", "single_player": 1,
        "character_template_uuid": "ct", "class_uuid": "cl", "trait_uuids": [],
    }
    story_read.find_story_by_id.return_value = {"id": 2, "uuid": "s", "id_location_start": HERE}
    story_read.find_difficulty_by_id.return_value = {"id": 3, "uuid": "d"}
    story_read.find_locations_by_story_id.return_value = [
        {"id": HERE, "uuid": "loc-here"},
        {"id": THERE, "uuid": "loc-there", "cost_energy_enter": 0, "secure_param": 0,
         "max_characters": 0},
    ]
    edge = {"id_location_from": HERE, "id_location_to": THERE, "direction": "N",
            "flag_back": 1, "energy_cost": 0}
    edge.update(edge_overrides or {})
    story_read.find_location_neighbors_by_story_id.return_value = [edge]
    story_read.find_events_by_story_id.return_value = events
    story_read.find_character_templates_by_story_id.return_value = []
    story_read.find_traits_by_story_id.return_value = []
    story_read.find_items_by_story_id.return_value = []
    story_read.find_card_by_story_and_card_id.return_value = None
    story_read.find_keys_by_story_id.return_value = keys or []
    persistence.find_locations_by_match_id.return_value = []
    character_read.find_characters_by_match_id.return_value = [{
        "id": 1, "uuid": "c", "id_user": USER_ID, "id_character_template": 1,
        "id_location": HERE, "dexterity": 5, "intelligence": 4, "constitution": 3,
        "energy": 9, "life": 8, "sad": 0, "is_sleeping": 0, "is_coma": 0}]
    character_read.find_backpack.return_value = None
    character_read.find_traits.return_value = []
    character_read.find_inventory.return_value = []
    mover = {"id": 1, "uuid": "c", "id_user": USER_ID, "id_location": HERE, "energy": 100,
             "energy_max": 100, "carried_weight": 0, "weight_max": 50, "is_sleeping": 0,
             "is_coma": 1 if coma else 0}
    movement_store.find_visited_location_ids.return_value = [HERE, THERE]
    movement_store.find_character_by_match_and_user.return_value = mover
    movement_store.find_current_weather_move_cost.return_value = (0, 0)
    movement_store.find_characters_for_movement.return_value = [mover]
    event_store.load_check_context.return_value = EventCheckContext(
        id_character=1, id_location=HERE, energy=10, coin=10, registry={})
    service = rs.RegistryService(MagicMock(), story_read, None)
    service.load_all = MagicMock(return_value={})
    return MatchQueryService(persistence, story_read, user_access, character_read,
                             movement_store=movement_store, event_store=event_store,
                             registry_service_instance=service), service


def test_match_info_event_and_edge_locks():
    public = [{"name": "gate", "visibility": "PUBLIC"}]
    events = [dict(_event("gate", "=", "open"), uuid="e1", id_specific_location=HERE),
              dict(_event(None, None, None), id=2, uuid="e2", id_specific_location=HERE)]
    service, registry = _query(events, {"condition_registry_key": "gate",
                                        "condition_registry_value": "open",
                                        "registry_value_operator_condition": "!="},
                               keys=public)
    registry.load_all.return_value = {"gate": ["Open"]}
    loc = service.get_match_info("match-uuid", "u").locations_active[0]
    by_uuid = {e.uuid: e for e in loc.events}
    assert by_uuid["e1"].registry_lock == _lock("MISSING", "gate", "=", "open")
    assert by_uuid["e2"].registry_lock is None
    assert loc.neighbors[0].reason == "MOVEMENT_CONDITION_NOT_MET"
    assert loc.neighbors[0].registry_lock == _lock("FORBIDDEN", "gate", "!=", "Open")
    wire = _location_info_to_camel(loc)
    assert wire["events"][0]["registryLock"]["mode"] in ("MISSING",)
    assert wire["neighbors"][0]["registryLock"]["value"] == "Open"


def test_match_info_hidden_edge_and_other_reason():
    edge = {"condition_registry_key": "gate", "condition_registry_value": "open"}
    service, _ = _query([], edge)
    assert service.get_match_info("match-uuid", "u").locations_active[0] \
        .neighbors[0].registry_lock == _lock("MISSING", None, None, None, hidden=True)
    service, _ = _query([], edge, coma=True)
    n = service.get_match_info("match-uuid", "u").locations_active[0].neighbors[0]
    assert n.reason == "COMA" and n.registry_lock is None


# ── pending choices of execute-event ────────────────────────────────────────

def test_pending_choices_carry_the_filtered_lock():
    store = MagicMock()
    store.find_user_id_by_uuid.return_value = USER_ID
    store.find_match_for_event.return_value = {
        "id": 1, "uuid": "m", "status": "RUNNING", "current_clock": 7, "id_story": 4,
        "id_user_creator": USER_ID, "id_current_weather": None}
    actor = dict(id=3, uuid="c", id_user=USER_ID, id_class=50, id_location=100,
                 dexterity=10, intelligence=10, constitution=10, energy=20, life=30, sad=0,
                 exp=0, energy_max=100, life_max=100, sad_max=50, is_sleeping=False,
                 is_coma=False, characteristics=None)
    store.find_character_by_match_and_user.return_value = actor
    store.find_characters_for_event.return_value = [actor]
    store.find_backpack.return_value = {"food": 5, "magic": 5, "coin": 10}
    ev = dict(_event(None, None, None), uuid="event-1", cost_enery=1, flag_end_time=0)
    store.find_event_by_story_and_uuid.return_value = ev
    store.find_events_by_id.return_value = {1: ev}
    store.find_effects_by_event_id.return_value = {}
    store.find_id_event_end_game.return_value = None
    store.find_item_uuids_by_id.return_value = {}
    store.find_trait_uuids_by_id.return_value = {}
    store.find_trait_stats_by_id.return_value = {}
    store.load_check_context.return_value = EventCheckContext(
        id_character=3, id_location=100, energy=20, coin=10, id_class=50)
    choices = [{"id": i, "uuid": f"choice-{i}", "id_event": 1, "priority": i,
                "otherwise_flag": 0, "logic_operator": "AND"} for i in (11, 12)]
    store.find_choices_by_event_id.return_value = choices
    store.find_choice_conditions_by_choice_id.return_value = {
        11: [_cond("KEYS", "gate", "open", "=")]}
    store.find_trait_ids_by_character.return_value = set()
    store.resolve_short_text.return_value = None
    registry, _, _ = _service([{"name": "gate", "visibility": "PUBLIC"}])
    service = EventService(store, edge_store=MagicMock(), content_read_port=None,
                           time_service=MagicMock(), registry_service_instance=registry)
    out = service.execute_event("m", "u", "event-1", "en").pending_choices
    assert out[0]["reason"] == choice_availability.CONDITION_KEYS_NOT_MET
    assert out[0]["registryLock"] == _lock("MISSING", "gate", "=", "open")
    assert out[1]["registryLock"] is None
