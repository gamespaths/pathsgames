"""v1.2.0 the matches of a user and the one-transaction merge of a guest into a Google user."""
from abc import ABC, abstractmethod
from typing import List

from app.core.models.auth.identity import MatchOwnership


class GuestMergePersistencePort(ABC):
    @abstractmethod
    def matches_of_user(self, user_id: int) -> List[MatchOwnership]: ...

    @abstractmethod
    def apply_merge(self, guest_user_id: int, target_user_id: int, cancel_match_ids: List[int], now: str) -> int:
        """Answers the number of matches moved from the guest to the target."""
