"""v1.2.0 links the current guest to the Google user at login: its matches move to the user; per story the
STARTED match with the latest ts_update wins, the others become CANCELLED; ended ones are kept."""
from datetime import datetime, timezone
from typing import List, Optional

from app.core.models.auth.identity import MatchOwnership, MergeResult
from app.core.ports.auth.guest_merge_persistence_port import GuestMergePersistencePort

ACTIVE = {"CREATED", "RUNNING", "PAUSED"}


def epoch_millis(ts: Optional[str]) -> int:
    """ISO-8601 or SQLite "yyyy-MM-dd HH:mm:ss" (UTC) to epoch millis; 0 when unreadable."""
    if ts is None or not str(ts).strip():
        return 0
    text = str(ts).strip().replace(" ", "T").replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return 0
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp() * 1000)


def matches_to_cancel(matches: List[MatchOwnership]) -> List[int]:
    by_story = {}
    for m in matches:
        if m.status in ACTIVE:
            by_story.setdefault(m.story_id, []).append(m)
    cancel = []
    for started in by_story.values():
        if len(started) > 1:
            winner = max(started, key=lambda m: (epoch_millis(m.ts_update), m.id))
            cancel.extend(m.id for m in started if m.id != winner.id)
    return cancel


class GuestMergeService:
    def __init__(self, port: GuestMergePersistencePort):
        self.port = port

    def merge(self, guest_user_id: int, target_user_id: int) -> MergeResult:
        if guest_user_id == target_user_id:
            return MergeResult()
        everything = list(self.port.matches_of_user(target_user_id)) + list(self.port.matches_of_user(guest_user_id))
        cancel = matches_to_cancel(everything)
        moved = self.port.apply_merge(guest_user_id, target_user_id, cancel, datetime.now(timezone.utc).isoformat())
        return MergeResult(moved, cancel)
