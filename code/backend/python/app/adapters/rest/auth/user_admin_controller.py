"""v0.41.6 — GET /api/admin/users/{identifier}: one user by uuid, email or username (owner-move preview) with its
eligibility; v1.7.0 the paged list, the detail and the ban / suspend / unblock / relink / deletion actions."""
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Body, Request

from app.adapters.rest.match.match_controller import _error
from app.adapters.rest.match.match_owner_admin_controller import owner_error
from app.core.models.auth.user_admin import UserAdminError
from app.core.ports.match.match_owner_ports import MatchOwnerError, MatchOwnerPort


def _field(body: Any, name: str) -> Optional[str]:
    return body.get(name) if isinstance(body, dict) else None


class UserAdminController:

    def __init__(self, owner_service: MatchOwnerPort, user_admin_service=None):
        self.owner_service = owner_service
        self.user_admin = user_admin_service
        self.router = APIRouter()
        self.router.add_api_route("/api/admin/users", self.list_users, methods=["GET"])
        self.router.add_api_route("/api/admin/users/{identifier}", self.get_user, methods=["GET"])
        for action in ("ban", "suspend", "unblock", "relink-subject", "deletion"):
            self.router.add_api_route("/api/admin/users/{uuid}/" + action, self._action(action), methods=["POST"])

    def list_users(self, email: Optional[str] = None, nickname: Optional[str] = None, state: Optional[str] = None,
                   cursor: Optional[str] = None, limit: Optional[int] = None):
        try:
            return self.user_admin.list(email, nickname, state, cursor, limit).to_body()
        except UserAdminError as exc:
            return _error(exc.code, exc.message, exc.http_status)

    def get_user(self, identifier: str):
        try:
            user = self.owner_service.find_user(identifier)
        except MatchOwnerError as exc:
            return owner_error(exc)
        body = user.to_response(datetime.now(timezone.utc))
        detail = self.user_admin.detail(user.uuid) if self.user_admin is not None else None
        if detail is not None:
            body.update(detail.to_body())
        return body

    def _action(self, action: str):
        def run(uuid: str, request: Request, body: Any = Body(None)):
            admin_uuid = getattr(request.state, "user_uuid", None)
            reason = _field(body, "reason")
            try:
                if action == "ban":
                    result = self.user_admin.ban(admin_uuid, uuid, reason)
                elif action == "suspend":
                    result = self.user_admin.suspend(admin_uuid, uuid, _field(body, "until"), reason)
                elif action == "unblock":
                    result = self.user_admin.unblock(admin_uuid, uuid, reason)
                elif action == "relink-subject":
                    result = self.user_admin.relink_subject(admin_uuid, uuid, reason)
                else:
                    result = self.user_admin.delete_user(admin_uuid, uuid, reason)
            except UserAdminError as exc:
                return _error(exc.code, exc.message, exc.http_status)
            return result.to_body()
        run.__name__ = "user_" + action.replace("-", "_")
        return run
