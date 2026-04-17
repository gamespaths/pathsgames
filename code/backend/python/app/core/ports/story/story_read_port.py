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

    @abstractmethod
    def find_unique_categories(self) -> List[str]:
        pass

    @abstractmethod
    def find_unique_groups(self) -> List[str]:
        pass

    @abstractmethod
    def find_stories_by_category(self, category: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def find_stories_by_group(self, group: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def find_classes_for_story(self, story_id: int) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def find_character_templates_for_story(self, story_id: int) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def find_traits_for_story(self, story_id: int) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def find_card_for_story(self, story_id: int, card_id: int) -> Optional[Dict[str, Any]]:
        pass
