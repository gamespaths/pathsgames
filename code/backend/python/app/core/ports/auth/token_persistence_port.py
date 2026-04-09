from abc import ABC, abstractmethod
from app.core.models.auth.token_info import TokenInfo
from typing import Optional

class TokenPersistencePort(ABC):
    @abstractmethod
    def save_refresh_token(self, user_uuid: str, refresh_token: str, token_info: TokenInfo) -> None:
        pass

    @abstractmethod
    def revoke_token(self, refresh_token: str) -> None:
        pass

    @abstractmethod
    def revoke_all_by_user_uuid(self, user_uuid: str) -> None:
        pass

    @abstractmethod
    def is_refresh_token_valid(self, refresh_token: str) -> bool:
        pass

    @abstractmethod
    def find_user_id_by_uuid(self, user_uuid: str) -> Optional[int]:
        pass

    @abstractmethod
    def enforce_token_limit(self, user_id: int, max_tokens: int) -> None:
        pass
