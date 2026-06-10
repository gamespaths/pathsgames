from fastapi import APIRouter, Query, Path, HTTPException, Body, Request
from typing import List, Dict, Any
from app.core.ports.story.story_query_port import StoryQueryPort
from app.core.ports.story.story_import_port import StoryImportPort
from app.core.ports.story.story_validator_port import StoryValidationException
from app.core.models.story.story_summary import StorySummary
from app.core.models.story.story_import_result import StoryImportResult

class StoryAdminController:
    def __init__(self, query_port: StoryQueryPort, import_port: StoryImportPort, validator_port=None):
        self.query_port = query_port
        self.import_port = import_port
        self.validator_port = validator_port
        self.router = APIRouter(prefix="/api/admin/stories", tags=["Story Admin"])

        self.router.add_api_route("", self.list_all_stories, methods=["GET"], response_model=List[StorySummary])
        self.router.add_api_route("/import", self.import_story, methods=["POST"], response_model=StoryImportResult, status_code=201)
        self.router.add_api_route("/{uuid}/validate", self.validate_story, methods=["GET"])
        self.router.add_api_route("/{uuid}", self.delete_story, methods=["DELETE"])

    async def list_all_stories(self, req: Request, lang: str = Query("en")) -> List[StorySummary]:
        self._require_admin(req)
        return self.query_port.list_all_stories(lang)

    async def import_story(self, req: Request, data: Dict[str, Any] = Body(default=None)) -> StoryImportResult:
        self._require_admin(req)
        if not data:
            raise HTTPException(status_code=400, detail={
                "error": "EMPTY_IMPORT_DATA",
                "message": "Request body must contain story data"
            })
        try:
            return self.import_port.import_story(data)
        except StoryValidationException as e:
            raise HTTPException(status_code=400, detail={
                "error": "INVALID_STORY",
                "message": e.report.summary(),
                "errors": [err.to_dict() for err in e.report.errors],
            })
        except ValueError as e:
            raise HTTPException(status_code=400, detail={
                "error": "INVALID_IMPORT_DATA",
                "message": str(e)
            })

    async def validate_story(self, req: Request, uuid: str = Path(...)):
        # Step 22: read-only integrity report for a persisted story.
        self._require_admin(req)
        if self.validator_port is None:
            return {"valid": True, "count": 0, "errors": []}
        report = self.validator_port.validate_story_by_uuid(uuid)
        if report is None:
            raise HTTPException(status_code=404, detail={
                "error": "STORY_NOT_FOUND",
                "message": f"No story found with UUID: {uuid}"
            })
        return report.to_dict()

    async def delete_story(self, req: Request, uuid: str = Path(...)):
        self._require_admin(req)
        deleted = self.import_port.delete_story(uuid)
        if not deleted:
            raise HTTPException(status_code=404, detail={
                "error": "STORY_NOT_FOUND",
                "message": f"No story found with UUID: {uuid}"
            })
        return {"status": "DELETED", "uuid": uuid}

    def _require_admin(self, request: Request):
        role = request.state.role if hasattr(request.state, "role") else None
        if role != "ADMIN":
            raise HTTPException(status_code=403, detail={
                "error": "FORBIDDEN",
                "message": "Insufficient permissions"
            })
