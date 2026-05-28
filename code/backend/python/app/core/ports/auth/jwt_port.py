from abc import ABC, abstractmethod
from app.core.models.auth.token_info import TokenInfo

class JwtPort(ABC):
    @abstractmethod
    def generate_access_token(self, user_uuid: str, username: str, role: str) -> str:
        pass

    @abstractmethod
    def generate_refresh_token(self, user_uuid: str) -> str:
        pass

    @abstractmethod
    def get_access_token_expiration_ms(self) -> int:
        pass

    @abstractmethod
    def get_refresh_token_expiration_ms(self) -> int:
        pass

    @abstractmethod
    def parse_token(self, token: str) -> TokenInfo:
        pass

    @abstractmethod
    def validate_token(self, token: str) -> bool:
        pass
