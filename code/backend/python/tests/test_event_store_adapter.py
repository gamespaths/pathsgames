"""Step 29 — the SQLAlchemy event store adapter, end to end.

Complements :mod:`tests.test_event_store_adapter_movement` (which covers only the
forced-movement writes) by exercising the resolve/read/context/write surface of
:class:`EventStoreAdapter` against an in-memory SQLite database.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.auth.models import Base, User
from app.adapters.persistence.match.models import (
    GamingBackpackResourcesEntity,
    GamingCharacterInstanceEntity,
    GamingCharacterTraitsEntity,
    GamingInventoryItemsEntity,
    GamingMatchEntity,
    GamingStateRegistryEntity,
    LogEventsEntity,
)
from app.adapters.persistence.story.models import (
    EventEffectEntity,
    EventEntity,
    ItemEntity,
    StoryEntity,
    TraitEntity,
)
from app.adapters.persistence.match.event_store_adapter import EventStoreAdapter
from app.core.ports.match.event_ports import MSG_EVENT_EXECUTED
import app.adapters.persistence.match.models  # noqa: F401  registers gaming_* tables

_NOW = "2024-01-01T00:00:00"


@pytest.fixture()
def session_factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    yield factory
    engine.dispose()


@pytest.fixture()
def adapter(session_factory):
    return EventStoreAdapter(session_factory)


def _seed_match(session_factory, *, id_story=9001, weather=None):
    with session_factory() as s:
        s.add(StoryEntity(id=id_story, uuid="story-uuid", author="A",
                          id_event_end_game=77, id_event_all_player_coma=88))
        s.add(User(id=7, uuid="user-uuid", username="bob", state=6))
        s.add(GamingMatchEntity(
            id=1, uuid="match-uuid", id_story=id_story, id_difficulty=1,
            id_user_creator=7, current_clock=4, status="RUNNING",
            id_current_weather=weather, ts_insert=_NOW, ts_update=_NOW))
        s.commit()


def _seed_character(session_factory, **overrides):
    fields = dict(
        id=3, id_match=1, uuid="char-uuid", id_user=7, id_character_template=1,
        id_class=5, id_location=100, life=10, energy=6, sad=1, exp=2,
        life_max=20, energy_max=12, sad_max=9, dexterity=2, intelligence=3,
        constitution=4, is_sleeping=0, is_coma=0, characteristics="brave",
        ts_insert=_NOW, ts_update=_NOW)
    fields.update(overrides)
    with session_factory() as s:
        s.add(GamingCharacterInstanceEntity(**fields))
        s.commit()


def _seed_backpack(session_factory, *, food=3, magic=2, coin=11):
    with session_factory() as s:
        s.add(GamingBackpackResourcesEntity(
            id=1, id_match=1, uuid="bp-uuid", id_character_match=3,
            food=food, magic=magic, coin=coin, ts_insert=_NOW, ts_update=_NOW))
        s.commit()


# ── resolve ──────────────────────────────────────────────────────────────────

def test_find_user_id_by_uuid(session_factory, adapter):
    _seed_match(session_factory)

    assert adapter.find_user_id_by_uuid("user-uuid") == 7
    assert adapter.find_user_id_by_uuid("nope") is None


def test_find_match_for_event_returns_the_projection(session_factory, adapter):
    _seed_match(session_factory, weather=42)

    m = adapter.find_match_for_event("match-uuid")
    assert m == {"id": 1, "uuid": "match-uuid", "status": "RUNNING", "current_clock": 4,
                 "id_story": 9001, "id_user_creator": 7, "id_current_weather": 42}


def test_find_match_for_event_unknown_uuid(session_factory, adapter):
    _seed_match(session_factory)
    assert adapter.find_match_for_event("ghost") is None


def test_find_character_by_match_and_user(session_factory, adapter):
    _seed_match(session_factory)
    _seed_character(session_factory)

    c = adapter.find_character_by_match_and_user(1, 7)
    assert c["id"] == 3
    assert c["uuid"] == "char-uuid"
    assert c["id_class"] == 5
    assert c["energy"] == 6
    assert c["is_sleeping"] is False
    assert c["is_coma"] is False
    assert c["characteristics"] == "brave"

    assert adapter.find_character_by_match_and_user(1, 999) is None


def test_find_characters_for_event_lists_the_match(session_factory, adapter):
    _seed_match(session_factory)
    _seed_character(session_factory)
    _seed_character(session_factory, id=4, uuid="char-b", id_user=8)

    assert sorted(c["id"] for c in adapter.find_characters_for_event(1)) == [3, 4]
    assert adapter.find_characters_for_event(2) == []


def test_find_backpack_defaults_to_zero_when_absent(session_factory, adapter):
    assert adapter.find_backpack(1, 3) == {"food": 0, "magic": 0, "coin": 0}


def test_find_backpack_reads_the_row(session_factory, adapter):
    _seed_match(session_factory)
    _seed_backpack(session_factory)

    assert adapter.find_backpack(1, 3) == {"food": 3, "magic": 2, "coin": 11}


# ── story reads ──────────────────────────────────────────────────────────────

def _seed_event(session_factory, **overrides):
    fields = dict(id=50, id_story=9001, uuid="ev-uuid", type="NORMAL", id_card=1,
                  cost_enery=2, coin_cost=3, flag_end_time=1, id_event_next=51,
                  id_specific_location=100, id_weather=42,
                  registry_key_condition="k", registry_value_condition="v",
                  id_item_condition=60, id_class_condition=5)
    fields.update(overrides)
    with session_factory() as s:
        s.add(EventEntity(**fields))
        s.commit()


def test_find_event_by_story_and_uuid(session_factory, adapter):
    _seed_event(session_factory)

    e = adapter.find_event_by_story_and_uuid(9001, "ev-uuid")
    assert e["id"] == 50
    assert e["type"] == "NORMAL"
    assert e["cost_enery"] == 2
    assert e["coin_cost"] == 3
    assert e["flag_end_time"] == 1
    assert e["id_event_next"] == 51
    assert e["id_class_condition"] == 5

    assert adapter.find_event_by_story_and_uuid(9001, "ghost") is None
    assert adapter.find_event_by_story_and_uuid(9002, "ev-uuid") is None


def test_find_events_by_id_maps_only_the_story(session_factory, adapter):
    _seed_event(session_factory)
    _seed_event(session_factory, id=51, uuid="ev-b")
    _seed_event(session_factory, id=50, id_story=9002, uuid="ev-other")

    events = adapter.find_events_by_id(9001)
    assert sorted(events) == [50, 51]
    assert events[51]["uuid"] == "ev-b"


def test_find_effects_by_event_id_groups_in_authored_order(session_factory, adapter):
    with session_factory() as s:
        s.add(EventEffectEntity(id=2, id_story=9001, uuid="ef-2", id_event=50,
                                statistics="energy", value=-1, target="SELF"))
        s.add(EventEffectEntity(id=1, id_story=9001, uuid="ef-1", id_event=50,
                                statistics="life", value=5, target="ALL",
                                traits_to_add="1", key_to_add="k",
                                key_value_to_add="v", id_location=100))
        s.add(EventEffectEntity(id=3, id_story=9001, uuid="ef-3", id_event=51,
                                statistics="sad", value=1))
        # Orphan effect (no id_event) is skipped.
        s.add(EventEffectEntity(id=4, id_story=9001, uuid="ef-4", statistics="sad"))
        s.commit()

    out = adapter.find_effects_by_event_id(9001)
    assert sorted(out) == [50, 51]
    assert [e["uuid"] for e in out[50]] == ["ef-1", "ef-2"]
    assert out[50][0]["key_to_add"] == "k"
    assert out[50][0]["id_location"] == 100
    assert len(out[51]) == 1


def test_find_id_event_end_game_and_all_player_coma(session_factory, adapter):
    _seed_match(session_factory)

    assert adapter.find_id_event_end_game(9001) == 77
    assert adapter.find_id_event_all_player_coma(9001) == 88
    assert adapter.find_id_event_end_game(9999) is None
    assert adapter.find_id_event_all_player_coma(9999) is None


def test_find_item_and_trait_uuid_maps(session_factory, adapter):
    with session_factory() as s:
        s.add(ItemEntity(id=60, id_story=9001, uuid="item-a"))
        s.add(ItemEntity(id=61, id_story=9002, uuid="item-other"))
        s.add(TraitEntity(id=70, id_story=9001, uuid="trait-a"))
        s.commit()

    assert adapter.find_item_uuids_by_id(9001) == {60: "item-a"}
    assert adapter.find_trait_uuids_by_id(9001) == {70: "trait-a"}


# ── check context ────────────────────────────────────────────────────────────

def test_load_check_context_without_a_character(adapter):
    ctx = adapter.load_check_context(1, None)
    assert ctx.id_character is None


def test_load_check_context_unknown_character(session_factory, adapter):
    _seed_match(session_factory)
    ctx = adapter.load_check_context(1, 999)
    assert ctx.id_character is None


def test_load_check_context_loads_everything(session_factory, adapter):
    _seed_match(session_factory, weather=42)
    _seed_character(session_factory, is_sleeping=1, is_coma=1)
    _seed_backpack(session_factory)
    with session_factory() as s:
        s.add(GamingInventoryItemsEntity(id=1, id_match=1, uuid="inv-a",
                                         id_character_match=3, id_item=60, amount=2,
                                         ts_insert=_NOW, ts_update=_NOW))
        # amount 0 does not count as owned
        s.add(GamingInventoryItemsEntity(id=2, id_match=1, uuid="inv-b",
                                         id_character_match=3, id_item=61, amount=0,
                                         ts_insert=_NOW, ts_update=_NOW))
        s.add(GamingStateRegistryEntity(id=1, id_match=1, uuid="reg-a", key="door",
                                        string_value="open", ts_insert=_NOW, ts_update=_NOW))
        s.add(GamingStateRegistryEntity(id=2, id_match=1, uuid="reg-b", key="count",
                                        int_value=5, ts_insert=_NOW, ts_update=_NOW))
        s.add(GamingStateRegistryEntity(id=3, id_match=1, uuid="reg-c", key="empty",
                                        ts_insert=_NOW, ts_update=_NOW))
        s.add(LogEventsEntity(id=1, id_match=1, uuid="log-a", id_event=50,
                              log_message=MSG_EVENT_EXECUTED + " done",
                              ts_insert=_NOW, ts_update=_NOW))
        # merely referenced — must NOT count as consumed
        s.add(LogEventsEntity(id=2, id_match=1, uuid="log-b", id_event=51,
                              log_message="WEATHER referenced",
                              ts_insert=_NOW, ts_update=_NOW))
        s.commit()

    ctx = adapter.load_check_context(1, 3)
    assert ctx.id_character == 3
    assert ctx.id_location == 100
    assert ctx.sleeping is True
    assert ctx.coma is True
    assert ctx.energy == 6
    assert ctx.coin == 11
    assert ctx.id_class == 5
    assert ctx.owned_item_ids == {60}
    assert ctx.current_weather_id == 42
    assert ctx.consumed_event_ids == {50}
    assert ctx.registry == {"door": "open", "count": "5", "empty": None}


def test_load_check_context_without_a_backpack_reports_zero_coin(session_factory, adapter):
    _seed_match(session_factory)
    _seed_character(session_factory)

    assert adapter.load_check_context(1, 3).coin == 0


# ── writes ───────────────────────────────────────────────────────────────────

def test_update_character_stats(session_factory, adapter):
    _seed_match(session_factory)
    _seed_character(session_factory)

    adapter.update_character_stats(1, 3, {"life": 4, "energy": 1, "exp": 9})

    with session_factory() as s:
        c = s.query(GamingCharacterInstanceEntity).filter_by(id=3, id_match=1).one()
        assert (c.life, c.energy, c.exp) == (4, 1, 9)


def test_update_character_stats_missing_character_is_a_no_op(session_factory, adapter):
    adapter.update_character_stats(1, 3, {"life": 4})  # must not raise


def test_update_backpack_keeps_unmentioned_resources(session_factory, adapter):
    _seed_match(session_factory)
    _seed_backpack(session_factory)

    adapter.update_backpack(1, 3, {"coin": 1})

    with session_factory() as s:
        b = s.query(GamingBackpackResourcesEntity).filter_by(id_match=1).one()
        assert (b.food, b.magic, b.coin) == (3, 2, 1)


def test_update_backpack_missing_row_is_a_no_op(session_factory, adapter):
    adapter.update_backpack(1, 3, {"coin": 1})  # must not raise


def test_set_character_characteristics(session_factory, adapter):
    _seed_match(session_factory)
    _seed_character(session_factory)

    adapter.set_character_characteristics(1, 3, "brave,wise")
    with session_factory() as s:
        assert s.query(GamingCharacterInstanceEntity).filter_by(id=3).one() \
            .characteristics == "brave,wise"

    adapter.set_character_characteristics(1, 3, None)
    with session_factory() as s:
        assert s.query(GamingCharacterInstanceEntity).filter_by(id=3).one() \
            .characteristics is None

    adapter.set_character_characteristics(1, 999, "x")  # no-op, must not raise


def test_add_item_inserts_then_increments(session_factory, adapter):
    _seed_match(session_factory)
    _seed_character(session_factory)

    adapter.add_item(1, 3, 60)
    adapter.add_item(1, 3, 60)
    adapter.add_item(1, 3, 61)

    with session_factory() as s:
        rows = {r.id_item: r for r in s.query(GamingInventoryItemsEntity).all()}
        assert rows[60].amount == 2
        assert rows[61].amount == 1
        assert sorted(r.id for r in rows.values()) == [1, 2]


def test_remove_item_takes_every_unit(session_factory, adapter):
    """v0.35.1 — a story that takes an item away takes all of it, not one unit."""
    _seed_match(session_factory)
    adapter.add_item(1, 3, 60)
    adapter.add_item(1, 3, 60)

    assert adapter.remove_item(1, 3, 60) is True
    with session_factory() as s:
        assert s.query(GamingInventoryItemsEntity).count() == 0

    assert adapter.remove_item(1, 3, 60) is False


def test_add_item_refuses_at_the_cap(session_factory, adapter):
    """max_per_character: the unit does not go in, and it is not an error."""
    _seed_match(session_factory)
    assert adapter.add_item(1, 3, 60, 2) is True
    assert adapter.add_item(1, 3, 60, 2) is True
    assert adapter.add_item(1, 3, 60, 2) is False

    with session_factory() as s:
        assert s.query(GamingInventoryItemsEntity).one().amount == 2


def test_add_item_cap_of_zero_is_no_cap(session_factory, adapter):
    _seed_match(session_factory)
    for _ in range(3):
        assert adapter.add_item(1, 3, 60, 0) is True

    with session_factory() as s:
        assert s.query(GamingInventoryItemsEntity).one().amount == 3


def test_add_item_folds_duplicate_rows_a_pre_v0351_database_may_carry(session_factory, adapter):
    """The schema forbids them now; an older database may still hold a pair, and the two
    amounts have to become one before the cap can mean anything."""
    _seed_match(session_factory)
    with session_factory() as s:
        s.add(GamingInventoryItemsEntity(id=1, id_match=1, uuid="inv-a", id_character_match=3,
                                         id_item=60, amount=2, ts_insert=_NOW, ts_update=_NOW))
        s.add(GamingInventoryItemsEntity(id=2, id_match=1, uuid="inv-b", id_character_match=3,
                                         id_item=60, amount=3, ts_insert=_NOW, ts_update=_NOW))
        s.commit()

    assert adapter.add_item(1, 3, 60) is True

    with session_factory() as s:
        row = s.query(GamingInventoryItemsEntity).one()
        assert row.id == 1
        assert row.amount == 6


def test_remove_item_of_an_item_never_carried_returns_false(session_factory, adapter):
    with session_factory() as s:
        s.add(GamingInventoryItemsEntity(id=1, id_match=1, uuid="inv-a",
                                         id_character_match=3, id_item=61, amount=1,
                                         ts_insert=_NOW, ts_update=_NOW))
        s.commit()

    assert adapter.remove_item(1, 3, 60) is False


def test_add_trait_is_idempotent(session_factory, adapter):
    assert adapter.add_trait(1, 3, 70, 50) is True
    assert adapter.add_trait(1, 3, 70, 50) is False
    assert adapter.add_trait(1, 3, 71, None) is True

    with session_factory() as s:
        rows = s.query(GamingCharacterTraitsEntity).order_by(
            GamingCharacterTraitsEntity.id).all()
        assert [r.id for r in rows] == [1, 2]
        assert rows[0].id_event == 50
        assert rows[1].id_event is None


def test_remove_trait(session_factory, adapter):
    adapter.add_trait(1, 3, 70, None)

    assert adapter.remove_trait(1, 3, 70) is True
    assert adapter.remove_trait(1, 3, 70) is False
    with session_factory() as s:
        assert s.query(GamingCharacterTraitsEntity).count() == 0


@pytest.mark.parametrize("key", ["", "   ", None])
def test_upsert_registry_ignores_a_blank_key(session_factory, adapter, key):
    adapter.upsert_registry(1, key, "v", 3, 50, 4)

    with session_factory() as s:
        assert s.query(GamingStateRegistryEntity).count() == 0


def test_upsert_registry_inserts_then_updates(session_factory, adapter):
    adapter.upsert_registry(1, "door", "open", 3, 50, 4)

    with session_factory() as s:
        r = s.query(GamingStateRegistryEntity).one()
        assert (r.string_value, r.int_value) == ("open", None)
        assert (r.id_character, r.id_event, r.clock) == (3, 50, 4)

    # numeric value lands in int_value and clears the string
    adapter.upsert_registry(1, "door", "12", None, None, 5)
    with session_factory() as s:
        r = s.query(GamingStateRegistryEntity).one()
        assert (r.string_value, r.int_value) == (None, 12)
        assert r.clock == 5

    # None clears both
    adapter.upsert_registry(1, "door", None, None, None, 6)
    with session_factory() as s:
        r = s.query(GamingStateRegistryEntity).one()
        assert (r.string_value, r.int_value) == (None, None)


def test_set_current_weather(session_factory, adapter):
    _seed_match(session_factory)

    adapter.set_current_weather(1, 42)
    with session_factory() as s:
        assert s.query(GamingMatchEntity).filter_by(id=1).one().id_current_weather == 42

    adapter.set_current_weather(99, 42)  # unknown match, must not raise


def test_log_event_executed_appends_with_the_next_id(session_factory, adapter):
    adapter.log_event_executed(1, 3, 50, 4, MSG_EVENT_EXECUTED + " first")
    adapter.log_event_executed(1, None, 51, 5, MSG_EVENT_EXECUTED + " second")

    with session_factory() as s:
        rows = s.query(LogEventsEntity).order_by(LogEventsEntity.id).all()
        assert [r.id for r in rows] == [1, 2]
        assert rows[0].id_character_match == 3
        assert rows[0].clock == 4
        assert rows[1].id_character_match is None
        assert rows[1].log_message.endswith("second")


# ── choices (Step 31) ───────────────────────────────────────────────────────

def _seed_choice(session_factory, *, cid, id_event, priority=1, logic="AND", **overrides):
    with session_factory() as s:
        from app.adapters.persistence.story.models import ChoiceEntity
        s.add(ChoiceEntity(id=cid, id_story=9001, uuid=f"choice-{cid}", id_event=id_event,
                           priority=priority, logic_operator=logic, **overrides))
        s.commit()


def test_find_choices_by_event_id_filters_on_the_event(session_factory, adapter):
    _seed_choice(session_factory, cid=1, id_event=12, limit_dex=3)
    _seed_choice(session_factory, cid=2, id_event=13)
    _seed_choice(session_factory, cid=3, id_event=12)
    _seed_choice(session_factory, cid=4, id_event=None)

    out = adapter.find_choices_by_event_id(9001, 12)

    assert [c["id"] for c in out] == [1, 3]
    # The canonical dict carries the Step 31 fields under their canonical names.
    assert out[0]["otherwise_flag"] == 0 or out[0]["otherwise_flag"] is None
    assert out[0]["logic_operator"] == "AND"
    assert out[0]["limit_dex"] == 3


def test_find_choice_conditions_by_choice_id_groups_and_orders(session_factory, adapter):
    from app.adapters.persistence.story.models import ChoiceConditionEntity
    with session_factory() as s:
        s.add(ChoiceConditionEntity(id=3, id_story=9001, id_choice=7,
                                    condition_type="KEYS", condition_key="gate",
                                    condition_value="OPEN", condition_operator="="))
        s.add(ChoiceConditionEntity(id=1, id_story=9001, id_choice=7,
                                    condition_type="statistics", condition_key="int",
                                    condition_value="3", condition_operator=">"))
        s.add(ChoiceConditionEntity(id=2, id_story=9001, id_choice=8,
                                    condition_type="traits", condition_key=None,
                                    condition_value="9", condition_operator="="))
        s.add(ChoiceConditionEntity(id=4, id_story=9001, id_choice=None,
                                    condition_type="KEYS"))
        s.commit()

    out = adapter.find_choice_conditions_by_choice_id(9001)

    # Ordered by row id, grouped by choice, column names mapped to the canonical keys.
    assert [c["type"] for c in out[7]] == ["statistics", "KEYS"]
    assert out[7][0] == {"type": "statistics", "key": "int", "value": "3", "operator": ">"}
    assert [c["value"] for c in out[8]] == ["9"]
    assert None not in out


def test_count_log_markers_counts_only_the_prefix_of_the_event(session_factory, adapter):
    from app.core.ports.match.event_ports import MSG_CHOICE_SELECTED
    adapter.log_event_executed(1, 3, 12, 4, MSG_EVENT_EXECUTED + " 12")
    adapter.log_event_executed(1, 3, 12, 5, MSG_EVENT_EXECUTED + " 12")   # a second cycle
    adapter.log_event_executed(1, 3, 12, 5, MSG_CHOICE_SELECTED + " 12")  # other prefix
    adapter.log_event_executed(1, 3, 13, 5, MSG_EVENT_EXECUTED + " 13")   # other event
    adapter.log_event_executed(1, 3, 12, 5, "WEATHER something")          # unrelated row

    assert adapter.count_log_markers(1, 12, MSG_EVENT_EXECUTED) == 2
    assert adapter.count_log_markers(1, 12, MSG_CHOICE_SELECTED) == 1
    assert adapter.count_log_markers(1, 14, MSG_EVENT_EXECUTED) == 0


def test_find_trait_ids_by_character(session_factory, adapter):
    with session_factory() as s:
        s.add(GamingCharacterTraitsEntity(id=1, id_match=1, uuid="t-1",
                                          id_character_match=3, id_traits=9,
                                          ts_insert=_NOW, ts_update=_NOW))
        s.add(GamingCharacterTraitsEntity(id=3, id_match=1, uuid="t-3",
                                          id_character_match=4, id_traits=7,
                                          ts_insert=_NOW, ts_update=_NOW))
        s.commit()

    assert adapter.find_trait_ids_by_character(1, 3) == {9}


def test_resolve_short_text_prefers_the_lang_and_falls_back_to_english(session_factory, adapter):
    from app.adapters.persistence.story.models import TextEntity
    with session_factory() as s:
        s.add(TextEntity(id=1, id_story=9001, id_text=610, lang="it", short_text="La Prova"))
        s.add(TextEntity(id=2, id_story=9001, id_text=611, lang="en", short_text="The Trial"))
        s.commit()

    assert adapter.resolve_short_text(9001, 610, "it") == "La Prova"
    assert adapter.resolve_short_text(9001, 611, "it") == "The Trial"  # en fallback
    assert adapter.resolve_short_text(9001, 612, "it") is None
    assert adapter.resolve_short_text(9001, None, "it") is None
    assert adapter.resolve_short_text(9001, 611, None) == "The Trial"  # blank lang = en


# ── choice resolution (Step 32) ─────────────────────────────────────────────

def _seed_choice_effect(session_factory, *, eid, id_choice, **overrides):
    with session_factory() as s:
        from app.adapters.persistence.story.models import ChoiceEffectEntity
        s.add(ChoiceEffectEntity(id=eid, id_story=9001, uuid=f"ce-{eid}",
                                 id_choice=id_choice, **overrides))
        s.commit()


def test_find_choice_by_story_and_uuid_finds_the_option(session_factory, adapter):
    _seed_choice(session_factory, cid=1, id_event=12, id_text_narrative=42,
                 id_event_torun=13)
    _seed_choice(session_factory, cid=2, id_event=12)

    found = adapter.find_choice_by_story_and_uuid(9001, "choice-1")

    assert found["id"] == 1 and found["id_event"] == 12
    # The two fields Step 32 reads and Step 31 deliberately never served.
    assert found["id_text_narrative"] == 42
    assert found["id_event_torun"] == 13
    assert adapter.find_choice_by_story_and_uuid(9001, "nope") is None


def test_find_choice_by_story_and_uuid_blank_uuid_is_none(session_factory, adapter):
    assert adapter.find_choice_by_story_and_uuid(9001, None) is None
    assert adapter.find_choice_by_story_and_uuid(9001, "  ") is None


def test_find_choice_effects_keeps_only_the_options_rows_in_authored_order(
        session_factory, adapter):
    _seed_choice_effect(session_factory, eid=9, id_choice=20, statistics="life", value=-2)
    _seed_choice_effect(session_factory, eid=2, id_choice=20, statistics="exp", value=1)
    _seed_choice_effect(session_factory, eid=5, id_choice=21, statistics="exp", value=3)

    rows = adapter.find_choice_effects_by_choice_id(9001, 20)

    # Authored order, so a later row builds on the earlier one.
    assert [r["id"] for r in rows] == [2, 9]
    assert [r["statistics"] for r in rows] == ["exp", "life"]


def test_find_choice_effects_maps_the_whole_v0320_vocabulary(session_factory, adapter):
    _seed_choice_effect(session_factory, eid=1, id_choice=20, id_card=4, flag_group=1,
                        statistics="energy", value=2, key="GATE", value_to_add="OPEN",
                        value_to_remove="SHUT", id_event=7, id_location=8, id_weather=9,
                        id_item_target=10, item_action="ADD")

    row = adapter.find_choice_effects_by_choice_id(9001, 20)[0]

    # The same key names the event effects use — that is what lets _apply_stat /
    # _apply_item / _apply_movement read either table.
    assert row["uuid"] == "ce-1" and row["id_card"] == 4 and row["flag_group"] == 1
    assert row["statistics"] == "energy" and row["value"] == 2
    assert row["key"] == "GATE" and row["value_to_add"] == "OPEN"
    assert row["value_to_remove"] == "SHUT"
    assert row["id_event"] == 7 and row["id_location"] == 8 and row["id_weather"] == 9
    assert row["id_item_target"] == 10 and row["item_action"] == "ADD"


def test_log_choice_executed_writes_the_history_row(session_factory, adapter):
    from app.adapters.persistence.match.models import LogChoicesExecutedEntity
    from app.core.ports.match.event_ports import MSG_CHOICE_SELECTED

    adapter.log_choice_executed(1, 12, 20, 5, f"{MSG_CHOICE_SELECTED} 20")
    adapter.log_choice_executed(1, 12, 21, 6, f"{MSG_CHOICE_SELECTED} 21")

    with session_factory() as s:
        rows = s.query(LogChoicesExecutedEntity).order_by(
            LogChoicesExecutedEntity.id).all()
    assert [r.id for r in rows] == [1, 2]
    assert rows[0].id_match == 1
    assert rows[0].id_event == 12  # the OWNING event, not the option
    assert rows[0].id_choise == 20
    assert rows[0].clock == 5
    assert rows[0].log_message == f"{MSG_CHOICE_SELECTED} 20"
    assert rows[0].uuid and rows[1].uuid != rows[0].uuid


def test_insert_story_progress_numbers_the_milestone_within_its_match(
        session_factory, adapter):
    from app.adapters.persistence.match.models import GamingStoryProgressEntity

    adapter.insert_story_progress(1, 12, 20, 5)
    adapter.insert_story_progress(1, 13, 21, 6)
    adapter.insert_story_progress(2, 14, 22, 7)

    with session_factory() as s:
        match_one = s.query(GamingStoryProgressEntity).filter_by(id_match=1).order_by(
            GamingStoryProgressEntity.id).all()
        match_two = s.query(GamingStoryProgressEntity).filter_by(id_match=2).all()
    # The key is (id, id_match), so ids restart per match rather than running globally.
    assert [r.id for r in match_one] == [1, 2]
    assert [r.id for r in match_two] == [1]
    assert match_one[0].id_event == 12 and match_one[0].id_choise == 20
    assert match_one[0].clock == 5
