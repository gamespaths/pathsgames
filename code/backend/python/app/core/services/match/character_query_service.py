"""Step 21 — character read-side service (players list, character detail)."""
from typing import Any, Dict, List, Optional

from app.core.models.match.match_models import CharacterInstanceInfo, ItemInstanceInfo
from app.core.ports.match.match_ports import (
    CharacterQueryPort,
    CharacterReadPort,
    MatchPersistencePort,
    StoryMatchReadPort,
    UserAccessPort,
)


def build_character_infos(
    characters: List[Dict[str, Any]],
    match: Dict[str, Any],
    story_read_port: StoryMatchReadPort,
    character_read_port: CharacterReadPort,
    requester_uuid: Optional[str],
    requester_id: Optional[int],
) -> List[CharacterInstanceInfo]:
    """Shared mapping helper used by the players list and by MatchQueryService."""
    if not characters:
        return []
    story_id = match.get("id_story")
    template_uuid_by_id: Dict[int, str] = {}
    trait_uuid_by_id: Dict[int, str] = {}
    location_by_id: Dict[int, Dict[str, Any]] = {}
    item_by_id: Dict[int, Dict[str, Any]] = {}
    if story_id is not None:
        for t in story_read_port.find_character_templates_by_story_id(story_id):
            template_uuid_by_id[t["id_tipo"]] = t["uuid"]
        for t in story_read_port.find_traits_by_story_id(story_id):
            trait_uuid_by_id[t["id"]] = t["uuid"]
        for loc in story_read_port.find_locations_by_story_id(story_id):
            location_by_id[loc["id"]] = loc
        for item in story_read_port.find_items_by_story_id(story_id):
            item_by_id[item["id"]] = item

    result: List[CharacterInstanceInfo] = []
    for c in characters:
        backpack = character_read_port.find_backpack(match["id"], c["id"]) or {}
        trait_uuids: List[str] = []
        for row in character_read_port.find_traits(match["id"], c["id"]):
            uuid = trait_uuid_by_id.get(row.get("id_traits"))
            if uuid:
                trait_uuids.append(uuid)
        items: List[ItemInstanceInfo] = []
        for inv in character_read_port.find_inventory(match["id"], c["id"]):
            item = item_by_id.get(inv.get("id_item"))
            items.append(ItemInstanceInfo(
                uuid=inv.get("uuid"),
                item_uuid=item["uuid"] if item else None,
                name=None,
                weight=(item.get("weight") if item else 0) or 0,
                amount=inv.get("amount", 1),
                state=inv.get("state"),
            ))
        weight = sum((i.weight or 0) * (i.amount or 1) for i in items)
        loc = location_by_id.get(c.get("id_location"))
        user_uuid = (requester_uuid
                     if requester_id is not None and requester_id == c.get("id_user")
                     else None)
        result.append(CharacterInstanceInfo(
            uuid=c["uuid"],
            match_uuid=match["uuid"],
            user_uuid=user_uuid,
            character_template_uuid=template_uuid_by_id.get(c.get("id_character_template")),
            class_uuid=None,
            dexterity=c["dexterity"],
            intelligence=c["intelligence"],
            constitution=c["constitution"],
            energy=c["energy"],
            life=c["life"],
            sad=c["sad"],
            life_max=c.get("life_max", 0),
            energy_max=c.get("energy_max", 0),
            sad_max=c.get("sad_max", 0),
            weight_max=c.get("weight_max", 0),
            weight=weight,
            id_location=c.get("id_location"),
            location_uuid=loc["uuid"] if loc else None,
            location_name=f"location-{loc['id']}" if loc else None,
            is_sleeping=c["is_sleeping"],
            is_coma=c["is_coma"],
            trait_uuids=trait_uuids,
            items=items,
            food=backpack.get("food", 0),
            magic=backpack.get("magic", 0),
            coin=backpack.get("coin", 0),
        ))
    return result


class CharacterQueryService(CharacterQueryPort):
    def __init__(
        self,
        match_persistence_port: MatchPersistencePort,
        character_read_port: CharacterReadPort,
        story_read_port: StoryMatchReadPort,
        user_access_port: UserAccessPort,
    ) -> None:
        self.match_persistence_port = match_persistence_port
        self.character_read_port = character_read_port
        self.story_read_port = story_read_port
        self.user_access_port = user_access_port

    def list_players(self, match_uuid: str, user_uuid: str) -> Optional[List[CharacterInstanceInfo]]:
        if not match_uuid or not user_uuid:
            return None
        match = self.match_persistence_port.find_match_by_uuid(match_uuid)
        if match is None:
            return None
        user = self._resolve_access(match, user_uuid)
        if user is None:
            return None
        characters = self.character_read_port.find_characters_by_match_id(match["id"])
        return build_character_infos(characters, match, self.story_read_port,
                                     self.character_read_port, user["uuid"], user["id"])

    def get_character(self, match_uuid: str, character_uuid: str,
                      user_uuid: str) -> Optional[CharacterInstanceInfo]:
        if not match_uuid or not character_uuid or not user_uuid:
            return None
        match = self.match_persistence_port.find_match_by_uuid(match_uuid)
        if match is None:
            return None
        user = self._resolve_access(match, user_uuid)
        if user is None:
            return None
        character = self.character_read_port.find_character_by_match_and_uuid(match["id"], character_uuid)
        if character is None:
            return None
        built = build_character_infos([character], match, self.story_read_port,
                                      self.character_read_port, user["uuid"], user["id"])
        return built[0] if built else None

    def _resolve_access(self, match: Dict[str, Any], user_uuid: str) -> Optional[Dict[str, Any]]:
        user = self.user_access_port.find_by_uuid(user_uuid)
        if user is None:
            return None
        if user.get("id") == match.get("id_user_creator"):
            return user
        participant = any(
            c.get("id_user") == user.get("id")
            for c in self.character_read_port.find_characters_by_match_id(match["id"])
        )
        return user if participant else None
