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

    @abstractmethod
    def list_categories(self) -> List[str]:
        pass

    @abstractmethod
    def list_groups(self) -> List[str]:
        pass

    @abstractmethod
    def list_stories_by_category(self, category: str, lang: str = "en") -> List[StorySummary]:
        pass

    @abstractmethod
    def list_stories_by_group(self, group: str, lang: str = "en") -> List[StorySummary]:
        pass

    # Step 23 — non-abstract for backward compatibility with existing fakes.
    def list_traits_for_class(self, story_uuid: str, class_uuid: str, lang: str = "en"):
        """Returns ``(status, traits)`` with status in
        {"OK", "STORY_NOT_FOUND", "CLASS_NOT_FOUND"}."""
        raise NotImplementedError
