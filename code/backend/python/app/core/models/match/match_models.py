"""Step 19 — domain models for the single-player match flow."""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class MatchCreateCommand:
    user_uuid: str
    story_uuid: str
    difficulty_uuid: str
    name: Optional[str] = None
    character_template_uuid: Optional[str] = None
    # Step 0.19.9 — creator loadout persisted on gaming_match.
    class_uuid: Optional[str] = None
    trait_uuids: List[str] = field(default_factory=list)
    single_player: Optional[int] = None
    turnstile_token: Optional[str] = None
    remote_ip: Optional[str] = None
    # Step 27 — optional deterministic RNG seed (Robot tests pass 42).
    rng_seed: Optional[int] = None


@dataclass
class MatchSummary:
    uuid: str
    story_uuid: Optional[str]
    difficulty_uuid: Optional[str]
    name: Optional[str]
    status: str
    current_clock: int
    exp_cost: int
    user_creator_uuid: str
    ts_insert: str
    # Step 0.19.9 — creator loadout persisted on gaming_match.
    single_player: Optional[int] = None
    character_template_uuid: Optional[str] = None
    class_uuid: Optional[str] = None
    trait_uuids: List[str] = field(default_factory=list)


@dataclass
class MatchListFilter:
    """v0.28.1 — raw request inputs for the paginated admin match list.

    Carries the *unresolved* values from the query string; the query service
    turns ``user_uuid``/``story_uuid`` into ids, ``since_days`` into an ISO
    lower bound and ``cursor`` into a keyset position. ``None``/blank ⇒ no filter.
    """

    status: Optional[str] = None
    user_uuid: Optional[str] = None
    story_uuid: Optional[str] = None
    since_days: Optional[int] = None
    cursor: Optional[str] = None
    limit: Optional[int] = None


@dataclass
class MatchSummaryPage:
    """v0.28.1 — one page of the admin match list (newest first).

    ``next_cursor`` is ``None`` on the last page; pass it back as ``?cursor=`` to
    fetch the following page. ``limit`` is the effective (clamped) page size.
    """

    items: List[MatchSummary]
    next_cursor: Optional[str]
    limit: int


@dataclass
class MatchLocationState:
    """One row of gaming_state_locations. v0.28.6 — on the PLAYER info endpoint
    only ALREADY-VISITED locations are projected (visited = character positions ∪
    movement log, the same set GET /locations returns); the admin endpoint keeps
    every location so the console can render the full runtime table."""

    id_location: int
    uuid: str
    flag_already_actived: int
    clock_counter: int
    #: Step 33 — the party has entered this location at least once. Not the same as
    #: flag_already_actived, which means "this location's counter has been consumed".
    flag_visited: int = 0


@dataclass
class MatchRegistryEntry:
    uuid: str
    key: str
    string_value: Optional[str] = None
    int_value: Optional[int] = None


@dataclass
class MatchEventOption:
    uuid: str
    name: str
    type: str


@dataclass
class ItemEffectPreview:
    """Step 35 — one list_items_effects row, as the board may read it BEFORE the item is
    used. Until this version an item's effects reached the client only in the answer of
    use-item, once the row was already spent: a healing potion and a poison looked the same.

    Statistic and value only. The trait CSVs would need a second lookup to become names,
    and the effect's narrative card is the story of what happened — it belongs to the
    answer, not to the promise. The statistic arrives already normalised (``sad``, never
    ``SADNESS``); the value is the AUTHORED one, before the engine clamps it."""

    statistic: Optional[str] = None
    value: int = 0


@dataclass
class ItemInstanceInfo:
    """Step 27 — a single item carried by a character inside a match."""

    uuid: str
    item_uuid: Optional[str] = None
    name: Optional[str] = None
    weight: int = 0
    amount: int = 1
    state: Optional[str] = None
    # Step 34 — the item's story card and the card object resolved with it. The id alone
    # is not enough: react-game never resolves a card by id, it consumes the object.
    id_card: Optional[int] = None
    card: Optional[Dict[str, Any]] = None
    # Step 34 — False means the item is carried only; use-item refuses it.
    is_consumabile: Optional[bool] = None
    # Step 35 — what using it promises. Empty (never None) for an item with no effect and
    # on the masked inventories of the other players.
    effects: List[ItemEffectPreview] = field(default_factory=list)


@dataclass
class CharacterInstanceInfo:
    """Step 21 — a character materialised in a match (stats + location + backpack)."""

    uuid: str
    match_uuid: Optional[str] = None
    user_uuid: Optional[str] = None
    character_template_uuid: Optional[str] = None
    class_uuid: Optional[str] = None
    dexterity: int = 0
    intelligence: int = 0
    constitution: int = 0
    energy: int = 0
    life: int = 0
    sad: int = 0
    # Step 27 — max statistics computed at join and persisted on the instance.
    life_max: int = 0
    energy_max: int = 0
    sad_max: int = 0
    weight_max: int = 0
    weight: int = 0
    id_location: Optional[int] = None
    location_uuid: Optional[str] = None
    is_sleeping: int = 0
    is_coma: int = 0
    # Step 30 — the match clock at which the coma opened; 0 while not comatose.
    clock_in_coma: int = 0
    trait_uuids: List[str] = field(default_factory=list)
    items: List[ItemInstanceInfo] = field(default_factory=list)
    food: int = 0
    magic: int = 0
    coin: int = 0


@dataclass
class JoinMatchCommand:
    """Step 21 — command for POST /api/matches/{uuid}/join."""

    match_uuid: str
    user_uuid: str
    character_template_uuid: Optional[str] = None
    class_uuid: Optional[str] = None
    trait_uuids: List[str] = field(default_factory=list)


