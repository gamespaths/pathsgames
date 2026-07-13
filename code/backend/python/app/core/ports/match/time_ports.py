"""Step 25 — time advancement & clock cycle ports."""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple

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

    # ── Step 26: time-start recovery ────────────────────────────────────────

    @abstractmethod
    def load_recovery_context(self, id_match: int) -> Optional[Dict[str, Any]]:
        """Return {"id_story", "difficulty_energy"} for the match, or None."""

    @abstractmethod
    def find_recovery_characters(self, id_match: int) -> List[Dict[str, Any]]:
        """Per-character recovery inputs (stats, caps, id_class, id_location)."""

    @abstractmethod
    def find_location_safety(self, id_story: int) -> List[Dict[str, Any]]:
        """Per-location {"id_location", "secure_param", "counter_time",
        "id_event_if_counter_zero"} for the story."""

    @abstractmethod
    def find_class_bonuses(self, id_story: int) -> List[Dict[str, Any]]:
        """Class-bonus rows {"id_class", "statistic", "value"} for the story."""

    @abstractmethod
    def find_state_locations(self, id_match: int) -> List[Dict[str, Any]]:
        """Existing gaming_state_locations rows {"id_location", "clock_counter"}."""

    @abstractmethod
    def update_character_stats(self, id_match: int, id_character: int,
                               energy: int, life: int, sad: int) -> None:
        """Persist the recovered current stats of a single character."""

    @abstractmethod
    def insert_state_location(self, id_match: int, id_location: int, clock_counter: int) -> None:
        """Insert a gaming_state_locations row seeded with the given counter."""

    @abstractmethod
    def update_state_location_counter(self, id_match: int, id_location: int,
                                      new_clock_counter: int) -> None:
        """Update gaming_state_locations.clock_counter for a location."""

    @abstractmethod
    def log_recovery(self, id_match: int, id_character: int, message: str) -> None:
        """Audit a per-character recovery summary into log_events."""

    @abstractmethod
    def log_counter_zero(self, id_match: int, id_location: int,
                         id_event_if_counter_zero: Optional[int], message: str) -> None:
        """Audit a counter-zero event (pending execution; wired in Step 29)."""

    @abstractmethod
    def mark_state_location_activated(self, id_match: int, id_location: int) -> None:
        """Set gaming_state_locations.flag_already_actived = 1 when the counter reaches zero."""

    @abstractmethod
    def log_sleep(self, id_match: int, id_character: int, clock: int) -> None:
        """Write a log_events row for a voluntary sleep action (Step 28.7)."""
