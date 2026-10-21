"""Outbound port of refresh token persistence (users_tokens); v1.2.0 tokens stored as SHA-256 hash,
a legacy clear value found is rewritten as hash."""
from abc import ABC, abstractmethod
from typing import Optional

from app.core.models.auth.identity import StoredRefreshToken, UserStatus


class TokenPersistencePort(ABC):
    @abstractmethod
    def find_refresh_token(self, token_hash: str, legacy_clear: Optional[str]) -> Optional[StoredRefreshToken]: ...

    @abstractmethod
    def mark_rotated(self, token_id: int, now: str) -> None: ...

    @abstractmethod
    def revoke_refresh_token(self, token_hash: str, legacy_clear: Optional[str]) -> bool: ...

    @abstractmethod
    def revoke_all_by_user_uuid(self, user_uuid: str) -> None: ...

    @abstractmethod
    def revoke_all_by_user_id(self, user_id: int) -> None: ...

    @abstractmethod
    def store_refresh_token(self, user_id: int, token_hash: str, expires_at: str) -> None: ...

    @abstractmethod
    def find_user_id_by_uuid(self, user_uuid: str) -> Optional[int]: ...

    @abstractmethod
    def enforce_token_limit(self, user_id: int, max_tokens: int) -> None: ...

    @abstractmethod
    def find_user_by_id(self, user_id: int) -> Optional[UserStatus]: ...

    @abstractmethod
    def update_last_access(self, user_id: int) -> None: ...
