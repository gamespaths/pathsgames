from fastapi import APIRouter, Query, Path, HTTPException
from typing import List, Optional
from app.core.ports.story.story_query_port import StoryQueryPort
from app.core.models.story.story_summary import StorySummary
from app.core.models.story.story_detail import StoryDetail

class StoryController:
    def __init__(self, query_port: StoryQueryPort):
        self.query_port = query_port
        self.router = APIRouter(prefix="/api/stories", tags=["Stories"])
        
        self.router.add_api_route("", self.list_stories, methods=["GET"], response_model=List[StorySummary])
        self.router.add_api_route("/categories", self.list_categories, methods=["GET"], response_model=List[str])
        self.router.add_api_route("/groups", self.list_groups, methods=["GET"], response_model=List[str])
        self.router.add_api_route("/category/{category}", self.list_stories_by_category, methods=["GET"], response_model=List[StorySummary])
        self.router.add_api_route("/group/{group}", self.list_stories_by_group, methods=["GET"], response_model=List[StorySummary])
        self.router.add_api_route("/{uuid}", self.get_story, methods=["GET"], response_model=StoryDetail)

    async def list_stories(self, lang: str = Query("en")) -> List[StorySummary]:
        return self.query_port.list_public_stories(lang)

    async def get_story(self, uuid: str = Path(...), lang: str = Query("en")) -> StoryDetail:
        story = self.query_port.get_story_detail(uuid, lang)
        if not story:
            raise HTTPException(status_code=404, detail={
                "error": "STORY_NOT_FOUND",
                "message": f"No story found with UUID: {uuid}"
            })
        return story

    async def list_categories(self) -> List[str]:
        return self.query_port.list_categories()

    async def list_groups(self) -> List[str]:
        return self.query_port.list_groups()

    async def list_stories_by_category(self, category: str = Path(...), lang: str = Query("en")) -> List[StorySummary]:
        return self.query_port.list_stories_by_category(category, lang)

    async def list_stories_by_group(self, group: str = Path(...), lang: str = Query("en")) -> List[StorySummary]:
        return self.query_port.list_stories_by_group(group, lang)
