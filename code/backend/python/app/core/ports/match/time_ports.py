"""Step 25 — time advancement & clock cycle ports."""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Tuple

from app.core.models.match.time_models import ClockResult, SleepResult
from app.core.ports.match.turn_ports import TurnCycleStorePort


class TimeAdvancementPort(ABC):
    @abstractmethod
    def sleep(self, match_uuid: str, user_uuid: str) -> SleepResult:
        """Mark the caller's character sleeping (idempotent), then evaluate the
        time-end trigger; advance the clock if every character is sleeping or out
        of energy."""

    @abstractmethod
    def clock(self, match_uuid: str, user_uuid: str) -> ClockResult:
        """Read the current clock, labels and per-character sleeping/energy state."""


class TimeStorePort(TurnCycleStorePort):
    """Extends the turn-cycle store with the writes/reads needed at time start."""

    @abstractmethod
    def find_character_by_match_and_user(self, id_match: int,
                                         id_user: int) -> Optional[Dict[str, Any]]:
        """The character instance owned by ``id_user`` in ``id_match``, or None."""

    @abstractmethod
    def set_character_sleeping(self, id_match: int, id_character: int, sleeping: bool) -> None:
        """Set/clear ``is_sleeping`` on a single character of the match."""

    @abstractmethod
    def wake_all_characters(self, id_match: int) -> None:
        """Clear ``is_sleeping`` on every character of the match (wake at time start)."""

    @abstractmethod
    def increment_match_clock(self, id_match: int) -> int:
        """Advance ``gaming_match.current_clock`` by one and return the new value."""

    @abstractmethod
    def insert_clock_history(self, id_match: int, clock: int) -> None:
        """Insert a ``log_clock_history`` row for the given (new) clock."""

    @abstractmethod
    def find_story_clock_labels(self, id_match: int,
                                lang: str) -> Tuple[Optional[str], Optional[str]]:
        """Resolve the (singular, plural) clock labels for the match's story."""
