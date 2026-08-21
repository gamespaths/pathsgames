"""Steps 34 & 35 — FastAPI controller for the inventory and the resources.

  GET  /api/gameplay/{uuid_match}/inventory            -> 200 | 401 | 404
  POST /api/gameplay/{uuid_match}/inventory/use-item   -> 200 | 400 | 401 | 404 | 409
  POST /api/gameplay/{uuid_match}/inventory/drop-item  -> 200 | 400 | 401 | 404 | 409
  GET  /api/gameplay/{uuid_match}/resources            -> 200 | 401 | 404

use-item answers with the execute-event payload, because an item carrying a SADNESS effect
can trigger the step-30 overflow or coma and the frontend then reuses its event handler
almost unchanged. On an item usage `eventUuid` and `eventType` are null and `card` is the
item's own card.

Both request bodies name `itemInstanceUuid`: the uuid of the INVENTORY ROW
(`items[].uuid`), never the story item's `items[].itemUuid`.
"""
import time
from typing import Any, Dict, List

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.adapters.rest.match.event_controller import _result_to_camel
from app.core.models.match.match_models import ItemInstanceInfo
from app.core.ports.match.inventory_ports import InventoryError, InventoryPort

# Not-found for what does not exist; conflict for a state the player could act on.
_STATUS_BY_CODE = {
    InventoryError.MATCH_NOT_FOUND: 404,
    InventoryError.ITEM_NOT_FOUND: 404,
    InventoryError.MATCH_NOT_RUNNING: 409,
    InventoryError.SLEEPING: 409,
    InventoryError.COMA: 409,
    InventoryError.ITEM_NOT_CONSUMABLE: 409,
    InventoryError.ITEM_CLASS_NOT_PERMITTED: 409,
    InventoryError.ITEM_CLASS_PROHIBITED: 409,
}


def _error(code: str, message: str, http_status: int) -> JSONResponse:
    return JSONResponse(
        status_code=http_status,
        content={"error": code, "message": message, "timestamp": int(time.time() * 1000)},
    )


def item_to_camel(i: ItemInstanceInfo) -> Dict[str, Any]:
    """The one item shape, shared with the match /info players[] projection."""
    return {
        "uuid": i.uuid,
        "itemUuid": i.item_uuid,
        "name": i.name,
        "weight": i.weight,
        "amount": i.amount,
        "state": i.state,
        "idCard": i.id_card,
        "card": i.card,
        "isConsumabile": i.is_consumabile,
    }


def _inventory_to_camel(v: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "matchUuid": v["match_uuid"],
        "characterUuid": v["character_uuid"],
        "items": [item_to_camel(i) for i in v["items"]],
        "weight": v["weight"],
        "weightMax": v["weight_max"],
    }


def _drop_to_camel(v: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "matchUuid": v["match_uuid"],
        "characterUuid": v["character_uuid"],
        "itemInstanceUuid": v["item_instance_uuid"],
        "itemUuid": v["item_uuid"],
        "amountDropped": v["amount_dropped"],
        "weight": v["weight"],
        "weightMax": v["weight_max"],
        # Always true — the inventory and the carried weight both changed.
        "refreshRecommended": True,
    }


def _resources_to_camel(v: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "matchUuid": v["match_uuid"],
        "characterUuid": v["character_uuid"],
        "food": v["food"],
        "magic": v["magic"],
        # Singular, as everywhere in the API. react-game maps it to `coins`.
        "coin": v["coin"],
        "weight": v["weight"],
        "weightMax": v["weight_max"],
    }


class InventoryController:
    def __init__(self, inventory_port: InventoryPort):
        self.inventory_port = inventory_port
        self.router = APIRouter()
        self.router.add_api_route(
            "/api/gameplay/{uuid_match}/inventory", self.inventory, methods=["GET"])
        self.router.add_api_route(
            "/api/gameplay/{uuid_match}/inventory/use-item", self.use_item, methods=["POST"])
        self.router.add_api_route(
            "/api/gameplay/{uuid_match}/inventory/drop-item", self.drop_item, methods=["POST"])
        self.router.add_api_route(
            "/api/gameplay/{uuid_match}/resources", self.resources, methods=["GET"])

    async def inventory(self, uuid_match: str, request: Request, lang: str = "en"):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        try:
            view = self.inventory_port.list_inventory(uuid_match, user_uuid, lang)
        except InventoryError as exc:
            return _error(exc.code, exc.message, _STATUS_BY_CODE.get(exc.code, 409))
        return JSONResponse(status_code=200, content=_inventory_to_camel(view))

    async def use_item(self, uuid_match: str, request: Request, lang: str = "en"):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        item_uuid = await self._item_instance_uuid(request)
        if not item_uuid:
            return _error("MISSING_ITEM", "itemInstanceUuid is required", 400)
        try:
            result = self.inventory_port.use_item(uuid_match, user_uuid, item_uuid, lang)
        except InventoryError as exc:
            return _error(exc.code, exc.message, _STATUS_BY_CODE.get(exc.code, 409))
        return JSONResponse(status_code=200, content=_result_to_camel(result))

    async def drop_item(self, uuid_match: str, request: Request):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        item_uuid = await self._item_instance_uuid(request)
        if not item_uuid:
            return _error("MISSING_ITEM", "itemInstanceUuid is required", 400)
        try:
            view = self.inventory_port.drop_item(uuid_match, user_uuid, item_uuid)
        except InventoryError as exc:
            return _error(exc.code, exc.message, _STATUS_BY_CODE.get(exc.code, 409))
        return JSONResponse(status_code=200, content=_drop_to_camel(view))

    async def resources(self, uuid_match: str, request: Request):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        try:
            view = self.inventory_port.get_resources(uuid_match, user_uuid)
        except InventoryError as exc:
            return _error(exc.code, exc.message, _STATUS_BY_CODE.get(exc.code, 409))
        return JSONResponse(status_code=200, content=_resources_to_camel(view))

    @staticmethod
    async def _item_instance_uuid(request: Request):
        try:
            body = await request.json()
        except Exception:
            body = {}
        value = (body or {}).get("itemInstanceUuid")
        return value if value and str(value).strip() else None
