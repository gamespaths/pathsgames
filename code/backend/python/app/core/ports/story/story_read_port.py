from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class StoryReadPort(ABC):
    @abstractmethod
    def find_public_stories(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def find_all_stories(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def find_story_by_uuid(self, uuid: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def find_texts_for_story(self, story_id: int) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def find_difficulties_for_story(self, story_id: int) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def count_locations_for_story(self, story_id: int) -> int:
        pass

    @abstractmethod
    def count_events_for_story(self, story_id: int) -> int:
        pass

    @abstractmethod
    def count_items_for_story(self, story_id: int) -> int:
        pass
