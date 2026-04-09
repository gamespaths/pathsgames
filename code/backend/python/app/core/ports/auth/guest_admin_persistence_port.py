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
    def count_all_guests(self) -> int:
        pass

    @abstractmethod
    def count_active_guests(self) -> int:
        pass

    @abstractmethod
    def count_expired_guests(self) -> int:
        pass
