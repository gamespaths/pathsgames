"""Tests for MatchCommandService — Step 19."""
import pytest
from unittest.mock import MagicMock

from app.core.models.match.match_models import MatchCreateCommand, MatchCreationError
from app.core.services.match.match_command_service import MatchCommandService


def _build_service(
    is_maintenance=False,
    user=None,
    story=None,
    difficulty=None,
    locations=None,
    keys=None,
    saved_match=None,
):
    story_read = MagicMock()
    persistence = MagicMock()
    user_access = MagicMock()
    system_mode = MagicMock()

    system_mode.is_maintenance.return_value = is_maintenance
    user_access.find_by_uuid.return_value = user
    story_read.find_story_by_uuid.return_value = story
    story_read.find_difficulty_by_uuid.return_value = difficulty
    story_read.find_locations_by_story_id.return_value = locations
    story_read.find_keys_by_story_id.return_value = keys
    persistence.save_match.return_value = saved_match

    return MatchCommandService(story_read, persistence, user_access, system_mode), {
        "story_read": story_read,
        "persistence": persistence,
        "user_access": user_access,
        "system_mode": system_mode,
    }


def _user(state=2):
    return {"id": 7, "uuid": "user-uuid", "username": "u", "role": "PLAYER", "state": state}


def _story():
    return {"id": 2, "uuid": "story-uuid"}


def _difficulty(exp=5):
    return {"id": 3, "uuid": "diff-uuid", "exp_cost": exp}


def _saved(uuid="match-uuid"):
    return {
        "id": 99,
        "uuid": uuid,
        "id_story": 2,
        "id_difficulty": 3,
        "id_user_creator": 7,
        "name": "n",
        "status": "CREATED",
        "current_clock": 0,
        "exp_cost": 5,
        "ts_insert": "now",
        "ts_update": "now",
    }


def test_invalid_input_none_command():
    service, _ = _build_service()
    with pytest.raises(MatchCreationError) as exc:
        service.create_match(None)
    assert exc.value.code == MatchCreationError.INVALID_INPUT


def test_invalid_input_missing_user():
    service, _ = _build_service()
    cmd = MatchCreateCommand("", "s", "d")
    with pytest.raises(MatchCreationError) as exc:
        service.create_match(cmd)
    assert exc.value.code == MatchCreationError.INVALID_INPUT


def test_invalid_input_missing_story():
    service, _ = _build_service()
    with pytest.raises(MatchCreationError):
        service.create_match(MatchCreateCommand("u", "", "d"))


def test_invalid_input_missing_difficulty():
    service, _ = _build_service()
    with pytest.raises(MatchCreationError):
        service.create_match(MatchCreateCommand("u", "s", ""))


def test_maintenance_mode():
    service, mocks = _build_service(is_maintenance=True)
    with pytest.raises(MatchCreationError) as exc:
        service.create_match(MatchCreateCommand("u", "s", "d"))
    assert exc.value.code == MatchCreationError.MAINTENANCE_MODE
    mocks["user_access"].find_by_uuid.assert_not_called()


def test_user_not_found():
    service, _ = _build_service(user=None)
    with pytest.raises(MatchCreationError) as exc:
        service.create_match(MatchCreateCommand("u", "s", "d"))
    assert exc.value.code == MatchCreationError.USER_NOT_FOUND


def test_user_banned_state_4():
    service, _ = _build_service(user=_user(state=4))
    with pytest.raises(MatchCreationError) as exc:
        service.create_match(MatchCreateCommand("u", "s", "d"))
    assert exc.value.code == MatchCreationError.USER_BANNED


def test_user_blocked_state_3():
    service, _ = _build_service(user=_user(state=3))
    with pytest.raises(MatchCreationError) as exc:
        service.create_match(MatchCreateCommand("u", "s", "d"))
    assert exc.value.code == MatchCreationError.USER_BANNED


def test_story_not_found():
    service, _ = _build_service(user=_user(), story=None)
    with pytest.raises(MatchCreationError) as exc:
        service.create_match(MatchCreateCommand("u", "s", "d"))
    assert exc.value.code == MatchCreationError.STORY_NOT_FOUND


def test_difficulty_not_found():
    service, _ = _build_service(user=_user(), story=_story(), difficulty=None)
    with pytest.raises(MatchCreationError) as exc:
        service.create_match(MatchCreateCommand("u", "s", "d"))
    assert exc.value.code == MatchCreationError.DIFFICULTY_NOT_FOUND


def test_no_locations_none():
    service, _ = _build_service(
        user=_user(), story=_story(), difficulty=_difficulty(), locations=None
    )
    with pytest.raises(MatchCreationError) as exc:
        service.create_match(MatchCreateCommand("u", "s", "d"))
    assert exc.value.code == MatchCreationError.STORY_HAS_NO_LOCATIONS


