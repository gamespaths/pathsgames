"""v0.41.4 Step 41 H — the neutral "match export v1": export, dry-run check and import on any backend
(decisions 45-66). Mirrors ``MatchExportPort.java`` / ``MatchExportStorePort.java``."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional

FORMAT = "paths-games-match-export"
FORMAT_VERSION = 1
MODE_AUTO, MODE_KEEP, MODE_REPLACE = "AUTO", "KEEP", "REPLACE"

# check errors
CHECKSUM_MISMATCH = "CHECKSUM_MISMATCH"
FORMAT_UNKNOWN = "FORMAT_UNKNOWN"
SCHEMA_INVALID = "SCHEMA_INVALID"
REFERENCE_INVALID = "REFERENCE_INVALID"
STORY_INVALID = "STORY_INVALID"
STORY_DIFFERS = "STORY_DIFFERS"
STORY_ENTITY_MISSING = "STORY_ENTITY_MISSING"
MATCH_EXISTS = "MATCH_EXISTS"
CHARACTER_EXISTS = "CHARACTER_EXISTS"
# check warnings
APP_VERSION_DIFFERS = "APP_VERSION_DIFFERS"
CROSS_FAMILY = "CROSS_FAMILY"
USERNAME_RENAMED = "USERNAME_RENAMED"
# Decision 54 (revised): a new user matched by e-mail onto an existing one of the target.
USER_MAPPED_BY_EMAIL = "USER_MAPPED_BY_EMAIL"
ROLE_DOWNGRADED = "ROLE_DOWNGRADED"
USER_HAS_ACTIVE_MATCH = "USER_HAS_ACTIVE_MATCH"
STORY_MATCHES_DELETED = "STORY_MATCHES_DELETED"
MARKERS_RECONCILED = "MARKERS_RECONCILED"
VISITED_LOCATIONS_DIFFER = "VISITED_LOCATIONS_DIFFER"
ACTIVE_CHOICES_IGNORED = "ACTIVE_CHOICES_IGNORED"

# exception codes and their HTTP status
STATUS = {"MATCH_NOT_FOUND": 404, "NO_SNAPSHOT": 409, "SNAPSHOT_INTEGRITY_FAILED": 409, "EXPORT_TOO_LARGE": 413,
          "IMPORT_TOO_LARGE": 413, "IMPORT_INVALID": 422, MATCH_EXISTS: 409, STORY_DIFFERS: 409,
          CHARACTER_EXISTS: 409, "IMPORT_TIME_START_FAILED": 500}


@dataclass(frozen=True)
class Issue:
    code: str
    message: str


@dataclass(frozen=True)
class ExportResult:
    document: Dict[str, Any]
    canonical: str
    file_name: str


class MatchExportError(Exception):
    """A refused export or import: ``code`` (see STATUS) plus the check errors when there are some."""

    def __init__(self, code: str, message: str, errors: Optional[List[Issue]] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.errors = list(errors or [])

    @property
    def status(self) -> int:
        return STATUS.get(self.code, 500)


@dataclass
class ImportRows:
    """Native rows of an import; id_user_creator / id_user hold user uuids, resolved by the store."""
    replace_uuid: Optional[str]
    new_users: List[Dict[str, Any]]
    match: Dict[str, Any]
    characters: List[Dict[str, Any]]
    child_rows: Dict[str, List[Dict[str, Any]]]
    logs: List[tuple] = field(default_factory=list)  # (table, columns)
    active_ordinal: Optional[int] = None


class MatchExportStorePort(ABC):

    @abstractmethod
    def dialect(self) -> str:
        """"sqlite" or "postgresql"."""

    @abstractmethod
    def log_rows(self, id_match: int, table: str, mark: int) -> List[Dict[str, Any]]:
        """Rows of one log_* table of the match with id <= mark, in id order."""

    @abstractmethod
    def users_by_ids(self, ids: Iterable[int]) -> Dict[int, Dict[str, Any]]:
        """users rows by id, never a secret column."""

    @abstractmethod
    def user_by_uuid(self, uuid: str) -> Optional[Dict[str, Any]]:
        """One user by uuid, never a secret column."""

    @abstractmethod
    def user_by_email(self, email: Optional[str]) -> Optional[Dict[str, Any]]:
        """The user with this e-mail (case-insensitive), never a secret column."""

    @abstractmethod
    def username_taken(self, username: str) -> bool:
        """True when another user has the username."""

    @abstractmethod
    def story_id_by_uuid(self, story_uuid: str) -> Optional[int]:
        """The story id on this server."""

    @abstractmethod
    def story_uuid_by_id(self, id_story: int) -> Optional[str]:
        """The story uuid of an id."""

    @abstractmethod
    def story_location_ids(self, id_story: int) -> List[int]:
        """The story location ids (one gaming_state_locations row each)."""

    @abstractmethod
    def count_matches_of_story(self, id_story: int) -> int:
        """How many matches the story has."""

    @abstractmethod
    def active_matches_of(self, user_uuids: Iterable[str], id_story: int,
                          exclude_match_uuid: Optional[str]) -> List[Dict[str, Any]]:
        """CREATED/RUNNING matches created by these users on the story."""

    @abstractmethod
    def match_exists(self, uuid_match: str) -> bool:
        """True when the match uuid is taken."""

    @abstractmethod
    def match_of_character(self, character_uuid: str) -> Optional[str]:
        """The uuid of the match owning the character."""

    @abstractmethod
    def insert_imported(self, rows: ImportRows) -> int:
        """One session and one commit: replaced match deleted, users, match, characters, rows, logs."""
