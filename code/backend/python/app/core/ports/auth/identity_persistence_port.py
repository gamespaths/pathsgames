"""v1.2.0 users, users_identities and the ID-token replay store (mirror of IdentityPersistencePort.java)."""
from abc import ABC, abstractmethod
from typing import List, Optional

from app.core.models.auth.identity import NewUser, UserIdentity, UserStatus


class IdentityPersistencePort(ABC):
    @abstractmethod
    def find_identity_by_email(self, provider: str, email: str) -> Optional[UserIdentity]: ...

    @abstractmethod
    def find_identities_of_user(self, user_id: int) -> List[UserIdentity]: ...

    @abstractmethod
    def find_user_by_id(self, user_id: int) -> Optional[UserStatus]: ...

    @abstractmethod
    def find_user_by_uuid(self, uuid: str) -> Optional[UserStatus]: ...

    @abstractmethod
    def find_user_by_nickname(self, nickname: str) -> Optional[UserStatus]: ...

    @abstractmethod
    def find_user_by_email(self, email: str) -> Optional[UserStatus]: ...

    @abstractmethod
    def nickname_exists(self, nickname: str) -> bool: ...

    @abstractmethod
    def create_user(self, user: NewUser, identity: Optional[UserIdentity]) -> int:
        """One transaction: the user and its identity; raises DuplicateUserError on a clash."""

    @abstractmethod
    def create_identity(self, user_id: int, identity: UserIdentity) -> None: ...

    @abstractmethod
    def update_identity_profile(self, identity_id: int, profile: UserIdentity) -> None: ...

    @abstractmethod
    def update_last_access(self, user_id: int) -> None: ...

    @abstractmethod
    def update_state(self, user_id: int, state: int) -> None: ...

    def find_theme_selected(self, user_id: int) -> Optional[str]:
        """v1.7.0 users.theme_selected of the user; None when unknown or not set."""
        raise NotImplementedError

    def update_preferences(self, user_id: int, language: Optional[str], theme: Optional[str]) -> None:
        """v1.7.0 users.language and users.theme_selected; a None value is left unchanged."""
        raise NotImplementedError

    @abstractmethod
    def mark_id_token_seen(self, token_hash: str, expires_at: str) -> bool:
        """False when the hash is already stored (a replayed ID token)."""

    @abstractmethod
    def delete_expired_id_tokens(self, now: str) -> int: ...

    @abstractmethod
    def find_user_ids_by_state(self, state: int, limit: int) -> List[int]: ...

    @abstractmethod
    def find_inactive_identity_user_ids(self, last_access_before: str, limit: int) -> List[int]: ...

    @abstractmethod
    def delete_user_fully(self, user_id: int) -> None:
        """Identities, tokens and the user; its matches must be gone already."""

    @abstractmethod
    def find_non_guest_user_ids_by_nickname_like(self, pattern: str) -> List[int]: ...
