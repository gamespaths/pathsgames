"""Step 36 — the only door to gaming_state_registry.

Before it, four readers disagreed on how a row becomes a string and three writers on how a
string becomes a row. Rows cross this port as plain dicts, never as ORM entities.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class RegistryStorePort(ABC):
    """Reads and writes of the match registry, plus the audit row every write leaves."""

    @abstractmethod
    def find_by_match(self, id_match: int) -> List[Dict[str, Any]]:
        """Every row of the match: id, uuid, key, string_value, int_value, id_character,
        id_event, id_choice, clock, multi_value. Step 36.1 — one row per VALUE, so a
        multi-valued key owns several of them."""

    @abstractmethod
    def find_by_match_and_key(self, id_match: int, key: str) -> List[Dict[str, Any]]:
        """Every row of one key: one for a single key, N for a multi-valued one, none when
        the key is absent or its set is empty."""

    @abstractmethod
    def upsert(self, id_match: int, key: str, string_value: Optional[str],
               int_value: Optional[int], id_character: Optional[int],
               id_event: Optional[int], id_choice: Optional[int],
               clock: Optional[int]) -> None:
        """Replace the one row of a SINGLE key. The id and uuid of a new row are minted here."""

    @abstractmethod
    def insert_value(self, id_match: int, key: str, string_value: Optional[str],
                     int_value: Optional[int], id_character: Optional[int],
                     id_event: Optional[int], id_choice: Optional[int],
                     clock: Optional[int]) -> None:
        """Add one member to a MULTI key. The caller has already ruled out a duplicate."""

    @abstractmethod
    def delete_value(self, id_match: int, key: str, string_value: Optional[str],
                     int_value: Optional[int]) -> None:
        """Delete the row holding one member of a MULTI key."""

    @abstractmethod
    def insert_all(self, id_match: int, rows: List[Dict[str, Any]]) -> None:
        """Bulk insert used only by match creation, where ids start at 1."""

    @abstractmethod
    def delete_by_match_ids(self, match_ids: List[int]) -> None:
        """Cleanup path."""

    @abstractmethod
    def log_change(self, id_match: int, id_character: Optional[int], id_event: Optional[int],
                   id_choice: Optional[int], clock: Optional[int], message: str) -> None:
        """Audit row on log_events; the message carries the key and the two values."""
