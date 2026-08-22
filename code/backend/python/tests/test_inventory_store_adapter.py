"""Step 34 — the SQLAlchemy inventory store adapter, against in-memory SQLite."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.auth.models import Base, User
from app.adapters.persistence.match.inventory_store_adapter import InventoryStoreAdapter
from app.adapters.persistence.match.models import (
    GamingBackpackResourcesEntity,
    GamingCharacterInstanceEntity,
    GamingInventoryItemsEntity,
    GamingMatchEntity,
    LogItemUsageEntity,
)
from app.adapters.persistence.story.models import ItemEffectEntity, ItemEntity, StoryEntity
import app.adapters.persistence.match.models  # noqa: F401  registers gaming_* tables

_NOW = "2024-01-01T00:00:00"
MATCH_ID, CHAR_ID, STORY_ID, USER_ID = 1, 3, 9001, 7


@pytest.fixture()
def session_factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    yield factory
    engine.dispose()


@pytest.fixture()
def adapter(session_factory):
    return InventoryStoreAdapter(session_factory)


@pytest.fixture()
def seeded(session_factory):
    with session_factory() as s:
        s.add(StoryEntity(id=STORY_ID, uuid="story-uuid", author="A"))
        s.add(User(id=USER_ID, uuid="user-uuid", username="bob", state=6))
        s.add(GamingMatchEntity(
            id=MATCH_ID, uuid="match-uuid", id_story=STORY_ID, id_difficulty=1,
            id_user_creator=USER_ID, current_clock=4, status="RUNNING",
            ts_insert=_NOW, ts_update=_NOW))
        s.add(GamingCharacterInstanceEntity(
            id=CHAR_ID, id_match=MATCH_ID, uuid="char-uuid", id_user=USER_ID,
            id_character_template=1, id_class=5, id_location=100, life=10, energy=6,
            sad=1, exp=2, life_max=20, energy_max=12, sad_max=9, dexterity=2,
            intelligence=3, constitution=4, weight_max=42, is_sleeping=1, is_coma=0,
            ts_insert=_NOW, ts_update=_NOW))
        s.commit()
    return session_factory


def _add_item(session_factory, iid, **over):
    fields = dict(id=iid, id_story=STORY_ID, uuid=f"item-{iid}", weight=3, id_card=77,
                  id_text_name=400, is_consumabile=1, id_class_permitted=None,
                  id_class_prohibited=None)
    fields.update(over)
    with session_factory() as s:
        s.add(ItemEntity(**fields))
        s.commit()


def _add_row(session_factory, rid, id_item, amount=1):
    with session_factory() as s:
        s.add(GamingInventoryItemsEntity(
            id=rid, id_match=MATCH_ID, uuid=f"row-{rid}", id_character_match=CHAR_ID,
            id_item=id_item, amount=amount, state="ACTIVE", ts_insert=_NOW, ts_update=_NOW))
        s.commit()


def _add_effect(session_factory, eid, id_item, **over):
    fields = dict(id=eid, id_story=STORY_ID, uuid=f"effect-{eid}", id_card=None,
                  id_item=id_item, effect_code="LIFE", effect_value=3,
                  traits_to_add=None, traits_to_remove=None)
    fields.update(over)
    with session_factory() as s:
        s.add(ItemEffectEntity(**fields))
        s.commit()


# ── reads ───────────────────────────────────────────────────────────────────

def test_find_match_by_uuid(adapter, seeded):
    m = adapter.find_match_by_uuid("match-uuid")
    assert m == {"id": MATCH_ID, "uuid": "match-uuid", "status": "RUNNING",
                 "id_story": STORY_ID}
    assert adapter.find_match_by_uuid("nope") is None


def test_find_character_maps_the_gates_and_the_capacity(adapter, seeded):
    c = adapter.find_character_by_match_and_user(MATCH_ID, USER_ID)
    assert c["id"] == CHAR_ID
    assert c["id_class"] == 5
    assert c["is_sleeping"] is True
    assert c["is_coma"] is False
    assert c["weight_max"] == 42
    assert adapter.find_character_by_match_and_user(MATCH_ID, 999) is None


def test_find_inventory_orders_by_id_and_carries_the_row_id(adapter, seeded, session_factory):
    _add_item(session_factory, 900)
    _add_row(session_factory, 3, 900, 2)
    _add_row(session_factory, 1, 900, 1)

    rows = adapter.find_inventory(MATCH_ID, CHAR_ID)

    assert [r["id"] for r in rows] == [1, 3]
    assert rows[0]["uuid"] == "row-1"
    assert rows[1]["amount"] == 2


def test_find_items_by_id_carries_the_gates_and_the_card(adapter, seeded, session_factory):
    _add_item(session_factory, 900, is_consumabile=0, id_class_permitted=8)

    items = adapter.find_items_by_id(STORY_ID)

    assert items[900]["uuid"] == "item-900"
    assert items[900]["weight"] == 3
    assert items[900]["id_card"] == 77
    assert items[900]["is_consumabile"] == 0
    assert items[900]["id_class_permitted"] == 8


def test_item_effects_are_grouped_per_item_in_id_order(adapter, seeded, session_factory):
    _add_effect(session_factory, 2, 900)
    _add_effect(session_factory, 1, 900, effect_code="SADNESS", traits_to_add="7")
    _add_effect(session_factory, 3, 901)

    grouped = adapter.find_item_effects_by_item_id(STORY_ID)

    assert [e["id"] for e in grouped[900]] == [1, 2]
    assert grouped[900][0]["effect_code"] == "SADNESS"
    assert grouped[900][0]["traits_to_add"] == "7"
    assert len(grouped[901]) == 1


def test_an_effect_row_with_no_item_is_skipped(adapter, seeded, session_factory):
    _add_effect(session_factory, 1, None)
    assert adapter.find_item_effects_by_item_id(STORY_ID) == {}


def test_find_backpack(adapter, seeded, session_factory):
    with session_factory() as s:
        s.add(GamingBackpackResourcesEntity(
            id=1, id_match=MATCH_ID, uuid="bp", id_character_match=CHAR_ID,
            food=4, magic=2, coin=9, ts_insert=_NOW, ts_update=_NOW))
        s.commit()

    assert adapter.find_backpack(MATCH_ID, CHAR_ID) == {"food": 4, "magic": 2, "coin": 9}
    assert adapter.find_backpack(MATCH_ID, 999) is None


# ── writes ──────────────────────────────────────────────────────────────────

def test_delete_inventory_row_removes_only_that_row(adapter, seeded, session_factory):
    _add_item(session_factory, 900)
    _add_row(session_factory, 1, 900)
    _add_row(session_factory, 2, 900)

    adapter.delete_inventory_row(MATCH_ID, 1)

    assert [r["id"] for r in adapter.find_inventory(MATCH_ID, CHAR_ID)] == [2]


def test_log_ids_are_globally_unique_not_per_match(adapter, seeded, session_factory):
    """log_item_usage carries UNIQUE (id), unlike the per-match gaming_* tables."""
    adapter.log_item_usage(MATCH_ID, CHAR_ID, 900, 2, '{"a":1}')
    adapter.log_item_usage(MATCH_ID, CHAR_ID, 901, 1, "{}")

    with session_factory() as s:
        rows = s.query(LogItemUsageEntity).order_by(LogItemUsageEntity.id).all()
    assert [r.id for r in rows] == [1, 2]
    assert rows[0].id_item == 900
    # v0.35.1 — the units the usage actually spent, not the hardcoded 1 it used to be.
    assert rows[0].counter == 2
    assert rows[1].counter == 1
    assert rows[0].effects_json == '{"a":1}'
    assert rows[0].uuid != rows[1].uuid
    assert rows[0].timestamp is not None
