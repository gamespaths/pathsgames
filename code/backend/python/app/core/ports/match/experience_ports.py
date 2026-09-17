"""Ports of Step 38 — experience spent on a +1 of DEX/INT/COS.

Mirrors the Java `ExperiencePort` / `ExperienceStorePort` pair.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional


class ExperienceError(Exception):
    """Domain error mapped to HTTP status codes by the controller."""

    # Unknown match, unknown user, or the caller owns no character in it.
    MATCH_NOT_FOUND = "MATCH_NOT_FOUND"
    MATCH_NOT_RUNNING = "MATCH_NOT_RUNNING"
    NOT_YOUR_TURN = "NOT_YOUR_TURN"
    COMA = "COMA"
    SLEEPING = "SLEEPING"
    # The body's stat is not one of dex / int / cos.
    INVALID_STAT = "INVALID_STAT"
    # The character's location has secure_param <= 0.
    LOCATION_NOT_SAFE = "LOCATION_NOT_SAFE"
    # The stat already sits at the difficulty's max_stat_value.
    MAX_STAT_VALUE = "MAX_STAT_VALUE"
    NOT_ENOUGH_EXP = "NOT_ENOUGH_EXP"

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class ExperiencePort(ABC):
    """Inbound port: buy one point of ``stat`` for the caller's character."""

    @abstractmethod
    def use_exp(self, match_uuid: str, user_uuid: str, stat: str) -> Dict[str, Any]:
        """The purchase: stat/exp before and after, the cost, the refreshed price list
        and the two stat changes (the stat, then the exp)."""


class ExperienceStorePort(ABC):
    """Outbound port: the rows use-exp reads and the two it writes."""

    @abstractmethod
    def find_match_by_uuid(self, match_uuid: str) -> Optional[Dict[str, Any]]:
        """id, uuid, status, id_story, id_difficulty, exp_cost, current_clock,
        id_character_current_turn."""

    @abstractmethod
    def find_character_by_match_and_user(self, id_match: int,
                                         id_user: int) -> Optional[Dict[str, Any]]:
        """id, uuid, dexterity, intelligence, constitution, exp, is_sleeping, is_coma,
        id_location."""

    @abstractmethod
    def find_location_secure_param(self, id_story: int, id_location: int) -> Optional[int]:
        """The secure_param of a story location, None when the location is gone."""

    @abstractmethod
    def find_difficulty(self, id_story: int, id_difficulty: int) -> Optional[Dict[str, Any]]:
        """exp_cost, exp_cost_base, max_stat_value; None when the row is gone."""

    @abstractmethod
    def update_character(self, id_match: int, id_character: int, dexterity: int,
                         intelligence: int, constitution: int, exp: int) -> None:
        """Writes the three characteristics and the exp of one character."""

    @abstractmethod
    def log_exp_use(self, id_match: int, id_character: int, clock: int, message: str) -> None:
        """One log_events row whose message starts with EXP_USE."""
