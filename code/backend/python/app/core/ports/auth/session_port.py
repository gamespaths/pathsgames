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
