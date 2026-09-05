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


def test_find_by_match_and_key_returns_every_row_of_the_key(adapter):
    adapter.insert_all(9, [{"key": "count", "string_value": None, "int_value": 7}])

    assert adapter.find_by_match_and_key(9, "count")[0]["int_value"] == 7
    assert adapter.find_by_match_and_key(9, "gone") == []
    assert adapter.find_by_match_and_key(9, None) == []


def test_upsert_overwrites_the_existing_key_in_place(adapter):
    adapter.insert_all(9, [{"key": "count", "string_value": "old", "int_value": None}])

    adapter.upsert(9, "count", None, 42, 3, 12, 5, 7)

    row = adapter.find_by_match_and_key(9, "count")[0]
    assert row["int_value"] == 42 and row["string_value"] is None
    assert row["id_character"] == 3 and row["id_event"] == 12
    assert row["id_choice"] == 5 and row["clock"] == 7
    assert len(adapter.find_by_match(9)) == 1


def test_upsert_inserts_a_new_key_with_the_next_free_id(adapter):
    adapter.insert_all(9, [{"key": "other", "string_value": "x", "int_value": None}])

    adapter.upsert(9, "fresh", "hello", None, None, None, None, 6)

    fresh = adapter.find_by_match_and_key(9, "fresh")[0]
    assert fresh["id"] == 2
    assert fresh["string_value"] == "hello" and fresh["clock"] == 6


def test_a_match_with_no_rows_yet_starts_its_ids_at_one(adapter):
    adapter.upsert(9, "first", "v", None, None, None, None, 0)
    assert adapter.find_by_match_and_key(9, "first")[0]["id"] == 1


def test_ids_are_allocated_per_match_never_globally(adapter):
    adapter.insert_all(1, [{"key": "a", "string_value": "x", "int_value": None}])
    adapter.upsert(2, "b", "y", None, None, None, None, 0)
    assert adapter.find_by_match_and_key(2, "b")[0]["id"] == 1


def test_insert_value_adds_a_member_and_stamps_the_mirror(adapter):
    adapter.insert_all(9, [{"key": "clues", "string_value": "A", "int_value": None,
                            "multi_value": 1}])

    adapter.insert_value(9, "clues", "B", None, 3, 12, None, 6)

    rows = sorted(adapter.find_by_match_and_key(9, "clues"), key=lambda r: r["id"])
    assert [r["string_value"] for r in rows] == ["A", "B"]
    assert rows[1]["id"] == 2 and rows[1]["multi_value"] == 1


def test_delete_value_removes_the_one_row_holding_that_member(adapter):
    adapter.insert_all(9, [{"key": "clues", "string_value": "A", "int_value": None,
                            "multi_value": 1},
                           {"key": "clues", "string_value": "B", "int_value": None,
                            "multi_value": 1}])

    adapter.delete_value(9, "clues", "B", None)
    adapter.delete_value(9, "clues", "Z", None)  # a member the key does not hold

    assert [r["string_value"] for r in adapter.find_by_match_and_key(9, "clues")] == ["A"]


def test_insert_all_carries_each_seeded_rows_own_mirror(adapter):
    adapter.insert_all(9, [{"key": "single", "string_value": "x", "int_value": None},
                           {"key": "clues", "string_value": "A", "int_value": None,
                            "multi_value": 1}])

    rows = sorted(adapter.find_by_match(9), key=lambda r: r["id"])
    assert [r["multi_value"] for r in rows] == [0, 1]


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


# ── v0.36.2 — the admin console addresses a match by uuid, not by id ─────────

def _insert_match(session_factory, uuid, id_story=3):
    from app.adapters.persistence.match.models import GamingMatchEntity
    with session_factory() as session:
        session.add(GamingMatchEntity(uuid=uuid, id_story=id_story, id_difficulty=1,
                                      id_user_creator=1, ts_insert="2026-01-01T00:00:00",
                                      ts_update="2026-01-01T00:00:00"))
        session.commit()


def test_find_match_and_story_id_by_uuid_returns_both_ids(adapter, session_factory):
    _insert_match(session_factory, "m-1")
    assert adapter.find_match_and_story_id_by_uuid("m-1") == (1, 3)


def test_find_match_and_story_id_by_uuid_unknown_match(adapter):
    assert adapter.find_match_and_story_id_by_uuid("nope") is None


@pytest.mark.parametrize("uuid", [None, "", "   "])
def test_find_match_and_story_id_by_uuid_rejects_a_blank_uuid(adapter, uuid):
    assert adapter.find_match_and_story_id_by_uuid(uuid) is None
