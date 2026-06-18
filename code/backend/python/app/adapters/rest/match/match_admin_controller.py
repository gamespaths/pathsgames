"""Admin-only match endpoints.

Extracted from ``match_controller`` (Step 20.x) so every ``/api/admin/**`` endpoint lives
in its own file and is mounted only on the dedicated admin app/port (default 8044). The
player match endpoints stay in ``MatchController`` on the public app/port.

The camelCase presenters (``_summary_to_camel`` / ``_detail_to_camel``) and ``_error`` are
reused from ``match_controller`` so admin and player responses keep an identical shape.
"""
from typing import Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.models.match import match_statuses
from app.core.ports.match.match_ports import MatchCommandPort, MatchQueryPort
from app.adapters.rest.match.match_controller import (
    _error,
    _summary_to_camel,
    _detail_to_camel,
)


class MatchUpdateRequestBody(BaseModel):
    """Body for PUT /api/admin/matches/{uuid}. Both fields optional."""
    status: Optional[str] = None
    name: Optional[str] = None


class MatchAdminController:
    def __init__(self, command_port: MatchCommandPort, query_port: MatchQueryPort):
        self.command_port = command_port
        self.query_port = query_port
        self.router = APIRouter()
        self.router.add_api_route(
            "/api/admin/matches", self.list_all_matches, methods=["GET"]
        )
        self.router.add_api_route(
            "/api/admin/matches/statuses", self.list_match_statuses, methods=["GET"]
        )
        self.router.add_api_route(
            "/api/admin/matches/{uuid_match}/info", self.get_admin_match_info, methods=["GET"]
        )
        self.router.add_api_route(
            "/api/admin/matches/{uuid_match}", self.update_match, methods=["PUT"]
        )
        self.router.add_api_route(
            "/api/admin/matches/{uuid_match}/stop", self.stop_match, methods=["POST"]
        )
        self.router.add_api_route(
            "/api/admin/matches/{uuid_match}/pause", self.pause_match, methods=["POST"]
        )
        self.router.add_api_route(
            "/api/admin/matches/{uuid_match}/resume", self.resume_match, methods=["POST"]
        )
        self.router.add_api_route(
            "/api/admin/matches/{uuid_match}", self.delete_match, methods=["DELETE"]
        )

    def list_all_matches(self):
        """GET /api/admin/matches — every match in the platform (admin view).
        The admin role is enforced by the JWT middleware for /api/admin/ paths."""
        results = self.query_port.list_all_matches()
        return JSONResponse(status_code=200, content=[_summary_to_camel(s) for s in results])

    def list_match_statuses(self):
        """GET /api/admin/matches/statuses — valid statuses, each flagged
        ``terminal`` when a match in that status is stopped (deletable)."""
        return JSONResponse(status_code=200, content=[
            {"value": s, "terminal": match_statuses.is_terminal(s)}
            for s in match_statuses.ALL
        ])

    def update_match(self, uuid_match: str, body: Optional[MatchUpdateRequestBody] = None):
        """PUT /api/admin/matches/{uuid} — update a match's status and/or name."""
        status_val = body.status if body else None
        name_val = body.name if body else None
        if status_val is None and name_val is None:
            return _error("INVALID_INPUT", "At least one of status or name must be provided", 400)
        return self._apply_update(uuid_match, status_val, name_val)

    def stop_match(self, uuid_match: str):
        return self._apply_update(uuid_match, match_statuses.ENDED, None)

    def pause_match(self, uuid_match: str):
        return self._apply_update(uuid_match, match_statuses.PAUSED, None)

    def resume_match(self, uuid_match: str):
        return self._apply_update(uuid_match, match_statuses.RUNNING, None)

    def delete_match(self, uuid_match: str):
        """DELETE /api/admin/matches/{uuid} — delete a stopped match."""
        outcome = self.command_port.delete_match(uuid_match)
        if outcome == "DELETED":
            return JSONResponse(status_code=200, content={"status": "DELETED", "uuid": uuid_match})
        if outcome == "NOT_STOPPED":
            return _error("MATCH_NOT_STOPPED",
                          "Only stopped matches (ENDED or GAMEOVER) can be deleted", 409)
        return _error("MATCH_NOT_FOUND", f"Match not found: {uuid_match}", 404)

    def get_admin_match_info(self, uuid_match: str):
        """GET /api/admin/matches/{uuid}/info — full match detail for the admin
        console, without the per-user ownership check."""
        detail = self.query_port.get_match_info_for_admin(uuid_match)
        if detail is None:
            return _error("MATCH_NOT_FOUND", f"Match not found: {uuid_match}", 404)
        return JSONResponse(status_code=200, content=_detail_to_camel(detail))

    def _apply_update(self, uuid_match: str, status_val, name_val):
        outcome = self.command_port.update_match(uuid_match, status_val, name_val)
        if outcome == "UPDATED":
            return JSONResponse(status_code=200, content={"status": "UPDATED", "uuid": uuid_match})
        if outcome == "INVALID_STATUS":
            return _error("INVALID_STATUS", f"status must be one of {match_statuses.ALL}", 400)
        return _error("MATCH_NOT_FOUND", f"Match not found: {uuid_match}", 404)
