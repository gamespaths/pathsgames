"""Outbound port of refresh token persistence (users_tokens); v1.2.0 tokens stored as SHA-256 hash,
a legacy clear value found is rewritten as hash; v1.7.0 every revocation stores its reason."""
from abc import ABC, abstractmethod
from typing import Optional

from app.core.models.auth import revoke_reasons
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
    def revoke_all_by_user_id(self, user_id: int, reason: str = revoke_reasons.LOGOUT_ALL) -> None: ...

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

    def count_active_by_user_id(self, user_id: int) -> int:
        """v1.7.0 the open (not revoked) refresh sessions of the user (admin user detail)."""
        raise NotImplementedError

    def count_active_issued_after(self, user_id: int, issued_after) -> int:
        """v1.7.0 active (not revoked, not expired) tokens issued at or after the bound (activeSessions)."""
        raise NotImplementedError

    def set_sessions_valid_after(self, user_id: int, valid_after: str) -> None:
        """v1.7.0 users.sessions_valid_after: access tokens issued before it are refused."""
        raise NotImplementedError

    def delete_short_lived_revoked(self, revoked_before: str) -> int:
        """v1.7.0 deletes the ROTATED and LOGOUT rows revoked before the bound; the count removed."""
        raise NotImplementedError
