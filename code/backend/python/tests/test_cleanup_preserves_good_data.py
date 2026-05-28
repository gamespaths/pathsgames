"""Safety tests for the dev-only test-data cleanup.

These tests exercise the real SQLAlchemy adapters against an in-memory SQLite
database and assert that the cleanup removes ONLY the robot-test rows
(marker ``robottest``) and never the real ("good") data, even when both kinds
of rows are present together.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.auth.models import Base, UserToken
from app.adapters.persistence.auth.guest_persistence_adapter import GuestPersistenceAdapter
from app.adapters.persistence.match.match_persistence_adapter import MatchPersistenceAdapter
from app.adapters.persistence.match.models import (
    GamingStateLocationEntity,
    GamingStateRegistryEntity,
)
# Importing the story models registers the list_stories table referenced by
# the gaming_match foreign key, so create_all() can build the full schema.
from app.adapters.persistence.story.models import (  # noqa: F401
    KeyEntity,
    LocationEntity,
    StoryDifficultyEntity,
    StoryEntity,
)
import app.adapters.persistence.match.models  # noqa: F401  registers gaming_* tables
from app.core.services.dev.test_data_cleanup_service import TestDataCleanupService

FUTURE = "2099-01-01T00:00:00Z"


@pytest.fixture()
def session_factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    yield sessionmaker(bind=engine, autocommit=False, autoflush=False)
    engine.dispose()


def test_cleanup_guests_preserves_real_guests(session_factory):
    adapter = GuestPersistenceAdapter(session_factory)
    adapter.create_guest_user("real-1", "guest_real0001", "ck1", FUTURE)
    adapter.create_guest_user("real-2", "guest_real0002", "ck2", FUTURE)
    adapter.create_guest_user("rob-1", "robottest_aaaa1111", "ck3", FUTURE)
    adapter.create_guest_user("rob-2", "robottest_bbbb2222", "ck4", FUTURE)

    deleted = adapter.delete_guests_by_username_like("robottest%")

    assert deleted == 2
    remaining = {g["username"] for g in adapter.find_all_guests()}
    assert remaining == {"guest_real0001", "guest_real0002"}


def test_cleanup_guests_removes_only_robot_tokens(session_factory):
    adapter = GuestPersistenceAdapter(session_factory)
    real_id = adapter.create_guest_user("real-1", "guest_real0001", "ck1", FUTURE)
    rob_id = adapter.create_guest_user("rob-1", "robottest_aaaa1111", "ck3", FUTURE)
    adapter.store_refresh_token(real_id, "real-token", FUTURE)
    adapter.store_refresh_token(rob_id, "robot-token", FUTURE)

    adapter.delete_guests_by_username_like("robottest%")

    with session_factory() as session:
        tokens = session.query(UserToken).all()
        assert len(tokens) == 1
        assert tokens[0].id_user == real_id


def test_cleanup_matches_preserves_real_matches_and_children(session_factory):
    adapter = MatchPersistenceAdapter(session_factory)
    real = adapter.save_match({"id_story": 1, "id_difficulty": 1, "id_user_creator": 1,
                               "name": "My epic adventure"})
    robot = adapter.save_match({"id_story": 1, "id_difficulty": 1, "id_user_creator": 1,
                                "name": "robottest_match"})
    adapter.save_locations([{"id_match": robot["id"], "id_location": 1}])
    adapter.save_registry([{"id": 1, "id_match": robot["id"], "key": "k"}])
    adapter.save_locations([{"id_match": real["id"], "id_location": 2}])

    deleted = adapter.delete_matches_by_name_like("robottest%")

    assert deleted == 1
    assert {m["name"] for m in adapter.find_all_matches()} == {"My epic adventure"}
    with session_factory() as session:
        assert session.query(GamingStateLocationEntity).filter_by(id_match=robot["id"]).count() == 0
        assert session.query(GamingStateRegistryEntity).filter_by(id_match=robot["id"]).count() == 0
        # the real match keeps its own child rows untouched
        assert session.query(GamingStateLocationEntity).filter_by(id_match=real["id"]).count() == 1


def test_cleanup_service_end_to_end_preserves_good_data(session_factory):
    guest_adapter = GuestPersistenceAdapter(session_factory)
    match_adapter = MatchPersistenceAdapter(session_factory)
    guest_adapter.create_guest_user("real-1", "guest_real0001", "ck1", FUTURE)
    guest_adapter.create_guest_user("rob-1", "robottest_aaaa1111", "ck3", FUTURE)
    match_adapter.save_match({"id_story": 1, "id_difficulty": 1, "id_user_creator": 1,
                              "name": "Real match"})
    match_adapter.save_match({"id_story": 1, "id_difficulty": 1, "id_user_creator": 1,
                              "name": "robottest_match"})

    service = TestDataCleanupService(guest_adapter, match_adapter)
    result = service.cleanup_test_data()

    assert result.deleted_guests == 1
    assert result.deleted_matches == 1
    assert {g["username"] for g in guest_adapter.find_all_guests()} == {"guest_real0001"}
    assert {m["name"] for m in match_adapter.find_all_matches()} == {"Real match"}
