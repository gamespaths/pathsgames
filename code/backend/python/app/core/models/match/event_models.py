"""Step 29 — normal (player-triggered) event models (mirrors the Java reference)."""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set


class EventError(Exception):
    """Domain error mapped to HTTP status codes by the controller.

    The codes from CHARACTER_CANNOT_ACT down are produced by the check procedure, so they
    also appear as the ``reason`` of an unavailable event on match-info: a board showing an
    action as available can never be refused by execute-event, and a blocked one already
    knows why.
    """

    MATCH_NOT_FOUND = "MATCH_NOT_FOUND"
    MATCH_NOT_RUNNING = "MATCH_NOT_RUNNING"
    EVENT_NOT_FOUND = "EVENT_NOT_FOUND"
    CHARACTER_CANNOT_ACT = "CHARACTER_CANNOT_ACT"
    EVENT_NOT_EXECUTABLE_TYPE = "EVENT_NOT_EXECUTABLE_TYPE"
    ONCE_ALREADY_CONSUMED = "ONCE_ALREADY_CONSUMED"
    WRONG_LOCATION = "WRONG_LOCATION"
    NOT_ENOUGH_ENERGY = "NOT_ENOUGH_ENERGY"
    NOT_ENOUGH_COINS = "NOT_ENOUGH_COINS"
    REGISTRY_CONDITION_NOT_MET = "REGISTRY_CONDITION_NOT_MET"
    WEATHER_CONDITION_NOT_MET = "WEATHER_CONDITION_NOT_MET"
    ITEM_CONDITION_NOT_MET = "ITEM_CONDITION_NOT_MET"
    CLASS_CONDITION_NOT_MET = "CLASS_CONDITION_NOT_MET"

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class EventCheckContext:
    """Everything the check procedure needs, loaded ONCE per request.

    match-info evaluates N events against a single context, so adding events to a story
    never adds queries. ``registry`` and ``consumed_event_ids`` are mutable on purpose: a
    chain of effects must see what the effects before it just wrote.
    """
    id_character: Optional[int]
    id_location: Optional[int] = None
    sleeping: bool = False
    coma: bool = False
    energy: int = 0
    coin: int = 0
    id_class: Optional[int] = None
    owned_item_ids: Set[int] = field(default_factory=set)
    current_weather_id: Optional[int] = None
    consumed_event_ids: Set[int] = field(default_factory=set)
    registry: Dict[str, Optional[str]] = field(default_factory=dict)

    @staticmethod
    def no_character() -> "EventCheckContext":
        """The context of a caller with no character: nothing is ever executable."""
        return EventCheckContext(id_character=None)


@dataclass
class EventAvailability:
    """The verdict of the check procedure, shared by match-info and execute-event."""
    available: bool
    reason: Optional[str] = None

    @staticmethod
    def ok() -> "EventAvailability":
        return EventAvailability(True, None)

    @staticmethod
    def no(reason: str) -> "EventAvailability":
        return EventAvailability(False, reason)


@dataclass
class StatChange:
    character_uuid: Optional[str]
    statistic: str
    before: int
    after: int
    delta: int


@dataclass
class RegistryChange:
    key: str
    old_value: Optional[str]
    new_value: Optional[str]


@dataclass
class EntityChange:
    """A trait / item / characteristic that was added or removed. ``action`` is ADD or REMOVE."""
    character_uuid: Optional[str]
    value: Optional[str]
    action: str


@dataclass
class AppliedEffect:
    """One list_events_effects row that ran.

    ``card`` is the row's OWN card: that, not the event's, is the narrative the board
    renders. ``character_uuids`` may be empty — a class-targeted effect can match nobody.
    """
    event_uuid: Optional[str]
    effect_uuid: Optional[str]
    statistic: Optional[str]
    value: Optional[int]
    target: Optional[str]
    target_class: Optional[int]
    character_uuids: List[str] = field(default_factory=list)
    card: Optional[Dict[str, Any]] = None


@dataclass
class EventExecutionResult:
    match_uuid: str
    event_uuid: Optional[str]
    event_type: Optional[str]
    card: Optional[Dict[str, Any]]
    executed_event_uuids: List[str]
    energy_spent: int
    coin_spent: int
    new_energy: int
    new_coin: int
    current_clock: int
    # Always False in v0.29.0: an event neither requires nor consumes a turn, exactly like
    # Step 28 movement. Turn semantics are revisited in Step 61.
    turn_consumed: bool = False
    time_ended: bool = False
    item_added: bool = False
    item_removed: bool = False
    weather_applied: bool = False
    forced_sleep: bool = False
    coma_triggered: bool = False
    game_over: bool = False
    refresh_recommended: bool = False
    stat_changes: List[StatChange] = field(default_factory=list)
    registry_changes: List[RegistryChange] = field(default_factory=list)
    trait_changes: List[EntityChange] = field(default_factory=list)
    item_changes: List[EntityChange] = field(default_factory=list)
    characteristic_changes: List[EntityChange] = field(default_factory=list)
    effects: List[AppliedEffect] = field(default_factory=list)
    # Always empty in v0.29.0 — the Step 30 choice engine fills it.
    pending_choices: List[Dict[str, Any]] = field(default_factory=list)
