"""Step 29 — normal (player-triggered) event models (mirrors the Java reference)."""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

# Step 31 — the two answers of execute-event. APPLIED is the 0-choice flow (effects ran,
# unchanged); CHOICES_PENDING means the cost was paid, the marker written, and the
# options in ``pending_choices`` await the player (or their refusal, client-side only).
STATUS_APPLIED = "APPLIED"
STATUS_CHOICES_PENDING = "CHOICES_PENDING"


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
    # The caller owns no character in this match: nothing is executable.
    CHARACTER_CANNOT_ACT = "CHARACTER_CANNOT_ACT"
    # Asleep: the character wakes up on its own, so the block is temporary.
    SLEEPING = "SLEEPING"
    # In a coma: only a rescue brings it back.
    COMA = "COMA"
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
class LocationChange:
    """One forced movement (v0.29.3): who moved, from where (None when unplaced), to where."""
    character_uuid: Optional[str]
    from_location_uuid: Optional[str]
    to_location_uuid: Optional[str]


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
class ChoiceCheckContext:
    """Everything the Step 31 per-option verdict needs, pre-loaded once per execute-event.

    ``actor_stats`` carries the full stat vocabulary of the effect engine
    (life/energy/sad/exp/dex/int/cos/food/magic/coin), read AFTER the open-cost deduction —
    the player chooses with the energy they actually have left. ``party_locations`` and
    ``party_stat_sums`` cover every character of the match; the service may leave them
    empty when no condition needs them.
    """
    actor_stats: Dict[str, int] = field(default_factory=dict)
    id_class: Optional[int] = None
    id_location: Optional[int] = None
    owned_item_ids: Set[int] = field(default_factory=set)
    trait_ids: Set[int] = field(default_factory=set)
    registry: Dict[str, Optional[str]] = field(default_factory=dict)
    party_locations: List[Optional[int]] = field(default_factory=list)
    party_stat_sums: Dict[str, int] = field(default_factory=dict)


@dataclass
class ChoiceAvailability:
    """The Step 31 per-option verdict: ``reason`` is None exactly when ``available``."""
    available: bool
    reason: Optional[str] = None

    @staticmethod
    def ok() -> "ChoiceAvailability":
        return ChoiceAvailability(True, None)

    @staticmethod
    def no(reason: str) -> "ChoiceAvailability":
        return ChoiceAvailability(False, reason)


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
    # v0.29.3 — a forced-movement effect moved at least one character.
    movement_applied: bool = False
    forced_sleep: bool = False
    coma_triggered: bool = False
    game_over: bool = False
    refresh_recommended: bool = False
    stat_changes: List[StatChange] = field(default_factory=list)
    registry_changes: List[RegistryChange] = field(default_factory=list)
    trait_changes: List[EntityChange] = field(default_factory=list)
    item_changes: List[EntityChange] = field(default_factory=list)
    characteristic_changes: List[EntityChange] = field(default_factory=list)
    location_changes: List[LocationChange] = field(default_factory=list)
    # STATUS_APPLIED or STATUS_CHOICES_PENDING (Step 31).
    status: str = STATUS_APPLIED
    effects: List[AppliedEffect] = field(default_factory=list)
    # The options of a choice-event; empty when ``status`` is APPLIED. Each option is a
    # camelCase-ready dict: uuid, priority, name, description, card, available, reason —
    # the choice's narrative text is deliberately absent (no pre-leak, Step 32 reveals it).
    pending_choices: List[Dict[str, Any]] = field(default_factory=list)
    # Step 30. Never None in practice; see EdgeStateOutcome.none().
    edge_state: "EdgeStateOutcome" = field(default_factory=lambda: EdgeStateOutcome())


@dataclass
class EdgeStateOutcome:
    """Step 30 — what the edge rules did, and the party epilogue when everyone is down.

    The epilogue is kept apart from ``executed_event_uuids`` / ``effects`` on purpose:
    merged in, the frontend would render it as if it were part of the chain the player
    chose, when in fact it is the engine answering their collapse.
    """

    sadness_overflow_uuids: List[str] = field(default_factory=list)
    coma_uuids: List[str] = field(default_factory=list)
    all_players_in_coma: bool = False
    # None when the story authors no epilogue, or it was already spent.
    coma_event_uuid: Optional[str] = None
    coma_event_card: Optional[Dict[str, Any]] = None
    coma_executed_event_uuids: List[str] = field(default_factory=list)
    coma_effects: List[AppliedEffect] = field(default_factory=list)

    @staticmethod
    def none() -> "EdgeStateOutcome":
        return EdgeStateOutcome()

    def anything(self) -> bool:
        """True when anything at all happened — the frontend shows a card only then."""
        return bool(self.sadness_overflow_uuids or self.coma_uuids or self.all_players_in_coma)
