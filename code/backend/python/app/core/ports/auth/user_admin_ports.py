"""v1.7.0 step 10 — outbound ports of the admin user management (mirror of UserAdminPersistencePort.java and
AdminInterventionPort.java): list, suspension, re-link flag, banned-subject hashes, intervention log."""
from abc import ABC, abstractmethod
from typing import List, Optional

from app.core.models.auth.user_admin import AdminUserItem


class UserAdminPersistencePort(ABC):
    @abstractmethod
    def list_by_nickname(self, state: Optional[int], prefix: str, after_nickname: Optional[str],
                         after_uuid: Optional[str], limit: int) -> List[AdminUserItem]: ...

    @abstractmethod
    def list_by_last_access(self, state: int, after_access: Optional[str], after_uuid: Optional[str],
                            limit: int) -> List[AdminUserItem]: ...

    @abstractmethod
    def find_by_email(self, email: str) -> Optional[AdminUserItem]: ...

    @abstractmethod
    def find_by_uuid(self, uuid: str) -> Optional[AdminUserItem]: ...

    @abstractmethod
    def find_email(self, user_id: int) -> Optional[str]: ...

    @abstractmethod
    def update_state_and_suspension(self, user_id: int, state: int, suspended_until: Optional[str]) -> None: ...

    @abstractmethod
    def is_relink_pending(self, user_id: int) -> bool: ...

    @abstractmethod
    def set_relink_pending(self, user_id: int, pending: bool) -> None: ...

    @abstractmethod
    def replace_identity_subject(self, identity_id: int, user_id: int, subject: str) -> None: ...

    @abstractmethod
    def store_banned_hashes(self, user_uuid: str, hash_sub: Optional[str], hash_email: Optional[str]) -> None: ...

    @abstractmethod
    def delete_banned_hashes(self, user_uuid: str) -> int: ...

    @abstractmethod
    def has_banned_hashes(self, user_uuid: str) -> bool: ...

    @abstractmethod
    def is_banned(self, hash_sub: Optional[str], hash_email: Optional[str]) -> bool: ...


class AdminInterventionPort(ABC):
    @abstractmethod
    def record(self, admin_uuid: Optional[str], action: str, target_uuid: str, reason: str) -> None: ...

    @abstractmethod
    def delete_older_than(self, iso_bound: str) -> int: ...
