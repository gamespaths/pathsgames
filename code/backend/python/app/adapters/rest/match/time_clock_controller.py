"""Step 25 — FastAPI controller for time advancement & clock cycle.

Endpoints (player, Bearer access token):
  POST /api/gameplay/{uuid_match}/action/sleep  -> 200 | 401 | 404 | 409
  GET  /api/match/{uuid_match}/clock             -> 200 | 401 | 404
"""
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.models.match import location_entry_models as lem
from app.core.models.match.time_models import ClockResult, SleepResult
from app.core.models.match.turn_models import TurnCycleError
from app.core.ports.match.time_ports import TimeAdvancementPort

# HTTP status per error code (mirrors the Java controller).
_STATUS_BY_CODE = {
    TurnCycleError.MATCH_NOT_FOUND: 404,
    TurnCycleError.MATCH_NOT_STARTABLE: 409,
    TurnCycleError.NO_CHARACTERS_JOINED: 409,
    TurnCycleError.MATCH_NOT_RUNNING: 409,
    TurnCycleError.NOT_YOUR_TURN: 409,
}


def _error(code: str, message: str, http_status: int) -> JSONResponse:
    return JSONResponse(
        status_code=http_status,
        content={"error": code, "message": message, "timestamp": int(time.time() * 1000)},
    )


def _sleep_to_camel(r: SleepResult) -> dict:
    return {
        "matchUuid": r.match_uuid,
        "characterUuid": r.character_uuid,
        "isSleeping": r.is_sleeping,
        "timeEndTriggered": r.time_end_triggered,
        "currentClock": r.current_clock,
        "recovery": [
            {
                "characterUuid": item.character_uuid,
                "energyDelta": item.energy_delta,
                "lifeDelta": item.life_delta,
                "sadDelta": item.sad_delta,
            }
            for item in (r.recovery or [])
        ],
        # Step 33 — what happened in the world while the party slept. A LIST: several
        # counters can run out on one time-start. Already filtered for this caller: `card`
        # is absent entirely when visibility is ANONYMOUS.
        "counterZero": [lem.to_camel_counter_zero(i) for i in (r.counter_zero or [])],
        # v0.35.6 — the recovery and the events a time-start fires can empty a life bar: the
        # verdict travels with the answer instead of surfacing as a flag on the next reload.
        "edgeState": lem.to_camel_edge_state(r.edge_state),
    }


def _clock_character_to_camel(c) -> dict:
    return {
        "characterUuid": c.character_uuid,
        "isSleeping": c.is_sleeping,
        "energy": c.energy,
    }


def _clock_to_camel(r: ClockResult) -> dict:
    return {
        "matchUuid": r.match_uuid,
        "currentClock": r.current_clock,
        "clockLabelSingular": r.clock_label_singular,
        "clockLabelPlural": r.clock_label_plural,
        "anyCharacterSleeping": r.any_character_sleeping,
        "characters": [_clock_character_to_camel(c) for c in r.characters],
    }


class TimeClockController:
    def __init__(self, time_advancement_port: TimeAdvancementPort):
        self.time_advancement_port = time_advancement_port
        self.router = APIRouter()
        self.router.add_api_route(
            "/api/gameplay/{uuid_match}/action/sleep", self.sleep, methods=["POST"]
        )
        self.router.add_api_route(
            "/api/match/{uuid_match}/clock", self.clock, methods=["GET"]
        )

    def sleep(self, uuid_match: str, request: Request):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        try:
            result = self.time_advancement_port.sleep(uuid_match, user_uuid)
        except TurnCycleError as exc:
            return _error(exc.code, exc.message, _STATUS_BY_CODE.get(exc.code, 400))
        return JSONResponse(status_code=200, content=_sleep_to_camel(result))

    def clock(self, uuid_match: str, request: Request):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        try:
            result = self.time_advancement_port.clock(uuid_match, user_uuid)
        except TurnCycleError as exc:
            return _error(exc.code, exc.message, _STATUS_BY_CODE.get(exc.code, 400))
        return JSONResponse(status_code=200, content=_clock_to_camel(result))
