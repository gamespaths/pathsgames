"""Step 19 — match ports definitions."""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from app.core.models.match.match_models import MatchCreateCommand, MatchDetail, MatchSummary


class MatchCommandPort(ABC):
    @abstractmethod
    def create_match(self, command: MatchCreateCommand) -> MatchSummary:
        """Persist a new match for the given user. Raises
        :class:`MatchCreationError` for validation failures."""

    @abstractmethod
    def update_match(self, uuid_match: str, status: Optional[str], name: Optional[str]) -> str:
        """Update a match's status and/or name (admin operation).

        Returns one of ``'UPDATED'``, ``'NOT_FOUND'`` or ``'INVALID_STATUS'``."""

    @abstractmethod
    def delete_match(self, uuid_match: str) -> str:
        """Delete a match together with its runtime state (admin operation).
        Only matches in a terminal status (ENDED / GAMEOVER) may be deleted.

        Returns one of ``'DELETED'``, ``'NOT_FOUND'`` or ``'NOT_STOPPED'``."""

    @abstractmethod
    def end_match(self, uuid_match: str, uuid_event: str, user_uuid: str) -> str:
        """Step 20.1 — completes a match (status → ENDED) when ``uuid_event`` is
        the story's ``idEventEndGame``. Caller must be the match owner.

        Returns one of:
          - ``'COMPLETED'``  — match status set to ENDED;
          - ``'NOT_ACCEPTABLE'`` — event is not the configured end-game event;
          - ``'NOT_FOUND'`` — unknown match or caller is not the owner."""


class MatchQueryPort(ABC):
    @abstractmethod
    def list_user_matches(self, user_uuid: str) -> List[MatchSummary]:
        ...

    @abstractmethod
    def list_all_matches(self) -> List[MatchSummary]:
        """Return every match in the platform, newest first (admin view)."""

    @abstractmethod
    def get_match_info(self, match_uuid: str, user_uuid: str) -> Optional[MatchDetail]:
        ...

    @abstractmethod
    def get_match_info_for_admin(self, match_uuid: str) -> Optional[MatchDetail]:
        """Return the full match detail for the admin view — without the
        per-user ownership check. Returns None only when the match is unknown."""
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
    def find_all_matches(self) -> List[Dict[str, Any]]:
        """Return every ``gaming_match`` row, newest first."""

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

    @abstractmethod
    def delete_matches_by_name_like(self, name_like_pattern: str) -> int:
        """Delete all matches whose name matches the given SQL LIKE pattern,
        together with their derived runtime state (locations and registry
        rows). Used by the dev-only test-data cleanup. Returns the number of
        matches removed."""
        ...

    @abstractmethod
    def update_match_fields(self, uuid: str, status: Optional[str], name: Optional[str]) -> bool:
        """Update the status and/or name of a single match. A ``None`` field is
        left unchanged. Returns ``False`` when no match has the given uuid."""
        ...

    @abstractmethod
    def delete_match_by_uuid(self, uuid: str) -> bool:
        """Delete a single match by uuid together with its derived runtime
        state. Returns ``False`` when no match has the given uuid."""
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

    @abstractmethod
    def find_event_by_story_id_and_uuid(self, story_id: int, uuid_event: str) -> Optional[Dict[str, Any]]:
        """Step 20.1 — return ``{"id": int, "uuid": str}`` for the event with
        the given uuid in the given story, or ``None`` when no such event exists."""
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


class TurnstileVerificationPort(ABC):
    @abstractmethod
    def verify(self, token: Optional[str], remote_ip: Optional[str]) -> bool:
        """Return True when the Turnstile token is valid or validation is disabled."""
