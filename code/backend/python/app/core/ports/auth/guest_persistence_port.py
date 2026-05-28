from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

class GuestPersistencePort(ABC):
    @abstractmethod
    def create_guest_user(self, user_uuid: str, username: str, guest_cookie_token: str, expires_at_iso: str) -> int:
        pass

    @abstractmethod
    def find_guest_by_cookie_token(self, guest_cookie_token: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def store_refresh_token(self, user_id: int, refresh_token: str, expires_at: str) -> None:
        pass

    @abstractmethod
    def update_last_access(self, user_id: int) -> None:
        pass

    @abstractmethod
    def delete_expired_guests(self) -> int:
        pass
