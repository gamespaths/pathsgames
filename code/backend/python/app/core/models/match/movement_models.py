"""Step 28 — movement system domain models (mirrors the Java reference)."""
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class NeighborCost:
    """A neighbor edge with the resolved energy-cost breakdown for the current weather:
    base_energy_cost (edge) + entry_energy_cost (target entry) + weather_energy_cost = total."""
    id_location: int
    uuid: Optional[str]
    direction: Optional[str]
    base_energy_cost: int
    entry_energy_cost: int
    weather_energy_cost: int
    total_energy_cost: int
    condition_met: bool


@dataclass
class VisitedLocation:
    """A visited location with its current character count and move-cost neighbors."""
    id_location: int
    uuid: Optional[str]
    id_card: Optional[int]
    safe: bool
    character_count: int
    neighbors: List[NeighborCost] = field(default_factory=list)


@dataclass
class MovementResult:
    match_uuid: str
    character_uuid: Optional[str]
    from_location_id: Optional[int]
    from_location_uuid: Optional[str]
    to_location_id: int
    to_location_uuid: Optional[str]
    energy_spent: int
    new_energy: int
    current_clock: int


class MovementError(Exception):
    """Domain error mapped to HTTP status codes by the controller (Step 28)."""

    MATCH_NOT_FOUND = "MATCH_NOT_FOUND"
    MATCH_NOT_RUNNING = "MATCH_NOT_RUNNING"
    CHARACTER_CANNOT_ACT = "CHARACTER_CANNOT_ACT"
    NOT_A_NEIGHBOR = "NOT_A_NEIGHBOR"
    MOVEMENT_CONDITION_NOT_MET = "MOVEMENT_CONDITION_NOT_MET"
    OVERWEIGHT = "OVERWEIGHT"
    INSUFFICIENT_ENERGY = "INSUFFICIENT_ENERGY"
    LOCATION_FULL = "LOCATION_FULL"

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
