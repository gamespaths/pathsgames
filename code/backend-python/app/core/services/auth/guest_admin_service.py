from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from app.core.models.auth.guest_info import GuestInfo
from app.core.models.auth.guest_stats import GuestStats
from app.core.ports.auth.guest_admin_port import GuestAdminPort
from app.core.ports.auth.guest_admin_persistence_port import GuestAdminPersistencePort

class GuestAdminService(GuestAdminPort):
    def __init__(self, persistence_port: GuestAdminPersistencePort):
        self.persistence_port = persistence_port

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
