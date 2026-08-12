"""Tests for MatchCommandService — Step 19."""
import pytest
from unittest.mock import MagicMock

from app.core.models.match.match_models import MatchCreateCommand, MatchCreationError
from app.core.ports.match.match_ports import TurnstileVerificationPort
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
    # v0.32.1 — no duplicate-match guard hit by default (a bare MagicMock would be truthy)
    persistence.has_active_match_for_story.return_value = False

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


def test_turnstile_rejected():
    class _RejectAll(TurnstileVerificationPort):
        def verify(self, token, remote_ip):
            return False

    story_read = MagicMock()
    persistence = MagicMock()
    user_access = MagicMock()
    system_mode = MagicMock()
    system_mode.is_maintenance.return_value = False
    strict = MatchCommandService(story_read, persistence, user_access, system_mode, _RejectAll())
    with pytest.raises(MatchCreationError) as exc:
        strict.create_match(MatchCreateCommand("u", "s", "d", turnstile_token="bad"))
    assert exc.value.code == MatchCreationError.TURNSTILE_VALIDATION_FAILED


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


def test_active_match_already_exists():
    """v0.32.1 — a non-terminal match on the same story blocks a second one."""
    service, mocks = _build_service(
        user=_user(),
        story=_story(),
        difficulty=_difficulty(),
        locations=[{"id": 10, "uuid": "loc", "counter_time": 0}],
        keys=[],
        saved_match=_saved(),
    )
    mocks["persistence"].has_active_match_for_story.return_value = True
    with pytest.raises(MatchCreationError) as exc:
        service.create_match(MatchCreateCommand("u", "s", "d"))
    assert exc.value.code == MatchCreationError.ACTIVE_MATCH_ALREADY_EXISTS
    # a rejected creation writes nothing
    mocks["persistence"].save_match.assert_not_called()


def test_active_match_guard_asks_for_created_running_and_paused():
    """v0.32.1 — the guard is called with user id, story id and the ACTIVE set."""
    service, mocks = _build_service(
        user=_user(),
        story=_story(),
        difficulty=_difficulty(),
        locations=[{"id": 10, "uuid": "loc", "counter_time": 0}],
        keys=[],
        saved_match=_saved(),
    )
    service.create_match(MatchCreateCommand("u", "s", "d"))
    args = mocks["persistence"].has_active_match_for_story.call_args[0]
    assert args[0] == 7
    assert args[1] == 2
    assert set(args[2]) == {"CREATED", "RUNNING", "PAUSED"}


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
        {"id": 10, "uuid": "loc-1", "counter_time": 5},
        {"id": 11, "uuid": "loc-2", "counter_time": None},
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
    # Step 33 — the fixture story authors no id_location_start, so nothing is pre-visited.
    assert [r["flag_visited"] for r in save_locations] == [0, 0]

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
        locations=[{"id": 10, "uuid": "u", "counter_time": 0}],
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
        locations=[{"id": 10, "uuid": "u", "counter_time": 0}],
        keys=[],
        saved_match=_saved(),
    )
    # Step 23 — loadout traits are validated at creation
    mocks["story_read"].find_class_by_uuid.return_value = {"id": 30, "uuid": "class-uuid"}
    mocks["story_read"].find_trait_by_uuid.side_effect = lambda sid, u: {
        "t1": {"id": 40, "uuid": "t1", "cost_positive": 1, "cost_negative": 0,
               "id_class_permitted": None, "id_class_prohibited": None},
        "t2": {"id": 41, "uuid": "t2", "cost_positive": 1, "cost_negative": 0,
               "id_class_permitted": None, "id_class_prohibited": None},
    }.get(u)
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
        locations=[{"id": 10, "uuid": "u", "counter_time": 0}],
        keys=[],
        saved_match=_saved(),
    )
    service.create_match(MatchCreateCommand("u", "s", "d"))
    saved_arg = mocks["persistence"].save_match.call_args[0][0]
    assert saved_arg["single_player"] == 1


# ── admin update / delete ─────────────────────────────────────────────────────

def test_update_match_valid_status_returns_updated():
    service, mocks = _build_service()
    mocks["persistence"].update_match_fields.return_value = True
    assert service.update_match("m1", "ENDED", "n") == "UPDATED"
    mocks["persistence"].update_match_fields.assert_called_once_with("m1", "ENDED", "n")


