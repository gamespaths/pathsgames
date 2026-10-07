"""Step 38 — POST /api/gameplay/{uuid_match}/action/use-exp (mirror of the Java ExperienceController)."""
import time
from typing import Any, Dict

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.ports.match.experience_ports import ExperienceError, ExperiencePort

_STATUS_BY_CODE = {
    ExperienceError.MATCH_NOT_FOUND: 404,
    ExperienceError.INVALID_STAT: 400,
    ExperienceError.MATCH_NOT_RUNNING: 409,
    ExperienceError.NOT_YOUR_TURN: 409,
    ExperienceError.COMA: 409,
    ExperienceError.SLEEPING: 409,
    ExperienceError.LOCATION_NOT_SAFE: 409,
    ExperienceError.MAX_STAT_VALUE: 409,
    ExperienceError.NOT_ENOUGH_EXP: 409,
}


def _error(code: str, message: str, http_status: int) -> JSONResponse:
    return JSONResponse(
        status_code=http_status,
        content={"error": code, "message": message, "timestamp": int(time.time() * 1000)},
    )


def _result_to_camel(r: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "matchUuid": r.get("match_uuid"),
        "characterUuid": r.get("character_uuid"),
        "stat": r.get("stat"),
        "statBefore": r.get("stat_before"),
        "statAfter": r.get("stat_after"),
        "expBefore": r.get("exp_before"),
        "expAfter": r.get("exp_after"),
        "expCost": r.get("exp_cost"),
        "expCosts": dict(r.get("exp_costs") or {}),
        "statChanges": [
            {"characterUuid": c.get("character_uuid"), "statistic": c.get("statistic"),
             "before": c.get("before"), "after": c.get("after"), "delta": c.get("delta")}
            for c in (r.get("stat_changes") or [])
        ],
    }


class ExperienceController:
    def __init__(self, experience_port: ExperiencePort):
        self.experience_port = experience_port
        self.router = APIRouter()
        self.router.add_api_route(
            "/api/gameplay/{uuid_match}/action/use-exp", self.use_exp, methods=["POST"])

    async def use_exp(self, uuid_match: str, request: Request):
        user_uuid = getattr(request.state, "user_uuid", None)
        if not user_uuid:
            return _error("UNAUTHENTICATED", "User identity is missing", 401)
        try:
            body = await request.json()
        except Exception:
            body = {}
        stat = (body or {}).get("stat") if isinstance(body, dict) else None
        if not stat or not str(stat).strip():
            return _error("INVALID_STAT", "stat is required: one of dex, int, cos", 400)
        try:
            result = self.experience_port.use_exp(uuid_match, user_uuid, str(stat))
        except ExperienceError as exc:
            return _error(exc.code, exc.message, _STATUS_BY_CODE.get(exc.code, 409))
        return JSONResponse(status_code=200, content=_result_to_camel(result))
