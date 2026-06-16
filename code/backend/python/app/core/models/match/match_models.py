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
class MatchLocationState:
    id_location: int
    uuid: str
    flag_already_actived: int
    clock_counter: int
    name: Optional[str] = None


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
class ItemInstanceInfo:
    """Step 27 — a single item carried by a character inside a match."""

    uuid: str
    item_uuid: Optional[str] = None
    name: Optional[str] = None
    weight: int = 0
    amount: int = 1
    state: Optional[str] = None


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
    location_name: Optional[str] = None
    is_sleeping: int = 0
    is_coma: int = 0
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
    """Step 27.x — an event available at a player-occupied location, with its
    resolved visual card (a camelCase dict mirroring CardInfoResponse)."""

    uuid: str
    type: Optional[str] = None
    end_game: bool = False
    card: Optional[Dict[str, Any]] = None


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


@dataclass
class LocationInfo:
    """Step 27.x — a location occupied by one or more players, enriched with its
    card, the neighbor locations reachable from it and the events specific to it."""

    id_location: int
    uuid: Optional[str] = None
    card: Optional[Dict[str, Any]] = None
    neighbors: List[LocationNeighborInfo] = field(default_factory=list)
    events: List[EventInfo] = field(default_factory=list)


@dataclass
class MatchDetail:
    match: MatchSummary
    current_location_id: Optional[int] = None
    current_location_uuid: Optional[str] = None
    current_location_name: Optional[str] = None
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
    # Step 23 — trait selection validation on the creator loadout
    TRAIT_NOT_FOUND = "TRAIT_NOT_FOUND"
    TRAIT_DUPLICATED = "TRAIT_DUPLICATED"
    TRAIT_NOT_COMPATIBLE = "TRAIT_NOT_COMPATIBLE"
    TRAIT_COST_EXCEEDED = "TRAIT_COST_EXCEEDED"

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message
