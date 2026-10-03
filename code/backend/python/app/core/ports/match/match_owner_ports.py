"""v0.41.6 — the admin User tab: owner of a match, user preview by uuid / email / username and the move.
Mirrors ``MatchOwnerPort.java`` and ``UserDirectoryPort.java``."""
from abc import ABC, abstractmethod
from typing import List, Optional

from app.core.models.auth.admin_user import AdminUserView
from app.core.models.match.match_owner import MatchOwnerMoveResult

INVALID_INPUT = "INVALID_INPUT"
MATCH_NOT_FOUND = "MATCH_NOT_FOUND"
USER_NOT_FOUND = "USER_NOT_FOUND"
USER_AMBIGUOUS = "USER_AMBIGUOUS"
MATCH_TERMINATED = "MATCH_TERMINATED"
MATCH_MULTI_CHARACTER = "MATCH_MULTI_CHARACTER"
USER_NOT_ALLOWED = "USER_NOT_ALLOWED"
USER_EXPIRED = "USER_EXPIRED"
ACTIVE_MATCH_ALREADY_EXISTS = "ACTIVE_MATCH_ALREADY_EXISTS"

HTTP_STATUS = {INVALID_INPUT: 400, MATCH_NOT_FOUND: 404, USER_NOT_FOUND: 404}


class MatchOwnerError(Exception):
    """400 INVALID_INPUT, 404 MATCH_NOT_FOUND / USER_NOT_FOUND, 409 for every refusal."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message

    @property
    def http_status(self) -> int:
        return HTTP_STATUS.get(self.code, 409)


class UserDirectoryPort(ABC):
    """Read-only user lookups; the views come back with match_count 0, the service fills it."""

    @abstractmethod
    def find_by_id(self, user_id: int) -> Optional[AdminUserView]:
        ...

    @abstractmethod
    def find_by_uuid(self, uuid: str) -> Optional[AdminUserView]:
        ...

    @abstractmethod
    def find_by_email(self, email: str) -> List[AdminUserView]:
        """Case-insensitive; more than one row means an ambiguous email."""

    @abstractmethod
    def find_by_username(self, username: str) -> List[AdminUserView]:
        ...


class MatchOwnerPort(ABC):

    @abstractmethod
    def owner(self, uuid_match: str) -> AdminUserView:
        ...

    @abstractmethod
    def find_user(self, identifier: str) -> AdminUserView:
        ...

    @abstractmethod
    def move(self, uuid_match: str, identifier: str) -> MatchOwnerMoveResult:
        ...
