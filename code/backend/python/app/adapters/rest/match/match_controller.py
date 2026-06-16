"""Step 19 — FastAPI controller for the match endpoints."""
import time
from dataclasses import asdict
from typing import List, Optional

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
    MatchCreationError.TURNSTILE_VALIDATION_FAILED: status.HTTP_400_BAD_REQUEST,
    MatchCreationError.STORY_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    MatchCreationError.DIFFICULTY_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    MatchCreationError.USER_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    MatchCreationError.USER_BANNED: status.HTTP_403_FORBIDDEN,
    MatchCreationError.MAINTENANCE_MODE: status.HTTP_503_SERVICE_UNAVAILABLE,
    # Step 23 — trait selection validation on the creator loadout
    MatchCreationError.TRAIT_NOT_FOUND: status.HTTP_400_BAD_REQUEST,
    MatchCreationError.TRAIT_DUPLICATED: status.HTTP_400_BAD_REQUEST,
    MatchCreationError.TRAIT_NOT_COMPATIBLE: status.HTTP_400_BAD_REQUEST,
    MatchCreationError.TRAIT_COST_EXCEEDED: status.HTTP_400_BAD_REQUEST,
}


class MatchCreateRequestBody(BaseModel):
    storyUuid: Optional[str] = None
    difficultyUuid: Optional[str] = None
    name: Optional[str] = None
    characterTemplateUuid: Optional[str] = None
    classUuid: Optional[str] = None
    traitUuids: Optional[List[str]] = None
    singlePlayer: Optional[int] = None
    turnstileToken: Optional[str] = None


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
        "singlePlayer": summary.single_player,
        "characterTemplateUuid": summary.character_template_uuid,
        "classUuid": summary.class_uuid,
        "traitUuids": summary.trait_uuids,
    }


def _item_to_camel(it):
    """Step 27 — a single inventory item carried by a character."""
    return {
        "uuid": it.uuid,
        "itemUuid": it.item_uuid,
        "name": it.name,
        "weight": it.weight,
        "amount": it.amount,
        "state": it.state,
    }


def _character_summary_to_camel(p):
    """Step 21 — lightweight character row (players list / MatchInfo.players)."""
    return {
        "uuid": p.uuid,
        "userUuid": p.user_uuid,
        "characterTemplateUuid": p.character_template_uuid,
        "dexterity": p.dexterity,
        "intelligence": p.intelligence,
        "constitution": p.constitution,
        "energy": p.energy,
        "life": p.life,
        "sad": p.sad,
        # Step 27 — max statistics, carried weight and items list.
        "lifeMax": p.life_max,
        "energyMax": p.energy_max,
        "sadMax": p.sad_max,
        "weightMax": p.weight_max,
        "weight": p.weight,
        "items": [_item_to_camel(it) for it in p.items],
        "idLocation": p.id_location,
        "locationName": p.location_name,
        "isSleeping": p.is_sleeping,
        "isComa": p.is_coma,
    }


def _character_full_to_camel(p):
    """Step 21 — full character detail (join / character endpoint)."""
    return {
        "uuid": p.uuid,
        "matchUuid": p.match_uuid,
        "userUuid": p.user_uuid,
        "characterTemplateUuid": p.character_template_uuid,
        "classUuid": p.class_uuid,
        "dexterity": p.dexterity,
        "intelligence": p.intelligence,
        "constitution": p.constitution,
        "energy": p.energy,
        "life": p.life,
        "sad": p.sad,
        # Step 27 — max statistics, carried weight and items list.
        "lifeMax": p.life_max,
        "energyMax": p.energy_max,
        "sadMax": p.sad_max,
        "weightMax": p.weight_max,
        "weight": p.weight,
        "items": [_item_to_camel(it) for it in p.items],
        "idLocation": p.id_location,
        "locationUuid": p.location_uuid,
        "locationName": p.location_name,
        "isSleeping": p.is_sleeping,
        "isComa": p.is_coma,
        "traitUuids": list(p.trait_uuids),
        "food": p.food,
        "magic": p.magic,
        "coin": p.coin,
    }


def _location_info_to_camel(l):
    """Step 27.x — a player-occupied location with its card, neighbors and events."""
    return {
        "idLocation": l.id_location,
        "uuid": l.uuid,
        "card": l.card,
        "neighbors": [
            {
                "idLocation": n.id_location,
                "uuid": n.uuid,
                "direction": n.direction,
                "flagBack": n.flag_back,
                "energyCost": n.energy_cost,
                "card": n.card,
            }
            for n in l.neighbors
        ],
        "events": [
            {"uuid": e.uuid, "type": e.type, "card": e.card}
            for e in l.events
        ],
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
        "players": [_character_summary_to_camel(p) for p in detail.players],
        "locationsActive": [_location_info_to_camel(l) for l in detail.locations_active],
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
        self.router.add_api_route(
            "/api/match/{uuid_match}/end/{uuid_event}",
            self.end_match,
            methods=["PATCH"],
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
            class_uuid=body.classUuid,
            trait_uuids=body.traitUuids or [],
            single_player=body.singlePlayer,
            turnstile_token=body.turnstileToken,
            remote_ip=request.client.host if request.client else None,
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

    def end_match(self, uuid_match: str, uuid_event: str, request: Request):
        """Step 20.1 — PATCH /api/match/{uuid_match}/end/{uuid_event}.
        Completes a match when ``uuid_event`` matches the story's end-game event.
        Returns 406 when the event is not the end-game trigger."""
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        if not uuid_match or not uuid_event:
            return _error("INVALID_INPUT", "Match uuid and event uuid are required", 400)
        outcome = self.command_port.end_match(uuid_match, uuid_event, user_uuid)
        if outcome == "COMPLETED":
            return JSONResponse(status_code=200, content={"status": "ENDED", "uuid": uuid_match})
        if outcome == "NOT_ACCEPTABLE":
            return _error("EVENT_NOT_END_GAME",
                          "The supplied event is not the end-game event for this match", 406)
        return _error("MATCH_NOT_FOUND", "Match not found or not accessible", 404)
