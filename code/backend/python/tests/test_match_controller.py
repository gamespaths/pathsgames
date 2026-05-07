"""Tests for the FastAPI match controller — Step 19."""
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.rest.match.match_controller import MatchController
from app.core.models.match.match_models import (
    MatchCreationError,
    MatchDetail,
    MatchEventOption,
    MatchLocationState,
    MatchRegistryEntry,
    MatchSummary,
)


@pytest.fixture()
def env():
    command_port = MagicMock()
    query_port = MagicMock()
    controller = MatchController(command_port, query_port)
    app = FastAPI()
    app.include_router(controller.router)

    @app.middleware("http")
    async def inject_user(request, call_next):
        if request.headers.get("x-user"):
            request.state.user_uuid = request.headers["x-user"]
        return await call_next(request)

    return TestClient(app), command_port, query_port


def _summary():
    return MatchSummary(
        uuid="match-uuid",
        story_uuid="story-uuid",
        difficulty_uuid="diff-uuid",
        name="n",
        status="CREATED",
        current_clock=0,
        exp_cost=5,
        user_creator_uuid="user-uuid",
        ts_insert="now",
    )


def _detail():
    return MatchDetail(
        match=_summary(),
        current_location_id=10,
        current_location_uuid="loc-uuid",
        current_location_name="loc",
        locations=[MatchLocationState(10, "ls", 0, 5, "loc")],
        registry=[MatchRegistryEntry("r", "k", "v", 1)],
        events=[MatchEventOption("e", "n", "EVENT")],
        choices=[MatchEventOption("c", "n", "CHOICE")],
    )


def test_create_match_unauthenticated(env):
    client, _, _ = env
    response = client.post("/api/matches", json={"storyUuid": "s", "difficultyUuid": "d"})
    assert response.status_code == 401


def test_create_match_missing_body(env):
    client, _, _ = env
    response = client.post("/api/matches", headers={"x-user": "u"})
    assert response.status_code == 400


def test_create_match_missing_story(env):
    client, _, _ = env
    response = client.post(
        "/api/matches",
        headers={"x-user": "u"},
        json={"difficultyUuid": "d"},
    )
    assert response.status_code == 400


def test_create_match_missing_difficulty(env):
    client, _, _ = env
    response = client.post(
        "/api/matches",
        headers={"x-user": "u"},
        json={"storyUuid": "s"},
    )
    assert response.status_code == 400


def test_create_match_success(env):
    client, command_port, _ = env
    command_port.create_match.return_value = _summary()
    response = client.post(
        "/api/matches",
        headers={"x-user": "u"},
        json={"storyUuid": "s", "difficultyUuid": "d", "name": "n"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["uuid"] == "match-uuid"
    assert body["storyUuid"] == "story-uuid"


@pytest.mark.parametrize(
    "code,expected_status",
    [
        (MatchCreationError.STORY_NOT_FOUND, 404),
        (MatchCreationError.DIFFICULTY_NOT_FOUND, 404),
        (MatchCreationError.USER_NOT_FOUND, 404),
        (MatchCreationError.USER_BANNED, 403),
        (MatchCreationError.MAINTENANCE_MODE, 503),
        (MatchCreationError.STORY_HAS_NO_LOCATIONS, 400),
        (MatchCreationError.INVALID_INPUT, 400),
    ],
)
def test_create_match_error_codes(env, code, expected_status):
    client, command_port, _ = env
    command_port.create_match.side_effect = MatchCreationError(code, "msg")
    response = client.post(
        "/api/matches",
        headers={"x-user": "u"},
        json={"storyUuid": "s", "difficultyUuid": "d"},
    )
    assert response.status_code == expected_status
    assert response.json()["error"] == code


def test_create_match_unknown_error_code(env):
    client, command_port, _ = env
    command_port.create_match.side_effect = MatchCreationError("UNKNOWN_CODE", "msg")
    response = client.post(
        "/api/matches",
        headers={"x-user": "u"},
        json={"storyUuid": "s", "difficultyUuid": "d"},
    )
    assert response.status_code == 400


def test_list_matches_unauthenticated(env):
    client, _, _ = env
    response = client.get("/api/matches")
    assert response.status_code == 401


def test_list_matches_returns_list(env):
    client, _, query_port = env
    query_port.list_user_matches.return_value = [_summary()]
    response = client.get("/api/matches", headers={"x-user": "u"})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["uuid"] == "match-uuid"


def test_get_match_info_unauthenticated(env):
    client, _, _ = env
    response = client.get("/api/match/abc/info")
    assert response.status_code == 401


def test_get_match_info_not_found(env):
    client, _, query_port = env
    query_port.get_match_info.return_value = None
    response = client.get("/api/match/abc/info", headers={"x-user": "u"})
    assert response.status_code == 404


def test_get_match_info_success(env):
    client, _, query_port = env
    query_port.get_match_info.return_value = _detail()
    response = client.get("/api/match/abc/info", headers={"x-user": "u"})
    assert response.status_code == 200
    body = response.json()
    assert body["match"]["uuid"] == "match-uuid"
    assert body["currentLocationId"] == 10
    assert body["locations"][0]["uuid"] == "ls"
    assert body["registry"][0]["key"] == "k"
    assert body["events"][0]["uuid"] == "e"
    assert body["choices"][0]["uuid"] == "c"


def test_get_match_info_blank_uuid_directly():
    """The empty-uuid branch is unreachable via FastAPI routing, so we
    invoke the controller method directly to keep branch coverage at 100%."""
    command_port = MagicMock()
    query_port = MagicMock()
    controller = MatchController(command_port, query_port)

    class _State:
        user_uuid = "u"

    class _Request:
        state = _State()

    response = controller.get_match_info("", _Request())
    assert response.status_code == 400
