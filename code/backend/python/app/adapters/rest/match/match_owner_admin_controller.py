"""v0.41.6 — admin User tab: GET the owner of a match and PUT ``{"user": "<uuid|email|username>"}`` to
move the match (creator and characters) to that user. Mirrors ``MatchOwnerAdminController.java``."""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body

from app.adapters.rest.match.match_controller import _error
from app.core.ports.match import match_owner_ports as op
from app.core.ports.match.match_owner_ports import MatchOwnerError, MatchOwnerPort


def owner_error(exc: MatchOwnerError):
    return _error(exc.code, exc.message, exc.http_status)


class MatchOwnerAdminController:

    def __init__(self, owner_service: MatchOwnerPort):
        self.owner_service = owner_service
        self.router = APIRouter()
        self.router.add_api_route("/api/admin/matches/{uuid_match}/owner", self.get_owner, methods=["GET"])
        self.router.add_api_route("/api/admin/matches/{uuid_match}/owner", self.move_owner, methods=["PUT"])

    def get_owner(self, uuid_match: str):
        try:
            return self.owner_service.owner(uuid_match).to_response(datetime.now(timezone.utc))
        except MatchOwnerError as exc:
            return owner_error(exc)

    def move_owner(self, uuid_match: str, body: Any = Body(None)):
        user = body.get("user") if isinstance(body, dict) else None
        if not isinstance(user, str) or not user.strip():
            return _error(op.INVALID_INPUT, "Field 'user' is required", 400)
        try:
            return self.owner_service.move(uuid_match, user).to_response()
        except MatchOwnerError as exc:
            return owner_error(exc)
