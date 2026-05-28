from abc import ABC, abstractmethod
from typing import Dict, Any, List
from app.core.models.story.story_import_result import StoryImportResult

class StoryImportPort(ABC):
    @abstractmethod
    def import_story(self, data: Dict[str, Any]) -> StoryImportResult:
        pass

    @abstractmethod
    def delete_story(self, uuid: str) -> bool:
        pass
