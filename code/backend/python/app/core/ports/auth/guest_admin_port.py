from abc import ABC, abstractmethod
from typing import List, Optional
from app.core.models.auth.guest_info import GuestInfo
from app.core.models.auth.guest_stats import GuestStats

class GuestAdminPort(ABC):
    @abstractmethod
    def list_all_guests(self) -> List[GuestInfo]:
        """Lists all guest users."""
        pass

    @abstractmethod
    def get_guest_by_uuid(self, uuid: str) -> Optional[GuestInfo]:
        """Returns details of a single guest user by UUID."""
        pass

    @abstractmethod
    def delete_guest(self, uuid: str) -> bool:
        """Deletes a guest user and their tokens."""
        pass

    @abstractmethod
    def delete_expired_guests(self) -> int:
        """Removes all expired guest sessions."""
        pass

    @abstractmethod
    def get_guest_stats(self) -> GuestStats:
        """Returns aggregate guest statistics."""
        pass
