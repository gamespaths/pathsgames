"""Step 28 — FastAPI controller for the movement system.

Endpoints (player, Bearer access token):
  POST /api/gameplay/{uuid_match}/movements/start  -> 200 | 400 | 401 | 404 | 409
  GET  /api/match/{uuid_match}/locations            -> 200 | 401 | 404
"""
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.models.match import location_entry_models as lem
from app.core.models.match.movement_models import MovementError, MovementResult, VisitedLocation
from app.core.ports.match.movement_ports import MovementPort

_STATUS_BY_CODE = {
    MovementError.MATCH_NOT_FOUND: 404,
    MovementError.MATCH_NOT_RUNNING: 409,
    MovementError.CHARACTER_CANNOT_ACT: 409,
    MovementError.SLEEPING: 409,
    MovementError.COMA: 409,
    MovementError.NOT_A_NEIGHBOR: 409,
    MovementError.MOVEMENT_CONDITION_NOT_MET: 409,
    MovementError.OVERWEIGHT: 409,
    MovementError.INSUFFICIENT_ENERGY: 409,
    MovementError.NOT_ENOUGH_COINS: 409,
    MovementError.NOT_ENOUGH_FOOD: 409,
    MovementError.NOT_ENOUGH_MAGIC: 409,
    MovementError.LOCATION_FULL: 409,
}


def _error(code: str, message: str, http_status: int) -> JSONResponse:
    return JSONResponse(
        status_code=http_status,
        content={"error": code, "message": message, "timestamp": int(time.time() * 1000)},
    )


def _movement_to_camel(r: MovementResult) -> dict:
    return {
        "matchUuid": r.match_uuid,
        "characterUuid": r.character_uuid,
        "fromLocationId": r.from_location_id,
        "fromLocationUuid": r.from_location_uuid,
        "toLocationId": r.to_location_id,
        "toLocationUuid": r.to_location_uuid,
        "energySpent": r.energy_spent,
        # v0.35.3 — the edge's resource price, and the backpack after it.
        "foodSpent": r.food_spent,
        "magicSpent": r.magic_spent,
        "coinSpent": r.coin_spent,
        "newEnergy": r.new_energy,
        "newFood": r.new_food,
        "newMagic": r.new_magic,
        "newCoin": r.new_coin,
        "currentClock": r.current_clock,
        # Step 33 — what the destination did about the arrival. The board already has the
        # new location for its left page; these belong on the right.
        "automaticEvents": [lem.to_camel_automatic_event(f)
                            for f in (r.automatic_events or [])],
        # v0.35.6 — an arrival can kill: the Step 30 verdict of the whole move, in the very
        # shape execute-event answers, so the board reads a collapse the same way always.
        "edgeState": lem.to_camel_edge_state(r.edge_state),
    }


def _location_to_camel(loc: VisitedLocation) -> dict:
    return {
        "idLocation": loc.id_location,
        "uuid": loc.uuid,
        "idCard": loc.id_card,
        "card": loc.card,
        "safe": loc.safe,
        "characterCount": loc.character_count,
        "neighbors": [
            {
                "idLocation": n.id_location,
                "uuid": n.uuid,
                "direction": n.direction,
                "idLocationFrom": n.id_location_from,
                "idLocationTo": n.id_location_to,
                "idCard": n.id_card,
                "card": n.card,
                "baseEnergyCost": n.base_energy_cost,
                "entryEnergyCost": n.entry_energy_cost,
                "weatherEnergyCost": n.weather_energy_cost,
                "totalEnergyCost": n.total_energy_cost,
                # v0.35.3 — the edge's resource price; edge-only, so no breakdown.
                "costFood": n.cost_food,
                "costMagic": n.cost_magic,
                "costCoin": n.cost_coin,
                "conditionMet": n.condition_met,
            }
            for n in loc.neighbors
        ],
    }


def _locations_to_camel(match_uuid: str, locations) -> dict:
    return {"matchUuid": match_uuid, "locations": [_location_to_camel(l) for l in locations]}


class MovementController:
    def __init__(self, movement_port: MovementPort):
        self.movement_port = movement_port
        self.router = APIRouter()
        self.router.add_api_route(
            "/api/gameplay/{uuid_match}/movements/start", self.start_movement, methods=["POST"]
        )
        self.router.add_api_route(
            "/api/match/{uuid_match}/locations", self.locations, methods=["GET"]
        )

    async def start_movement(self, uuid_match: str, request: Request):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        try:
            body = await request.json()
        except Exception:
            body = {}
        target = (body or {}).get("targetLocationUuid")
        if not target:
            return _error("MISSING_TARGET", "targetLocationUuid is required", 400)
        try:
            result = self.movement_port.start_movement(uuid_match, user_uuid, target)
        except MovementError as exc:
            return _error(exc.code, exc.message, _STATUS_BY_CODE.get(exc.code, 400))
        return JSONResponse(status_code=200, content=_movement_to_camel(result))

    def locations(self, uuid_match: str, request: Request, lang: str = "en"):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        try:
            result = self.movement_port.list_locations(uuid_match, user_uuid, lang)
        except MovementError as exc:
            return _error(exc.code, exc.message, _STATUS_BY_CODE.get(exc.code, 400))
        return JSONResponse(status_code=200, content=_locations_to_camel(uuid_match, result))
