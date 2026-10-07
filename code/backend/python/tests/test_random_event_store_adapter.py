"""Step 39 — the SQLAlchemy random event store adapter against in-memory SQLite."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.auth.models import Base, User
from app.adapters.persistence.match.models import GamingMatchEntity, LogEventsEntity
from app.adapters.persistence.match.random_event_store_adapter import RandomEventStoreAdapter
from app.adapters.persistence.story.models import (
    ChoiceEntity, EventEntity, GlobalRandomEventEntity, StoryEntity,
)
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
    return RandomEventStoreAdapter(session_factory)


def _seed_match(session_factory, **kw):
    with session_factory() as s:
        s.add(StoryEntity(id=9001, uuid="story-uuid", author="A"))
        s.add(User(id=7, uuid="user-uuid", username="bob", state=6))
        s.add(GamingMatchEntity(
            id=1, uuid="match-uuid", id_story=9001, id_difficulty=1,
            id_user_creator=7, current_clock=kw.get("clock", 6), status="RUNNING",
            rng_seed=kw.get("seed", 42), ts_insert=_NOW, ts_update=_NOW))
        s.commit()


def test_load_context_reads_the_match(session_factory, adapter):
    _seed_match(session_factory)
    assert adapter.load_context(1) == {"id_story": 9001, "current_clock": 6,
                                       "rng_seed": 42, "status": "RUNNING"}


def test_load_context_none_when_unknown(adapter):
    assert adapter.load_context(99) is None


def test_find_random_events_joins_event_type_and_choices(session_factory, adapter):
    with session_factory() as s:
        s.add(StoryEntity(id=9001, uuid="story-uuid", author="A"))
        s.add(EventEntity(id=11, id_story=9001, type="ONCE"))
        s.add(EventEntity(id=12, id_story=9001, type="AUTOMATIC"))
        s.add(ChoiceEntity(id=1, id_story=9001, id_event=12))
        s.add(ChoiceEntity(id=2, id_story=9001, id_event=None))
        s.add(GlobalRandomEventEntity(id=1, id_story=9001, id_event=11, probability=30.0,
                                      condition_key="k", condition_value="v",
                                      registry_value_operator_condition="!="))
        s.add(GlobalRandomEventEntity(id=2, id_story=9001, id_event=12, probability=20))
        s.add(GlobalRandomEventEntity(id=3, id_story=9001, id_event=99, probability=None))
        s.add(GlobalRandomEventEntity(id=4, id_story=9001, id_event=None, probability=5))
        s.commit()

    rows = {r["id"]: r for r in adapter.find_random_events(9001)}

    assert rows[1] == {"id": 1, "id_event": 11, "probability": 30, "condition_key": "k",
                       "condition_value": "v", "registry_value_operator_condition": "!=",
                       "event_exists": True, "event_type": "ONCE", "event_owns_choices": False}
    assert rows[2]["event_owns_choices"] is True
    assert rows[3]["event_exists"] is False and rows[3]["probability"] == 0
    assert rows[3]["event_type"] is None
    assert rows[4]["event_exists"] is False


def test_find_random_events_empty_story(adapter):
    assert adapter.find_random_events(9001) == []


def test_find_consumed_event_ids_reads_only_executed_markers(session_factory, adapter):
    _seed_match(session_factory)
    with session_factory() as s:
        s.add(LogEventsEntity(id=1, id_match=1, uuid="l1", id_event=11,
                              log_message="EVENT_EXECUTED 11", ts_insert=_NOW, ts_update=_NOW))
        s.add(LogEventsEntity(id=2, id_match=1, uuid="l2", id_event=12,
                              log_message="weather event", ts_insert=_NOW, ts_update=_NOW))
        s.commit()
    assert adapter.find_consumed_event_ids(1) == {11}
