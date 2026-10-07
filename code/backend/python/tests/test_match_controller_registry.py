"""Step 36 — GET /api/match/{uuid}/registry."""
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.rest.match.match_controller import MatchController


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

    return TestClient(app), query_port


AUTH = {"x-user": "user-uuid"}


def _groups():
    return [{
        "category": "tutorial",
        "entries": [{
            "uuid": "reg-1", "key": "tutorial_progress",
            "values": ["3"], "multi_value": False, "id_character": 12,
            "category": "tutorial", "visible": True, "priority": 1,
            "id_card": 950, "card": None,
        }],
    }]


def test_returns_the_groups_with_every_field_the_board_needs(env):
    client, query_port = env
    query_port.get_match_registry.return_value = _groups()

    body = client.get("/api/match/match-uuid/registry", headers=AUTH).json()

    entry = body["groups"][0]["entries"][0]
    assert body["groups"][0]["category"] == "tutorial"
    assert entry["key"] == "tutorial_progress"
    assert entry["values"] == ["3"] and entry["multiValue"] is False
    assert entry["visible"] is True and entry["priority"] == 1
    assert entry["idCharacter"] == 12 and entry["idCard"] == 950


def test_an_empty_registry_is_an_empty_array_never_a_missing_key(env):
    client, query_port = env
    query_port.get_match_registry.return_value = []

    response = client.get("/api/match/match-uuid/registry", headers=AUTH)

    assert response.status_code == 200
    assert response.json() == {"groups": []}


def test_include_hidden_defaults_to_false_and_is_forwarded(env):
    client, query_port = env
    query_port.get_match_registry.return_value = []

    client.get("/api/match/match-uuid/registry", headers=AUTH)
    query_port.get_match_registry.assert_called_with("match-uuid", "user-uuid", False, "en")

    client.get("/api/match/match-uuid/registry?includeHidden=true&lang=it", headers=AUTH)
    query_port.get_match_registry.assert_called_with("match-uuid", "user-uuid", True, "it")


def test_a_match_the_caller_does_not_own_reads_as_not_found(env):
    client, query_port = env
    query_port.get_match_registry.return_value = None

    response = client.get("/api/match/other-uuid/registry", headers=AUTH)

    assert response.status_code == 404
    assert response.json()["error"] == "MATCH_NOT_FOUND"


def test_no_authenticated_user_is_refused_and_the_port_is_never_asked(env):
    client, query_port = env

    response = client.get("/api/match/match-uuid/registry")

    assert response.status_code == 401
    assert response.json()["error"] == "UNAUTHENTICATED"
    query_port.get_match_registry.assert_not_called()
