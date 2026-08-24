"""v0.29.3 — the forced-movement writes of the SQLAlchemy event store adapter.

Exercises :class:`EventStoreAdapter` against an in-memory SQLite database: the location
update, the cost-0 movement log and the location id→uuid map the engine checks ids against.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.auth.models import Base
from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity,
    LogMovementEntity,
)
from app.adapters.persistence.story.models import LocationEntity
from app.adapters.persistence.match.event_store_adapter import EventStoreAdapter
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


def _seed_character(session_factory, id_location=100):
    with session_factory() as s:
        s.add(GamingCharacterInstanceEntity(
            id=3, id_match=1, uuid="char-uuid", id_user=7, id_character_template=1,
            id_location=id_location, life=10, energy=5, ts_insert=_NOW, ts_update=_NOW,
        ))
        s.commit()


def test_update_character_location_writes_the_new_location(session_factory, adapter):
    _seed_character(session_factory)

    adapter.update_character_location(1, 3, 200)

    with session_factory() as s:
        c = s.query(GamingCharacterInstanceEntity).filter_by(id=3, id_match=1).one()
        assert c.id_location == 200
        assert c.energy == 5  # forced movement never touches energy


def test_update_character_location_missing_character_is_a_no_op(session_factory, adapter):
    adapter.update_character_location(1, 99, 200)

    with session_factory() as s:
        assert s.query(GamingCharacterInstanceEntity).count() == 0


def test_insert_movement_log_writes_the_row_with_the_next_id(session_factory, adapter):
    adapter.insert_movement_log(1, 3, 100, 200, 0)
    adapter.insert_movement_log(1, 3, 200, 100, 0)

    with session_factory() as s:
        rows = s.query(LogMovementEntity).order_by(LogMovementEntity.id).all()
        assert [r.id for r in rows] == [1, 2]
        first = rows[0]
        assert first.id_match == 1
        assert first.id_character_match == 3
        assert first.id_location_from == 100
        assert first.id_location_to == 200
        assert first.energy_cost == 0
        assert first.uuid


def test_insert_movement_log_accepts_and_persists_the_resource_costs(session_factory, adapter):
    """v0.35.3 — the event store writes movement rows too (a forced move), so it must speak
    the same signature the movement store does. It did not, and only the end-to-end suite
    noticed: every unit test here had mocked the store away."""
    adapter.insert_movement_log(1, 3, 100, 200, 4, 2, 1, 3)

    with session_factory() as s:
        row = s.query(LogMovementEntity).one()
        assert (row.energy_cost, row.food_cost, row.magic_cost, row.coin_cost) == (4, 2, 1, 3)


def test_insert_movement_log_defaults_the_resource_costs_to_zero(session_factory, adapter):
    adapter.insert_movement_log(1, 3, 100, 200, 4)

    with session_factory() as s:
        row = s.query(LogMovementEntity).one()
        assert (row.food_cost, row.magic_cost, row.coin_cost) == (0, 0, 0)


def test_find_location_uuids_by_id_maps_only_the_story(session_factory, adapter):
    with session_factory() as s:
        s.add(LocationEntity(id=100, id_story=9001, uuid="loc-a"))
        s.add(LocationEntity(id=200, id_story=9001, uuid="loc-b"))
        s.add(LocationEntity(id=100, id_story=9002, uuid="loc-other-story"))
        s.commit()

    assert adapter.find_location_uuids_by_id(9001) == {100: "loc-a", 200: "loc-b"}
