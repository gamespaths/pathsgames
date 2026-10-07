from abc import ABC, abstractmethod
from typing import List
from app.core.models.story.story_summary import StorySummary


class CatalogWriterPort(ABC):
    """v0.37.6 — outbound port: stores a story list where the game website reads it."""

    @abstractmethod
    def is_configured(self) -> bool:
        pass

    @abstractmethod
    def target(self) -> str | None:
        pass

    @abstractmethod
    def write(self, relative_path: str, stories: List[StorySummary]) -> int:
        """Writes the `GET /api/stories` JSON body; returns the byte count."""
        pass
