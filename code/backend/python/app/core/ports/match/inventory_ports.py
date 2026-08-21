"""Ports of the Step 34 inventory and the Step 35 resources.

Mirrors the Java `InventoryPort` / `InventoryStorePort` pair. Everything the effect
engine already owns — the backpack, the stats, the traits — is reused from
`EventStorePort` rather than duplicated here.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class InventoryError(Exception):
    """Domain error mapped to HTTP status codes by the controller.

    Deliberately a separate vocabulary from `EventError`: those codes double as the
    ``reason`` of an unavailable event on match-info, where ITEM_NOT_CONSUMABLE would
    mean nothing.
    """

    # Unknown match, unknown user, or the caller owns no character in it.
    MATCH_NOT_FOUND = "MATCH_NOT_FOUND"
    MATCH_NOT_RUNNING = "MATCH_NOT_RUNNING"
    SLEEPING = "SLEEPING"
    COMA = "COMA"
    # Unknown row uuid — or a row belonging to another character, masked as unknown.
    ITEM_NOT_FOUND = "ITEM_NOT_FOUND"
    ITEM_NOT_CONSUMABLE = "ITEM_NOT_CONSUMABLE"
    ITEM_CLASS_NOT_PERMITTED = "ITEM_CLASS_NOT_PERMITTED"
    ITEM_CLASS_PROHIBITED = "ITEM_CLASS_PROHIBITED"

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class InventoryPort(ABC):
    """Inbound port: four operations, all scoped to the calling user's character."""

    @abstractmethod
    def list_inventory(self, match_uuid: str, user_uuid: str,
                       lang: str) -> Dict[str, Any]:
        """The caller's items, carried weight and capacity."""

    @abstractmethod
    def use_item(self, match_uuid: str, user_uuid: str, item_instance_uuid: str,
                 lang: str):
        """Consume one item. Answers the execute-event payload: an item carrying a
        SADNESS effect can trigger the step-30 overflow or coma."""

    @abstractmethod
    def drop_item(self, match_uuid: str, user_uuid: str,
                  item_instance_uuid: str) -> Dict[str, Any]:
        """Discard one item. No recipient: transferring is multiplayer."""

    @abstractmethod
    def get_resources(self, match_uuid: str, user_uuid: str) -> Dict[str, Any]:
        """Step 35 — food, magic, coin and the carried weight."""


class InventoryStorePort(ABC):
    """Outbound port."""

    @abstractmethod
    def find_match_by_uuid(self, match_uuid: str) -> Optional[Dict[str, Any]]:
        """{id, uuid, status, id_story} or None."""

    @abstractmethod
    def find_character_by_match_and_user(self, id_match: int,
                                         id_user: int) -> Optional[Dict[str, Any]]:
        """{id, uuid, id_class, is_sleeping, is_coma, weight_max} or None."""

    @abstractmethod
    def find_inventory(self, id_match: int, id_character: int) -> List[Dict[str, Any]]:
        """Every inventory row of one character, in id order, INCLUDING its ``id``:
        the row is what use-item and drop-item delete."""

    @abstractmethod
    def find_items_by_id(self, id_story: int) -> Dict[int, Dict[str, Any]]:
        """The story items keyed by id."""

    @abstractmethod
    def find_item_effects_by_item_id(self, id_story: int) -> Dict[int, List[Dict[str, Any]]]:
        """Every list_items_effects row of the story, grouped by id_item, in id order."""

    @abstractmethod
    def delete_inventory_row(self, id_match: int, id_row: int) -> None:
        """Remove one row entirely: amount is never decremented (frozen step-34 decision)."""

    @abstractmethod
    def find_backpack(self, id_match: int, id_character: int) -> Optional[Dict[str, Any]]:
        """{food, magic, coin} or None when the row was never written."""

    @abstractmethod
    def log_item_usage(self, id_match: int, id_character: int, id_item: int,
                       effects_json: str) -> None:
        """Append one log_item_usage row. The table carries UNIQUE (id), so the id comes
        from the table-wide maximum, not from a per-match one."""
