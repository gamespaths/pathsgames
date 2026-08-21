"""Steps 34 & 35 — InventoryService: listing, use, drop, resources and every refusal.

Mirrors InventoryServiceTest on the Java side.
"""
import json
from unittest.mock import MagicMock

import pytest

from app.core.models.match.event_models import (
    EdgeStateOutcome, EntityChange, EventExecutionResult, StatChange,
)
from app.core.ports.match.inventory_ports import InventoryError
from app.core.services.match.inventory_service import (
    InventoryService, normalize_effect_code, to_effects_json, total_weight,
)

MATCH_UUID = "match-uuid"
USER_UUID = "user-uuid"
MATCH_ID, USER_ID, CHAR_ID, STORY_ID = 1, 100, 50, 9001
WARRIOR, MAGE = 7, 8


def _row(rid, uuid, id_item, amount=1):
    return {"id": rid, "uuid": uuid, "id_item": id_item, "amount": amount, "state": "ACTIVE"}


def _item(iid=900, weight=3, consumable=1, **over):
    base = dict(id=iid, uuid=f"item-{iid}", weight=weight, id_card=None,
                id_text_name=400, is_consumabile=consumable,
                id_class_permitted=None, id_class_prohibited=None)
    base.update(over)
    return base


def _effect(eid=1, code="LIFE", value=3, add=None, remove=None, id_card=None):
    return {"id": eid, "uuid": f"effect-{eid}", "id_card": id_card, "effect_code": code,
            "effect_value": value, "traits_to_add": add, "traits_to_remove": remove}


def _result(stat_changes=None, trait_changes=None, edge=None, coma=False):
    return EventExecutionResult(
        match_uuid=MATCH_UUID, event_uuid=None, event_type=None, card=None,
        executed_event_uuids=[], energy_spent=0, coin_spent=0, new_energy=5, new_coin=0,
        current_clock=3, turn_consumed=False, time_ended=False, item_added=False,
        item_removed=False, weather_applied=False, movement_applied=False,
        forced_sleep=False, coma_triggered=coma, game_over=False, refresh_recommended=True,
        stat_changes=stat_changes or [], registry_changes=[],
        trait_changes=trait_changes or [], item_changes=[], characteristic_changes=[],
        location_changes=[], status="APPLIED", effects=[], pending_choices=[],
        edge_state=edge or EdgeStateOutcome.none(), automatic_events=[],
    )


@pytest.fixture
def store():
    s = MagicMock()
    s.find_match_by_uuid.return_value = {
        "id": MATCH_ID, "uuid": MATCH_UUID, "status": "RUNNING", "id_story": STORY_ID}
    s.find_character_by_match_and_user.return_value = {
        "id": CHAR_ID, "uuid": "char-uuid", "id_class": WARRIOR,
        "is_sleeping": False, "is_coma": False, "weight_max": 30}
    s.find_item_effects_by_item_id.return_value = {}
    s.find_backpack.return_value = None
    return s


@pytest.fixture
def user_access():
    u = MagicMock()
    u.find_by_uuid.return_value = {"id": USER_ID, "uuid": USER_UUID}
    return u


@pytest.fixture
def engine():
    e = MagicMock()
    e.apply_standalone_effects.return_value = _result()
    return e


@pytest.fixture
def story_read():
    s = MagicMock()
    s.find_text_by_story_id_text_and_lang.return_value = None
    s.find_card_by_story_id_and_card_id.return_value = None
    return s


@pytest.fixture
def service(store, user_access, story_read, engine):
    return InventoryService(store, user_access, story_read, engine)


def _given_potion(store):
    store.find_inventory.return_value = [_row(1, "row-1", 900)]
    store.find_items_by_id.return_value = {900: _item()}


# ── listing ─────────────────────────────────────────────────────────────────

