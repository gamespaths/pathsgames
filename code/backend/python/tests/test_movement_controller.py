"""Step 28 — tests for the FastAPI movement controller."""
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.rest.match.movement_controller import MovementController
from app.core.models.match.movement_models import (
    MovementError,
    MovementResult,
    NeighborCost,
    VisitedLocation,
)


@pytest.fixture()
def env():
    port = MagicMock()
    controller = MovementController(port)
    app = FastAPI()
    app.include_router(controller.router)

    @app.middleware("http")
    async def inject_user(request, call_next):
        if request.headers.get("x-user"):
            request.state.user_uuid = request.headers["x-user"]
        return await call_next(request)

    return TestClient(app), port


AUTH = {"x-user": "user-uuid"}


def test_start_unauthenticated(env):
    client, _ = env
    assert client.post("/api/gameplay/m1/movements/start",
                       json={"targetLocationUuid": "loc-2"}).status_code == 401


def test_start_missing_target(env):
    client, _ = env
    r = client.post("/api/gameplay/m1/movements/start", headers=AUTH, json={})
    assert r.status_code == 400
    assert r.json()["error"] == "MISSING_TARGET"


def test_start_success(env):
    client, port = env
    port.start_movement.return_value = MovementResult(
        "m1", "char-1", 1, None, 2, "loc-2", 6, 4, 3)
    r = client.post("/api/gameplay/m1/movements/start", headers=AUTH,
                    json={"targetLocationUuid": "loc-2"})
    assert r.status_code == 200
    body = r.json()
    assert body["toLocationUuid"] == "loc-2"
    assert body["energySpent"] == 6
    assert body["newEnergy"] == 4


def test_start_not_found(env):
    client, port = env
    port.start_movement.side_effect = MovementError(MovementError.MATCH_NOT_FOUND, "no")
    r = client.post("/api/gameplay/m1/movements/start", headers=AUTH,
                    json={"targetLocationUuid": "loc-2"})
    assert r.status_code == 404


def test_start_insufficient_energy(env):
    client, port = env
    port.start_movement.side_effect = MovementError(MovementError.INSUFFICIENT_ENERGY, "no")
    r = client.post("/api/gameplay/m1/movements/start", headers=AUTH,
                    json={"targetLocationUuid": "loc-2"})
    assert r.status_code == 409


def test_locations_unauthenticated(env):
    client, _ = env
    assert client.get("/api/match/m1/locations").status_code == 401


def test_locations_success(env):
    client, port = env
    loc_card = {"uuid": "card-1", "title": "Start", "urlImage": "http://img/1.jpg"}
    nb_card = {"uuid": "card-2", "title": "Center", "urlImage": "http://img/2.jpg"}
    port.list_locations.return_value = [
        VisitedLocation(1, "loc-1", 7, True, 1,
                        [NeighborCost(2, "loc-2", "NORTH", 1, 1, 2, 4, True,
                                      id_card=8, card=nb_card,
                                      id_location_from=2, id_location_to=1)],
                        card=loc_card)
    ]
    r = client.get("/api/match/m1/locations", headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    loc = body["locations"][0]
    assert loc["characterCount"] == 1
    assert loc["card"]["title"] == "Start"
    assert loc["card"]["urlImage"] == "http://img/1.jpg"
    nb = loc["neighbors"][0]
    # breakdown exposed: base 1 + entry 1 + weather 2 = total 4
    assert nb["baseEnergyCost"] == 1
    assert nb["entryEnergyCost"] == 1
    assert nb["weatherEnergyCost"] == 2
    assert nb["totalEnergyCost"] == 4
    assert nb["idCard"] == 8
    assert nb["card"]["title"] == "Center"
    # authored orientation: location 1 is the edge's `to`, so this entry is a return
    assert nb["idLocationFrom"] == 2
    assert nb["idLocationTo"] == 1


def test_locations_forwards_lang_param(env):
    client, port = env
    port.list_locations.return_value = []
    client.get("/api/match/m1/locations?lang=it", headers=AUTH)
    # controller passes lang through to the port
    assert port.list_locations.call_args.args[2] == "it"


def test_locations_not_found(env):
    client, port = env
    port.list_locations.side_effect = MovementError(MovementError.MATCH_NOT_FOUND, "no")
    r = client.get("/api/match/m1/locations", headers=AUTH)
    assert r.status_code == 404
