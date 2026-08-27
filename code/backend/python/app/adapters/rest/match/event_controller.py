"""Step 29 / Step 32 — FastAPI controller for normal events and choice resolution.

  POST /api/gameplay/{uuid_match}/action/execute-event  -> 200 | 400 | 401 | 404 | 409
  POST /api/gameplay/{uuid_match}/action/select-choice  -> 200 | 400 | 401 | 404 | 409

Both live here because they are two halves of one transaction against one port: the first
opens a choice-event and pays for it, the second spends what was paid.

Whether an event can be triggered at all is already known to the client: every event on
GET /api/match/{uuid}/info carries an `available` flag and, when false, the same `reason`
this endpoint would return as its error code. The same holds for an option, whose
`available`/`reason` ride on the execute-event response that served it.
"""
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.models.match.event_models import (
    AppliedEffect, ChoiceResolutionResult, EntityChange, EventError,
    EventExecutionResult, LocationChange, RegistryChange, StatChange,
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
    EventError.NOT_ENOUGH_FOOD: 409,
    EventError.NOT_ENOUGH_MAGIC: 409,
    EventError.REGISTRY_CONDITION_NOT_MET: 409,
    EventError.WEATHER_CONDITION_NOT_MET: 409,
    EventError.ITEM_CONDITION_NOT_MET: 409,
    EventError.CLASS_CONDITION_NOT_MET: 409,
    # Step 32 — an unknown option is missing; the other two are states the player can
    # act on (open the event, or change the world) and retry, hence 409 and not 404.
    EventError.CHOICE_NOT_FOUND: 404,
    EventError.CHOICE_NOT_OPEN: 409,
    EventError.CHOICE_NOT_AVAILABLE: 409,
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
        # Step 31: APPLIED (effects ran) or CHOICES_PENDING (options in pendingChoices).
        "status": r.status,
        "card": r.card,
        "executedEventUuids": r.executed_event_uuids,
        "energySpent": r.energy_spent,
        "coinSpent": r.coin_spent,
        # v0.35.3 — the food and magic the event took, and the backpack after it.
        "foodSpent": r.food_spent,
        "magicSpent": r.magic_spent,
        "newEnergy": r.new_energy,
        "newCoin": r.new_coin,
        "newFood": r.new_food,
        "newMagic": r.new_magic,
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
        "edgeState": _edge_state_to_camel(r.edge_state),
    }


def _edge_state_to_camel(e) -> Optional[Dict[str, Any]]:
    """Step 30. The epilogue stays separate from the top-level events and effects."""
    if e is None:
        return None
    return {
        "sadnessOverflowUuids": list(e.sadness_overflow_uuids),
        "comaUuids": list(e.coma_uuids),
        "allPlayersInComa": e.all_players_in_coma,
        "comaEventUuid": e.coma_event_uuid,
        "comaEventCard": e.coma_event_card,
        "comaExecutedEventUuids": list(e.coma_executed_event_uuids),
        "comaEffects": [_effect_to_camel(x) for x in e.coma_effects],
    }


def _resolution_to_camel(r: ChoiceResolutionResult) -> dict:
    """The whole execute-event payload, plus what only a resolution knows.

    Same shape by construction, so the board runs one code path over both. `eventUuid`
    keeps its meaning — the event the payload is about — which here is the event that
    owned the option. `energySpent`/`coinSpent` are always 0: the open already paid.
    """
    body = _result_to_camel(r.execution)
    body.update({
        "choiceUuid": r.choice_uuid,
        "eventUuid": r.event_uuid,
        # Withheld by Step 31 (it would have leaked the consequence of a choice not yet
        # made), revealed now that the choice is irreversible.
        "narrative": r.narrative,
        "choiceCard": r.choice_card,
        "choiceEventUuid": r.choice_event_uuid,
        "choiceEventCard": r.choice_event_card,
        "progressRecorded": r.progress_recorded,
    })
    return body


class EventController:
    def __init__(self, event_port: EventPort):
        self.event_port = event_port
        self.router = APIRouter()
        self.router.add_api_route(
            "/api/gameplay/{uuid_match}/action/execute-event",
            self.execute_event, methods=["POST"],
        )
        self.router.add_api_route(
            "/api/gameplay/{uuid_match}/action/select-choice",
            self.select_choice, methods=["POST"],
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

    async def select_choice(self, uuid_match: str, request: Request, lang: str = "en"):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        try:
            body = await request.json()
        except Exception:
            body = {}
        choice_uuid = (body or {}).get("choiceUuid")
        if not choice_uuid or not str(choice_uuid).strip():
            return _error("MISSING_CHOICE", "choiceUuid is required", 400)
        try:
            result = self.event_port.select_choice(uuid_match, user_uuid, choice_uuid, lang)
        except EventError as exc:
            return _error(exc.code, exc.message, _STATUS_BY_CODE.get(exc.code, 409))
        return JSONResponse(status_code=200, content=_resolution_to_camel(result))
