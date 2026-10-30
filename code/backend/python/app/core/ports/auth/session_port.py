from abc import ABC, abstractmethod
from app.core.models.auth.refreshed_session import RefreshedSession
from app.core.models.auth.token_info import TokenInfo

class SessionPort(ABC):
    @abstractmethod
    def refresh_session(self, refresh_token: str) -> RefreshedSession:
        pass

    @abstractmethod
    def logout(self, refresh_token: str) -> None:
        pass

    @abstractmethod
    def logout_all(self, user_uuid: str) -> None:
        pass

    @abstractmethod
    def validate_access_token(self, access_token: str) -> TokenInfo:
        pass

    def active_sessions(self, user_uuid: str) -> int:
        """v1.7.0 the sessions refreshed in the last 30 days (GET /api/auth/me activeSessions)."""
        return 0

    def purge_revoked_tokens(self) -> int:
        """v1.7.0 daily job: deletes the ROTATED and LOGOUT rows older than 7 days."""
        return 0
