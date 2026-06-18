"""Step 25 — time advancement & clock cycle domain models."""
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class ClockCharacter:
    character_uuid: Optional[str]
    is_sleeping: bool
    energy: int


@dataclass
class SleepResult:
    match_uuid: str
    character_uuid: Optional[str]
    is_sleeping: bool
    time_end_triggered: bool
    current_clock: int


@dataclass
class ClockResult:
    match_uuid: str
    current_clock: int
    clock_label_singular: Optional[str]
    clock_label_plural: Optional[str]
    any_character_sleeping: bool
    characters: List[ClockCharacter] = field(default_factory=list)


@dataclass
class TimeAdvanced:
    """Domain event emitted when the match clock advances (Step 25).

    WebSocket broadcasting is deferred to Step 64; for now it is published
    in-process via :class:`DomainEventPublisher`."""

    match_uuid: str
    new_clock: int
