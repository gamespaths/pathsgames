"""Step 28 — the SQLAlchemy movement store adapter.

Exercises :class:`MovementStoreAdapter` against an in-memory SQLite database: the
match/character/location reads, the undirected neighbour scan, the weather move
costs, the location+energy write, the ``log_movements`` append and the visited-
location scan the map view is built from.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.auth.models import Base, User
from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity,
    GamingMatchEntity,
    GamingStateRegistryEntity,
    LogMovementEntity,
)
from app.adapters.persistence.story.models import (
    LocationEntity, LocationNeighborEntity, StoryEntity, WeatherRuleEntity,
)
from app.adapters.persistence.match.movement_store_adapter import MovementStoreAdapter
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
    return MovementStoreAdapter(session_factory)


def _seed_match(session_factory, *, weather=None):
    with session_factory() as s:
        s.add(StoryEntity(id=9001, uuid="story-uuid", author="A"))
        s.add(User(id=7, uuid="user-uuid", username="bob", state=6))
        s.add(GamingMatchEntity(
            id=1, uuid="match-uuid", id_story=9001, id_difficulty=1,
            id_user_creator=7, current_clock=3, status="RUNNING",
            id_current_weather=weather, ts_insert=_NOW, ts_update=_NOW))
        s.commit()


def _seed_character(session_factory, **overrides):
    fields = dict(id=3, id_match=1, uuid="char-uuid", id_user=7, id_character_template=1,
                  id_location=100, energy=6, energy_max=12, weight_max=20, life=10,
                  is_sleeping=0, is_coma=0, ts_insert=_NOW, ts_update=_NOW)
    fields.update(overrides)
    with session_factory() as s:
        s.add(GamingCharacterInstanceEntity(**fields))
        s.commit()


# ── reads ────────────────────────────────────────────────────────────────────

def test_find_match_for_movement(session_factory, adapter):
    _seed_match(session_factory)

    assert adapter.find_match_for_movement("match-uuid") == {
        "id": 1, "uuid": "match-uuid", "status": "RUNNING", "current_clock": 3,
        "id_story": 9001, "id_user_creator": 7}
    assert adapter.find_match_for_movement("ghost") is None


def test_find_character_by_match_and_user(session_factory, adapter):
    _seed_match(session_factory)
    _seed_character(session_factory, is_sleeping=1)

    c = adapter.find_character_by_match_and_user(1, 7)
    assert c["id"] == 3
    assert c["id_location"] == 100
    assert c["energy"] == 6
    assert c["energy_max"] == 12
    assert c["carried_weight"] == 0
    assert c["weight_max"] == 20
    assert c["is_sleeping"] is True
    assert c["is_coma"] is False

    assert adapter.find_character_by_match_and_user(1, 999) is None


def test_find_characters_for_movement(session_factory, adapter):
    _seed_match(session_factory)
    _seed_character(session_factory)
    _seed_character(session_factory, id=4, uuid="char-b", id_user=8, id_location=200)

    rows = sorted(adapter.find_characters_for_movement(1), key=lambda r: r["id"])
    assert rows == [{"id": 3, "id_location": 100}, {"id": 4, "id_location": 200}]
    assert adapter.find_characters_for_movement(2) == []


def _seed_locations(session_factory):
    with session_factory() as s:
        s.add(LocationEntity(id=100, id_story=9001, uuid="loc-a", id_card=1,
                             is_safe=1, max_characters=2))
        s.add(LocationEntity(id=200, id_story=9001, uuid="loc-b", id_card=2,
                             is_safe=0, max_characters=None))
        s.commit()


def test_find_location_by_uuid_and_by_id(session_factory, adapter):
    _seed_locations(session_factory)

    a = adapter.find_location_by_uuid(9001, "loc-a")
    assert a == {"id": 100, "uuid": "loc-a", "id_card": 1, "secure_param": 1,
                 "cost_energy_enter": 0, "max_characters": 2}
    assert adapter.find_location_by_id(9001, 200)["secure_param"] == 0
    assert adapter.find_location_by_uuid(9001, "ghost") is None
    assert adapter.find_location_by_id(9001, 999) is None


def test_find_neighbors_of_location_is_undirected(session_factory, adapter):
    with session_factory() as s:
        s.add(LocationNeighborEntity(id=1, id_story=9001, uuid="n-1",
                                     id_location_from=100, id_location_to=200,
                                     direction="N", energy_cost=2, flag_back=1,
                                     condition_key="k", condition_value="v"))
        s.add(LocationNeighborEntity(id=2, id_story=9001, uuid="n-2",
                                     id_location_from=300, id_location_to=100,
                                     direction="S", energy_cost=0, flag_back=None))
        s.add(LocationNeighborEntity(id=3, id_story=9001, uuid="n-3",
                                     id_location_from=300, id_location_to=400))
        s.add(LocationNeighborEntity(id=4, id_story=9002, uuid="n-4",
                                     id_location_from=100, id_location_to=200))
        s.commit()

    out = adapter.find_neighbors_of_location(9001, 100)
    assert len(out) == 2
    assert out[0] == {"id_from": 100, "id_to": 200, "direction": "N", "energy_cost": 2,
                      "condition_key": "k", "condition_value": "v", "flag_back": 1}
    assert out[1]["id_from"] == 300
    assert out[1]["energy_cost"] == 0
    assert out[1]["flag_back"] == 0


def test_find_registry_value(session_factory, adapter):
    with session_factory() as s:
        s.add(GamingStateRegistryEntity(id=1, id_match=1, uuid="r-a", key="door",
                                        string_value="open", ts_insert=_NOW, ts_update=_NOW))
        s.add(GamingStateRegistryEntity(id=2, id_match=1, uuid="r-b", key="count",
                                        int_value=3, ts_insert=_NOW, ts_update=_NOW))
        s.add(GamingStateRegistryEntity(id=3, id_match=1, uuid="r-c", key="empty",
                                        ts_insert=_NOW, ts_update=_NOW))
        s.commit()

    assert adapter.find_registry_value(1, "door") == "open"
    assert adapter.find_registry_value(1, "count") == "3"
    assert adapter.find_registry_value(1, "empty") is None
    assert adapter.find_registry_value(1, "ghost") is None
    assert adapter.find_registry_value(2, "door") is None


def test_find_current_weather_move_cost(session_factory, adapter):
    _seed_match(session_factory, weather=10)
    with session_factory() as s:
        s.add(WeatherRuleEntity(id=10, id_story=9001, uuid="w-sun",
                                cost_move_safe_location=1, cost_move_not_safe_location=4))
        s.commit()

    assert adapter.find_current_weather_move_cost(1) == (1, 4)
    assert adapter.find_current_weather_move_cost(99) == (0, 0)


def test_find_current_weather_move_cost_without_weather(session_factory, adapter):
    _seed_match(session_factory, weather=None)
    assert adapter.find_current_weather_move_cost(1) == (0, 0)


def test_find_current_weather_move_cost_with_a_dangling_weather_id(session_factory, adapter):
    _seed_match(session_factory, weather=999)
    assert adapter.find_current_weather_move_cost(1) == (0, 0)


def test_count_characters_at_location(session_factory, adapter):
    _seed_match(session_factory)
    _seed_character(session_factory)
    _seed_character(session_factory, id=4, uuid="char-b", id_user=8, id_location=100)
    _seed_character(session_factory, id=5, uuid="char-c", id_user=9, id_location=200)

    assert adapter.count_characters_at_location(1, 100) == 2
    assert adapter.count_characters_at_location(1, 300) == 0


# ── writes ───────────────────────────────────────────────────────────────────

def test_update_character_location_and_energy(session_factory, adapter):
    _seed_match(session_factory)
    _seed_character(session_factory)

    adapter.update_character_location_and_energy(1, 3, 200, 4)

    with session_factory() as s:
        c = s.query(GamingCharacterInstanceEntity).filter_by(id=3, id_match=1).one()
        assert (c.id_location, c.energy) == (200, 4)

    adapter.update_character_location_and_energy(1, 999, 200, 4)  # must not raise


def test_insert_movement_log(session_factory, adapter):
    adapter.insert_movement_log(1, 3, 100, 200, 2)
    adapter.insert_movement_log(1, 3, None, 300, 0)

    with session_factory() as s:
        rows = s.query(LogMovementEntity).order_by(LogMovementEntity.id).all()
        assert [r.id for r in rows] == [1, 2]
        assert rows[0].id_location_from == 100
        assert rows[0].energy_cost == 2
        assert rows[1].id_location_from is None
        assert rows[0].uuid != rows[1].uuid


def test_find_visited_location_ids_dedupes_and_keeps_order(session_factory, adapter):
    _seed_match(session_factory)
    _seed_character(session_factory, id_location=200)
    _seed_character(session_factory, id=4, uuid="char-b", id_user=8, id_location=None)
    adapter.insert_movement_log(1, 3, 100, 200, 2)
    adapter.insert_movement_log(1, 3, 200, 300, 2)

    assert adapter.find_visited_location_ids(1) == [200, 100, 300]
    assert adapter.find_visited_location_ids(2) == []
