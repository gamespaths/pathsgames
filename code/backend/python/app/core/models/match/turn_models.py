"""Step 24 — turn cycle domain models for the single-player turn engine."""
from dataclasses import dataclass, field
from typing import List, Optional

WAITING = "WAITING"
ACTIVE = "ACTIVE"
COMPLETED = "COMPLETED"
ALL = [WAITING, ACTIVE, COMPLETED]


def compute_priority(dexterity: int, intelligence: int, constitution: int,
                     life: int, id_character: int) -> int:
    """priority = (DEX*3 + INT*2 + COS*1) * 1000 + LIFE*10 + idCharacter (higher acts first)."""
    stats = dexterity * 3 + intelligence * 2 + constitution
    return stats * 1000 + life * 10 + id_character


@dataclass
class TurnEntry:
    character_uuid: Optional[str]
    id_character: int
    name: Optional[str]
    priority: int
    clock: int
    status: str
    pass_counter: int
    timestamp_start: Optional[str]
    timestamp_end: Optional[str]


@dataclass
class TurnSequenceResult:
    match_uuid: str
    current_clock: int
    status: str
    active_character_uuid: Optional[str]
    queue: List[TurnEntry] = field(default_factory=list)


@dataclass
class PassResult:
    match_uuid: str
    passed_character_uuid: Optional[str]
    next_active_character_uuid: Optional[str]
    status: str


class TurnCycleError(Exception):
    """Raised by the turn cycle service; ``code`` drives the HTTP status mapping."""

    MATCH_NOT_FOUND = "MATCH_NOT_FOUND"
    MATCH_NOT_STARTABLE = "MATCH_NOT_STARTABLE"
    NO_CHARACTERS_JOINED = "NO_CHARACTERS_JOINED"
    MATCH_NOT_RUNNING = "MATCH_NOT_RUNNING"
    NOT_YOUR_TURN = "NOT_YOUR_TURN"

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
