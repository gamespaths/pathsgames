"""v1.7.0 the stamp of a match: ts_update and the play_ms counter. Mirrors ``MatchStampStorePort.java``."""
from abc import ABC, abstractmethod
from typing import Optional


class MatchStampStorePort(ABC):
    @abstractmethod
    def find_ts_update(self, match_uuid: str) -> Optional[str]:
        """The ts_update of the match, None when no match has the uuid."""

    @abstractmethod
    def stamp(self, match_uuid: str, ts_update: str, play_ms_delta: int) -> bool:
        """Sets ts_update and adds the delta to play_ms; False when no match has the uuid."""

    @abstractmethod
    def claim(self, match_uuid: str, old_version: str, new_version: str, play_ms_delta: int) -> bool:
        """v1.7.0 step 8 conditional update: True only when ts_update still was old_version."""
