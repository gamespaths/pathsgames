"""Step 19 — FastAPI controller for the match endpoints."""
import time
from dataclasses import asdict
from typing import Optional

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.models.match.match_models import (
    MatchCreateCommand,
    MatchCreationError,
)
from app.core.ports.match.match_ports import MatchCommandPort, MatchQueryPort


_STATUS_BY_CODE = {
    MatchCreationError.INVALID_INPUT: status.HTTP_400_BAD_REQUEST,
    MatchCreationError.STORY_HAS_NO_LOCATIONS: status.HTTP_400_BAD_REQUEST,
    MatchCreationError.STORY_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    MatchCreationError.DIFFICULTY_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    MatchCreationError.USER_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    MatchCreationError.USER_BANNED: status.HTTP_403_FORBIDDEN,
    MatchCreationError.MAINTENANCE_MODE: status.HTTP_503_SERVICE_UNAVAILABLE,
}


class MatchCreateRequestBody(BaseModel):
    storyUuid: Optional[str] = None
    difficultyUuid: Optional[str] = None
    name: Optional[str] = None
    characterTemplateUuid: Optional[str] = None


def _error(code: str, message: str, http_status: int) -> JSONResponse:
    return JSONResponse(
        status_code=http_status,
        content={"error": code, "message": message, "timestamp": int(time.time() * 1000)},
    )


def _summary_to_camel(summary):
    return {
        "uuid": summary.uuid,
        "storyUuid": summary.story_uuid,
        "difficultyUuid": summary.difficulty_uuid,
        "name": summary.name,
        "status": summary.status,
        "currentClock": summary.current_clock,
        "expCost": summary.exp_cost,
        "userCreatorUuid": summary.user_creator_uuid,
        "tsInsert": summary.ts_insert,
    }


def _detail_to_camel(detail):
    return {
        "match": _summary_to_camel(detail.match),
        "currentLocationId": detail.current_location_id,
        "currentLocationUuid": detail.current_location_uuid,
        "currentLocationName": detail.current_location_name,
        "locations": [
            {
                "idLocation": l.id_location,
                "uuid": l.uuid,
                "flagAlreadyActived": l.flag_already_actived,
                "clockCounter": l.clock_counter,
                "name": l.name,
            }
            for l in detail.locations
        ],
        "registry": [
            {
                "uuid": r.uuid,
                "key": r.key,
                "stringValue": r.string_value,
                "intValue": r.int_value,
            }
            for r in detail.registry
        ],
        "events": [asdict(e) for e in detail.events],
        "choices": [asdict(c) for c in detail.choices],
    }


class MatchController:
    def __init__(self, command_port: MatchCommandPort, query_port: MatchQueryPort):
        self.command_port = command_port
        self.query_port = query_port
        self.router = APIRouter()
        self.router.add_api_route(
            "/api/matches", self.create_match, methods=["POST"]
        )
        self.router.add_api_route(
            "/api/matches", self.list_matches, methods=["GET"]
        )
        self.router.add_api_route(
            "/api/match/{uuid_match}/info", self.get_match_info, methods=["GET"]
        )

    def create_match(self, request: Request, body: Optional[MatchCreateRequestBody] = None):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        if body is None or not body.storyUuid or not body.difficultyUuid:
            return _error("INVALID_INPUT", "storyUuid and difficultyUuid are required", 400)
        command = MatchCreateCommand(
            user_uuid=user_uuid,
            story_uuid=body.storyUuid,
            difficulty_uuid=body.difficultyUuid,
            name=body.name,
            character_template_uuid=body.characterTemplateUuid,
        )
        try:
            summary = self.command_port.create_match(command)
        except MatchCreationError as exc:
            return _error(exc.code, exc.message, _STATUS_BY_CODE.get(exc.code, 400))
        return JSONResponse(status_code=201, content=_summary_to_camel(summary))

    def list_matches(self, request: Request):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        results = self.query_port.list_user_matches(user_uuid)
        return JSONResponse(status_code=200, content=[_summary_to_camel(s) for s in results])

    def get_match_info(self, uuid_match: str, request: Request):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        if not uuid_match:
            return _error("INVALID_INPUT", "Match uuid is required", 400)
        detail = self.query_port.get_match_info(uuid_match, user_uuid)
        if detail is None:
            return _error("MATCH_NOT_FOUND", "Match not found or not accessible", 404)
        return JSONResponse(status_code=200, content=_detail_to_camel(detail))
