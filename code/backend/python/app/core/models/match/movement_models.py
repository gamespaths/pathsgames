"""Step 28 — movement system domain models (mirrors the Java reference)."""
from dataclasses import dataclass, field
from typing import Any, List, Optional


@dataclass
class NeighborCost:
    """A neighbor edge with the resolved energy-cost breakdown for the current weather:
    base_energy_cost (edge) + entry_energy_cost (target entry) + weather_energy_cost = total.
    ``id_card``/``card`` are the neighbor LOCATION's card (camelCase dict, may be None).

    ``direction`` is the AUTHORED story-edge direction, from ``id_location_from`` to
    ``id_location_to`` — NOT the way the character walks: a two-way edge is listed from
    both endpoints with the same direction. The two endpoint ids let a client tell the
    two traversals apart and flip the direction when the listing location is
    ``id_location_to``."""
    id_location: int
    uuid: Optional[str]
    direction: Optional[str]
    base_energy_cost: int
    entry_energy_cost: int
    weather_energy_cost: int
    total_energy_cost: int
    condition_met: bool
    id_card: Optional[int] = None
    card: Optional[dict] = None
    id_location_from: Optional[int] = None
    id_location_to: Optional[int] = None


@dataclass
class VisitedLocation:
    """A visited location with its current character count and move-cost neighbors.
    ``card`` is the location's resolved card (camelCase dict, may be None)."""
    id_location: int
    uuid: Optional[str]
    id_card: Optional[int]
    safe: bool
    character_count: int
    neighbors: List[NeighborCost] = field(default_factory=list)
    card: Optional[dict] = None


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
    #: Step 33 — what the destination did about the arrival: its id_event_if_first_time /
    #: id_event_not_first_time / id_event_if_character_enter_empty_location, already executed.
    automatic_events: List[Any] = field(default_factory=list)


@dataclass
class MovementAvailability:
    """The verdict on a single move, shared by match-info (which reports it on every neighbor)
    and action/move (which enforces it). ``reason`` is a ``MovementError`` code, None when the
    move is allowed. Mirrors ``EventAvailability`` — see ``movement_availability.check``."""
    available: bool
    reason: Optional[str] = None

    @staticmethod
    def ok() -> "MovementAvailability":
        return MovementAvailability(True, None)

    @staticmethod
    def no(reason: str) -> "MovementAvailability":
        return MovementAvailability(False, reason)


class MovementError(Exception):
    """Domain error mapped to HTTP status codes by the controller (Step 28)."""

    MATCH_NOT_FOUND = "MATCH_NOT_FOUND"
    MATCH_NOT_RUNNING = "MATCH_NOT_RUNNING"
    CHARACTER_CANNOT_ACT = "CHARACTER_CANNOT_ACT"
    SLEEPING = "SLEEPING"
    COMA = "COMA"
    NOT_A_NEIGHBOR = "NOT_A_NEIGHBOR"
    MOVEMENT_CONDITION_NOT_MET = "MOVEMENT_CONDITION_NOT_MET"
    OVERWEIGHT = "OVERWEIGHT"
    INSUFFICIENT_ENERGY = "INSUFFICIENT_ENERGY"
    LOCATION_FULL = "LOCATION_FULL"

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
