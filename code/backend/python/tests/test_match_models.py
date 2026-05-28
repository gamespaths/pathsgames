"""Tests for Step 19 match domain models."""
from app.core.models.match.match_models import (
    MatchCreateCommand,
    MatchCreationError,
    MatchDetail,
    MatchEventOption,
    MatchLocationState,
    MatchRegistryEntry,
    MatchSummary,
)


def test_match_create_command_fields():
    cmd = MatchCreateCommand("u", "s", "d", "n", "ct")
    assert cmd.user_uuid == "u"
    assert cmd.story_uuid == "s"
    assert cmd.difficulty_uuid == "d"
    assert cmd.name == "n"
    assert cmd.character_template_uuid == "ct"


def test_match_create_command_defaults():
    cmd = MatchCreateCommand("u", "s", "d")
    assert cmd.name is None
    assert cmd.character_template_uuid is None
    assert cmd.class_uuid is None
    assert cmd.trait_uuids == []
    assert cmd.single_player is None


def test_match_summary_fields():
    s = MatchSummary("u", "s", "d", "name", "CREATED", 0, 5, "user", "ts")
    assert s.uuid == "u"
    assert s.status == "CREATED"
    assert s.exp_cost == 5
    assert s.trait_uuids == []


def test_match_create_command_loadout_fields():
    cmd = MatchCreateCommand(
        "u", "s", "d", "n", "ct",
        class_uuid="cl", trait_uuids=["t1", "t2"], single_player=0,
    )
    assert cmd.class_uuid == "cl"
    assert cmd.trait_uuids == ["t1", "t2"]
    assert cmd.single_player == 0


def test_match_summary_loadout_fields():
    s = MatchSummary(
        "u", "s", "d", "name", "CREATED", 0, 5, "user", "ts",
        single_player=1, character_template_uuid="ct",
        class_uuid="cl", trait_uuids=["t1"],
    )
    assert s.single_player == 1
    assert s.character_template_uuid == "ct"
    assert s.class_uuid == "cl"
    assert s.trait_uuids == ["t1"]


def test_match_detail_defaults():
    summary = MatchSummary("u", None, None, None, "CREATED", 0, 0, "uc", "ts")
    detail = MatchDetail(match=summary)
    assert detail.locations == []
    assert detail.registry == []
    assert detail.events == []
    assert detail.choices == []
    assert detail.current_location_id is None


def test_match_detail_with_collections():
    summary = MatchSummary("u", "s", "d", "n", "CREATED", 0, 5, "uc", "ts")
    loc = MatchLocationState(1, "lu", 0, 5, "loc")
    reg = MatchRegistryEntry("ru", "k", "v", 1)
    evt = MatchEventOption("e", "n", "EVENT")
    choice = MatchEventOption("c", "n", "CHOICE")
    detail = MatchDetail(
        match=summary,
        current_location_id=1,
        current_location_uuid="lu",
        current_location_name="loc-1",
        locations=[loc],
        registry=[reg],
        events=[evt],
        choices=[choice],
    )
    assert detail.locations[0].id_location == 1
    assert detail.registry[0].key == "k"
    assert detail.events[0].type == "EVENT"
    assert detail.choices[0].uuid == "c"


def test_match_creation_error_carries_code():
    err = MatchCreationError(MatchCreationError.STORY_NOT_FOUND, "msg")
    assert err.code == "STORY_NOT_FOUND"
    assert err.message == "msg"
    assert str(err) == "msg"
