"""
StoryCrudPort — Inbound port for Step 17 generic admin CRUD.
Provides create, read, update, delete for all story sub-entities.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional


class StoryCrudPort(ABC):
    @abstractmethod
    def list_entities(self, story_uuid: str, entity_type: str) -> Optional[List[Dict[str, Any]]]:
        """List all entities of a type within a story. Returns None if story not found."""
        pass

    @abstractmethod
    def get_entity(self, story_uuid: str, entity_type: str, entity_uuid: str) -> Optional[Dict[str, Any]]:
        """Get a single entity by UUID. Returns None if not found."""
        pass

    @abstractmethod
    def create_entity(self, story_uuid: str, entity_type: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new entity. Returns None if story not found or data invalid."""
        pass

    @abstractmethod
    def update_entity(self, story_uuid: str, entity_type: str, entity_uuid: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update an entity. Returns None if not found."""
        pass

    @abstractmethod
    def delete_entity(self, story_uuid: str, entity_type: str, entity_uuid: str) -> bool:
        """Delete an entity. Returns True if deleted, False if not found."""
        pass

    @abstractmethod
    def get_story(self, story_uuid: str) -> Optional[Dict[str, Any]]:
        """Get a single story by UUID. Returns None if not found."""
        pass

    @abstractmethod
    def create_story(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new story."""
        pass

    @abstractmethod
    def update_story(self, story_uuid: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update story metadata. Returns None if not found."""
        pass
