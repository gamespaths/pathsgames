"""v0.41.2 Step 41 F — KPI counters at event time (a failure is logged, never raised) and the
day/month/total report; never rolled back by a snapshot restore (decision 44). Mirrors ``KpiService.java``."""
import logging
import re
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Callable, Dict, List, Optional

from app.core.ports.match import kpi_ports as k
from app.core.ports.match.kpi_ports import (
    KpiCount, KpiError, KpiMission, KpiPort, KpiReport, KpiRow, KpiStorePort,
)

logger = logging.getLogger(__name__)
_DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TOTAL_PERIOD = "total"


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


def ratio(numerator: int, denominator: int, scale: int) -> float:
    """HALF_UP rounding of an exact division, like Java's BigDecimal.divide."""
    quantum = Decimal(1).scaleb(-scale)
    return float((Decimal(numerator) / Decimal(denominator)).quantize(quantum, rounding=ROUND_HALF_UP))


class KpiService(KpiPort):

    def __init__(self, store: KpiStorePort, today: Optional[Callable[[], date]] = None) -> None:
        self.store = store
        self._today = today or _utc_today

    # ── writes (best effort) ──────────────────────────────────────────────

    def record(self, story_uuid, metric, ref_uuid, delta) -> None:
        if not story_uuid or not str(story_uuid).strip() or metric not in k.METRICS or not delta:
            return
        try:
            self.store.increment(story_uuid, self._today().isoformat(), metric, ref_uuid or "", int(delta))
        except Exception as exc:  # noqa: BLE001 - a KPI never fails the action
            logger.warning("KPI_RECORD_FAILED story=%s metric=%s: %s", story_uuid, metric, exc)

    def record_for_match(self, id_match, metric, ref_uuid, delta) -> None:
        try:
            story_uuid = self.store.find_story_uuid_by_match(id_match)
        except Exception as exc:  # noqa: BLE001
            logger.warning("KPI_RECORD_FAILED match=%s metric=%s: %s", id_match, metric, exc)
            return
        if story_uuid:
            self.record(story_uuid, metric, ref_uuid, delta)

    def record_location_visit(self, id_match, id_story, id_location) -> None:
        try:
            location_uuid = self.store.find_location_uuid(id_story, id_location)
        except Exception as exc:  # noqa: BLE001
            logger.warning("KPI_RECORD_FAILED match=%s location=%s: %s", id_match, id_location, exc)
            return
        if location_uuid:
            self.record_for_match(id_match, k.LOCATION_VISIT, location_uuid, 1)

    # ── the report ────────────────────────────────────────────────────────

    def report(self, story_uuid, from_day, to_day, group_by) -> KpiReport:
        group = (group_by or "").strip().lower() or k.GROUP_DAY
        if group not in (k.GROUP_DAY, k.GROUP_MONTH, k.GROUP_TOTAL):
            raise KpiError("groupBy must be day, month or total")
        end = self._today() if _blank(to_day) else _parse_day("to", to_day)
        start = end - timedelta(days=k.DEFAULT_DAYS - 1) if _blank(from_day) else _parse_day("from", from_day)
        if start > end:
            raise KpiError("from must not be after to")
        if (end - start).days + 1 > k.MAX_DAYS:
            raise KpiError(f"The range may span at most {k.MAX_DAYS} days")
        story = None if _blank(story_uuid) else story_uuid.strip()
        rows = self.store.find_rows(story, start.isoformat(), end.isoformat())

        periods = _empty_periods(start, end, group)
        choices: Dict[str, int] = {}
        locations: Dict[str, int] = {}
        missions: Dict[str, List[int]] = {}
        for r in rows:
            p = periods.get(_period_of(r.day, group))
            if p is None or r.metric not in k.METRICS:
                continue
            _accumulate(r, p, choices, locations, missions)
        out = [_to_row(period, p) for period, p in periods.items()]
        return KpiReport(story, start.isoformat(), end.isoformat(), group, out,
                         _counts(choices), _counts(locations),
                         [KpiMission(u, v[0], v[1], v[2]) for u, v in sorted(missions.items())])


_PERIOD_SLOT = {k.MATCH_STARTED: 0, k.MATCH_COMPLETED: 1, k.DURATION_MS: 2, k.DURATION_CLOCKS: 3, k.COMA: 4}
_MISSION_SLOT = {k.MISSION_ACTIVE: 0, k.MISSION_COMPLETED: 1, k.MISSION_FAILED: 2}


def _accumulate(r, p, choices, locations, missions) -> None:
    ref = r.ref_uuid or ""
    value = int(r.value or 0)
    if r.metric in _PERIOD_SLOT:
        p[_PERIOD_SLOT[r.metric]] += value
    elif r.metric == k.CHOICE:
        choices[ref] = choices.get(ref, 0) + value
    elif r.metric == k.LOCATION_VISIT:
        locations[ref] = locations.get(ref, 0) + value
    else:
        missions.setdefault(ref, [0, 0, 0])[_MISSION_SLOT[r.metric]] += value


def _to_row(period: str, p: List[int]) -> KpiRow:
    rate = None if p[0] == 0 else ratio(p[1], p[0], 4)
    minutes = None if p[1] == 0 else ratio(p[2], p[1] * 60_000, 2)
    clocks = None if p[1] == 0 else ratio(p[3], p[1], 2)
    return KpiRow(period, p[0], p[1], rate, minutes, clocks, p[4])


def _empty_periods(start: date, end: date, group: str) -> Dict[str, List[int]]:
    if group == k.GROUP_TOTAL:
        return {TOTAL_PERIOD: [0] * 5}
    periods: Dict[str, List[int]] = {}
    day = start
    while day <= end:
        key = day.isoformat()[:7] if group == k.GROUP_MONTH else day.isoformat()
        periods.setdefault(key, [0] * 5)
        day += timedelta(days=1)
    return periods


def _period_of(day: Optional[str], group: str) -> str:
    if day is None:
        return ""
    if group == k.GROUP_TOTAL:
        return TOTAL_PERIOD
    return day[:7] if group == k.GROUP_MONTH and len(day) >= 7 else day


def _counts(by_uuid: Dict[str, int]) -> List[KpiCount]:
    return [KpiCount(u, c) for u, c in sorted(by_uuid.items(), key=lambda kv: (-kv[1], kv[0]))]


def _parse_day(name: str, value: str) -> date:
    v = str(value).strip()
    if not _DAY.match(v):
        raise KpiError(f"{name} must be a UTC date YYYY-MM-DD")
    try:
        return date.fromisoformat(v)
    except ValueError:
        raise KpiError(f"{name} must be a UTC date YYYY-MM-DD") from None


def _blank(value) -> bool:
    return value is None or not str(value).strip()
