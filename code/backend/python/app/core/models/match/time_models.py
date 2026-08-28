"""Step 25 — time advancement & clock cycle domain models."""
from dataclasses import dataclass, field
from typing import Any, List, Optional


@dataclass
class ClockCharacter:
    character_uuid: Optional[str]
    is_sleeping: bool
    energy: int


@dataclass
class RecoveryItem:
    """Step 26 — per-character recovery summary (deltas applied at time-start)."""
    character_uuid: Optional[str]
    energy_delta: int
    life_delta: int
    sad_delta: int


@dataclass
class TimeStartOutcome:
    """Step 33 — what one time-start produced: the stat deltas, and the automatic events
    it owes, already ordered by ``priority_automatic_event`` then location id."""
    recovery: List["RecoveryItem"] = field(default_factory=list)
    pending: List[Any] = field(default_factory=list)
    #: v0.35.6 — the edges this recovery pushed anyone over.
    edge_state: Any = None


@dataclass
class TimeEndOutcome:
    """Step 33 — the outcome of a forced time end (an event carrying ``flag_end_time``)."""
    new_clock: int
    recovery: List["RecoveryItem"] = field(default_factory=list)
    counter_zero: List[Any] = field(default_factory=list)
    #: v0.35.6 — the edges the time-start pushed anyone over.
    edge_state: Any = None


@dataclass
class SleepResult:
    match_uuid: str
    character_uuid: Optional[str]
    is_sleeping: bool
    time_end_triggered: bool
    current_clock: int
    recovery: List["RecoveryItem"] = field(default_factory=list)
    #: Step 33 — what happened in the world while the party slept: the location counters
    #: that ran out, and the events they set off. A LIST: several counters can expire on
    #: one time-start. Already filtered for the recipient (fog of war).
    counter_zero: List[Any] = field(default_factory=list)
    #: v0.35.6 — the Step 30 verdict of the time-start the sleep set off: the recovery's own,
    #: folded with the events it fired. Same shape execute-event answers.
    edge_state: Any = None


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
