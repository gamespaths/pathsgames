"""Tests for MatchQueryService — Step 19."""
from unittest.mock import MagicMock

from app.core.services.match.match_query_service import MatchQueryService


def _user(uid=7, uuid="user-uuid"):
    return {"id": uid, "uuid": uuid, "username": "u", "role": "PLAYER", "state": 2}


def _match(creator=7, mid=99, story=2, diff=3, mu="match-uuid"):
    return {
        "id": mid,
        "uuid": mu,
        "id_story": story,
        "id_difficulty": diff,
        "id_user_creator": creator,
        "name": "n",
        "status": "CREATED",
        "current_clock": 0,
        "exp_cost": 5,
        "ts_insert": "now",
        "ts_update": "now",
    }


def _build(user=None, match=None, matches=None, story=None, difficulty=None, locations=None,
           state_locations=None, registry=None):
    persistence = MagicMock()
    story_read = MagicMock()
    user_access = MagicMock()
    user_access.find_by_uuid.return_value = user
    persistence.find_match_by_uuid.return_value = match
    persistence.find_matches_by_user_id.return_value = matches or []
    story_read.find_story_by_id.return_value = story
    story_read.find_difficulty_by_id.return_value = difficulty
    story_read.find_locations_by_story_id.return_value = locations or []
    persistence.find_locations_by_match_id.return_value = state_locations or []
    persistence.find_registry_by_match_id.return_value = registry or []
    return MatchQueryService(persistence, story_read, user_access), {
        "persistence": persistence,
        "story_read": story_read,
        "user_access": user_access,
    }


def test_list_user_matches_blank_user():
    service, _ = _build()
    assert service.list_user_matches("") == []
    assert service.list_user_matches(None) == []


def test_list_user_matches_unknown_user():
    service, mocks = _build(user=None)
    assert service.list_user_matches("u") == []
    mocks["persistence"].find_matches_by_user_id.assert_not_called()


def test_list_user_matches_returns_summaries():
    service, _ = _build(user=_user(), matches=[_match()])
    summaries = service.list_user_matches("u")
    assert len(summaries) == 1
    assert summaries[0].uuid == "match-uuid"
    assert summaries[0].user_creator_uuid == "user-uuid"


def test_get_match_info_blank_inputs():
    service, _ = _build()
    assert service.get_match_info("", "u") is None
    assert service.get_match_info("m", "") is None
    assert service.get_match_info(None, "u") is None


def test_get_match_info_unknown_user():
    service, _ = _build(user=None)
    assert service.get_match_info("m", "u") is None


def test_get_match_info_match_not_found():
    service, _ = _build(user=_user(), match=None)
    assert service.get_match_info("m", "u") is None


def test_get_match_info_other_owner():
    service, _ = _build(user=_user(), match=_match(creator=99))
    assert service.get_match_info("m", "u") is None


def test_get_match_info_full():
    service, _ = _build(
        user=_user(),
        match=_match(),
        story={"id": 2, "uuid": "story-uuid", "id_location_start": 10},
        difficulty={"id": 3, "uuid": "diff-uuid"},
        locations=[
            {"id": 10, "uuid": "loc-10"},
            {"id": 11, "uuid": "loc-11"},
        ],
        state_locations=[
            {"id_match": 99, "id_location": 10, "uuid": "ls10",
             "flag_already_actived": 0, "clock_counter": 5},
            {"id_match": 99, "id_location": 11, "uuid": "ls11",
             "flag_already_actived": 0, "clock_counter": 0},
        ],
        registry=[
            {"id": 1, "id_match": 99, "uuid": "r1", "key": "k", "string_value": None, "int_value": 1},
        ],
    )
    detail = service.get_match_info("m", "u")
    assert detail is not None
    assert detail.match.story_uuid == "story-uuid"
    assert detail.match.difficulty_uuid == "diff-uuid"
    assert detail.current_location_id == 10
    assert detail.current_location_uuid == "loc-10"
    assert detail.current_location_name == "location-10"
    assert len(detail.locations) == 2
    assert detail.locations[0].name == "location-10"
    assert len(detail.registry) == 1
    assert detail.events == []
    assert detail.choices == []


def test_get_match_info_no_start_location():
    service, _ = _build(
        user=_user(),
        match=_match(),
        story={"id": 2, "uuid": "story-uuid", "id_location_start": None},
        difficulty={"id": 3, "uuid": "diff-uuid"},
    )
    detail = service.get_match_info("m", "u")
    assert detail is not None
    assert detail.current_location_id is None
    assert detail.current_location_uuid is None


def test_get_match_info_start_location_missing_in_locations_list():
    service, _ = _build(
        user=_user(),
        match=_match(),
        story={"id": 2, "uuid": "story-uuid", "id_location_start": 10},
        difficulty={"id": 3, "uuid": "diff-uuid"},
        locations=[],
    )
    detail = service.get_match_info("m", "u")
    assert detail.current_location_id == 10
    assert detail.current_location_uuid is None


def test_get_match_info_story_missing():
    service, _ = _build(
        user=_user(),
        match=_match(),
        story=None,
    )
    detail = service.get_match_info("m", "u")
    assert detail is not None
    assert detail.match.story_uuid is None
    assert detail.match.difficulty_uuid is None
