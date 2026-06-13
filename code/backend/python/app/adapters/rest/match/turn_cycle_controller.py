"""Step 24 — FastAPI controller for the single-player turn cycle endpoints.

Endpoints (player, Bearer access token):
  POST /api/matches/{uuid_match}/start          -> 200 | 401 | 404 | 409
  POST /api/gameplay/{uuid_match}/action/pass   -> 200 | 401 | 404 | 409
  GET  /api/match/{uuid_match}/turn-sequence     -> 200 | 401 | 404
"""
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.models.match.turn_models import (
    PassResult,
    TurnCycleError,
    TurnSequenceResult,
)
from app.core.ports.match.turn_ports import TurnCyclePort

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


def _entry_to_camel(e) -> dict:
    return {
        "characterUuid": e.character_uuid,
        "idCharacter": e.id_character,
        "name": e.name,
        "priority": e.priority,
        "clock": e.clock,
        "status": e.status,
        "passCounter": e.pass_counter,
        "timestampStart": e.timestamp_start,
        "timestampEnd": e.timestamp_end,
    }


def _sequence_to_camel(r: TurnSequenceResult) -> dict:
    return {
        "matchUuid": r.match_uuid,
        "currentClock": r.current_clock,
        "status": r.status,
        "activeCharacterUuid": r.active_character_uuid,
        "queue": [_entry_to_camel(e) for e in r.queue],
    }


def _pass_to_camel(r: PassResult) -> dict:
    return {
        "matchUuid": r.match_uuid,
        "passedCharacterUuid": r.passed_character_uuid,
        "nextActiveCharacterUuid": r.next_active_character_uuid,
        "status": r.status,
    }


class TurnCycleController:
    def __init__(self, turn_cycle_port: TurnCyclePort):
        self.turn_cycle_port = turn_cycle_port
        self.router = APIRouter()
        self.router.add_api_route(
            "/api/matches/{uuid_match}/start", self.start, methods=["POST"]
        )
        self.router.add_api_route(
            "/api/gameplay/{uuid_match}/action/pass", self.pass_turn, methods=["POST"]
        )
        self.router.add_api_route(
            "/api/match/{uuid_match}/turn-sequence", self.turn_sequence, methods=["GET"]
        )

    def start(self, uuid_match: str, request: Request):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        try:
            result = self.turn_cycle_port.start_match(uuid_match, user_uuid)
        except TurnCycleError as exc:
            return _error(exc.code, exc.message, _STATUS_BY_CODE.get(exc.code, 400))
        return JSONResponse(status_code=200, content=_sequence_to_camel(result))

    def pass_turn(self, uuid_match: str, request: Request):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        try:
            result = self.turn_cycle_port.pass_turn(uuid_match, user_uuid)
        except TurnCycleError as exc:
            return _error(exc.code, exc.message, _STATUS_BY_CODE.get(exc.code, 400))
        return JSONResponse(status_code=200, content=_pass_to_camel(result))

    def turn_sequence(self, uuid_match: str, request: Request):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        try:
            result = self.turn_cycle_port.get_turn_sequence(uuid_match, user_uuid)
        except TurnCycleError as exc:
            return _error(exc.code, exc.message, _STATUS_BY_CODE.get(exc.code, 400))
        return JSONResponse(status_code=200, content=_sequence_to_camel(result))
