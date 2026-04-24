"""
StoryCrudAdminController — REST controller for Step 17 admin CRUD endpoints.
Routes:
  POST   /api/admin/stories                           → create story
  PUT    /api/admin/stories/{uuidStory}                → update story
  GET    /api/admin/stories/{uuidStory}/{entityType}   → list entities
  POST   /api/admin/stories/{uuidStory}/{entityType}   → create entity
  GET    /api/admin/stories/{uuidStory}/{entityType}/{entityUuid} → get entity
  PUT    /api/admin/stories/{uuidStory}/{entityType}/{entityUuid} → update entity
  DELETE /api/admin/stories/{uuidStory}/{entityType}/{entityUuid} → delete entity
"""
from fastapi import APIRouter, Path, HTTPException, Body, Request
from typing import Dict, Any, List
from app.core.ports.story.story_crud_port import StoryCrudPort


class StoryCrudAdminController:
    def __init__(self, crud_port: StoryCrudPort):
        self.crud_port = crud_port
        self.router = APIRouter(prefix="/api/admin/stories", tags=["Admin Story CRUD"])

        # Story-level
        self.router.add_api_route("", self.create_story_route, methods=["POST"], status_code=201)
        self.router.add_api_route("/{uuidStory}", self.update_story_route, methods=["PUT"])

        # Entity CRUD
        self.router.add_api_route("/{uuidStory}/{entityType}", self.list_entities, methods=["GET"])
        self.router.add_api_route("/{uuidStory}/{entityType}", self.create_entity, methods=["POST"], status_code=201)
        self.router.add_api_route("/{uuidStory}/{entityType}/{entityUuid}", self.get_entity, methods=["GET"])
        self.router.add_api_route("/{uuidStory}/{entityType}/{entityUuid}", self.update_entity, methods=["PUT"])
        self.router.add_api_route("/{uuidStory}/{entityType}/{entityUuid}", self.delete_entity, methods=["DELETE"])

    # === Story-level ===

    async def create_story_route(self, req: Request, data: Dict[str, Any] = Body(default=None)):
        self._require_admin(req)
        if not data:
            raise HTTPException(status_code=400, detail={"error": "EMPTY_DATA", "message": "Request body required"})
        result = self.crud_port.create_story(data)
        if result is None:
            raise HTTPException(status_code=400, detail={"error": "INVALID_DATA", "message": "Could not create story"})
        return result

    async def update_story_route(self, req: Request, uuidStory: str = Path(...), data: Dict[str, Any] = Body(default=None)):
        self._require_admin(req)
        if not data:
            raise HTTPException(status_code=400, detail={"error": "EMPTY_DATA", "message": "Request body required"})
        result = self.crud_port.update_story(uuidStory, data)
        if result is None:
            raise HTTPException(status_code=404, detail={"error": "STORY_NOT_FOUND", "message": f"No story: {uuidStory}"})
        return result

    # === Entity CRUD ===

    async def list_entities(self, req: Request, uuidStory: str = Path(...), entityType: str = Path(...)):
        self._require_admin(req)
        result = self.crud_port.list_entities(uuidStory, entityType)
        if result is None:
            raise HTTPException(status_code=404, detail={"error": "STORY_NOT_FOUND", "message": f"No story: {uuidStory}"})
        return result

    async def create_entity(self, req: Request, uuidStory: str = Path(...), entityType: str = Path(...), data: Dict[str, Any] = Body(default=None)):
        self._require_admin(req)
        if not data:
            raise HTTPException(status_code=400, detail={"error": "EMPTY_DATA", "message": "Request body required"})
        result = self.crud_port.create_entity(uuidStory, entityType, data)
        if result is None:
            raise HTTPException(status_code=404, detail={"error": "STORY_NOT_FOUND", "message": f"No story: {uuidStory}"})
        return result

    async def get_entity(self, req: Request, uuidStory: str = Path(...), entityType: str = Path(...), entityUuid: str = Path(...)):
        self._require_admin(req)
        result = self.crud_port.get_entity(uuidStory, entityType, entityUuid)
        if result is None:
            raise HTTPException(status_code=404, detail={"error": "ENTITY_NOT_FOUND", "message": f"Not found: {entityUuid}"})
        return result

    async def update_entity(self, req: Request, uuidStory: str = Path(...), entityType: str = Path(...), entityUuid: str = Path(...), data: Dict[str, Any] = Body(default=None)):
        self._require_admin(req)
        if not data:
            raise HTTPException(status_code=400, detail={"error": "EMPTY_DATA", "message": "Request body required"})
        result = self.crud_port.update_entity(uuidStory, entityType, entityUuid, data)
        if result is None:
            raise HTTPException(status_code=404, detail={"error": "ENTITY_NOT_FOUND", "message": f"Not found: {entityUuid}"})
        return result

    async def delete_entity(self, req: Request, uuidStory: str = Path(...), entityType: str = Path(...), entityUuid: str = Path(...)):
        self._require_admin(req)
        deleted = self.crud_port.delete_entity(uuidStory, entityType, entityUuid)
        if not deleted:
            raise HTTPException(status_code=404, detail={"error": "ENTITY_NOT_FOUND", "message": f"Not found: {entityUuid}"})
        return {"status": "DELETED", "uuid": entityUuid, "entityType": entityType}

    def _require_admin(self, request: Request):
        role = request.state.role if hasattr(request.state, "role") else None
        if role != "ADMIN":
            raise HTTPException(status_code=403, detail={"error": "FORBIDDEN", "message": "Insufficient permissions"})
