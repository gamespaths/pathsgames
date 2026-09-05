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
    def list_guests_page(self, older_than_days=None, cursor=None, limit=None):
        """v0.36.2 — one page of guests, most recently seen first. The console asked for the
        whole table before this, which on a real dataset is a scan and a timeout."""

    @abstractmethod
    def preview_stale_guests(self, older_than_days: int):
        """How many guests, and how many of their matches, a purge at this bound would take."""

    @abstractmethod
    def delete_stale_guests(self, older_than_days: int):
        """Delete every guest last seen more than N days ago, AND every match they created —
        whatever its status. Matches go first: a match references its creator by foreign key."""

    @abstractmethod
    def get_guest_stats(self) -> GuestStats:
        """Returns aggregate guest statistics."""
        pass