def test_list_reports_items_weight_and_capacity(service, store):
    store.find_inventory.return_value = [_row(1, "row-1", 900, 2), _row(2, "row-2", 901)]
    store.find_items_by_id.return_value = {900: _item(900, 3), 901: _item(901, 5, 0)}

    view = service.list_inventory(MATCH_UUID, USER_UUID, "en")

    assert view["match_uuid"] == MATCH_UUID
    assert view["character_uuid"] == "char-uuid"
    assert len(view["items"]) == 2
    assert view["weight"] == 11
    assert view["weight_max"] == 30


def test_list_promises_the_effects_using_the_item_would_apply(service, store):
    """Step 35 — the promise is read off the very rows use-item applies."""
    _given_potion(store)
    store.find_item_effects_by_item_id.return_value = {900: [
        {"id": 1, "effect_code": "LIFE", "effect_value": 3},
        {"id": 2, "effect_code": "SADNESS", "effect_value": -1},
    ]}

    effects = service.list_inventory(MATCH_UUID, USER_UUID, "en")["items"][0].effects

    assert [(e.statistic, e.value) for e in effects] == [("life", 3), ("sad", -1)]


def test_list_hides_an_effect_code_the_engine_would_drop(service, store):
    _given_potion(store)
    store.find_item_effects_by_item_id.return_value = {900: [
        {"id": 1, "effect_code": "WISDOM", "effect_value": 5},
        {"id": 2, "effect_code": "energy", "effect_value": None},
    ]}

    effects = service.list_inventory(MATCH_UUID, USER_UUID, "en")["items"][0].effects

    # A null value reads as 0; an unknown code is not promised at all.
    assert [(e.statistic, e.value) for e in effects] == [("energy", 0)]


def test_a_secret_item_promises_nothing_step35(service, store):
    """flag_show_effects = 0: the promise is hidden, the effects are NOT."""
    secret = _item()
    secret["flag_show_effects"] = 0
    store.find_inventory.return_value = [_row(1, "row-1", 900)]
    store.find_items_by_id.return_value = {900: secret}
    store.find_item_effects_by_item_id.return_value = {900: [
        {"id": 1, "effect_code": "LIFE", "effect_value": 3}]}

    items = service.list_inventory(MATCH_UUID, USER_UUID, "en")["items"]

    # Empty, never absent: an empty promise must not read as "this item does nothing".
    assert items[0].effects == []


def test_an_unset_flag_still_promises(service, store):
    """A story authored before the column existed already shipped the promise."""
    _given_potion(store)
    store.find_item_effects_by_item_id.return_value = {900: [
        {"id": 1, "effect_code": "LIFE", "effect_value": 3}]}

    items = service.list_inventory(MATCH_UUID, USER_UUID, "en")["items"]

    assert [(e.statistic, e.value) for e in items[0].effects] == [("life", 3)]


def test_using_a_secret_item_still_applies_its_effects(service, store, engine):
    secret = _item()
    secret["flag_show_effects"] = 0
    store.find_inventory.return_value = [_row(1, "row-1", 900)]
    store.find_items_by_id.return_value = {900: secret}
    store.find_item_effects_by_item_id.return_value = {900: [
        {"id": 1, "uuid": "e1", "effect_code": "LIFE", "effect_value": 3}]}

    service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")

    effects = engine.apply_standalone_effects.call_args[0][2]
    assert [(e["statistics"], e["value"]) for e in effects] == [("life", 3)]


def test_the_effect_rows_are_read_once_per_request(service, store):
    _given_potion(store)

    service.drop_item(MATCH_UUID, USER_UUID, "row-1")

    assert store.find_item_effects_by_item_id.call_count == 1


def test_an_item_with_no_effect_promises_an_empty_list(service, store):
    _given_potion(store)

    assert service.list_inventory(MATCH_UUID, USER_UUID, "en")["items"][0].effects == []


def test_list_empty_inventory_is_a_list_never_none(service, store):
    store.find_inventory.return_value = []
    store.find_items_by_id.return_value = {}

    view = service.list_inventory(MATCH_UUID, USER_UUID, "en")

    assert view["items"] == []
    assert view["weight"] == 0


