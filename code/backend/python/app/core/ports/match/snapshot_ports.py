"""v0.41.1 Step 41 B — the LIGHT match snapshots of every time-end and their admin list, check and
restore. Mirrors ``SnapshotPort.java`` / ``SnapshotStorePort.java``."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Set

TYPE_LIGHT = "LIGHT"
STATUS_RESTORED = "RESTORED"

CHECKSUM_MISMATCH = "SNAPSHOT_CHECKSUM_MISMATCH"
VERSION_UNKNOWN = "SNAPSHOT_VERSION_UNKNOWN"
STORY_ENTITY_MISSING = "STORY_ENTITY_MISSING"
USER_MISSING = "USER_MISSING"
MATCH_MISMATCH = "MATCH_MISMATCH"

MATCH_NOT_FOUND = "MATCH_NOT_FOUND"
SNAPSHOT_NOT_FOUND = "SNAPSHOT_NOT_FOUND"
SNAPSHOT_INTEGRITY_FAILED = "SNAPSHOT_INTEGRITY_FAILED"


@dataclass(frozen=True)
class CheckError:
    code: str
    message: str


@dataclass(frozen=True)
class SnapshotSummary:
    uuid: str
    clock: int
    type: str
    timestamp: Optional[str]
    description: Optional[str]
    size_bytes: int


@dataclass(frozen=True)
class SnapshotCheck:
    valid: bool
    errors: List[CheckError] = field(default_factory=list)


@dataclass(frozen=True)
class RestoreResult:
    status: str
    uuid_snapshot: str
    clock: int
    match_status: str
    logs_removed: int


class SnapshotError(Exception):
    """MATCH_NOT_FOUND / SNAPSHOT_NOT_FOUND (404) or SNAPSHOT_INTEGRITY_FAILED (409, with errors)."""

    def __init__(self, code: str, message: str, errors: Optional[List[CheckError]] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.errors = list(errors or [])


class SnapshotStorePort(ABC):

    @abstractmethod
    def find_match_by_uuid(self, uuid_match: str) -> Optional[Dict[str, Any]]:
        """``{id, uuid, id_story, status, current_clock, id_user_creator}`` or None."""

    @abstractmethod
    def find_match_by_id(self, id_match: int) -> Optional[Dict[str, Any]]:
        """Same shape, by id."""

    @abstractmethod
    def read_state(self, id_match: int) -> Dict[str, List[Dict[str, Any]]]:
        """Every state table of the match: gaming_match (one row), the characters and their child rows."""

    @abstractmethod
    def log_marks(self, id_match: int) -> Dict[str, int]:
        """The highest log id of the match in every log_* table (0 when it has none)."""

    @abstractmethod
    def insert(self, id_match: int, id_story: int, clock: int, type_: str, payload: str,
               checksum: str, description: str) -> None:
        """One system_snapshot row."""

    @abstractmethod
    def list(self, id_match: int) -> List[Dict[str, Any]]:
        """Newest first, without the payload."""

    @abstractmethod
    def find(self, id_match: int, uuid_snapshot: str) -> Optional[Dict[str, Any]]:
        """One snapshot with its payload and checksum."""

    @abstractmethod
    def prune(self, id_match: int, keep: int) -> int:
        """Keeps the newest ``keep`` snapshots; answers how many were deleted."""

    @abstractmethod
    def existing_story_ids(self, table: str, column: str, id_story: int,
                           ids: Iterable[int]) -> Set[int]:
        """Which of ``ids`` the story still holds in ``table.column``."""

    @abstractmethod
    def existing_user_ids(self, ids: Iterable[int]) -> Set[int]:
        """Which of ``ids`` are still users."""

    @abstractmethod
    def character_users(self, id_match: int) -> Dict[int, Optional[int]]:
        """v0.41.6 — the current owner of every character of the match: character id to user id."""

    @abstractmethod
    def restore(self, id_match: int, id_snapshot: int, state: Dict[str, List[Dict[str, Any]]],
                log_marks: Dict[str, int]) -> int:
        """One transaction: log cut above the marks, rows put back, newer snapshots dropped."""

    @abstractmethod
    def set_status(self, id_match: int, status: str) -> None:
        """The match status alone."""


class SnapshotPort(ABC):

    @abstractmethod
    def write_at_time_end(self, id_match: int) -> None:
        """The hook the time engine calls first at every time-end, before the clock moves."""

    @abstractmethod
    def list(self, uuid_match: str) -> List[SnapshotSummary]:
        """The snapshots of a match, newest first."""

    @abstractmethod
    def check(self, uuid_match: str, uuid_snapshot: str) -> SnapshotCheck:
        """Verifies a snapshot without writing anything."""

    @abstractmethod
    def restore(self, uuid_match: str, uuid_snapshot: str) -> RestoreResult:
        """Rolls the match back, runs the time-start and leaves it PAUSED."""
