"""v0.41.4 Step 41 H — POST /api/admin/matches/{uuid_match}/export (the neutral file, attachment) and
POST /api/admin/matches/import (dry-run 200, import 201). Admin app/port only. Mirrors the Java controller."""
import json
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from app.core.ports.match.match_export_ports import MatchExportError


def _error(status: int, code: str, message: str, errors=None) -> JSONResponse:
    body = {"error": code, "message": message}
    if errors:
        body["errors"] = [{"code": e.code, "message": e.message} for e in errors]
    body["timestamp"] = int(time.time() * 1000)
    return JSONResponse(status_code=status, content=body)


def export_error(exc: MatchExportError) -> JSONResponse:
    return _error(exc.status, exc.code, exc.message, exc.errors)


class MatchExportAdminController:

    def __init__(self, export_service, max_bytes: int = 5_000_000) -> None:
        self.service = export_service
        self.max_bytes = int(max_bytes)
        self.router = APIRouter()
        # /import first: no /{uuid_match} POST may ever shadow it.
        self.router.add_api_route("/api/admin/matches/import", self.import_match, methods=["POST"])
        self.router.add_api_route("/api/admin/matches/{uuid_match}/export", self.export_match, methods=["POST"])

    def export_match(self, uuid_match: str):
        """Pauses the match, exports its latest time-end snapshot, restores it and restarts it."""
        try:
            result = self.service.export_match(uuid_match)
        except MatchExportError as exc:
            return export_error(exc)
        return Response(content=result.canonical.encode("utf-8"), media_type="application/json",
                        headers={"Content-Disposition": f"attachment; filename={result.file_name}"})

    async def import_match(self, request: Request):
        """Body MatchImportRequest; dryRun answers the check only."""
        raw = await request.body()
        if not raw or not raw.strip():
            return _error(400, "INVALID_INPUT", "Body must be a MatchImportRequest")
        # A raw guard before parsing; the precise cap is on the canonical export (413 as well).
        if len(raw) > 2 * self.max_bytes + 4096:
            return _error(413, "IMPORT_TOO_LARGE", f"The export is larger than {self.max_bytes} bytes")
        try:
            body = json.loads(raw)
        except ValueError:
            body = None
        if not isinstance(body, dict):
            return _error(400, "INVALID_INPUT", "Body must be valid JSON")
        try:
            if body.get("dryRun") is True:
                return JSONResponse(status_code=200, content=self.service.check(body))
            return JSONResponse(status_code=201, content=self.service.import_match(body))
        except MatchExportError as exc:
            return export_error(exc)
