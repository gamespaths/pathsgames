"""Step 21 — FastAPI controller for the character endpoints.

Reuses the camelCase presenters and ``_error`` helper from match_controller.
"""
from typing import List, Optional

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.adapters.rest.match.match_controller import (
    _character_full_to_camel,
    _character_summary_to_camel,
    _error,
)
from app.core.models.match.match_models import CharacterJoinError, JoinMatchCommand
from app.core.ports.match.match_ports import CharacterCommandPort, CharacterQueryPort


_STATUS_BY_CODE = {
    CharacterJoinError.INVALID_INPUT: status.HTTP_400_BAD_REQUEST,
    CharacterJoinError.MATCH_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    CharacterJoinError.TEMPLATE_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    CharacterJoinError.CLASS_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    CharacterJoinError.USER_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    CharacterJoinError.USER_BANNED: status.HTTP_403_FORBIDDEN,
    CharacterJoinError.ALREADY_JOINED: status.HTTP_409_CONFLICT,
    CharacterJoinError.CLASS_NOT_COMPATIBLE: status.HTTP_409_CONFLICT,
    CharacterJoinError.MATCH_NOT_JOINABLE: status.HTTP_409_CONFLICT,
    # Step 23 — trait selection validation
    CharacterJoinError.TRAIT_NOT_FOUND: status.HTTP_400_BAD_REQUEST,
    CharacterJoinError.TRAIT_DUPLICATED: status.HTTP_400_BAD_REQUEST,
    CharacterJoinError.TRAIT_NOT_COMPATIBLE: status.HTTP_400_BAD_REQUEST,
    CharacterJoinError.TRAIT_COST_EXCEEDED: status.HTTP_400_BAD_REQUEST,
    CharacterJoinError.TRAIT_NOT_SELECTABLE: status.HTTP_400_BAD_REQUEST,
}


class JoinMatchRequestBody(BaseModel):
    characterTemplateUuid: Optional[str] = None
    classUuid: Optional[str] = None
    traitUuids: Optional[List[str]] = None


class CharacterController:
    def __init__(self, command_port: CharacterCommandPort, query_port: CharacterQueryPort):
        self.command_port = command_port
        self.query_port = query_port
        self.router = APIRouter()
        self.router.add_api_route(
            "/api/matches/{uuid_match}/join", self.join, methods=["POST"]
        )
        self.router.add_api_route(
            "/api/match/{uuid_match}/players", self.list_players, methods=["GET"]
        )
        self.router.add_api_route(
            "/api/match/{uuid_match}/characters/{uuid_character}",
            self.get_character, methods=["GET"]
        )

    def join(self, uuid_match: str, request: Request,
             body: Optional[JoinMatchRequestBody] = None):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        if not uuid_match:
            return _error("INVALID_INPUT", "Match uuid is required", 400)
        command = JoinMatchCommand(
            match_uuid=uuid_match,
            user_uuid=user_uuid,
            character_template_uuid=body.characterTemplateUuid if body else None,
            class_uuid=body.classUuid if body else None,
            trait_uuids=(body.traitUuids if body and body.traitUuids else []),
        )
        try:
            created = self.command_port.join(command)
        except CharacterJoinError as exc:
            return _error(exc.code, exc.message, _STATUS_BY_CODE.get(exc.code, 400))
        return JSONResponse(status_code=201, content=_character_full_to_camel(created))

    def list_players(self, uuid_match: str, request: Request):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        if not uuid_match:
            return _error("INVALID_INPUT", "Match uuid is required", 400)
        players = self.query_port.list_players(uuid_match, user_uuid)
        if players is None:
            return _error("MATCH_NOT_FOUND", "Match not found or not accessible", 404)
        return JSONResponse(status_code=200,
                            content=[_character_summary_to_camel(p) for p in players])

    def get_character(self, uuid_match: str, uuid_character: str, request: Request):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        if not uuid_match or not uuid_character:
            return _error("INVALID_INPUT", "Match uuid and character uuid are required", 400)
        character = self.query_port.get_character(uuid_match, uuid_character, user_uuid)
        if character is None:
            return _error("CHARACTER_NOT_FOUND", "Character not found or not accessible", 404)
        return JSONResponse(status_code=200, content=_character_full_to_camel(character))
