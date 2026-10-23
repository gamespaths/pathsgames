"""v1.2.0 links the current guest to the Google user at login: its matches move to the user. v1.7.0 step 9: per
story the Google user's active match always wins, the guest's become CANCELLED; ended ones are kept."""
from datetime import datetime, timezone
from typing import Dict, List, Optional

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


def _active_by_story(matches) -> Dict[int, List[MatchOwnership]]:
    by_story: Dict[int, List[MatchOwnership]] = {}
    for m in matches or []:
        if m.status in ACTIVE:
            by_story.setdefault(m.story_id, []).append(m)
    return by_story


def _older(started: List[MatchOwnership]) -> List[MatchOwnership]:
    """All the active matches of one story but the latest (ties: the higher id)."""
    winner = max(started, key=lambda m: (epoch_millis(m.ts_update), m.id))
    return [m for m in started if m.id != winner.id]


def matches_to_cancel(target: List[MatchOwnership], guest: List[MatchOwnership]) -> List[MatchOwnership]:
    """Per story: when the Google user has an active match every active guest match of that story is cancelled,
    otherwise the guest's survives. Inside one side only the latest ts_update stays (safety net)."""
    target_active, guest_active = _active_by_story(target), _active_by_story(guest)
    cancel: List[MatchOwnership] = []
    for started in target_active.values():
        cancel.extend(_older(started))
    for story_id, started in guest_active.items():
        cancel.extend(started if story_id in target_active else _older(started))
    return cancel


class GuestMergeService:
    def __init__(self, port: GuestMergePersistencePort):
        self.port = port

    def merge(self, guest_user_id: int, target_user_id: int) -> MergeResult:
        if guest_user_id == target_user_id:
            return MergeResult()
        target = list(self.port.matches_of_user(target_user_id))
        guest = list(self.port.matches_of_user(guest_user_id))
        cancel = matches_to_cancel(target, guest)
        ids = [m.id for m in cancel]
        moved = self.port.apply_merge(guest_user_id, target_user_id, ids, datetime.now(timezone.utc).isoformat())
        return MergeResult(moved, ids, [m.uuid for m in cancel])
