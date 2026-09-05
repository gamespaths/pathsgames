import base64
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from app.core.models.auth.guest_info import GuestInfo
from app.core.models.auth.guest_stats import GuestStats
from app.core.ports.auth.guest_admin_port import GuestAdminPort
from app.core.ports.auth.guest_admin_persistence_port import GuestAdminPersistencePort

#: Page size when the caller names none, and the ceiling whatever it names.
DEFAULT_PAGE_LIMIT = 50
MAX_PAGE_LIMIT = 200


class GuestAdminService(GuestAdminPort):
    def __init__(self, persistence_port: GuestAdminPersistencePort,
                 match_persistence_port=None):
        self.persistence_port = persistence_port
        # None on the bare constructor: the stale purge then refuses rather than
        # orphaning matches behind a deleted creator.
        self.match_persistence_port = match_persistence_port

    def list_guests_page(self, older_than_days=None, cursor=None, limit=None):
        page_limit = _clamp_limit(limit)
        pair = _decode_cursor(cursor)
        # Over-fetch one row to learn whether a further page exists.
        rows = self.persistence_port.find_guests_page(
            _bound_of(older_than_days),
            pair[0] if pair else None,
            pair[1] if pair else None,
            page_limit + 1)
        has_more = len(rows) > page_limit
        page_rows = rows[:page_limit] if has_more else rows
        next_cursor = None
        if has_more and page_rows:
            last = page_rows[-1]
            next_cursor = _encode_cursor(_seen_at(last), last.get("id"))
        return {
            "items": [self._to_guest_info(r) for r in page_rows],
            "next_cursor": next_cursor,
            "limit": page_limit,
        }

    def preview_stale_guests(self, older_than_days: int):
        ids = self.persistence_port.find_guest_ids_with_last_access_before(
            _bound_of(older_than_days))
        if not ids or self.match_persistence_port is None:
            return {"guests": len(ids), "matches": 0}
        return {"guests": len(ids),
                "matches": self.match_persistence_port.count_matches_by_user_creator_ids(ids)}

    def delete_stale_guests(self, older_than_days: int):
        ids = self.persistence_port.find_guest_ids_with_last_access_before(
            _bound_of(older_than_days))
        if not ids:
            return {"guests": 0, "matches": 0}
        # Matches before guests: a match references its creator by foreign key, so the
        # children must go first — the ordering the test-data cleanup already relies on.
        matches = (0 if self.match_persistence_port is None
                   else self.match_persistence_port.delete_matches_by_user_creator_ids(ids))
        return {"guests": self.persistence_port.delete_guests_by_ids(ids), "matches": matches}

    def list_all_guests(self) -> List[GuestInfo]:
        guests_data = self.persistence_port.find_all_guests()
        return [self._to_guest_info(data) for data in guests_data]

    def get_guest_by_uuid(self, uuid: str) -> Optional[GuestInfo]:
        if not uuid:
            return None
        guest_data = self.persistence_port.find_guest_by_uuid(uuid)
        if not guest_data:
            return None
        return self._to_guest_info(guest_data)

    def delete_guest(self, uuid: str) -> bool:
        if not uuid:
            return False
        return self.persistence_port.delete_guest_by_uuid(uuid)

    def delete_expired_guests(self) -> int:
        return self.persistence_port.delete_expired_guests()

    def get_guest_stats(self) -> GuestStats:
        total = self.persistence_port.count_all_guests()
        active = self.persistence_port.count_active_guests()
        expired = self.persistence_port.count_expired_guests()
        return GuestStats(
            total_guests=total,
            active_guests=active,
            expired_guests=expired
        )

    def _to_guest_info(self, data: Dict[str, Any]) -> GuestInfo:
        expires_at = data.get("guest_expires_at")
        expired = self._is_expired(expires_at)

        return GuestInfo(
            userUuid=data.get("uuid"),
            username=data.get("username"),
            nickname=data.get("nickname"),
            role=data.get("role", "PLAYER"),
            state=data.get("state", 6),
            guestCookieToken=data.get("guest_cookie_token"),
            guestExpiresAt=expires_at,
            language=data.get("language"),
            tsRegistration=data.get("ts_registration"),
            tsLastAccess=data.get("ts_last_access"),
            expired=expired
        )

    def _is_expired(self, expires_at: Optional[str]) -> bool:
        if not expires_at:
            return False
        try:
            # Handle ISO format
            dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            return datetime.now(timezone.utc) > dt
        except Exception:
            return False


def _bound_of(older_than_days):
    """The ISO-8601 instant N days ago, or None when the caller named no bound."""
    if older_than_days is None or int(older_than_days) < 0:
        return None
    return (datetime.now(timezone.utc) - timedelta(days=int(older_than_days))).isoformat()


def _seen_at(row):
    """When a guest was last seen: its last access, or its registration if it never came back."""
    return row.get("ts_last_access") or row.get("ts_registration")


def _clamp_limit(requested):
    if requested is None:
        return DEFAULT_PAGE_LIMIT
    return max(1, min(int(requested), MAX_PAGE_LIMIT))


def _encode_cursor(seen_at, row_id):
    """The same opaque "<timestamp>|<id>" token the admin match list uses."""
    raw = f"{seen_at}|{row_id}".encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _decode_cursor(cursor):
    """None for a missing or malformed token, so the query restarts at page one, never fails."""
    if not cursor or not str(cursor).strip():
        return None
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode(padded).decode("utf-8")
        seen_at, _, id_part = raw.rpartition("|")
        if not seen_at or not id_part:
            return None
        return (seen_at, int(id_part))
    except (ValueError, TypeError):
        return None