def test_reading_does_not_require_a_running_match(service, store):
    store.find_match_by_uuid.return_value = {
        "id": MATCH_ID, "uuid": MATCH_UUID, "status": "PAUSED", "id_story": STORY_ID}
    store.find_inventory.return_value = []
    store.find_items_by_id.return_value = {}

    assert service.list_inventory(MATCH_UUID, USER_UUID, "en")["items"] == []


def test_storyless_match_resolves_no_story_item(service, store):
    store.find_match_by_uuid.return_value = {
        "id": MATCH_ID, "uuid": MATCH_UUID, "status": "RUNNING", "id_story": None}
    store.find_inventory.return_value = [_row(1, "row-1", 900, 2)]

    assert service.list_inventory(MATCH_UUID, USER_UUID, "en")["weight"] == 0
    store.find_items_by_id.assert_not_called()


def test_list_resolves_the_item_card_and_name(service, store, story_read):
    store.find_inventory.return_value = [_row(1, "row-1", 900)]
    store.find_items_by_id.return_value = {900: _item(id_card=77)}
    story_read.find_card_by_story_id_and_card_id.return_value = {"uuid": "card-77"}
    story_read.find_text_by_story_id_text_and_lang.return_value = {"short_text": "Pozione"}

    item = service.list_inventory(MATCH_UUID, USER_UUID, "it")["items"][0]

    assert item.id_card == 77
    assert item.card == {"uuid": "card-77"}
    assert item.name == "Pozione"
    assert item.is_consumabile is True
    story_read.find_text_by_story_id_text_and_lang.assert_called_once_with(STORY_ID, 400, "it")


def test_items_sharing_a_card_cost_one_lookup(service, store, story_read):
    store.find_inventory.return_value = [_row(1, "a", 900), _row(2, "b", 901)]
    store.find_items_by_id.return_value = {900: _item(900, id_card=77),
                                           901: _item(901, id_card=77)}

    service.list_inventory(MATCH_UUID, USER_UUID, "en")

    assert story_read.find_card_by_story_id_and_card_id.call_count == 1


# ── resources ───────────────────────────────────────────────────────────────

def test_resources_report_backpack_and_weight(service, store):
    _given_potion(store)
    store.find_backpack.return_value = {"food": 4, "magic": 2, "coin": 9}

    view = service.get_resources(MATCH_UUID, USER_UUID)

    assert (view["food"], view["magic"], view["coin"]) == (4, 2, 9)
    assert view["weight"] == 3
    assert view["weight_max"] == 30


def test_resources_missing_backpack_row_reads_as_zeros(service, store):
    store.find_inventory.return_value = []
    store.find_items_by_id.return_value = {}

    view = service.get_resources(MATCH_UUID, USER_UUID)

    assert (view["food"], view["magic"], view["coin"]) == (0, 0, 0)


# ── use-item ────────────────────────────────────────────────────────────────

def test_use_removes_the_whole_row_before_the_effects_run(service, store, engine):
    store.find_inventory.return_value = [_row(1, "row-1", 900, 5)]
    store.find_items_by_id.return_value = {900: _item()}
    calls = []
    store.delete_inventory_row.side_effect = lambda *a: calls.append("delete")
    engine.apply_standalone_effects.side_effect = lambda *a, **kw: (calls.append("effects")
                                                                    or _result())

    service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")

    assert calls == ["delete", "effects"]
    store.delete_inventory_row.assert_called_once_with(MATCH_ID, 1)


def test_use_normalises_the_effect_codes_and_passes_the_trait_csvs(service, store, engine):
    _given_potion(store)
    store.find_item_effects_by_item_id.return_value = {900: [
        _effect(1, "SADNESS", -2),
        _effect(2, "LIFE", 3, add="90001,90002", remove="90004"),
    ]}

    service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")

    assert engine.apply_standalone_effects.call_args.kwargs["source_consumed"] is True
    effects = engine.apply_standalone_effects.call_args[0][2]
    assert effects[0]["statistics"] == "sad"
    assert effects[0]["value"] == -2
    assert effects[1]["statistics"] == "life"
    assert effects[1]["traits_to_add"] == "90001,90002"
    assert effects[1]["traits_to_remove"] == "90004"
    assert effects[1]["effect_uuid"] == "effect-2"


