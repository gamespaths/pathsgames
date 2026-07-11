"""Tests for the SQLAlchemy match persistence/read adapters — Step 19.

These tests exercise the adapters against an in-memory SQLite database so
we cover the real ORM mappings as well as the dict mapping logic.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.auth.models import Base
from app.adapters.persistence.match.match_persistence_adapter import MatchPersistenceAdapter
from app.adapters.persistence.match.story_match_read_adapter import StoryMatchReadAdapter
from app.adapters.persistence.match.user_access_adapter import UserAccessAdapter
from app.adapters.persistence.story.models import (
    KeyEntity,
    LocationEntity,
    StoryDifficultyEntity,
    StoryEntity,
)
from app.adapters.persistence.auth.models import User
import app.adapters.persistence.match.models  # noqa: F401  registers gaming_* tables


@pytest.fixture()
def session_factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    yield factory
    engine.dispose()


def test_save_and_find_match(session_factory):
    adapter = MatchPersistenceAdapter(session_factory)
    saved = adapter.save_match({
        "id_story": 1,
        "id_difficulty": 2,
        "id_user_creator": 7,
        "name": "test",
        "exp_cost": 5,
        "current_clock": 0,
    })
    assert saved["id"] is not None
    assert saved["uuid"]
    assert saved["status"] == "CREATED"

    found = adapter.find_match_by_uuid(saved["uuid"])
    assert found["id"] == saved["id"]
    assert adapter.find_match_by_uuid("missing") is None


def test_save_match_persists_loadout(session_factory):
    adapter = MatchPersistenceAdapter(session_factory)
    saved = adapter.save_match({
        "id_story": 1,
        "id_difficulty": 2,
        "id_user_creator": 7,
        "single_player": 0,
        "character_template_uuid": "ct",
        "class_uuid": "cl",
        "trait_uuids": ["t1", "t2"],
    })
    assert saved["single_player"] == 0
    assert saved["character_template_uuid"] == "ct"
    assert saved["class_uuid"] == "cl"
    assert saved["trait_uuids"] == ["t1", "t2"]

    found = adapter.find_match_by_uuid(saved["uuid"])
    assert found["trait_uuids"] == ["t1", "t2"]


def test_save_match_loadout_defaults(session_factory):
    adapter = MatchPersistenceAdapter(session_factory)
    saved = adapter.save_match({"id_story": 1, "id_difficulty": 2, "id_user_creator": 7})
    assert saved["single_player"] == 1
    assert saved["character_template_uuid"] is None
    assert saved["class_uuid"] is None
    assert saved["trait_uuids"] == []


def test_trait_uuids_codec_edge_cases():
    from app.adapters.persistence.match.match_persistence_adapter import (
        _join_trait_uuids,
        _split_trait_uuids,
    )
    assert _join_trait_uuids(None) is None
    assert _join_trait_uuids([]) is None
    assert _join_trait_uuids([None, "", "  "]) is None
    assert _join_trait_uuids([" a ", None, "b"]) == "a,b"
    assert _split_trait_uuids(None) == []
    assert _split_trait_uuids("") == []
    assert _split_trait_uuids(" a , ,b ") == ["a", "b"]


def test_find_matches_by_user_id(session_factory):
    adapter = MatchPersistenceAdapter(session_factory)
    adapter.save_match({"id_story": 1, "id_difficulty": 2, "id_user_creator": 7})
    adapter.save_match({"id_story": 1, "id_difficulty": 2, "id_user_creator": 9})
    rows = adapter.find_matches_by_user_id(7)
    assert len(rows) == 1
    assert adapter.find_matches_by_user_id(404) == []


def test_find_all_matches(session_factory):
    adapter = MatchPersistenceAdapter(session_factory)
    adapter.save_match({"id_story": 1, "id_difficulty": 2, "id_user_creator": 7})
    adapter.save_match({"id_story": 1, "id_difficulty": 2, "id_user_creator": 9})
    rows = adapter.find_all_matches()
    assert len(rows) == 2
    assert {r["id_user_creator"] for r in rows} == {7, 9}


def test_find_all_matches_empty(session_factory):
    adapter = MatchPersistenceAdapter(session_factory)
    assert adapter.find_all_matches() == []


# ── find_matches_page (v0.28.1) ──────────────────────────────────────────────

def _seed_page_rows(adapter, session_factory, specs):
    """Save matches then override status/ts_insert deterministically.

    specs: list of dicts {creator, story, status, ts}. Returns saved ids in
    insertion order so tests can assert on them."""
    from app.adapters.persistence.match.models import GamingMatchEntity
    ids = []
    for spec in specs:
        saved = adapter.save_match({
            "id_story": spec["story"], "id_difficulty": 2,
            "id_user_creator": spec["creator"],
        })
        ids.append(saved["id"])
    with session_factory() as session:
        for mid, spec in zip(ids, specs):
            row = session.get(GamingMatchEntity, mid)
            row.status = spec["status"]
            row.ts_insert = spec["ts"]
        session.commit()
    return ids


def test_find_matches_page_orders_newest_first_and_keysets(session_factory):
    adapter = MatchPersistenceAdapter(session_factory)
    i1, i2, i3 = _seed_page_rows(adapter, session_factory, [
        {"creator": 7, "story": 1, "status": "CREATED", "ts": "2024-01-01T00:00:00+00:00"},
        {"creator": 7, "story": 1, "status": "CREATED", "ts": "2024-02-02T00:00:00+00:00"},
        {"creator": 7, "story": 1, "status": "CREATED", "ts": "2024-03-03T00:00:00+00:00"},
    ])
    # First page (newest two): i3 then i2.
    page1 = adapter.find_matches_page(None, None, None, None, None, None, 2)
    assert [r["id"] for r in page1] == [i3, i2]
    # Keyset from the last row of page1 → the remaining oldest row.
    last = page1[-1]
    page2 = adapter.find_matches_page(None, None, None, None, last["ts_insert"], last["id"], 2)
    assert [r["id"] for r in page2] == [i1]


def test_find_matches_page_filters(session_factory):
    adapter = MatchPersistenceAdapter(session_factory)
    _seed_page_rows(adapter, session_factory, [
        {"creator": 7, "story": 1, "status": "RUNNING", "ts": "2024-03-01T00:00:00+00:00"},
        {"creator": 9, "story": 2, "status": "ENDED", "ts": "2024-01-01T00:00:00+00:00"},
    ])
    by_user = adapter.find_matches_page(None, 7, None, None, None, None, 50)
    assert [r["id_user_creator"] for r in by_user] == [7]
    by_story = adapter.find_matches_page(None, None, 2, None, None, None, 50)
    assert [r["id_story"] for r in by_story] == [2]
    by_status = adapter.find_matches_page("ENDED", None, None, None, None, None, 50)
    assert [r["status"] for r in by_status] == ["ENDED"]
    # ts_from keeps only rows at/after the bound (the RUNNING 2024-03 one).
    recent = adapter.find_matches_page(None, None, None, "2024-02-01T00:00:00+00:00", None, None, 50)
    assert [r["status"] for r in recent] == ["RUNNING"]


def test_find_matches_page_limit_and_empty(session_factory):
    adapter = MatchPersistenceAdapter(session_factory)
    _seed_page_rows(adapter, session_factory, [
        {"creator": 7, "story": 1, "status": "CREATED", "ts": "2024-02-02T00:00:00+00:00"},
        {"creator": 7, "story": 1, "status": "CREATED", "ts": "2024-01-01T00:00:00+00:00"},
    ])
    assert len(adapter.find_matches_page(None, None, None, None, None, None, 1)) == 1
    assert adapter.find_matches_page("GAMEOVER", None, None, None, None, None, 50) == []


def test_save_locations_and_registry_no_op_when_empty(session_factory):
    adapter = MatchPersistenceAdapter(session_factory)
    adapter.save_locations([])
    adapter.save_registry([])
    adapter.save_locations(None)
    adapter.save_registry(None)
    assert adapter.find_locations_by_match_id(99) == []
    assert adapter.find_registry_by_match_id(99) == []


def test_save_and_find_locations_and_registry(session_factory):
    adapter = MatchPersistenceAdapter(session_factory)
    saved = adapter.save_match({"id_story": 1, "id_difficulty": 2, "id_user_creator": 7})
    adapter.save_locations([
        {"id_match": saved["id"], "id_location": 10, "flag_already_actived": 0, "clock_counter": 5},
    ])
    adapter.save_registry([
        {"id": 1, "id_match": saved["id"], "key": "k", "string_value": "v", "int_value": None},
    ])
    locs = adapter.find_locations_by_match_id(saved["id"])
    regs = adapter.find_registry_by_match_id(saved["id"])
    assert len(locs) == 1 and locs[0]["id_location"] == 10
    assert locs[0]["clock_counter"] == 5
    assert len(regs) == 1 and regs[0]["string_value"] == "v"


def test_story_match_read_adapter(session_factory):
    with session_factory() as session:
        story = StoryEntity(uuid="story-uuid", visibility="PUBLIC", priority=0)
        session.add(story)
        session.flush()
        story_id = story.id

        diff = StoryDifficultyEntity(id=1, id_story=story_id, uuid="diff-uuid", exp_cost=5)
        location = LocationEntity(id=10, id_story=story_id, uuid="loc-uuid", counter_time=3)
        key = KeyEntity(id=20, id_story=story_id, uuid="key-uuid", key_name="k", key_value="1")
        session.add_all([diff, location, key])
        session.commit()

    read = StoryMatchReadAdapter(session_factory)
    s_by_uuid = read.find_story_by_uuid("story-uuid")
    assert s_by_uuid["uuid"] == "story-uuid"
    assert read.find_story_by_uuid("missing") is None
    s_by_id = read.find_story_by_id(s_by_uuid["id"])
    assert s_by_id["uuid"] == "story-uuid"
    assert read.find_story_by_id(404) is None

    d_by_uuid = read.find_difficulty_by_uuid(s_by_uuid["id"], "diff-uuid")
    assert d_by_uuid["exp_cost"] == 5
    assert read.find_difficulty_by_uuid(s_by_uuid["id"], "x") is None
    d_by_id = read.find_difficulty_by_id(s_by_uuid["id"], 1)
    assert d_by_id["uuid"] == "diff-uuid"
    assert read.find_difficulty_by_id(s_by_uuid["id"], 99) is None

    locs = read.find_locations_by_story_id(s_by_uuid["id"])
    assert locs[0]["counter_time"] == 3
    # v0.28.6 — the projection must carry id_card and secure_param: the match-info
    # enrichment reads them off these dicts (locationsActive[].card/.secureParam and
    # the neighbor location cards). They were missing, so those fields were always null.
    assert "id_card" in locs[0]
    assert "secure_param" in locs[0]
    keys = read.find_keys_by_story_id(s_by_uuid["id"])
    assert keys[0]["key_value"] == "1"


def test_user_access_adapter(session_factory):
    with session_factory() as session:
        session.add(User(uuid="user-uuid", username="alice", role="PLAYER", state=2))
        session.commit()

    adapter = UserAccessAdapter(session_factory)
    assert adapter.find_by_uuid("") is None
    assert adapter.find_by_uuid(None) is None
    assert adapter.find_by_uuid("missing") is None
    user = adapter.find_by_uuid("user-uuid")
    assert user == {
        "id": user["id"],
        "uuid": "user-uuid",
        "username": "alice",
        "role": "PLAYER",
        "state": 2,
    }


# ── admin update / delete ─────────────────────────────────────────────────────

def test_update_match_fields(session_factory):
    adapter = MatchPersistenceAdapter(session_factory)
    saved = adapter.save_match({"id_story": 1, "id_difficulty": 1, "id_user_creator": 1,
                                "name": "old", "status": "CREATED"})
    assert adapter.update_match_fields(saved["uuid"], "ENDED", "new") is True
    reloaded = adapter.find_match_by_uuid(saved["uuid"])
    assert reloaded["status"] == "ENDED"
    assert reloaded["name"] == "new"


def test_update_match_fields_null_fields_keep_values(session_factory):
    adapter = MatchPersistenceAdapter(session_factory)
    saved = adapter.save_match({"id_story": 1, "id_difficulty": 1, "id_user_creator": 1,
                                "name": "keep", "status": "RUNNING"})
    adapter.update_match_fields(saved["uuid"], None, None)
    reloaded = adapter.find_match_by_uuid(saved["uuid"])
    assert reloaded["status"] == "RUNNING"
    assert reloaded["name"] == "keep"


def test_update_match_fields_unknown_uuid(session_factory):
    adapter = MatchPersistenceAdapter(session_factory)
    assert adapter.update_match_fields("nope", "ENDED", None) is False


def test_delete_match_by_uuid_removes_match_and_children(session_factory):
    adapter = MatchPersistenceAdapter(session_factory)
    saved = adapter.save_match({"id_story": 1, "id_difficulty": 1, "id_user_creator": 1,
                                "name": "m", "status": "ENDED"})
    adapter.save_locations([{"id_match": saved["id"], "id_location": 1}])
    adapter.save_registry([{"id": 1, "id_match": saved["id"], "key": "k"}])

    assert adapter.delete_match_by_uuid(saved["uuid"]) is True

    assert adapter.find_match_by_uuid(saved["uuid"]) is None
    assert adapter.find_locations_by_match_id(saved["id"]) == []
    assert adapter.find_registry_by_match_id(saved["id"]) == []


def test_delete_match_by_uuid_unknown(session_factory):
    adapter = MatchPersistenceAdapter(session_factory)
    assert adapter.delete_match_by_uuid("nope") is False
