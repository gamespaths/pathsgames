"""Step 19 — domain models for the single-player match flow."""
from dataclasses import dataclass, field
from typing import List, Optional


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
class MatchDetail:
    match: MatchSummary
    current_location_id: Optional[int] = None
    current_location_uuid: Optional[str] = None
    current_location_name: Optional[str] = None
    locations: List[MatchLocationState] = field(default_factory=list)
    registry: List[MatchRegistryEntry] = field(default_factory=list)
    events: List[MatchEventOption] = field(default_factory=list)
    choices: List[MatchEventOption] = field(default_factory=list)


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

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message