def test_use_an_item_with_no_effect_row_still_consumes_it(service, store, engine):
    _given_potion(store)

    service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")

    store.delete_inventory_row.assert_called_once_with(MATCH_ID, 1)
    assert engine.apply_standalone_effects.call_args[0][2] == []


def test_use_narrates_with_the_items_own_card(service, store, story_read, engine):
    store.find_inventory.return_value = [_row(1, "row-1", 900)]
    store.find_items_by_id.return_value = {900: _item(id_card=77)}
    story_read.find_card_by_story_id_and_card_id.return_value = {"uuid": "card-77"}

    service.use_item(MATCH_UUID, USER_UUID, "row-1", "it")

    assert engine.apply_standalone_effects.call_args[0][3] == {"uuid": "card-77"}


def test_a_sadness_item_trips_the_same_edge_state_an_event_would(service, store, engine):
    _given_potion(store)
    engine.apply_standalone_effects.return_value = _result(
        edge=EdgeStateOutcome(sadness_overflow_uuids=["char-uuid"], coma_uuids=["char-uuid"]),
        coma=True)

    result = service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")

    assert result.coma_triggered is True
    assert result.edge_state.sadness_overflow_uuids == ["char-uuid"]
    assert result.event_uuid is None


def test_every_usage_writes_one_log_row(service, store, engine):
    _given_potion(store)
    engine.apply_standalone_effects.return_value = _result(
        stat_changes=[StatChange("char-uuid", "life", 4, 7, 3)],
        trait_changes=[EntityChange("char-uuid", "trait-1", "ADD")])

    service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")

    args = store.log_item_usage.call_args[0]
    assert args[:3] == (MATCH_ID, CHAR_ID, 900)
    payload = json.loads(args[3])
    assert payload["statChanges"][0] == {
        "characterUuid": "char-uuid", "statistic": "life",
        "before": 4, "after": 7, "delta": 3}
    assert payload["traitChanges"][0]["traitUuid"] == "trait-1"
    assert payload["sadnessOverflow"] is False
    assert payload["comaTriggered"] is False


# ── drop-item ───────────────────────────────────────────────────────────────

def test_a_non_consumable_item_is_droppable(service, store):
    store.find_inventory.return_value = [_row(1, "row-1", 900, 3)]
    store.find_items_by_id.return_value = {900: _item(weight=2, consumable=0)}

    view = service.drop_item(MATCH_UUID, USER_UUID, "row-1")

    assert view["item_instance_uuid"] == "row-1"
    assert view["item_uuid"] == "item-900"
    assert view["amount_dropped"] == 3
    store.delete_inventory_row.assert_called_once_with(MATCH_ID, 1)


def test_a_class_restricted_item_is_droppable_too(service, store):
    store.find_inventory.return_value = [_row(1, "row-1", 900)]
    store.find_items_by_id.return_value = {900: _item(id_class_permitted=MAGE)}

    assert service.drop_item(MATCH_UUID, USER_UUID, "row-1")["amount_dropped"] == 1


def test_dropping_a_dangling_item_reports_no_item_uuid(service, store):
    store.find_inventory.return_value = [_row(1, "row-1", 999)]
    store.find_items_by_id.return_value = {}

    view = service.drop_item(MATCH_UUID, USER_UUID, "row-1")

    assert view["item_uuid"] is None
    store.delete_inventory_row.assert_called_once_with(MATCH_ID, 1)


def test_a_null_amount_counts_as_one(service, store):
    store.find_inventory.return_value = [_row(1, "row-1", 900, None)]
    store.find_items_by_id.return_value = {900: _item()}

    assert service.drop_item(MATCH_UUID, USER_UUID, "row-1")["amount_dropped"] == 1


