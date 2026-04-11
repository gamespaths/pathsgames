from fastapi import APIRouter, Query, Path, HTTPException, Body, Request
from typing import List, Dict, Any
from app.core.ports.story.story_query_port import StoryQueryPort
from app.core.ports.story.story_import_port import StoryImportPort
from app.core.models.story.story_summary import StorySummary
from app.core.models.story.story_import_result import StoryImportResult

class StoryAdminController:
    def __init__(self, query_port: StoryQueryPort, import_port: StoryImportPort):
        self.query_port = query_port
        self.import_port = import_port
        self.router = APIRouter(prefix="/api/admin/stories", tags=["Story Admin"])
        
        self.router.add_api_route("", self.list_all_stories, methods=["GET"], response_model=List[StorySummary])
        self.router.add_api_route("/import", self.import_story, methods=["POST"], response_model=StoryImportResult, status_code=201)
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
        return self.import_port.import_story(data)

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