@dataclass
class EventInfo:
    """An event at a player-occupied location, with its resolved visual card (a camelCase
    dict mirroring CardInfoResponse).

    Step 29 added ``available``/``reason``: the verdict of the same check procedure that
    execute-event enforces, so a board offering an action can never be refused, and a
    blocked one already knows why."""

    uuid: str
    type: Optional[str] = None
    end_game: bool = False
    available: bool = False
    reason: Optional[str] = None
    card: Optional[Dict[str, Any]] = None
    # The energy the event costs to trigger (`cost_enery`); 0 when it is free.
    energy: int = 0


@dataclass
class LocationNeighborInfo:
    """Step 27.x — a location reachable from a player-occupied location. The
    id/uuid identify the *other* endpoint of the neighbor link."""

    id_location: int
    uuid: Optional[str] = None
    direction: Optional[str] = None
    flag_back: Optional[int] = None
    energy_cost: Optional[int] = None
    card: Optional[Dict[str, Any]] = None
    secure_param: Optional[int] = None
    id_location_from: Optional[int] = None
    id_location_to: Optional[int] = None
    card_back: Optional[Dict[str, Any]] = None
    # v0.28.6 — the card of the LOCATION at each endpoint of the edge, distinct
    # from `card` (authored LINK card) and `card_back` (return LINK card). Each is
    # gated on its OWN visited flag: None until that location has been visited.
    card_location_from: Optional[Dict[str, Any]] = None
    card_location_to: Optional[Dict[str, Any]] = None
    # Whether the reference character can take this path right now, and — when it cannot — the
    # MovementError code action/move would answer with (COMA, SLEEPING, INSUFFICIENT_ENERGY,
    # ...). Same verdict, same code, one source: movement_availability.check.
    available: bool = True
    reason: Optional[str] = None


@dataclass
class LocationInfo:
    """Step 27.x — a location occupied by one or more players, enriched with its
    card, the neighbor locations reachable from it and the events specific to it."""

    id_location: int
    uuid: Optional[str] = None
    id_card: Optional[int] = None
    card: Optional[Dict[str, Any]] = None
    neighbors: List[LocationNeighborInfo] = field(default_factory=list)
    events: List[EventInfo] = field(default_factory=list)
    secure_param: Optional[int] = None


@dataclass
class MatchDetail:
    match: MatchSummary
    current_location_id: Optional[int] = None
    current_location_uuid: Optional[str] = None
    locations: List[MatchLocationState] = field(default_factory=list)
    registry: List[MatchRegistryEntry] = field(default_factory=list)
    events: List[MatchEventOption] = field(default_factory=list)
    choices: List[MatchEventOption] = field(default_factory=list)
    players: List[CharacterInstanceInfo] = field(default_factory=list)
    locations_active: List[LocationInfo] = field(default_factory=list)


class CharacterJoinError(Exception):
    """Raised by the character command service when a business rule prevents a
    join. The :attr:`code` attribute drives the HTTP status mapping."""

    INVALID_INPUT = "INVALID_INPUT"
    MATCH_NOT_FOUND = "MATCH_NOT_FOUND"
    USER_NOT_FOUND = "USER_NOT_FOUND"
    USER_BANNED = "USER_BANNED"
    TEMPLATE_NOT_FOUND = "TEMPLATE_NOT_FOUND"
    CLASS_NOT_FOUND = "CLASS_NOT_FOUND"
    CLASS_NOT_COMPATIBLE = "CLASS_NOT_COMPATIBLE"
    ALREADY_JOINED = "ALREADY_JOINED"
    MATCH_NOT_JOINABLE = "MATCH_NOT_JOINABLE"
    # Step 23 — trait selection validation
    TRAIT_NOT_FOUND = "TRAIT_NOT_FOUND"
    TRAIT_DUPLICATED = "TRAIT_DUPLICATED"
    TRAIT_NOT_COMPATIBLE = "TRAIT_NOT_COMPATIBLE"
    TRAIT_COST_EXCEEDED = "TRAIT_COST_EXCEEDED"

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class MatchCreationError(Exception):
    """Raised by the command service when a business rule prevents the match
    from being created. The :attr:`code` attribute drives the HTTP status
    mapping in the controller layer."""

    INVALID_INPUT = "INVALID_INPUT"
    STORY_NOT_FOUND = "STORY_NOT_FOUND"
    DIFFICULTY_NOT_FOUND = "DIFFICULTY_NOT_FOUND"
    USER_NOT_FOUND = "USER_NOT_FOUND"
    USER_BANNED = "USER_BANNED"
    MAINTENANCE_MODE = "MAINTENANCE_MODE"
    STORY_HAS_NO_LOCATIONS = "STORY_HAS_NO_LOCATIONS"
    TURNSTILE_VALIDATION_FAILED = "TURNSTILE_VALIDATION_FAILED"
    # v0.32.1 — the creator already owns a non-terminal match on this story
    ACTIVE_MATCH_ALREADY_EXISTS = "ACTIVE_MATCH_ALREADY_EXISTS"
    # Step 23 — trait selection validation on the creator loadout
    TRAIT_NOT_FOUND = "TRAIT_NOT_FOUND"
    TRAIT_DUPLICATED = "TRAIT_DUPLICATED"
    TRAIT_NOT_COMPATIBLE = "TRAIT_NOT_COMPATIBLE"
    TRAIT_COST_EXCEEDED = "TRAIT_COST_EXCEEDED"

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message
