"""Step 36 — the single reader and writer of gaming_state_registry, against a real SQLite."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.auth.models import Base
import app.adapters.persistence.match.models  # noqa: F401  registers gaming_* tables
import app.adapters.persistence.story.models  # noqa: F401  the FK targets of those
from app.adapters.persistence.match.models import LogEventsEntity
from app.adapters.persistence.match.registry_store_adapter import RegistryStoreAdapter


@pytest.fixture()
def session_factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    yield factory
    engine.dispose()


@pytest.fixture()
def adapter(session_factory):
    return RegistryStoreAdapter(session_factory)


def test_insert_all_numbers_the_seeded_rows_from_one(adapter):
    adapter.insert_all(9, [{"key": "a", "string_value": "x", "int_value": None},
                           {"key": "b", "string_value": None, "int_value": 2}])

    rows = sorted(adapter.find_by_match(9), key=lambda r: r["id"])
    assert [r["id"] for r in rows] == [1, 2]
    assert rows[0]["key"] == "a" and rows[0]["string_value"] == "x"
    assert rows[1]["int_value"] == 2
    # Every row gets a uuid, seeded or written at runtime — the payload must not be ragged.
    assert all(r["uuid"] for r in rows)


def test_find_by_match_and_key_returns_one_row_or_none(adapter):
    adapter.insert_all(9, [{"key": "count", "string_value": None, "int_value": 7}])

    assert adapter.find_by_match_and_key(9, "count")["int_value"] == 7
    assert adapter.find_by_match_and_key(9, "gone") is None
    assert adapter.find_by_match_and_key(9, None) is None


def test_upsert_overwrites_the_existing_key_in_place(adapter):
    adapter.insert_all(9, [{"key": "count", "string_value": "old", "int_value": None}])

    adapter.upsert(9, "count", None, 42, 3, 12, 5, 7)

    row = adapter.find_by_match_and_key(9, "count")
    assert row["int_value"] == 42 and row["string_value"] is None
    assert row["id_character"] == 3 and row["id_event"] == 12
    assert row["id_choice"] == 5 and row["clock"] == 7
    assert len(adapter.find_by_match(9)) == 1


def test_upsert_inserts_a_new_key_with_the_next_free_id(adapter):
    adapter.insert_all(9, [{"key": "other", "string_value": "x", "int_value": None}])

    adapter.upsert(9, "fresh", "hello", None, None, None, None, 6)

    fresh = adapter.find_by_match_and_key(9, "fresh")
    assert fresh["id"] == 2
    assert fresh["string_value"] == "hello" and fresh["clock"] == 6


def test_a_match_with_no_rows_yet_starts_its_ids_at_one(adapter):
    adapter.upsert(9, "first", "v", None, None, None, None, 0)
    assert adapter.find_by_match_and_key(9, "first")["id"] == 1


def test_ids_are_allocated_per_match_never_globally(adapter):
    adapter.insert_all(1, [{"key": "a", "string_value": "x", "int_value": None}])
    adapter.upsert(2, "b", "y", None, None, None, None, 0)
    assert adapter.find_by_match_and_key(2, "b")["id"] == 1


def test_nothing_to_insert_or_delete_is_a_no_op(adapter):
    adapter.insert_all(9, [])
    adapter.insert_all(9, None)
    adapter.delete_by_match_ids([])
    adapter.delete_by_match_ids(None)
    assert adapter.find_by_match(9) == []


def test_delete_removes_only_the_named_matches(adapter):
    adapter.insert_all(1, [{"key": "a", "string_value": "x", "int_value": None}])
    adapter.insert_all(2, [{"key": "b", "string_value": "y", "int_value": None}])

    adapter.delete_by_match_ids([1])

    assert adapter.find_by_match(1) == []
    assert len(adapter.find_by_match(2)) == 1


def test_log_change_writes_one_row_carrying_the_whole_provenance(adapter, session_factory):
    adapter.log_change(1, 3, 12, 9, 5, "REGISTRY_CHANGE gate None -> OPEN")

    with session_factory() as session:
        rows = session.query(LogEventsEntity).all()
        assert len(rows) == 1
        row = rows[0]
        assert row.id_match == 1 and row.id_character_match == 3
        assert row.id_event == 12 and row.id_choise == 9 and row.clock == 5
        assert row.log_message == "REGISTRY_CHANGE gate None -> OPEN"
