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
from app.core.models.match.match_models import MatchListFilter
from app.core.ports.match.match_ports import CharacterCommandPort, MatchCommandPort, MatchQueryPort
from app.adapters.rest.match.match_controller import (
    _error,
    _summary_to_camel,
    _detail_to_camel,
)


class MatchUpdateRequestBody(BaseModel):
    """Body for PUT /api/admin/matches/{uuid}. Both fields optional."""
    status: Optional[str] = None
    name: Optional[str] = None


class ChangeStatisticsRequestBody(BaseModel):
    """Body for POST /api/admin/matches/{uuid}/player/{uuid}/changeStatistics.
    Fields omitted or set to -1 are skipped."""
    dex:    Optional[int] = None
    intel:  Optional[int] = None
    con:    Optional[int] = None
    energy: Optional[int] = None
    life:   Optional[int] = None
    sad:    Optional[int] = None
    coin:   Optional[int] = None
    food:   Optional[int] = None
    magic:  Optional[int] = None
    # State flags: omitted (null) means "leave as it is" — the -1 of the numeric fields.
    sleeping: Optional[bool] = None
    coma:     Optional[bool] = None


class MatchAdminController:
    def __init__(self, command_port: MatchCommandPort, query_port: MatchQueryPort,
                 character_command_port: Optional[CharacterCommandPort] = None,
                 weather_service=None, movement_service=None, match_logs_service=None):
        self.command_port = command_port
        self.query_port = query_port
        self.character_command_port = character_command_port
        # Step 27 — weather admin view (rng_seed + current + log_weather).
        self.weather_service = weather_service
        # Step 28 — movement admin view (visited locations + total energy cost).
        self.movement_service = movement_service
        # Step 28.7 — match logs timeline.
        self.match_logs_service = match_logs_service
        self.router = APIRouter()
        self.router.add_api_route(
            "/api/admin/matches", self.list_all_matches, methods=["GET"]
        )
        self.router.add_api_route(
            "/api/admin/matches/{uuid_match}/weather", self.get_admin_match_weather, methods=["GET"]
        )
        self.router.add_api_route(
            "/api/admin/matches/{uuid_match}/logs", self.get_admin_match_logs, methods=["GET"]
        )
        self.router.add_api_route(
            "/api/admin/matches/{uuid_match}/locations", self.get_admin_match_locations, methods=["GET"]
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
        self.router.add_api_route(
            "/api/admin/matches/{uuid_match}/player/{uuid_player}/changeStatistics",
            self.change_statistics, methods=["POST"],
        )

    def list_all_matches(self, limit: Optional[int] = None, cursor: Optional[str] = None,
                         status: Optional[str] = None, userUuid: Optional[str] = None,
                         storyUuid: Optional[str] = None, sinceDays: Optional[int] = None):
        """GET /api/admin/matches — paginated, filterable list of matches (v0.28.1).

        Returns a ``{items, nextCursor, limit}`` envelope so the console never reads
        the whole table. Query params (all optional): ``limit`` (default 50, max 200),
        ``cursor`` (opaque token), ``status``, ``userUuid``, ``storyUuid``,
        ``sinceDays`` (last N days). The admin role is enforced by the JWT middleware
        for /api/admin/ paths."""
        page = self.query_port.list_matches_page(MatchListFilter(
            status=status, user_uuid=userUuid, story_uuid=storyUuid,
            since_days=sinceDays, cursor=cursor, limit=limit,
        ))
        return JSONResponse(status_code=200, content={
            "items": [_summary_to_camel(s) for s in page.items],
            "nextCursor": page.next_cursor,
            "limit": page.limit,
        })

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

    def get_admin_match_locations(self, uuid_match: str, lang: str = "en"):
        """GET /api/admin/matches/{uuid}/locations — visited locations with the
        per-neighbor totalEnergyCost, character counts and resolved cards
        (Step 28). No ownership check; mirrors the player endpoint
        GET /api/match/{uuid}/locations."""
        from app.core.models.match.movement_models import MovementError
        from app.adapters.rest.match.movement_controller import _locations_to_camel
        if not uuid_match or not uuid_match.strip():
            return _error("INVALID_INPUT", "Match uuid is required", 400)
        if self.movement_service is None:
            return _error("NOT_IMPLEMENTED", "Movement service not wired", 501)
        try:
            locations = self.movement_service.list_locations_for_admin(uuid_match, lang)
        except MovementError as exc:
            return _error(exc.code, exc.message, 404)
        return JSONResponse(status_code=200, content=_locations_to_camel(uuid_match, locations))

    def get_admin_match_logs(self, uuid_match: str, lang: str = "en",
                             limit: Optional[int] = None, cursor: Optional[str] = None):
        """GET /api/admin/matches/{uuid}/logs — consolidated log timeline (Step 28.7).
        No ownership check; served on admin port 8044.
        v0.28.7 — cursor-paginated (?limit=&cursor=) with cards resolved in ?lang=."""
        if not uuid_match or not uuid_match.strip():
            return _error("INVALID_INPUT", "Match uuid is required", 400)
        if self.match_logs_service is None:
            return _error("NOT_IMPLEMENTED", "Match logs service not wired", 501)
        result = self.match_logs_service.get_match_logs_for_admin(uuid_match, lang, limit, cursor)
        if result is None:
            return _error("MATCH_NOT_FOUND", f"Match not found: {uuid_match}", 404)
        return JSONResponse(status_code=200, content=result)

    def get_admin_match_weather(self, uuid_match: str):
        """GET /api/admin/matches/{uuid}/weather — rng_seed + current weather +
        log_weather history (Step 27)."""
        if not uuid_match or not uuid_match.strip():
            return _error("INVALID_INPUT", "Match uuid is required", 400)
        if self.weather_service is None:
            return _error("NOT_IMPLEMENTED", "Weather service not wired", 501)
        view = self.weather_service.weather_admin(uuid_match)
        current = view.get("current")
        body = {
            "rngSeed": view.get("rng_seed"),
            "current": None if current is None else {
                "idWeather": current.get("id_weather"),
                "uuid": current.get("uuid"),
                "idCard": current.get("id_card"),
                "idTextName": current.get("id_text_name"),
                "deltaEnergy": current.get("delta_energy"),
                "currentClock": current.get("current_clock"),
            },
            "rules": [
                {
                    "id": r.get("id"), "uuid": r.get("uuid"),
                    "idTextName": r.get("id_text_name"), "name": r.get("name"),
                    "probability": r.get("probability"),
                    "deltaEnergy": r.get("delta_energy"),
                    "costMoveSafeLocation": r.get("cost_move_safe_location"),
                    "costMoveNotSafeLocation": r.get("cost_move_not_safe_location"),
                    "active": r.get("active"), "current": r.get("current"),
                }
                for r in view.get("rules", [])
            ],
            "log": [
                {
                    "id": l.get("id"), "uuid": l.get("uuid"), "clock": l.get("clock"),
                    "idWeather": l.get("id_weather"), "weatherUuid": l.get("weather_uuid"),
                    "idTextName": l.get("id_text_name"), "timestampStart": l.get("timestamp_start"),
                }
                for l in view.get("log", [])
            ],
        }
        return JSONResponse(status_code=200, content=body)

    def get_admin_match_info(self, uuid_match: str):
        """GET /api/admin/matches/{uuid}/info — full match detail for the admin
        console, without the per-user ownership check."""
        detail = self.query_port.get_match_info_for_admin(uuid_match)
        if detail is None:
            return _error("MATCH_NOT_FOUND", f"Match not found: {uuid_match}", 404)
        return JSONResponse(status_code=200, content=_detail_to_camel(detail))

    def change_statistics(self, uuid_match: str, uuid_player: str,
                          body: Optional[ChangeStatisticsRequestBody] = None):
        """POST /api/admin/matches/{uuid}/player/{uuid}/changeStatistics."""
        if not uuid_match or not uuid_player:
            return _error("INVALID_INPUT", "Match uuid and player uuid are required", 400)
        if self.character_command_port is None:
            return _error("NOT_IMPLEMENTED", "Character command port not wired", 501)

        def _skip(v): return None if (v is None or v == -1) else v

        outcome = self.character_command_port.change_statistics(
            uuid_match, uuid_player,
            dex=_skip(body.dex if body else None),
            intel=_skip(body.intel if body else None),
            con=_skip(body.con if body else None),
            energy=_skip(body.energy if body else None),
            life=_skip(body.life if body else None),
            sad=_skip(body.sad if body else None),
            coin=_skip(body.coin if body else None),
            food=_skip(body.food if body else None),
            magic=_skip(body.magic if body else None),
            sleeping=(body.sleeping if body else None),
            coma=(body.coma if body else None),
        )
        if outcome == "UPDATED":
            return JSONResponse(status_code=200, content={
                "status": "UPDATED", "matchUuid": uuid_match, "playerUuid": uuid_player,
            })
        if outcome == "MATCH_NOT_FOUND":
            return _error("MATCH_NOT_FOUND", f"Match not found: {uuid_match}", 404)
        return _error("PLAYER_NOT_FOUND",
                      f"Character instance not found: {uuid_player}", 404)

    def _apply_update(self, uuid_match: str, status_val, name_val):
        outcome = self.command_port.update_match(uuid_match, status_val, name_val)
        if outcome == "UPDATED":
            return JSONResponse(status_code=200, content={"status": "UPDATED", "uuid": uuid_match})
        if outcome == "INVALID_STATUS":
            return _error("INVALID_STATUS", f"status must be one of {match_statuses.ALL}", 400)
        return _error("MATCH_NOT_FOUND", f"Match not found: {uuid_match}", 404)
