"""Tests for the SQLAlchemy time/turn-cycle store adapters (Steps 24-25).

Exercises :class:`TimeStoreAdapter` (which subclasses
:class:`TurnCycleStoreAdapter`) against an in-memory SQLite database, covering
both the Step 24 turn-queue read/write methods and the Step 25 time-advancement
writes (clock increment, sleeping flags, clock history, story clock labels).
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.auth.models import Base, User
from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity,
    GamingMatchEntity,
    LogClockHistoryEntity,
)
from app.adapters.persistence.story.models import StoryEntity, TextEntity
from app.adapters.persistence.match.time_store_adapter import TimeStoreAdapter
import app.adapters.persistence.match.models  # noqa: F401  registers gaming_* tables

_NOW = "2024-01-01T00:00:00"


@pytest.fixture()
def session_factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    yield factory
    engine.dispose()


def _seed(session_factory, *, with_story=False, with_labels=False):
    """Insert a match + a user + a character; optionally a story with clock labels."""
    with session_factory() as s:
        if with_story:
            s.add(StoryEntity(
                id=1, uuid="story-uuid", author="A",
                id_text_clock_singular=10 if with_labels else None,
                id_text_clock_plural=11 if with_labels else None,
            ))
            if with_labels:
                s.add(TextEntity(id=1, id_story=1, id_text=10, lang="en", short_text="hour"))
                s.add(TextEntity(id=2, id_story=1, id_text=11, lang="en", short_text="hours"))
        s.add(User(id=7, uuid="user-uuid", username="bob", state=6))
        s.add(GamingMatchEntity(
            id=1, uuid="match-uuid", id_story=1 if with_story else 99, id_difficulty=1,
            id_user_creator=7, current_clock=2, status="RUNNING",
            ts_insert=_NOW, ts_update=_NOW,
        ))
        s.add(GamingCharacterInstanceEntity(
            id=1, id_match=1, uuid="char-uuid", id_user=7, id_character_template=1,
            life=10, energy=5, is_sleeping=1, ts_insert=_NOW, ts_update=_NOW,
        ))
        s.commit()


# ── TurnCycleStoreAdapter (inherited) ──────────────────────────────────────────

def test_find_match_by_uuid(session_factory):
    _seed(session_factory)
    adapter = TimeStoreAdapter(session_factory)
    assert adapter.find_match_by_uuid("") is None
    assert adapter.find_match_by_uuid("missing") is None
    m = adapter.find_match_by_uuid("match-uuid")
    assert m["id"] == 1
    assert m["current_clock"] == 2


def test_find_characters_and_user_lookup(session_factory):
    _seed(session_factory)
    adapter = TimeStoreAdapter(session_factory)
    chars = adapter.find_characters_by_match_id(1)
    assert len(chars) == 1 and chars[0]["is_sleeping"] is True
    assert adapter.find_user_id_by_uuid("user-uuid") == 7
    assert adapter.find_user_id_by_uuid("nope") is None
    assert adapter.find_user_id_by_uuid("") is None


def test_replace_and_read_queue(session_factory):
    _seed(session_factory)
    adapter = TimeStoreAdapter(session_factory)
    adapter.replace_queue(1, [
        {"id_character_match": 1, "clock": 2, "priority": 5, "status": "WAITING"},
        {"id_character_match": 2, "clock": 2, "priority": 9, "status": "ACTIVE"},
    ])
    queue = adapter.find_queue_by_match_id(1)
    assert [r["priority"] for r in queue] == [9, 5]  # ordered desc
    # update one row
    adapter.save_queue_row(1, {"id_character_match": 1, "status": "DONE", "pass_counter": 3})
    assert adapter.save_queue_row(1, {"id_character_match": 999, "status": "X"}) is None


def test_update_match_status_and_turn(session_factory):
    _seed(session_factory)
    adapter = TimeStoreAdapter(session_factory)
    adapter.update_match_status_and_turn(1, "PAUSED", 1)
    assert adapter.find_match_by_uuid("match-uuid")["status"] == "PAUSED"
    # missing match → no-op
    assert adapter.update_match_status_and_turn(999, "X", None) is None


# ── TimeStoreAdapter (Step 25) ─────────────────────────────────────────────────

def test_find_character_by_match_and_user(session_factory):
    _seed(session_factory)
    adapter = TimeStoreAdapter(session_factory)
    c = adapter.find_character_by_match_and_user(1, 7)
    assert c["uuid"] == "char-uuid" and c["is_sleeping"] is True
    assert adapter.find_character_by_match_and_user(1, 999) is None


def test_sleeping_flags(session_factory):
    _seed(session_factory)
    adapter = TimeStoreAdapter(session_factory)
    adapter.set_character_sleeping(1, 1, False)
    assert adapter.find_character_by_match_and_user(1, 7)["is_sleeping"] is False
    adapter.set_character_sleeping(1, 1, True)
    adapter.wake_all_characters(1)
    assert adapter.find_character_by_match_and_user(1, 7)["is_sleeping"] is False
    # missing character → no-op
    assert adapter.set_character_sleeping(1, 999, True) is None


def test_increment_clock_and_history(session_factory):
    _seed(session_factory)
    adapter = TimeStoreAdapter(session_factory)
    assert adapter.increment_match_clock(1) == 3
    assert adapter.increment_match_clock(999) == 0  # missing match
    adapter.insert_clock_history(1, 3)
    adapter.insert_clock_history(1, 4)  # exercises max(id)+1 path
    with session_factory() as s:
        assert s.query(LogClockHistoryEntity).count() == 2


def test_find_story_clock_labels(session_factory):
    _seed(session_factory, with_story=True, with_labels=True)
    adapter = TimeStoreAdapter(session_factory)
    singular, plural = adapter.find_story_clock_labels(1, "en")
    assert (singular, plural) == ("hour", "hours")


def test_find_story_clock_labels_missing(session_factory):
    _seed(session_factory, with_story=False)  # match.id_story = 99, no story row
    adapter = TimeStoreAdapter(session_factory)
    assert adapter.find_story_clock_labels(1, "en") == (None, None)
    assert adapter.find_story_clock_labels(999, "en") == (None, None)


def test_resolve_text_falls_back_to_english(session_factory):
    _seed(session_factory, with_story=True, with_labels=True)
    adapter = TimeStoreAdapter(session_factory)
    # request 'it' which is absent → falls back to the 'en' text
    singular, plural = adapter.find_story_clock_labels(1, "it")
    assert singular == "hour" and plural == "hours"
