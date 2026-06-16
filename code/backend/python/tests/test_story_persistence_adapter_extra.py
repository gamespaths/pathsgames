"""Extra coverage for the story persistence adapter — value coercion helpers,
scoped/global id generation, existence checks and the generic entity CRUD
early-exit branches (Step 17)."""
import pytest
from sqlalchemy import create_engine, Integer, Numeric, String
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.story.models import Base, StoryEntity, TextEntity
from app.adapters.persistence.story.story_persistence_adapter import (
    StoryPersistenceAdapter,
    _coerce_value,
    _get_long,
)


@pytest.fixture
def session_factory():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


@pytest.fixture
def adapter(session_factory):
    return StoryPersistenceAdapter(session_factory)


# ── pure helpers ───────────────────────────────────────────────────────────────

def test_get_long_tries_multiple_keys_and_types():
    assert _get_long(None, "id") is None
    assert _get_long({}, "id") is None
    assert _get_long({"id": 5}, "id") == 5
    assert _get_long({"id": 5.0}, "id") == 5
    assert _get_long({"id": "7"}, "id") == 7
    assert _get_long({"id": "x"}, "id") is None
    # falls through the first (None) key to the second
    assert _get_long({"id": None, "idTipo": 3}, "id", "idTipo") == 3


def test_coerce_value_integer_column():
    col = Integer()
    assert _coerce_value(col, None) is None
    assert _coerce_value(col, True) == 1
    assert _coerce_value(col, 4) == 4
    assert _coerce_value(col, 4.9) == 4
    assert _coerce_value(col, "10") == 10
    assert _coerce_value(col, "") is None
    assert _coerce_value(col, "3.5") == 3       # int(float("3.5"))
    assert _coerce_value(col, "nan-text") is None
    assert _coerce_value(col, [1]) == [1]       # non-coercible passthrough


def test_coerce_value_numeric_column():
    col = Numeric()
    assert _coerce_value(col, True) == 1.0
    assert _coerce_value(col, 2) == 2
    assert _coerce_value(col, "2.5") == 2.5
    assert _coerce_value(col, "") is None
    assert _coerce_value(col, "bad") is None
    assert _coerce_value(col, {"x": 1}) == {"x": 1}


def test_coerce_value_other_column_passthrough():
    assert _coerce_value(String(), "hello") == "hello"


# ── id generation / existence ──────────────────────────────────────────────────

def test_exists_and_next_ids(adapter):
    story_id = adapter.save_story({"uuid": "s-extra"})
    assert adapter.exists_story_id(story_id) is True
    assert adapter.exists_story_id(99999) is False

    # next scoped id starts at 1 for an empty table
    assert adapter.next_scoped_id("list_texts", "id", story_id) == 1
    assert adapter.next_global_id("list_texts", "id") == 1

    adapter.save_texts(story_id, [{"idText": 1, "lang": "en", "shortText": "x"}])
    assert adapter.next_scoped_id("list_texts", "id", story_id) >= 2
    assert adapter.exists_entity_id("list_texts", "id_text", 1, story_id) is True
    assert adapter.exists_entity_id("list_texts", "id_text", 999, story_id) is False


def test_sync_sequences_is_noop_on_sqlite(adapter):
    # No exception on SQLite (PostgreSQL-only body is skipped).
    assert adapter.sync_sequences() is None


# ── generic entity CRUD early-exit branches ────────────────────────────────────

def test_entity_crud_unknown_table_is_noop(adapter):
    assert adapter.save_entity(1, "not_a_table", {"x": 1}) is None
    assert adapter.update_entity(1, "not_a_table", "uuid", {"x": 1}) is None
    assert adapter.delete_entity_by_uuid("not_a_table", "uuid") is None


def test_update_entity_missing_row_is_noop(adapter):
    story_id = adapter.save_story({"uuid": "s-crud"})
    # table exists but no matching uuid → early return
    assert adapter.update_entity(story_id, "list_texts", "no-such-uuid", {"shortText": "y"}) is None


def test_update_story_missing_is_noop(adapter):
    assert adapter.update_story_by_id(99999, {"author": "ghost"}) is None
