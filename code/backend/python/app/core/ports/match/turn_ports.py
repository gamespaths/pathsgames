"""Step 24 — turn cycle ports."""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from app.core.models.match.turn_models import PassResult, TurnSequenceResult


class TurnCyclePort(ABC):
    @abstractmethod
    def start_match(self, match_uuid: str, user_uuid: str) -> TurnSequenceResult:
        """CREATED -> RUNNING, build the turn queue, activate the first turn."""

    @abstractmethod
    def pass_turn(self, match_uuid: str, user_uuid: str) -> PassResult:
        """Voluntarily pass the active character's turn (no energy cost)."""

    @abstractmethod
    def get_turn_sequence(self, match_uuid: str, user_uuid: str) -> TurnSequenceResult:
        """Read the current turn queue with statuses."""


class TurnCycleStorePort(ABC):
    @abstractmethod
    def find_match_by_uuid(self, uuid: str) -> Optional[Dict[str, Any]]:
        """Return {id, uuid, status, current_clock, id_user_creator, id_character_current_turn}."""

    @abstractmethod
    def find_characters_by_match_id(self, id_match: int) -> List[Dict[str, Any]]:
        """Return [{id, uuid, id_user, dexterity, intelligence, constitution, life}]."""

    @abstractmethod
    def replace_queue(self, id_match: int, rows: List[Dict[str, Any]]) -> None:
        """Delete the whole queue and insert the given rows."""

    @abstractmethod
    def find_queue_by_match_id(self, id_match: int) -> List[Dict[str, Any]]:
        """Return queue rows ordered by priority desc."""

    @abstractmethod
    def save_queue_row(self, id_match: int, row: Dict[str, Any]) -> None:
        """Update status / timestamps / pass_counter of one queue row."""

    @abstractmethod
    def update_match_status_and_turn(self, id_match: int, status: str,
                                     id_character_current_turn: Optional[int]) -> None:
        """Update gaming_match.status and gaming_match.id_character_current_turn."""

    @abstractmethod
    def find_user_id_by_uuid(self, user_uuid: str) -> Optional[int]:
        """Resolve a user uuid to the internal users.id, or None."""
