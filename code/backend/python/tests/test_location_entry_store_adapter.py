"""Step 33 — LocationEntryStoreAdapter against an in-memory SQLite database."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.auth.models import Base
from app.adapters.persistence.match.location_entry_store_adapter import (
    LocationEntryStoreAdapter,
)
from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity,
    GamingMatchEntity,
    GamingStateLocationEntity,
    LogEventsEntity,
    LogMovementEntity,
)
from app.adapters.persistence.story.models import LocationEntity
import app.adapters.persistence.match.models  # noqa: F401  registers gaming_* tables
import app.adapters.persistence.story.models  # noqa: F401  registers list_* tables

MATCH_ID, STORY_ID = 500, 9
LOC_A, LOC_B = 90001, 90002
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
    with session_factory() as s:
        s.add(GamingMatchEntity(id=MATCH_ID, uuid="m1", id_story=STORY_ID, id_difficulty=1,
                                status="RUNNING", current_clock=2, id_user_creator=7,
                                ts_insert=_NOW, ts_update=_NOW))
        s.add(LocationEntity(id=LOC_A, id_story=STORY_ID, uuid="loc-a", id_card=500,
                             id_event_if_first_time=40, id_event_not_first_time=41,
                             id_event_if_character_enter_empty_location=42,
                             id_event_if_character_start_time=43,
                             id_event_if_counter_zero=44, priority_automatic_event=3))
        s.add(GamingStateLocationEntity(id_match=MATCH_ID, id_location=LOC_A, uuid="sl-a",
                                        flag_already_actived=0, flag_visited=0,
                                        clock_counter=2, ts_insert=_NOW, ts_update=_NOW))
        s.commit()
    return LocationEntryStoreAdapter(session_factory)


def _character(session, cid, id_location):
    session.add(GamingCharacterInstanceEntity(
        id=cid, id_match=MATCH_ID, uuid=f"char-{cid}", id_user=cid, id_location=id_location,
        id_character_template=1, ts_insert=_NOW, ts_update=_NOW))


def test_find_location_triggers_maps_every_column(adapter):
    t = adapter.find_location_triggers(STORY_ID, LOC_A)
    assert t["id_card"] == 500
    assert t["id_event_if_first_time"] == 40
    assert t["id_event_not_first_time"] == 41
    assert t["id_event_if_character_enter_empty_location"] == 42
    assert t["id_event_if_character_start_time"] == 43
    assert t["id_event_if_counter_zero"] == 44
    assert t["priority_automatic_event"] == 3


def test_find_location_triggers_of_an_unknown_location_is_none(adapter):
    assert adapter.find_location_triggers(STORY_ID, 99999) is None


def test_flag_visited_starts_at_zero_and_latches(adapter):
    assert adapter.find_flag_visited(MATCH_ID, LOC_A) == 0
    adapter.mark_state_location_visited(MATCH_ID, LOC_A)
    assert adapter.find_flag_visited(MATCH_ID, LOC_A) == 1
    # Idempotent: latching again changes nothing.
    adapter.mark_state_location_visited(MATCH_ID, LOC_A)
    assert adapter.find_flag_visited(MATCH_ID, LOC_A) == 1


def test_flag_visited_of_a_location_with_no_state_row_reads_as_never_visited(adapter):
    assert adapter.find_flag_visited(MATCH_ID, LOC_B) == 0
    # And latching it is a no-op rather than an error.
    adapter.mark_state_location_visited(MATCH_ID, LOC_B)


def test_count_other_characters_excludes_the_arriving_one(adapter, session_factory):
    with session_factory() as s:
        _character(s, 10, LOC_A)
        _character(s, 20, LOC_A)
        _character(s, 30, LOC_B)
        s.commit()
    assert adapter.count_other_characters_at_location(MATCH_ID, LOC_A, 10) == 1
    assert adapter.count_other_characters_at_location(MATCH_ID, LOC_B, 30) == 0


def test_nominal_actor_is_the_lowest_id_standing_there(adapter, session_factory):
    with session_factory() as s:
        _character(s, 20, LOC_A)
        _character(s, 10, LOC_A)
        s.commit()
    assert adapter.find_nominal_actor_at_location(MATCH_ID, LOC_A) == 10


def test_nominal_actor_is_none_when_the_location_is_empty(adapter):
    assert adapter.find_nominal_actor_at_location(MATCH_ID, LOC_A) is None


def test_log_automatic_event_writes_the_clock_and_the_location(adapter, session_factory):
    adapter.log_automatic_event(MATCH_ID, 10, LOC_A, 40, 4, "automatic event 40")
    with session_factory() as s:
        row = s.query(LogEventsEntity).one()
    assert (row.id_location, row.id_event, row.clock) == (LOC_A, 40, 4)
    assert row.id_character_match == 10


def test_visited_location_ids_union_positions_and_movement_log(adapter, session_factory):
    with session_factory() as s:
        _character(s, 10, LOC_A)
        s.add(LogMovementEntity(id=1, id_match=MATCH_ID, uuid="m-1", id_character_match=10,
                                id_location_from=LOC_B, id_location_to=LOC_A,
                                energy_cost=1, ts_insert=_NOW, ts_update=_NOW))
        s.commit()
    assert sorted(adapter.find_visited_location_ids(MATCH_ID)) == [LOC_A, LOC_B]


def test_find_character_location(adapter, session_factory):
    with session_factory() as s:
        _character(s, 10, LOC_B)
        s.commit()
    assert adapter.find_character_location(MATCH_ID, 10) == LOC_B
    assert adapter.find_character_location(MATCH_ID, 999) is None