def test_dropping_never_writes_a_usage_log(service, store, engine):
    _given_potion(store)

    service.drop_item(MATCH_UUID, USER_UUID, "row-1")

    store.log_item_usage.assert_not_called()
    engine.apply_standalone_effects.assert_not_called()


# ── validation ──────────────────────────────────────────────────────────────

def _code(fn):
    with pytest.raises(InventoryError) as exc:
        fn()
    return exc.value.code


def test_unknown_user(service, user_access):
    user_access.find_by_uuid.return_value = None
    assert _code(lambda: service.list_inventory(MATCH_UUID, "ghost", "en")) == "MATCH_NOT_FOUND"


def test_missing_user_uuid(service):
    assert _code(lambda: service.list_inventory(MATCH_UUID, None, "en")) == "MATCH_NOT_FOUND"


def test_unknown_match(service, store):
    store.find_match_by_uuid.return_value = None
    assert _code(lambda: service.list_inventory("nope", USER_UUID, "en")) == "MATCH_NOT_FOUND"


def test_caller_has_no_character(service, store):
    store.find_character_by_match_and_user.return_value = None
    assert _code(lambda: service.list_inventory(MATCH_UUID, USER_UUID, "en")) == "MATCH_NOT_FOUND"


def test_match_not_running_blocks_both_actions(service, store):
    store.find_match_by_uuid.return_value = {
        "id": MATCH_ID, "uuid": MATCH_UUID, "status": "PAUSED", "id_story": STORY_ID}
    _given_potion(store)
    assert _code(lambda: service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")) == "MATCH_NOT_RUNNING"
    assert _code(lambda: service.drop_item(MATCH_UUID, USER_UUID, "row-1")) == "MATCH_NOT_RUNNING"


def test_coma_is_checked_before_sleeping(service, store):
    store.find_character_by_match_and_user.return_value = {
        "id": CHAR_ID, "uuid": "char-uuid", "id_class": WARRIOR,
        "is_sleeping": True, "is_coma": True, "weight_max": 30}
    _given_potion(store)
    assert _code(lambda: service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")) == "COMA"


def test_sleeping(service, store):
    store.find_character_by_match_and_user.return_value = {
        "id": CHAR_ID, "uuid": "char-uuid", "id_class": WARRIOR,
        "is_sleeping": True, "is_coma": False, "weight_max": 30}
    _given_potion(store)
    assert _code(lambda: service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")) == "SLEEPING"


def test_another_characters_row_is_masked_as_unknown(service, store):
    _given_potion(store)

    assert _code(lambda: service.use_item(MATCH_UUID, USER_UUID, "theirs", "en")) == "ITEM_NOT_FOUND"
    store.find_inventory.assert_called_once_with(MATCH_ID, CHAR_ID)
    store.delete_inventory_row.assert_not_called()


def test_blank_item_uuid(service, store):
    _given_potion(store)
    assert _code(lambda: service.use_item(MATCH_UUID, USER_UUID, "  ", "en")) == "ITEM_NOT_FOUND"
    assert _code(lambda: service.use_item(MATCH_UUID, USER_UUID, None, "en")) == "ITEM_NOT_FOUND"


def test_dangling_item_reference(service, store):
    store.find_inventory.return_value = [_row(1, "row-1", 999)]
    store.find_items_by_id.return_value = {}
    assert _code(lambda: service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")) == "ITEM_NOT_FOUND"


def test_row_that_names_no_item(service, store):
    store.find_inventory.return_value = [_row(1, "row-1", None)]
    store.find_items_by_id.return_value = {}
    assert _code(lambda: service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")) == "ITEM_NOT_FOUND"


def test_only_a_consumable_can_be_used(service, store):
    store.find_inventory.return_value = [_row(1, "row-1", 900)]
    store.find_items_by_id.return_value = {900: _item(consumable=0)}

    assert _code(lambda: service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")) == "ITEM_NOT_CONSUMABLE"
    store.delete_inventory_row.assert_not_called()


def _given_restricted(store, permitted=None, prohibited=None):
    store.find_inventory.return_value = [_row(1, "row-1", 900)]
    store.find_items_by_id.return_value = {
        900: _item(id_class_permitted=permitted, id_class_prohibited=prohibited)}


def test_class_not_permitted(service, store):
    _given_restricted(store, permitted=MAGE)
    assert _code(lambda: service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")) == "ITEM_CLASS_NOT_PERMITTED"


def test_a_classless_character_cannot_satisfy_a_permitted_gate(service, store):
    store.find_character_by_match_and_user.return_value = {
        "id": CHAR_ID, "uuid": "char-uuid", "id_class": None,
        "is_sleeping": False, "is_coma": False, "weight_max": 30}
    _given_restricted(store, permitted=MAGE)
    assert _code(lambda: service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")) == "ITEM_CLASS_NOT_PERMITTED"


def test_class_prohibited(service, store):
    _given_restricted(store, prohibited=WARRIOR)
    assert _code(lambda: service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")) == "ITEM_CLASS_PROHIBITED"


def test_the_matching_permitted_class_passes(service, store):
    _given_restricted(store, permitted=WARRIOR)
    service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")
    store.delete_inventory_row.assert_called_once()


def test_zero_means_no_restriction(service, store):
    _given_restricted(store, permitted=0, prohibited=0)
    service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")
    store.delete_inventory_row.assert_called_once()


def test_a_classless_character_is_untouched_by_a_prohibited_gate(service, store):
    store.find_character_by_match_and_user.return_value = {
        "id": CHAR_ID, "uuid": "char-uuid", "id_class": None,
        "is_sleeping": False, "is_coma": False, "weight_max": 30}
    _given_restricted(store, prohibited=WARRIOR)
    service.use_item(MATCH_UUID, USER_UUID, "row-1", "en")
    store.delete_inventory_row.assert_called_once()


# ── helpers ─────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("code,expected", [
    ("LIFE", "life"), ("ENERGY", "energy"), ("EXP", "exp"), ("DEX", "dex"),
    ("SADNESS", "sad"), ("sadness", "sad"), ("sad", "sad"), ("COINS", "coin"),
    ("  Energy  ", "energy"), ("HEALTH", "health"),
])
def test_normalize_effect_code(code, expected):
    assert normalize_effect_code(code) == expected


def test_normalize_effect_code_null_and_blank():
    assert normalize_effect_code(None) is None
    assert normalize_effect_code("   ") is None


def test_total_weight_null_defaults():
    from app.core.models.match.match_models import ItemInstanceInfo
    items = [ItemInstanceInfo(uuid="a", weight=3, amount=2),
             ItemInstanceInfo(uuid="b", weight=5, amount=None),
             ItemInstanceInfo(uuid="c", weight=None, amount=4)]
    assert total_weight(items) == 11
    assert total_weight([]) == 0
    assert total_weight(None) == 0


def test_effects_json_matches_the_java_key_order():
    payload = to_effects_json(_result(
        stat_changes=[StatChange("c", "life", 0, 1, 1)],
        trait_changes=[EntityChange("c", "t1", "ADD")],
        edge=EdgeStateOutcome(sadness_overflow_uuids=["c"]), coma=True))

    assert payload == ('{"statChanges":[{"characterUuid":"c","statistic":"life",'
                       '"before":0,"after":1,"delta":1}],'
                       '"traitChanges":[{"characterUuid":"c","traitUuid":"t1","action":"ADD"}],'
                       '"sadnessOverflow":true,"comaTriggered":true}')


def test_an_item_without_a_name_text_resolves_no_name(service, store, story_read):
    store.find_inventory.return_value = [_row(1, "row-1", 900)]
    store.find_items_by_id.return_value = {900: _item(id_text_name=None)}

    assert service.list_inventory(MATCH_UUID, USER_UUID, "en")["items"][0].name is None
    story_read.find_text_by_story_id_text_and_lang.assert_not_called()
