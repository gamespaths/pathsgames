from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional

class StoryPersistencePort(ABC):
    @abstractmethod
    def find_story_id_by_uuid(self, uuid: str) -> Optional[int]:
        pass

    @abstractmethod
    def delete_story_by_id(self, story_id: int) -> None:
        """Should cascade delete all related entities for the given story."""
        pass

    @abstractmethod
    def save_story(self, story_data: Dict[str, Any]) -> int:
        pass

    @abstractmethod
    def save_difficulties(self, story_id: int, difficulties: List[Dict[str, Any]]) -> None:
        pass

    @abstractmethod
    def save_texts(self, story_id: int, texts: List[Dict[str, Any]]) -> None:
        pass

    @abstractmethod
    def save_locations(self, story_id: int, locations: List[Dict[str, Any]]) -> None:
        pass
        
    @abstractmethod
    def save_events(self, story_id: int, events: List[Dict[str, Any]]) -> None:
        pass
        
    @abstractmethod
    def save_items(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        pass
        
    @abstractmethod
    def save_classes(self, story_id: int, classes: List[Dict[str, Any]]) -> None:
        pass
        
    @abstractmethod
    def save_choices(self, story_id: int, choices: List[Dict[str, Any]]) -> None:
        pass
        
    @abstractmethod
    def save_cards(self, story_id: int, cards: List[Dict[str, Any]]) -> None:
        pass
        
    @abstractmethod
    def save_keys(self, story_id: int, keys: List[Dict[str, Any]]) -> None:
        pass

    @abstractmethod
    def save_traits(self, story_id: int, traits: List[Dict[str, Any]]) -> None:
        pass

    @abstractmethod
    def save_character_templates(self, story_id: int, templates: List[Dict[str, Any]]) -> None:
        pass

    @abstractmethod
    def save_weather_rules(self, story_id: int, rules: List[Dict[str, Any]]) -> None:
        pass

    @abstractmethod
    def save_global_random_events(self, story_id: int, events: List[Dict[str, Any]]) -> None:
        pass

    @abstractmethod
    def save_missions(self, story_id: int, missions: List[Dict[str, Any]]) -> None:
        pass
        
    @abstractmethod
    def save_creators(self, story_id: int, creators: List[Dict[str, Any]]) -> None:
        pass
