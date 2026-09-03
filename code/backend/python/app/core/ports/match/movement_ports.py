"""Step 28 — movement system ports."""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple

from app.core.models.match.movement_models import MovementResult, VisitedLocation


class MovementPort(ABC):
    @abstractmethod
    def start_movement(self, match_uuid: str, user_uuid: str,
                       target_location_uuid: str) -> MovementResult:
        """Move the caller's character to an adjacent location and deduct energy."""

    @abstractmethod
    def list_locations(self, match_uuid: str, user_uuid: str) -> List[VisitedLocation]:
        """Visited locations (player-scoped: caller must own a character)."""

    @abstractmethod
    def list_locations_for_admin(self, match_uuid: str) -> List[VisitedLocation]:
        """Visited locations (admin-scoped: only MATCH_NOT_FOUND is raised)."""


class MovementStorePort(ABC):
    @abstractmethod
    def find_user_id_by_uuid(self, user_uuid: str) -> Optional[int]:
        ...

    @abstractmethod
    def find_match_for_movement(self, match_uuid: str) -> Optional[Dict[str, Any]]:
        """Match dict {id, uuid, status, current_clock, id_story, id_user_creator}."""

    @abstractmethod
    def find_character_by_match_and_user(self, id_match: int,
                                         id_user: int) -> Optional[Dict[str, Any]]:
        """{id, uuid, id_location, energy, weight_max, carried_weight, is_sleeping, is_coma}."""

    @abstractmethod
    def find_characters_for_movement(self, id_match: int) -> List[Dict[str, Any]]:
        """[{id, id_location}] for per-location counts."""

    @abstractmethod
    def find_location_by_uuid(self, id_story: int, uuid: str) -> Optional[Dict[str, Any]]:
        """{id, uuid, id_card, secure_param, cost_energy_enter, max_characters}."""

    @abstractmethod
    def find_location_by_id(self, id_story: int, id_location: int) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_neighbors_of_location(self, id_story: int,
                                   id_location: int) -> List[Dict[str, Any]]:
        """[{id_from, id_to, direction, energy_cost, condition_key, condition_value}]."""


    @abstractmethod
    def find_current_weather_move_cost(self, id_match: int) -> Tuple[int, int]:
        """(cost_safe, cost_not_safe); (0, 0) when no weather is selected."""

    @abstractmethod
    def count_characters_at_location(self, id_match: int, id_location: int) -> int:
        ...

    @abstractmethod
    def update_character_location_and_energy(self, id_match: int, id_character: int,
                                             id_location: int, energy: int) -> None:
        ...

    @abstractmethod
    def insert_movement_log(self, id_match: int, id_character: int,
                            from_location: Optional[int], to_location: int,
                            energy_cost: int) -> None:
        ...

    @abstractmethod
    def find_visited_location_ids(self, id_match: int) -> List[int]:
        """Current character positions plus every from/to in log_movements."""
