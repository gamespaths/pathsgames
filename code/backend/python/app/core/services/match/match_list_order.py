"""v1.7.0 step 9 the player's match list: active matches first, then last played (ts_update), paged in memory;
the cursor is the position of the next page in the sorted list."""
from typing import List, Optional

from app.core.models.match.match_models import MatchSummary, MatchSummaryPage
from app.core.models.match.match_statuses import ACTIVE
from app.core.services.match.match_stamp import parse_ts

DEFAULT_LIMIT = 50
MAX_LIMIT = 200


def _epoch(value) -> int:
    parsed = parse_ts(value)
    return int(parsed.timestamp() * 1000) if parsed is not None else 0


def _key(m: MatchSummary):
    played = _epoch(m.ts_update) or _epoch(m.ts_insert)
    return (0 if m.status in ACTIVE else 1, -played, -_epoch(m.ts_insert), m.uuid or "")


def sort(matches: Optional[List[MatchSummary]]) -> List[MatchSummary]:
    """A sorted copy: active (CREATED, RUNNING, PAUSED) first, then the latest ts_update."""
    return sorted(matches or [], key=_key)


def clamp_limit(requested) -> int:
    if requested is None:
        return DEFAULT_LIMIT
    try:
        value = int(requested)
    except (TypeError, ValueError):
        return DEFAULT_LIMIT
    return max(1, min(value, MAX_LIMIT))


def offset_of(cursor) -> int:
    """The position carried by the cursor; 0 (first page) when missing or unreadable."""
    if cursor is None or not str(cursor).strip():
        return 0
    try:
        return max(0, int(str(cursor).strip()))
    except ValueError:
        return 0


def page(matches: Optional[List[MatchSummary]], limit=None, cursor=None) -> MatchSummaryPage:
    """One page of the sorted list; next_cursor is None on the last page."""
    ordered = sort(matches)
    size = clamp_limit(limit)
    start = min(offset_of(cursor), len(ordered))
    end = min(start + size, len(ordered))
    return MatchSummaryPage(items=ordered[start:end], next_cursor=str(end) if end < len(ordered) else None,
                            limit=size)
