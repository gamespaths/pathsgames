"""v0.41.2 Step 41 F — daily UTC KPI counters per story written at event time (best effort) and the
admin report over them. Mirrors ``KpiPort.java`` / ``KpiStorePort.java``."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional

MATCH_STARTED = "MATCH_STARTED"
MATCH_COMPLETED = "MATCH_COMPLETED"
DURATION_MS = "DURATION_MS"
DURATION_CLOCKS = "DURATION_CLOCKS"
COMA = "COMA"
CHOICE = "CHOICE"
LOCATION_VISIT = "LOCATION_VISIT"
MISSION_ACTIVE = "MISSION_ACTIVE"
MISSION_COMPLETED = "MISSION_COMPLETED"
MISSION_FAILED = "MISSION_FAILED"
METRICS = (MATCH_STARTED, MATCH_COMPLETED, DURATION_MS, DURATION_CLOCKS, COMA, CHOICE,
           LOCATION_VISIT, MISSION_ACTIVE, MISSION_COMPLETED, MISSION_FAILED)

GROUP_DAY, GROUP_MONTH, GROUP_TOTAL = "day", "month", "total"
DEFAULT_DAYS = 30
MAX_DAYS = 366
INVALID_INPUT = "INVALID_INPUT"


@dataclass(frozen=True)
class KpiDailyRow:
    story_uuid: str
    day: Optional[str]
    metric: Optional[str]
    ref_uuid: Optional[str]
    value: int


@dataclass(frozen=True)
class KpiRow:
    period: str
    matches_started: int
    matches_completed: int
    completion_rate: Optional[float]
    avg_duration_minutes: Optional[float]
    avg_duration_clocks: Optional[float]
    coma_count: int


@dataclass(frozen=True)
class KpiCount:
    uuid: str
    count: int


@dataclass(frozen=True)
class KpiMission:
    uuid: str
    activated: int
    completed: int
    failed: int


@dataclass(frozen=True)
class KpiReport:
    story_uuid: Optional[str]
    from_day: str
    to_day: str
    group_by: str
    rows: List[KpiRow] = field(default_factory=list)
    choices: List[KpiCount] = field(default_factory=list)
    locations: List[KpiCount] = field(default_factory=list)
    missions: List[KpiMission] = field(default_factory=list)


class KpiError(Exception):
    """Bad query parameters: 400 INVALID_INPUT."""

    def __init__(self, message: str):
        super().__init__(message)
        self.code = INVALID_INPUT
        self.message = message


class KpiPort(ABC):

    @abstractmethod
    def record(self, story_uuid: Optional[str], metric: str, ref_uuid: Optional[str], delta: int) -> None:
        """Adds ``delta`` to today's (UTC) counter; a failure is logged and swallowed."""

    @abstractmethod
    def record_for_match(self, id_match: int, metric: str, ref_uuid: Optional[str], delta: int) -> None:
        """Same as ``record``, the story found through the match."""

    @abstractmethod
    def record_location_visit(self, id_match: int, id_story: int, id_location: int) -> None:
        """LOCATION_VISIT of a location entered for the first time in the match."""

    @abstractmethod
    def report(self, story_uuid: Optional[str], from_day: Optional[str], to_day: Optional[str],
               group_by: Optional[str]) -> KpiReport:
        """The report; blank story = every story summed; raises ``KpiError`` on bad input."""


class KpiStorePort(ABC):

    @abstractmethod
    def increment(self, story_uuid: str, day: str, metric: str, ref_uuid: str, delta: int) -> None:
        """INSERT ... ON CONFLICT (story_uuid, day, metric, ref_uuid) DO UPDATE SET value = value + delta."""

    @abstractmethod
    def find_rows(self, story_uuid: Optional[str], from_day: str, to_day: str) -> List[KpiDailyRow]:
        """Every row with from <= day <= to; None reads every story."""

    @abstractmethod
    def find_story_uuid_by_match(self, id_match: int) -> Optional[str]:
        """The story uuid of a match."""

    @abstractmethod
    def find_location_uuid(self, id_story: int, id_location: int) -> Optional[str]:
        """The uuid of a story location; list_locations is keyed by (id, id_story)."""