def test_no_locations_empty():
    service, _ = _build_service(
        user=_user(), story=_story(), difficulty=_difficulty(), locations=[]
    )
    with pytest.raises(MatchCreationError):
        service.create_match(MatchCreateCommand("u", "s", "d"))


def test_happy_path_creates_match_and_seeds_state():
    locations = [
        {"id": 10, "uuid": "loc-1", "counter_start": 5},
        {"id": 11, "uuid": "loc-2", "counter_start": None},
    ]
    keys = [
        {"id": 20, "key_name": "n1", "key_value": "1"},
        {"id": 21, "key_name": "n2", "key_value": "hello"},
        {"id": 22, "key_name": "n3", "key_value": "  "},
        {"id": 23, "key_name": "n4", "key_value": None},
    ]
    service, mocks = _build_service(
        user=_user(),
        story=_story(),
        difficulty=_difficulty(),
        locations=locations,
        keys=keys,
        saved_match=_saved(),
    )

    summary = service.create_match(MatchCreateCommand("u", "s", "d", "n", "ct"))
    assert summary.uuid == "match-uuid"
    assert summary.story_uuid == "story-uuid"
    assert summary.difficulty_uuid == "diff-uuid"
    assert summary.user_creator_uuid == "user-uuid"
    assert summary.exp_cost == 5

    save_locations = mocks["persistence"].save_locations.call_args[0][0]
    assert len(save_locations) == 2
    assert save_locations[0]["clock_counter"] == 5
    assert save_locations[1]["clock_counter"] == 0

    save_registry = mocks["persistence"].save_registry.call_args[0][0]
    assert len(save_registry) == 4
    assert save_registry[0]["int_value"] == 1
    assert save_registry[0]["string_value"] is None
    assert save_registry[1]["string_value"] == "hello"
    assert save_registry[2]["string_value"] == ""
    assert save_registry[3]["string_value"] is None
    assert save_registry[3]["int_value"] is None


def test_difficulty_default_exp_cost_when_none():
    service, _ = _build_service(
        user=_user(),
        story=_story(),
        difficulty={"id": 3, "uuid": "d", "exp_cost": None},
        locations=[{"id": 10, "uuid": "u", "counter_start": 0}],
        keys=[],
        saved_match=_saved(),
    )
    summary = service.create_match(MatchCreateCommand("u", "s", "d"))
    assert summary.exp_cost == 5


def test_keys_legacy_field_names_supported():
    service, mocks = _build_service(
        user=_user(),
        story=_story(),
        difficulty=_difficulty(),
        locations=[{"id": 10, "uuid": "u", "counter_time": 7}],
        keys=[{"id": 1, "name": "foo", "value": "bar"}],
        saved_match=_saved(),
    )
    service.create_match(MatchCreateCommand("u", "s", "d"))
    save_locations = mocks["persistence"].save_locations.call_args[0][0]
    assert save_locations[0]["clock_counter"] == 7
    save_registry = mocks["persistence"].save_registry.call_args[0][0]
    assert save_registry[0]["key"] == "foo"
    assert save_registry[0]["string_value"] == "bar"


def test_apply_default_handles_int_directly():
    row = {"int_value": None, "string_value": None}
    MatchCommandService._apply_default(row, 42)
    assert row["int_value"] == 42


def test_apply_default_falls_back_to_string_for_unknown_types():
    row = {"int_value": None, "string_value": None}
    MatchCommandService._apply_default(row, ["nope"])
    assert row["string_value"] == "['nope']"


def test_happy_path_persists_creator_loadout():
    service, mocks = _build_service(
        user=_user(),
        story=_story(),
        difficulty=_difficulty(),
        locations=[{"id": 10, "uuid": "u", "counter_start": 0}],
        keys=[],
        saved_match=_saved(),
    )
    cmd = MatchCreateCommand(
        "u", "s", "d", "n", "ct",
        class_uuid="class-uuid", trait_uuids=["t1", "t2"], single_player=0,
    )
    service.create_match(cmd)

    saved_arg = mocks["persistence"].save_match.call_args[0][0]
    assert saved_arg["single_player"] == 0
    assert saved_arg["character_template_uuid"] == "ct"
    assert saved_arg["class_uuid"] == "class-uuid"
    assert saved_arg["trait_uuids"] == ["t1", "t2"]


def test_single_player_defaults_to_one_when_not_provided():
    service, mocks = _build_service(
        user=_user(),
        story=_story(),
        difficulty=_difficulty(),
        locations=[{"id": 10, "uuid": "u", "counter_start": 0}],
        keys=[],
        saved_match=_saved(),
    )
    service.create_match(MatchCreateCommand("u", "s", "d"))
    saved_arg = mocks["persistence"].save_match.call_args[0][0]
    assert saved_arg["single_player"] == 1
