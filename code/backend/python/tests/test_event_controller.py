"""Step 29 / Step 32 — tests for the FastAPI event controller."""
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.rest.match.event_controller import EventController
from app.core.models.match.event_models import (
    AppliedEffect, ChoiceResolutionResult, EntityChange, EventError,
    EventExecutionResult, LocationChange, RegistryChange, StatChange,
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
        movement_applied=True,
        refresh_recommended=True,
        stat_changes=[StatChange("char-1", "life", 30, 25, -5)],
        registry_changes=[RegistryChange("GATE", None, "OPEN")],
        item_changes=[EntityChange("char-1", "item-1", "ADD")],
        location_changes=[LocationChange("char-1", "loc-a", "loc-b")],
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
    assert body["status"] == "APPLIED"  # Step 31: the 0-choice flow
    assert body["executedEventUuids"] == ["evt-1", "evt-2"]
    assert body["energySpent"] == 3 and body["newCoin"] == 8
    assert body["turnConsumed"] is False  # v0.29.0 never touches the turn queue
    assert body["timeEnded"] is True and body["gameOver"] is True
    assert body["refreshRecommended"] is True
    assert body["statChanges"][0]["delta"] == -5
    assert body["registryChanges"][0]["newValue"] == "OPEN"
    assert body["itemChanges"][0]["itemUuid"] == "item-1"
    # v0.29.3 — forced movement travels as movementApplied + locationChanges.
    assert body["movementApplied"] is True
    assert body["locationChanges"] == [{"characterUuid": "char-1",
                                        "fromLocationUuid": "loc-a",
                                        "toLocationUuid": "loc-b"}]
    # The narrative is the EFFECT's card, not the event's.
    assert body["effects"][0]["card"]["title"] == "A wound"
    assert body["pendingChoices"] == []


def test_choices_pending_payload(env):
    # Step 31: a choice-event pays and presents — no effects, options with verdicts.
    client, port = env
    port.execute_event.return_value = EventExecutionResult(
        match_uuid="m1", event_uuid="evt-1", event_type="NORMAL",
        card={"title": "The Crossroads"},
        executed_event_uuids=["evt-1"],
        energy_spent=1, coin_spent=0, new_energy=19, new_coin=8, current_clock=5,
        status="CHOICES_PENDING",
        pending_choices=[
            {"uuid": "choice-1", "priority": 1, "name": "Gold Door",
             "description": "The shiny one.", "card": {"title": "Gold"},
             "available": True, "reason": None},
            {"uuid": "choice-2", "priority": 2, "name": "Runes",
             "description": "For prodigies.", "card": None,
             "available": False, "reason": "CONDITION_STATISTICS_NOT_MET"},
        ],
    )

    r = client.post(URL, json=BODY, headers=AUTH)

    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "CHOICES_PENDING"
    assert body["energySpent"] == 1
    assert body["effects"] == [] and body["statChanges"] == []
    first, second = body["pendingChoices"]
    assert first["uuid"] == "choice-1" and first["available"] is True
    assert first["name"] == "Gold Door" and first["card"]["title"] == "Gold"
    assert second["available"] is False
    assert second["reason"] == "CONDITION_STATISTICS_NOT_MET"


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
    EventError.SLEEPING, EventError.COMA,
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


# ── select-choice (Step 32) ─────────────────────────────────────────────────

CHOICE_URL = "/api/gameplay/m1/action/select-choice"
CHOICE_BODY = {"choiceUuid": "ch-1"}


def _resolution() -> ChoiceResolutionResult:
    return ChoiceResolutionResult(
        execution=_result(),
        choice_uuid="ch-1", event_uuid="evt-owner",
        narrative="You push the door open.",
        choice_card={"title": "Open the door"},
        choice_event_uuid="evt-linked",
        choice_event_card={"title": "Beyond the door"},
        progress_recorded=True,
    )


def test_select_choice_returns_the_execution_block_and_the_choice_fields(env):
    client, port = env
    port.select_choice.return_value = _resolution()

    r = client.post(CHOICE_URL, json=CHOICE_BODY, headers=AUTH)

    assert r.status_code == 200
    body = r.json()
    # the choice-specific block
    assert body["choiceUuid"] == "ch-1"
    assert body["eventUuid"] == "evt-owner"  # the event that OWNED the option
    assert body["narrative"] == "You push the door open."
    assert body["choiceCard"]["title"] == "Open the door"
    assert body["choiceEventUuid"] == "evt-linked"
    assert body["choiceEventCard"]["title"] == "Beyond the door"
    assert body["progressRecorded"] is True
    # …carried on top of the whole execute-event payload, so the board has one code path
    assert body["matchUuid"] == "m1"
    assert body["status"] == "APPLIED"
    assert body["statChanges"][0]["statistic"] == "life"
    assert body["registryChanges"][0]["key"] == "GATE"
    assert body["itemChanges"][0]["itemUuid"] == "item-1"
    assert body["locationChanges"][0]["toLocationUuid"] == "loc-b"
    assert body["effects"][0]["card"]["title"] == "A wound"
    assert body["edgeState"] is not None


def test_select_choice_passes_the_lang_through(env):
    client, port = env
    port.select_choice.return_value = _resolution()

    client.post(CHOICE_URL + "?lang=it", json=CHOICE_BODY, headers=AUTH)

    port.select_choice.assert_called_once_with("m1", "user-uuid", "ch-1", "it")


def test_select_choice_unauthenticated(env):
    client, _ = env
    r = client.post(CHOICE_URL, json=CHOICE_BODY)
    assert r.status_code == 401
    assert r.json()["error"] == "UNAUTHENTICATED"


@pytest.mark.parametrize("body", [{}, {"choiceUuid": "  "}])
def test_select_choice_missing_choice_uuid(env, body):
    client, _ = env
    r = client.post(CHOICE_URL, json=body, headers=AUTH)
    assert r.status_code == 400
    assert r.json()["error"] == "MISSING_CHOICE"


@pytest.mark.parametrize("code", [
    EventError.MATCH_NOT_FOUND, EventError.EVENT_NOT_FOUND, EventError.CHOICE_NOT_FOUND,
])
def test_select_choice_not_found_codes(env, code):
    client, port = env
    port.select_choice.side_effect = EventError(code, "nope")
    r = client.post(CHOICE_URL, json=CHOICE_BODY, headers=AUTH)
    assert r.status_code == 404
    assert r.json()["error"] == code


@pytest.mark.parametrize("code", [
    # Both Step 32 states are things the player can act on: open the event, or change the
    # world — never a missing entity, hence 409 and not 404.
    EventError.CHOICE_NOT_OPEN, EventError.CHOICE_NOT_AVAILABLE,
    EventError.MATCH_NOT_RUNNING, EventError.SLEEPING, EventError.COMA,
])
def test_select_choice_conflict_codes(env, code):
    client, port = env
    port.select_choice.side_effect = EventError(code, "nope")
    r = client.post(CHOICE_URL, json=CHOICE_BODY, headers=AUTH)
    assert r.status_code == 409
    assert r.json()["error"] == code


@pytest.mark.parametrize("url,error", [
    (URL, "MISSING_EVENT"),
    (CHOICE_URL, "MISSING_CHOICE"),
])
def test_malformed_body_reads_as_an_empty_one(env, url, error):
    """A body that is not JSON at all must not 500 — it is simply a request that named
    nothing, which is what the 400 already says."""
    client, _ = env
    r = client.post(url, content=b"not json", headers={**AUTH, "content-type": "application/json"})
    assert r.status_code == 400
    assert r.json()["error"] == error
