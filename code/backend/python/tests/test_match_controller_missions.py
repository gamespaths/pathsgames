"""Step 37 — GET /api/match/{uuid}/missions and .../missions/{uuidMission}."""
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.rest.match.match_controller import MatchController


@pytest.fixture()
def env():
    query_port = MagicMock()
    controller = MatchController(MagicMock(), query_port)
    app = FastAPI()
    app.include_router(controller.router)

    @app.middleware("http")
    async def inject_user(request, call_next):
        if request.headers.get("x-user"):
            request.state.user_uuid = request.headers["x-user"]
        return await call_next(request)

    return TestClient(app), query_port


AUTH = {"x-user": "user-uuid"}


def _mission():
    return {"uuid": "m-1", "name": "Complete the Tutorial", "description": None,
            "status": "ACTIVE", "stepReached": 1, "stepsTotal": 2, "idCard": None,
            "card": None, "steps": [{"uuid": "s-1", "step": 1, "name": None,
                                     "description": None, "idCard": None, "card": None,
                                     "done": True}]}


def test_the_list_answers_with_the_missions_the_match_has_reached(env):
    client, query_port = env
    query_port.get_match_missions.return_value = [_mission()]

    r = client.get("/api/match/mu/missions", headers=AUTH)

    assert r.status_code == 200
    body = r.json()["missions"]
    assert body[0]["uuid"] == "m-1"
    assert body[0]["status"] == "ACTIVE"
    assert body[0]["steps"][0]["done"] is True
    query_port.get_match_missions.assert_called_once_with("mu", "user-uuid", None, "en")


def test_the_status_filter_and_the_language_reach_the_port_as_asked(env):
    client, query_port = env
    query_port.get_match_missions.return_value = []

    r = client.get("/api/match/mu/missions?status=COMPLETED&lang=it", headers=AUTH)

    assert r.status_code == 200
    assert r.json()["missions"] == []
    query_port.get_match_missions.assert_called_once_with("mu", "user-uuid", "COMPLETED", "it")


def test_detail_answers_with_one_mission_and_all_its_steps(env):
    client, query_port = env
    query_port.get_match_mission.return_value = _mission()

    r = client.get("/api/match/mu/missions/m-1", headers=AUTH)

    assert r.status_code == 200
    assert r.json()["stepsTotal"] == 2
    query_port.get_match_mission.assert_called_once_with("mu", "user-uuid", "m-1", "en")


def test_no_identity_on_the_request_is_401(env):
    client, _ = env
    assert client.get("/api/match/mu/missions").status_code == 401
    assert client.get("/api/match/mu/missions/m-1").status_code == 401


def test_a_match_nobody_may_see_reads_as_not_found(env):
    client, query_port = env
    query_port.get_match_missions.return_value = None
    query_port.get_match_mission.return_value = None

    r = client.get("/api/match/mu/missions", headers=AUTH)
    assert r.status_code == 404
    assert r.json()["error"] == "MATCH_NOT_FOUND"

    r = client.get("/api/match/mu/missions/m-1", headers=AUTH)
    assert r.status_code == 404


def test_a_blank_uuid_is_bad_input_not_a_missing_mission(env):
    client, query_port = env
    controller = MatchController(MagicMock(), query_port)
    request = MagicMock()
    request.state.user_uuid = "user-uuid"

    assert controller.get_match_missions("  ", request).status_code == 400
    assert controller.get_match_mission("mu", "  ", request).status_code == 400
