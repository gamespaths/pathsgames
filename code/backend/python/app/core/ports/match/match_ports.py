"""Step 19 — match ports definitions."""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from app.core.models.match.match_models import MatchCreateCommand, MatchDetail, MatchSummary


class MatchCommandPort(ABC):
    @abstractmethod
    def create_match(self, command: MatchCreateCommand) -> MatchSummary:
        """Persist a new match for the given user. Raises
        :class:`MatchCreationError` for validation failures."""


class MatchQueryPort(ABC):
    @abstractmethod
    def list_user_matches(self, user_uuid: str) -> List[MatchSummary]:
        ...

    @abstractmethod
    def get_match_info(self, match_uuid: str, user_uuid: str) -> Optional[MatchDetail]:
        ...


class MatchPersistencePort(ABC):
    @abstractmethod
    def save_match(self, match: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a row into ``gaming_match`` and return the saved fields
        including the generated id, uuid and timestamps."""

    @abstractmethod
    def find_match_by_uuid(self, uuid: str) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_matches_by_user_id(self, user_id: int) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def save_locations(self, rows: List[Dict[str, Any]]) -> None:
        ...

    @abstractmethod
    def save_registry(self, rows: List[Dict[str, Any]]) -> None:
        ...

    @abstractmethod
    def find_locations_by_match_id(self, match_id: int) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_registry_by_match_id(self, match_id: int) -> List[Dict[str, Any]]:
        ...


class StoryMatchReadPort(ABC):
    """Read-side helper used by the match domain to inspect story tables."""

    @abstractmethod
    def find_story_by_uuid(self, story_uuid: str) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_story_by_id(self, story_id: int) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_difficulty_by_uuid(self, story_id: int, difficulty_uuid: str) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_difficulty_by_id(self, story_id: int, difficulty_id: int) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_locations_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_keys_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        ...


class UserAccessPort(ABC):
    @abstractmethod
    def find_by_uuid(self, user_uuid: str) -> Optional[Dict[str, Any]]:
        """Return the minimum subset of the user row required by the match
        domain (id, uuid, username, role, state) or None when the user is
        unknown."""


class SystemModePort(ABC):
    @abstractmethod
    def is_maintenance(self) -> bool:
        ...