def test_update_match_invalid_status_returns_invalid():
    service, mocks = _build_service()
    assert service.update_match("m1", "BOGUS", None) == "INVALID_STATUS"
    mocks["persistence"].update_match_fields.assert_not_called()


def test_update_match_not_found():
    service, mocks = _build_service()
    mocks["persistence"].update_match_fields.return_value = False
    assert service.update_match("m1", None, "n") == "NOT_FOUND"


def test_delete_match_terminal_status_deletes():
    service, mocks = _build_service()
    mocks["persistence"].find_match_by_uuid.return_value = {"uuid": "m1", "status": "ENDED"}
    assert service.delete_match("m1") == "DELETED"
    mocks["persistence"].delete_match_by_uuid.assert_called_once_with("m1")


def test_delete_match_non_terminal_returns_not_stopped():
    service, mocks = _build_service()
    mocks["persistence"].find_match_by_uuid.return_value = {"uuid": "m1", "status": "RUNNING"}
    assert service.delete_match("m1") == "NOT_STOPPED"
    mocks["persistence"].delete_match_by_uuid.assert_not_called()


def test_delete_match_unknown_returns_not_found():
    service, mocks = _build_service()
    mocks["persistence"].find_match_by_uuid.return_value = None
    assert service.delete_match("m1") == "NOT_FOUND"


# ── Step 20.1 — player end match ─────────────────────────────────────────────

def _wire_owned_match(mocks, *, end_event_id=50):
    mocks["persistence"].find_match_by_uuid.return_value = {
        "uuid": "m1",
        "id_story": 2,
        "id_user_creator": 7,
        "status": "RUNNING",
    }
    mocks["user_access"].find_by_uuid.return_value = _user()
    mocks["story_read"].find_story_by_id.return_value = {
        "id": 2,
        "uuid": "story-uuid",
        "id_event_end_game": end_event_id,
    }


def test_end_match_blank_inputs_returns_not_found():
    service, _ = _build_service()
    assert service.end_match("", "ev", "u") == "NOT_FOUND"
    assert service.end_match("m", "", "u") == "NOT_FOUND"
    assert service.end_match("m", "ev", "") == "NOT_FOUND"


def test_end_match_unknown_match_returns_not_found():
    service, mocks = _build_service()
    mocks["persistence"].find_match_by_uuid.return_value = None
    assert service.end_match("m1", "ev", "u") == "NOT_FOUND"


def test_end_match_caller_not_owner_returns_not_found():
    service, mocks = _build_service()
    _wire_owned_match(mocks)
    mocks["user_access"].find_by_uuid.return_value = {"id": 999, "uuid": "intruder"}
    assert service.end_match("m1", "ev", "intruder") == "NOT_FOUND"
    mocks["persistence"].update_match_fields.assert_not_called()


def test_end_match_unknown_caller_returns_not_found():
    service, mocks = _build_service()
    _wire_owned_match(mocks)
    mocks["user_access"].find_by_uuid.return_value = None
    assert service.end_match("m1", "ev", "ghost") == "NOT_FOUND"


def test_end_match_story_missing_end_event_returns_not_acceptable():
    service, mocks = _build_service()
    _wire_owned_match(mocks, end_event_id=None)
    assert service.end_match("m1", "ev", "user-uuid") == "NOT_ACCEPTABLE"


def test_end_match_unknown_event_returns_not_acceptable():
    service, mocks = _build_service()
    _wire_owned_match(mocks)
    mocks["story_read"].find_event_by_story_id_and_uuid.return_value = None
    assert service.end_match("m1", "ev", "user-uuid") == "NOT_ACCEPTABLE"


def test_end_match_wrong_event_returns_not_acceptable():
    service, mocks = _build_service()
    _wire_owned_match(mocks)
    mocks["story_read"].find_event_by_story_id_and_uuid.return_value = {"id": 99, "uuid": "ev"}
    assert service.end_match("m1", "ev", "user-uuid") == "NOT_ACCEPTABLE"
    mocks["persistence"].update_match_fields.assert_not_called()


