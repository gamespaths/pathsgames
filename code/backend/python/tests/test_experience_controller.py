"""Step 38 — the FastAPI use-exp route."""
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.rest.match.experience_controller import ExperienceController
from app.core.ports.match.experience_ports import ExperienceError

USE = "/api/gameplay/m1/action/use-exp"
AUTH = {"x-user": "user-uuid"}


@pytest.fixture()
def env():
    port = MagicMock()
    app = FastAPI()
    app.include_router(ExperienceController(port).router)

    @app.middleware("http")
    async def inject_user(request, call_next):
        if request.headers.get("x-user"):
            request.state.user_uuid = request.headers["x-user"]
        return await call_next(request)

    return TestClient(app), port


def _result():
    return {"match_uuid": "m1", "character_uuid": "c1", "stat": "dex", "stat_before": 12,
            "stat_after": 13, "exp_before": 40, "exp_after": 28, "exp_cost": 12,
            "exp_costs": {"dex": 13, "int": None, "cos": 4},
            "stat_changes": [{"character_uuid": "c1", "statistic": "dex", "before": 12, "after": 13, "delta": 1},
                             {"character_uuid": "c1", "statistic": "exp", "before": 40, "after": 28, "delta": -12}]}


def test_ok(env):
    client, port = env
    port.use_exp.return_value = _result()
    resp = client.post(USE, json={"stat": "dex"}, headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert (body["matchUuid"], body["characterUuid"], body["stat"]) == ("m1", "c1", "dex")
    assert (body["statBefore"], body["statAfter"], body["expBefore"], body["expAfter"], body["expCost"]) == (12, 13, 40, 28, 12)
    assert body["expCosts"] == {"dex": 13, "int": None, "cos": 4}
    assert [c["statistic"] for c in body["statChanges"]] == ["dex", "exp"]
    assert body["statChanges"][1] == {"characterUuid": "c1", "statistic": "exp", "before": 40, "after": 28, "delta": -12}
    port.use_exp.assert_called_once_with("m1", "user-uuid", "dex")


def test_unauthenticated(env):
    client, port = env
    assert client.post(USE, json={"stat": "dex"}).status_code == 401
    port.use_exp.assert_not_called()


def test_missing_stat_is_400(env):
    client, port = env
    for body in ({}, {"stat": "  "}, None):
        resp = client.post(USE, json=body, headers=AUTH)
        assert resp.status_code == 400
        assert resp.json()["error"] == "INVALID_STAT"
    resp = client.post(USE, content=b"not json", headers={**AUTH, "content-type": "application/json"})
    assert resp.status_code == 400
    port.use_exp.assert_not_called()


@pytest.mark.parametrize("code, status", [
    ("MATCH_NOT_FOUND", 404), ("INVALID_STAT", 400), ("MATCH_NOT_RUNNING", 409), ("NOT_YOUR_TURN", 409),
    ("COMA", 409), ("SLEEPING", 409), ("LOCATION_NOT_SAFE", 409), ("MAX_STAT_VALUE", 409),
    ("NOT_ENOUGH_EXP", 409), ("SOMETHING_ELSE", 409),
])
def test_error_mapping(env, code, status):
    client, port = env
    port.use_exp.side_effect = ExperienceError(code, "boom")
    resp = client.post(USE, json={"stat": "life"}, headers=AUTH)
    assert resp.status_code == status
    assert resp.json() == {"error": code, "message": "boom", "timestamp": resp.json()["timestamp"]}
