"""Tests for the FastAPI match controller — Step 19."""
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.rest.match.match_controller import MatchController
from app.core.models.match.match_models import (
    EventInfo,
    LocationInfo,
    LocationNeighborInfo,
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
        single_player=1,
        character_template_uuid="ct",
        class_uuid="cl",
        trait_uuids=["t1", "t2"],
    )


def _detail():
    return MatchDetail(
        match=_summary(),
        current_location_id=10,
        current_location_uuid="loc-uuid",
        locations=[MatchLocationState(10, "ls", 0, 5)],
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
    assert body["singlePlayer"] == 1
    assert body["characterTemplateUuid"] == "ct"
    assert body["classUuid"] == "cl"
    assert body["traitUuids"] == ["t1", "t2"]


def test_create_match_passes_loadout_to_command(env):
    client, command_port, _ = env
    command_port.create_match.return_value = _summary()
    response = client.post(
        "/api/matches",
        headers={"x-user": "u"},
        json={
            "storyUuid": "s", "difficultyUuid": "d",
            "characterTemplateUuid": "ct", "classUuid": "cl",
            "traitUuids": ["t1", "t2"], "singlePlayer": 0,
        },
    )
    assert response.status_code == 201
    cmd = command_port.create_match.call_args[0][0]
    assert cmd.character_template_uuid == "ct"
    assert cmd.class_uuid == "cl"
    assert cmd.trait_uuids == ["t1", "t2"]
    assert cmd.single_player == 0


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


def test_get_match_info_serializes_locations_active(env):
    client, _, query_port = env
    detail = _detail()
    card = {"title": "Tavern", "description": "warm", "urlImage": "u", "awesomeIcon": "fa-x"}
    detail.locations_active = [
        LocationInfo(
            id_location=10,
            uuid="loc-10",
            card=card,
            neighbors=[LocationNeighborInfo(
                id_location=12, uuid="loc-12", direction="N",
                flag_back=0, energy_cost=2,
                card={"title": "Cave"},
                id_location_from=10, id_location_to=12,
                card_back={"title": "Cave Return"},
                card_location_from={"title": "Tavern"},
                card_location_to=None)],
            events=[EventInfo(uuid="evt-1", type="NORMAL", end_game=True, card={"title": "Stranger"})],
        )
    ]
    query_port.get_match_info.return_value = detail
    response = client.get("/api/match/abc/info", headers={"x-user": "u"})
    assert response.status_code == 200
    body = response.json()
    la = body["locationsActive"]
    assert len(la) == 1
    assert la[0]["idLocation"] == 10
    assert la[0]["card"]["title"] == "Tavern"
    assert la[0]["neighbors"][0]["idLocation"] == 12
    assert la[0]["neighbors"][0]["energyCost"] == 2
    assert la[0]["neighbors"][0]["card"]["title"] == "Cave"
    assert la[0]["neighbors"][0]["idLocationFrom"] == 10
    assert la[0]["neighbors"][0]["idLocationTo"] == 12
    assert la[0]["neighbors"][0]["cardBack"]["title"] == "Cave Return"
    # v0.28.6 — the LOCATION card of each endpoint, fog-gated per endpoint.
    assert la[0]["neighbors"][0]["cardLocationFrom"]["title"] == "Tavern"
    assert la[0]["neighbors"][0]["cardLocationTo"] is None
    # the synthetic names are gone from the contract
    assert "currentLocationName" not in body
    assert "name" not in body["locations"][0]
    assert "locationName" not in body["players"][0] if body.get("players") else True
    assert la[0]["events"][0]["uuid"] == "evt-1"
    assert la[0]["events"][0]["endGame"] is True
    assert la[0]["events"][0]["card"]["title"] == "Stranger"


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


# ── Step 20.1 — PATCH /api/match/{uuid_match}/end/{uuid_event} ──

def test_end_match_unauthenticated_returns_401(env):
    client, _, _ = env
    resp = client.patch("/api/match/m1/end/e1")
    assert resp.status_code == 401


def test_end_match_completed_returns_200(env):
    client, command_port, _ = env
    command_port.end_match.return_value = "COMPLETED"
    resp = client.patch("/api/match/m1/end/e1", headers={"x-user": "u"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ENDED"
    assert body["uuid"] == "m1"
    command_port.end_match.assert_called_once_with("m1", "e1", "u")


def test_end_match_not_acceptable_returns_406(env):
    client, command_port, _ = env
    command_port.end_match.return_value = "NOT_ACCEPTABLE"
    resp = client.patch("/api/match/m1/end/e1", headers={"x-user": "u"})
    assert resp.status_code == 406
    assert resp.json()["error"] == "EVENT_NOT_END_GAME"


def test_end_match_not_found_returns_404(env):
    client, command_port, _ = env
    command_port.end_match.return_value = "NOT_FOUND"
    resp = client.patch("/api/match/m1/end/e1", headers={"x-user": "u"})
    assert resp.status_code == 404
    assert resp.json()["error"] == "MATCH_NOT_FOUND"
