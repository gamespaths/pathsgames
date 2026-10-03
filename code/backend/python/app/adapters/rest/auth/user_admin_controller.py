"""v0.41.6 — GET /api/admin/users/{identifier}: one user by uuid, email or username (the owner-move
preview) with its eligibility; 404 USER_NOT_FOUND, 409 USER_AMBIGUOUS. Mirrors ``UserAdminController.java``."""
from datetime import datetime, timezone

from fastapi import APIRouter

from app.adapters.rest.match.match_owner_admin_controller import owner_error
from app.core.ports.match.match_owner_ports import MatchOwnerError, MatchOwnerPort


class UserAdminController:

    def __init__(self, owner_service: MatchOwnerPort):
        self.owner_service = owner_service
        self.router = APIRouter()
        self.router.add_api_route("/api/admin/users/{identifier}", self.get_user, methods=["GET"])

    def get_user(self, identifier: str):
        try:
            return self.owner_service.find_user(identifier).to_response(datetime.now(timezone.utc))
        except MatchOwnerError as exc:
            return owner_error(exc)
