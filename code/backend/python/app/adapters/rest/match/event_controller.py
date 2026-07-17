"""Step 29 — FastAPI controller for normal (player-triggered) events.

  POST /api/gameplay/{uuid_match}/action/execute-event  -> 200 | 400 | 401 | 404 | 409

Whether an event can be triggered at all is already known to the client: every event on
GET /api/match/{uuid}/info carries an `available` flag and, when false, the same `reason`
this endpoint would return as its error code.
"""
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.models.match.event_models import (
    AppliedEffect, EntityChange, EventError, EventExecutionResult, LocationChange,
    RegistryChange, StatChange,
)
from app.core.ports.match.event_ports import EventPort

# Not-found for what does not exist; conflict for a state the player could act on.
_STATUS_BY_CODE = {
    EventError.MATCH_NOT_FOUND: 404,
    EventError.EVENT_NOT_FOUND: 404,
    EventError.MATCH_NOT_RUNNING: 409,
    EventError.CHARACTER_CANNOT_ACT: 409,
    EventError.SLEEPING: 409,
    EventError.COMA: 409,
    EventError.EVENT_NOT_EXECUTABLE_TYPE: 409,
    EventError.ONCE_ALREADY_CONSUMED: 409,
    EventError.WRONG_LOCATION: 409,
    EventError.NOT_ENOUGH_ENERGY: 409,
    EventError.NOT_ENOUGH_COINS: 409,
    EventError.REGISTRY_CONDITION_NOT_MET: 409,
    EventError.WEATHER_CONDITION_NOT_MET: 409,
    EventError.ITEM_CONDITION_NOT_MET: 409,
    EventError.CLASS_CONDITION_NOT_MET: 409,
}


def _error(code: str, message: str, http_status: int) -> JSONResponse:
    return JSONResponse(
        status_code=http_status,
        content={"error": code, "message": message, "timestamp": int(time.time() * 1000)},
    )


def _stat_to_camel(c: StatChange) -> dict:
    return {"characterUuid": c.character_uuid, "statistic": c.statistic,
            "before": c.before, "after": c.after, "delta": c.delta}


def _registry_to_camel(c: RegistryChange) -> dict:
    return {"key": c.key, "oldValue": c.old_value, "newValue": c.new_value}


def _entity_to_camel(c: EntityChange, value_key: str) -> dict:
    return {"characterUuid": c.character_uuid, value_key: c.value, "action": c.action}


def _location_to_camel(c: LocationChange) -> dict:
    return {"characterUuid": c.character_uuid,
            "fromLocationUuid": c.from_location_uuid,
            "toLocationUuid": c.to_location_uuid}


def _effect_to_camel(e: AppliedEffect) -> dict:
    return {
        "eventUuid": e.event_uuid,
        "effectUuid": e.effect_uuid,
        "statistic": e.statistic,
        "value": e.value,
        "target": e.target,
        "targetClass": e.target_class,
        "characterUuids": e.character_uuids,
        # The effect's OWN card is the narrative to render — not the event's.
        "card": e.card,
    }


def _result_to_camel(r: EventExecutionResult) -> dict:
    return {
        "matchUuid": r.match_uuid,
        "eventUuid": r.event_uuid,
        "eventType": r.event_type,
        "card": r.card,
        "executedEventUuids": r.executed_event_uuids,
        "energySpent": r.energy_spent,
        "coinSpent": r.coin_spent,
        "newEnergy": r.new_energy,
        "newCoin": r.new_coin,
        "currentClock": r.current_clock,
        "turnConsumed": r.turn_consumed,
        "timeEnded": r.time_ended,
        "itemAdded": r.item_added,
        "itemRemoved": r.item_removed,
        "weatherApplied": r.weather_applied,
        "movementApplied": r.movement_applied,
        "forcedSleep": r.forced_sleep,
        "comaTriggered": r.coma_triggered,
        "gameOver": r.game_over,
        "refreshRecommended": r.refresh_recommended,
        "statChanges": [_stat_to_camel(c) for c in r.stat_changes],
        "registryChanges": [_registry_to_camel(c) for c in r.registry_changes],
        "traitChanges": [_entity_to_camel(c, "traitUuid") for c in r.trait_changes],
        "itemChanges": [_entity_to_camel(c, "itemUuid") for c in r.item_changes],
        "characteristicChanges": [
            _entity_to_camel(c, "characteristic") for c in r.characteristic_changes
        ],
        "locationChanges": [_location_to_camel(c) for c in r.location_changes],
        "effects": [_effect_to_camel(e) for e in r.effects],
        "pendingChoices": r.pending_choices,
    }


class EventController:
    def __init__(self, event_port: EventPort):
        self.event_port = event_port
        self.router = APIRouter()
        self.router.add_api_route(
            "/api/gameplay/{uuid_match}/action/execute-event",
            self.execute_event, methods=["POST"],
        )

    async def execute_event(self, uuid_match: str, request: Request, lang: str = "en"):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        try:
            body = await request.json()
        except Exception:
            body = {}
        event_uuid = (body or {}).get("eventUuid")
        if not event_uuid or not str(event_uuid).strip():
            return _error("MISSING_EVENT", "eventUuid is required", 400)
        try:
            result = self.event_port.execute_event(uuid_match, user_uuid, event_uuid, lang)
        except EventError as exc:
            return _error(exc.code, exc.message, _STATUS_BY_CODE.get(exc.code, 409))
        return JSONResponse(status_code=200, content=_result_to_camel(result))