def test_end_match_completed_sets_status_ended():
    service, mocks = _build_service()
    _wire_owned_match(mocks)
    mocks["story_read"].find_event_by_story_id_and_uuid.return_value = {"id": 50, "uuid": "ev"}
    assert service.end_match("m1", "ev", "user-uuid") == "COMPLETED"
    mocks["persistence"].update_match_fields.assert_called_once_with("m1", "ENDED", None)


# ─── Step 23: creator loadout trait validation ──────────────────────────────


def _build_loadout_service(difficulty=None):
    service, mocks = _build_service(
        user=_user(),
        story=_story(),
        difficulty=difficulty or _difficulty(),
        locations=[{"id": 10, "uuid": "u", "counter_time": 0}],
        keys=[],
        saved_match=_saved(),
    )
    mocks["story_read"].find_class_by_uuid.return_value = {"id": 30, "uuid": "class-uuid"}
    return service, mocks


def _loadout_cmd(traits):
    return MatchCreateCommand("u", "s", "d", "n", "ct",
                              class_uuid="class-uuid", trait_uuids=traits, single_player=1)


def test_create_unknown_trait_not_found():
    service, mocks = _build_loadout_service()
    mocks["story_read"].find_trait_by_uuid.return_value = None

    with pytest.raises(MatchCreationError) as exc:
        service.create_match(_loadout_cmd(["ghost"]))
    assert exc.value.code == MatchCreationError.TRAIT_NOT_FOUND
    mocks["persistence"].save_match.assert_not_called()


def test_create_duplicated_trait():
    service, mocks = _build_loadout_service()
    mocks["story_read"].find_trait_by_uuid.return_value = {
        "id": 40, "uuid": "t1", "cost_positive": 1, "cost_negative": 0,
        "id_class_permitted": None, "id_class_prohibited": None}

    with pytest.raises(MatchCreationError) as exc:
        service.create_match(_loadout_cmd(["t1", "t1"]))
    assert exc.value.code == MatchCreationError.TRAIT_DUPLICATED


def test_create_prohibited_trait():
    service, mocks = _build_loadout_service()
    mocks["story_read"].find_trait_by_uuid.return_value = {
        "id": 40, "uuid": "t1", "cost_positive": 1, "cost_negative": 0,
        "id_class_permitted": None, "id_class_prohibited": 30}

    with pytest.raises(MatchCreationError) as exc:
        service.create_match(_loadout_cmd(["t1"]))
    assert exc.value.code == MatchCreationError.TRAIT_NOT_COMPATIBLE


def test_create_positive_budget_exceeded():
    difficulty = {**_difficulty(), "trait_cost_positive_budget": 1}
    service, mocks = _build_loadout_service(difficulty=difficulty)
    mocks["story_read"].find_trait_by_uuid.side_effect = lambda sid, u: {
        "t1": {"id": 40, "uuid": "t1", "cost_positive": 1, "cost_negative": 0,
               "id_class_permitted": None, "id_class_prohibited": None},
        "t2": {"id": 41, "uuid": "t2", "cost_positive": 1, "cost_negative": 0,
               "id_class_permitted": None, "id_class_prohibited": None},
    }.get(u)

    with pytest.raises(MatchCreationError) as exc:
        service.create_match(_loadout_cmd(["t1", "t2"]))
    assert exc.value.code == MatchCreationError.TRAIT_COST_EXCEEDED


def test_step33_the_starting_location_is_seeded_as_already_visited():
    """The party starts IN the start; it never enters it. Without this, walking BACK there
    would fire id_event_if_first_time and announce as a discovery the place the story
    opened in."""
    service, mocks = _build_service(
        user=_user(),
        story={"id": 2, "uuid": "story-uuid", "id_location_start": 11},
        difficulty=_difficulty(),
        locations=[{"id": 10, "uuid": "loc-1", "counter_time": 5},
                   {"id": 11, "uuid": "loc-2", "counter_time": None}],
        keys=[],
        saved_match=_saved(),
    )

    service.create_match(MatchCreateCommand("u", "s", "d", "n", "ct"))

    rows = mocks["persistence"].save_locations.call_args[0][0]
    by_location = {r["id_location"]: r["flag_visited"] for r in rows}
    assert by_location == {10: 0, 11: 1}
