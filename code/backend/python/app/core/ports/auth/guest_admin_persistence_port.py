from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any

class GuestAdminPersistencePort(ABC):
    @abstractmethod
    def find_all_guests(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def find_guest_by_uuid(self, uuid: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def delete_guest_by_uuid(self, uuid: str) -> bool:
        pass

    @abstractmethod
    def delete_expired_guests(self) -> int:
        pass

    @abstractmethod
    def delete_guests_by_username_like(self, username_like_pattern: str) -> int:
        """Delete all guest users (state=6) whose username matches the given
        SQL LIKE pattern, together with their tokens. Used by the dev-only
        test-data cleanup. Returns the number of guest users removed."""
        pass

    # === v0.36.2: paging and the stale purge ===

    @abstractmethod
    def find_guests_page(self, last_access_before: Optional[str], ts_cursor: Optional[str],
                         id_cursor: Optional[int], limit: int) -> List[Dict[str, Any]]:
        """One keyset page of guests, most recently seen first. ``last_access_before`` is an
        optional ISO-8601 upper bound; the cursor pair continues a previous page. A guest that
        has never been back is ordered by its registration, the only date it has."""

    @abstractmethod
    def find_guest_ids_with_last_access_before(self, before: str) -> List[int]:
        """The ids of every guest last seen before the bound — what a stale purge takes."""

    @abstractmethod
    def delete_guests_by_ids(self, ids: List[int]) -> int:
        """Delete these guests and their tokens. Returns how many guest rows went."""

    @abstractmethod
    def count_all_guests(self) -> int:
        pass

    @abstractmethod
    def count_active_guests(self) -> int:
        pass

    @abstractmethod
    def count_expired_guests(self) -> int:
        pass
