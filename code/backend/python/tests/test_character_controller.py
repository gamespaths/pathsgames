"""Tests for the Step 21 FastAPI character controller."""
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.rest.match.character_controller import CharacterController
from app.core.models.match.match_models import CharacterInstanceInfo, CharacterJoinError


@pytest.fixture()
def env():
    command_port = MagicMock()
    query_port = MagicMock()
    controller = CharacterController(command_port, query_port)
    app = FastAPI()
    app.include_router(controller.router)

    @app.middleware("http")
    async def inject_user(request, call_next):
        if request.headers.get("x-user"):
            request.state.user_uuid = request.headers["x-user"]
        return await call_next(request)

    return TestClient(app), command_port, query_port


def _info():
    return CharacterInstanceInfo(
        uuid="char-uuid", match_uuid="match-uuid", user_uuid="user-uuid",
        character_template_uuid="tpl", class_uuid="cls",
        dexterity=19, intelligence=18, constitution=19, energy=127, life=137, sad=0,
        life_max=137, energy_max=127, sad_max=8, weight_max=24, weight=0,
        id_location=90001, location_uuid="loc", location_name="location-90001",
        is_sleeping=0, is_coma=0, trait_uuids=["t1"], items=[], food=0, magic=0, coin=0,
    )


AUTH = {"x-user": "user-uuid"}


# ─── join ────────────────────────────────────────────────────────────────────

def test_join_unauthenticated(env):
    client, _, _ = env
    assert client.post("/api/matches/m1/join", json={}).status_code == 401


def test_join_success(env):
    client, command_port, _ = env
    command_port.join.return_value = _info()
    r = client.post("/api/matches/m1/join", headers=AUTH,
                    json={"characterTemplateUuid": "t", "classUuid": "c", "traitUuids": ["x"]})
    assert r.status_code == 201
    body = r.json()
    assert body["uuid"] == "char-uuid"
    assert body["life"] == 137
    # Step 27 — max stats, carried weight and items projected on the response
    assert body["lifeMax"] == 137
    assert body["energyMax"] == 127
    assert body["sadMax"] == 8
    assert body["weightMax"] == 24
    assert body["weight"] == 0
    assert body["items"] == []


def test_join_empty_body(env):
    client, command_port, _ = env
    command_port.join.return_value = _info()
    assert client.post("/api/matches/m1/join", headers=AUTH).status_code == 201


@pytest.mark.parametrize("code,expected", [
    (CharacterJoinError.MATCH_NOT_FOUND, 404),
    (CharacterJoinError.TEMPLATE_NOT_FOUND, 404),
    (CharacterJoinError.CLASS_NOT_FOUND, 404),
    (CharacterJoinError.USER_NOT_FOUND, 404),
    (CharacterJoinError.USER_BANNED, 403),
    (CharacterJoinError.ALREADY_JOINED, 409),
    (CharacterJoinError.CLASS_NOT_COMPATIBLE, 409),
    (CharacterJoinError.MATCH_NOT_JOINABLE, 409),
    (CharacterJoinError.INVALID_INPUT, 400),
])
def test_join_error_codes(env, code, expected):
    client, command_port, _ = env
    command_port.join.side_effect = CharacterJoinError(code, "x")
    assert client.post("/api/matches/m1/join", headers=AUTH, json={}).status_code == expected


# ─── players ──────────────────────────────────────────────────────────────────

def test_players_unauthenticated(env):
    client, _, _ = env
    assert client.get("/api/match/m1/players").status_code == 401


def test_players_ok(env):
    client, _, query_port = env
    query_port.list_players.return_value = [_info()]
    r = client.get("/api/match/m1/players", headers=AUTH)
    assert r.status_code == 200
    p = r.json()[0]
    assert p["uuid"] == "char-uuid"
    # Step 27 — players list carries the extended stat block
    assert p["lifeMax"] == 137
    assert p["energyMax"] == 127
    assert p["sadMax"] == 8
    assert p["weightMax"] == 24
    assert p["weight"] == 0
    assert p["items"] == []


def test_players_not_found(env):
    client, _, query_port = env
    query_port.list_players.return_value = None
    assert client.get("/api/match/m1/players", headers=AUTH).status_code == 404


# ─── character detail ──────────────────────────────────────────────────────────

def test_character_unauthenticated(env):
    client, _, _ = env
    assert client.get("/api/match/m1/characters/c1").status_code == 401


def test_character_ok(env):
    client, _, query_port = env
    query_port.get_character.return_value = _info()
    r = client.get("/api/match/m1/characters/c1", headers=AUTH)
    assert r.status_code == 200
    assert r.json()["uuid"] == "char-uuid"
    assert r.json()["traitUuids"] == ["t1"]


def test_character_not_found(env):
    client, _, query_port = env
    query_port.get_character.return_value = None
    assert client.get("/api/match/m1/characters/c1", headers=AUTH).status_code == 404
