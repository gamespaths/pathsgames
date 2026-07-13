"""Step 29 — tests for the FastAPI event controller."""
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.rest.match.event_controller import EventController
from app.core.models.match.event_models import (
    AppliedEffect, EntityChange, EventError, EventExecutionResult, RegistryChange, StatChange,
)

URL = "/api/gameplay/m1/action/execute-event"
BODY = {"eventUuid": "evt-1"}
AUTH = {"x-user": "user-uuid"}


@pytest.fixture()
def env():
    port = MagicMock()
    app = FastAPI()
    app.include_router(EventController(port).router)

    @app.middleware("http")
    async def inject_user(request, call_next):
        if request.headers.get("x-user"):
            request.state.user_uuid = request.headers["x-user"]
        return await call_next(request)

    return TestClient(app), port


def _result() -> EventExecutionResult:
    return EventExecutionResult(
        match_uuid="m1", event_uuid="evt-1", event_type="ONCE",
        card={"title": "The Stranger"},
        executed_event_uuids=["evt-1", "evt-2"],
        energy_spent=3, coin_spent=2, new_energy=17, new_coin=8, current_clock=5,
        turn_consumed=False, time_ended=True, item_added=True, game_over=True,
        refresh_recommended=True,
        stat_changes=[StatChange("char-1", "life", 30, 25, -5)],
        registry_changes=[RegistryChange("GATE", None, "OPEN")],
        item_changes=[EntityChange("char-1", "item-1", "ADD")],
        effects=[AppliedEffect("evt-1", "eff-1", "life", -5, "ONLY_ONE", None,
                               ["char-1"], {"title": "A wound"})],
    )


def test_execute_event_returns_the_full_payload(env):
    client, port = env
    port.execute_event.return_value = _result()

    r = client.post(URL, json=BODY, headers=AUTH)

    assert r.status_code == 200
    body = r.json()
    assert body["eventUuid"] == "evt-1"
    assert body["eventType"] == "ONCE"
    assert body["executedEventUuids"] == ["evt-1", "evt-2"]
    assert body["energySpent"] == 3 and body["newCoin"] == 8
    assert body["turnConsumed"] is False  # v0.29.0 never touches the turn queue
    assert body["timeEnded"] is True and body["gameOver"] is True
    assert body["refreshRecommended"] is True
    assert body["statChanges"][0]["delta"] == -5
    assert body["registryChanges"][0]["newValue"] == "OPEN"
    assert body["itemChanges"][0]["itemUuid"] == "item-1"
    # The narrative is the EFFECT's card, not the event's.
    assert body["effects"][0]["card"]["title"] == "A wound"
    assert body["pendingChoices"] == []


def test_lang_is_forwarded(env):
    client, port = env
    port.execute_event.return_value = _result()

    client.post(URL + "?lang=it", json=BODY, headers=AUTH)

    port.execute_event.assert_called_once_with("m1", "user-uuid", "evt-1", "it")


def test_unauthenticated(env):
    client, _ = env
    r = client.post(URL, json=BODY)
    assert r.status_code == 401
    assert r.json()["error"] == "UNAUTHENTICATED"


@pytest.mark.parametrize("body", [{}, {"eventUuid": "  "}])
def test_missing_event_uuid(env, body):
    client, _ = env
    r = client.post(URL, json=body, headers=AUTH)
    assert r.status_code == 400
    assert r.json()["error"] == "MISSING_EVENT"


@pytest.mark.parametrize("code", [EventError.MATCH_NOT_FOUND, EventError.EVENT_NOT_FOUND])
def test_not_found_codes(env, code):
    client, port = env
    port.execute_event.side_effect = EventError(code, "nope")
    r = client.post(URL, json=BODY, headers=AUTH)
    assert r.status_code == 404
    assert r.json()["error"] == code


@pytest.mark.parametrize("code", [
    EventError.MATCH_NOT_RUNNING, EventError.CHARACTER_CANNOT_ACT,
    EventError.EVENT_NOT_EXECUTABLE_TYPE, EventError.ONCE_ALREADY_CONSUMED,
    EventError.WRONG_LOCATION, EventError.NOT_ENOUGH_ENERGY, EventError.NOT_ENOUGH_COINS,
    EventError.REGISTRY_CONDITION_NOT_MET, EventError.WEATHER_CONDITION_NOT_MET,
    EventError.ITEM_CONDITION_NOT_MET, EventError.CLASS_CONDITION_NOT_MET,
])
def test_conflict_codes(env, code):
    client, port = env
    port.execute_event.side_effect = EventError(code, "nope")
    r = client.post(URL, json=BODY, headers=AUTH)
    assert r.status_code == 409
    assert r.json()["error"] == code
