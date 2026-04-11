from abc import ABC, abstractmethod
from typing import List, Optional
from app.core.models.story.story_summary import StorySummary
from app.core.models.story.story_detail import StoryDetail

class StoryQueryPort(ABC):
    @abstractmethod
    def list_public_stories(self, lang: str = "en") -> List[StorySummary]:
        pass

    @abstractmethod
    def list_all_stories(self, lang: str = "en") -> List[StorySummary]:
        pass

    @abstractmethod
    def get_story_detail(self, uuid: str, lang: str = "en") -> Optional[StoryDetail]:
        pass
