"""Step 21 — character join service (template + class + difficulty + traits)."""
from typing import Any, Dict, List, Optional

from app.core.models.match import match_statuses
from app.core.models.match.match_models import (
    CharacterInstanceInfo,
    CharacterJoinError,
    JoinMatchCommand,
)
from app.core.ports.match.match_ports import (
    CharacterCommandPort,
    CharacterPersistencePort,
    MatchPersistencePort,
    StoryMatchReadPort,
    UserAccessPort,
)


_BANNED_STATES = {3, 4}


class CharacterCommandService(CharacterCommandPort):
    def __init__(
        self,
        story_read_port: StoryMatchReadPort,
        match_persistence_port: MatchPersistencePort,
        user_access_port: UserAccessPort,
        character_persistence_port: CharacterPersistencePort,
    ) -> None:
        self.story_read_port = story_read_port
        self.match_persistence_port = match_persistence_port
        self.user_access_port = user_access_port
        self.character_persistence_port = character_persistence_port

    def join(self, command: JoinMatchCommand) -> CharacterInstanceInfo:
        if command is None or not command.match_uuid or not command.user_uuid:
            raise CharacterJoinError(CharacterJoinError.INVALID_INPUT,
                                     "matchUuid and userUuid are required")

        match = self.match_persistence_port.find_match_by_uuid(command.match_uuid)
        if match is None:
            raise CharacterJoinError(CharacterJoinError.MATCH_NOT_FOUND,
                                     f"Match not found: {command.match_uuid}")
        if match_statuses.is_terminal(match.get("status")):
            raise CharacterJoinError(CharacterJoinError.MATCH_NOT_JOINABLE,
                                     "Match is in a terminal status and cannot be joined")

        user = self.user_access_port.find_by_uuid(command.user_uuid)
        if user is None:
            raise CharacterJoinError(CharacterJoinError.USER_NOT_FOUND, "User does not exist")
        if user.get("state") in _BANNED_STATES:
            raise CharacterJoinError(CharacterJoinError.USER_BANNED,
                                     "User is not allowed to join matches")

        if self.character_persistence_port.find_character_by_match_and_user(match["id"], user["id"]):
            raise CharacterJoinError(CharacterJoinError.ALREADY_JOINED,
                                     "User already has a character in this match")

        story = self.story_read_port.find_story_by_id(match["id_story"])
        if story is None:
            raise CharacterJoinError(CharacterJoinError.MATCH_NOT_FOUND, "Match story not found")

        template_uuid = command.character_template_uuid or match.get("character_template_uuid")
        class_uuid = command.class_uuid or match.get("class_uuid")
        trait_uuids = command.trait_uuids or match.get("trait_uuids") or []
        if not template_uuid:
            raise CharacterJoinError(CharacterJoinError.INVALID_INPUT,
                                     "characterTemplateUuid is required (none provided and none stored on the match)")

        template = self.story_read_port.find_character_template_by_uuid(story["id"], template_uuid)
        if template is None:
            raise CharacterJoinError(CharacterJoinError.TEMPLATE_NOT_FOUND,
                                     f"Character template not found: {template_uuid}")

        clazz = None
        if class_uuid:
            clazz = self.story_read_port.find_class_by_uuid(story["id"], class_uuid)
            if clazz is None:
                raise CharacterJoinError(CharacterJoinError.CLASS_NOT_FOUND,
                                         f"Class not found: {class_uuid}")
            self._validate_class(template, clazz)

        traits = self._resolve_traits(story["id"], trait_uuids)
        difficulty = self.story_read_port.find_difficulty_by_id(story["id"], match.get("id_difficulty"))
        class_bonuses = self._resolve_bonuses(story["id"], clazz)

        next_id = self.character_persistence_port.count_characters_by_match_id(match["id"]) + 1
        instance = self._build_instance(match, user, story, template, clazz, difficulty,
                                        traits, class_bonuses, next_id)
        saved = self.character_persistence_port.save_character(instance)

        self.character_persistence_port.save_backpack({
            "id": saved["id"],
            "id_match": match["id"],
            "id_character_match": saved["id"],
            "food": 0,
            "magic": 0,
            "coin": 0,
        })

        trait_rows: List[Dict[str, Any]] = []
        trait_id = 1
        for t in traits:
            trait_rows.append({
                "id": trait_id,
                "id_match": match["id"],
                "id_character_match": saved["id"],
                "id_traits": t["id"],
            })
            trait_id += 1
        self.character_persistence_port.save_traits(trait_rows)

        return self._to_info(saved, match, story, user["uuid"], template_uuid, class_uuid, trait_uuids)

    # ─── helpers ─────────────────────────────────────────────────────────────

    @staticmethod
    def _validate_class(template: Dict[str, Any], clazz: Dict[str, Any]) -> None:
        class_id = clazz.get("id")
        permitted = template.get("id_class_permitted")
        prohibited = template.get("id_class_prohibited")
        if permitted is not None and permitted != class_id:
            raise CharacterJoinError(CharacterJoinError.CLASS_NOT_COMPATIBLE,
                                     "Selected class is not permitted for this character template")
        if prohibited is not None and prohibited == class_id:
            raise CharacterJoinError(CharacterJoinError.CLASS_NOT_COMPATIBLE,
                                     "Selected class is prohibited for this character template")

    def _resolve_traits(self, story_id: int, trait_uuids: List[str]) -> List[Dict[str, Any]]:
        resolved = []
        for uuid in trait_uuids:
            if not uuid:
                continue
            trait = self.story_read_port.find_trait_by_uuid(story_id, uuid)
            if trait is not None:
                resolved.append(trait)
        return resolved

    def _resolve_bonuses(self, story_id: int, clazz: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if clazz is None:
            return []
        return [
            b for b in self.story_read_port.find_class_bonuses_by_story_id(story_id)
            if b.get("id_class") == clazz.get("id")
        ]

    def _build_instance(self, match, user, story, template, clazz, difficulty,
                        traits, class_bonuses, next_id) -> Dict[str, Any]:
        dexterity = (_nz(template.get("dexterity_start"))
                     + _nz(clazz.get("dexterity_base") if clazz else 0)
                     + _nz(difficulty.get("dexterity") if difficulty else 0)
                     + _sum_trait(traits, "dexterity") + _sum_bonus(class_bonuses, "dex"))
        intelligence = (_nz(template.get("intelligence_start"))
                        + _nz(clazz.get("intelligence_base") if clazz else 0)
                        + _nz(difficulty.get("intelligence") if difficulty else 0)
                        + _sum_trait(traits, "intelligence") + _sum_bonus(class_bonuses, "int"))
        constitution = (_nz(template.get("constitution_start"))
                        + _nz(clazz.get("constitution_base") if clazz else 0)
                        + _nz(difficulty.get("constitution") if difficulty else 0)
                        + _sum_trait(traits, "constitution") + _sum_bonus(class_bonuses, "con"))
        life_max = (_nz(template.get("life_max"))
                    + _nz(difficulty.get("life") if difficulty else 0)
                    + _sum_trait(traits, "life") + _sum_bonus(class_bonuses, "life"))
        energy_max = (_nz(template.get("energy_max"))
                      + _nz(difficulty.get("energy") if difficulty else 0)
                      + _sum_trait(traits, "energy") + _sum_bonus(class_bonuses, "energy"))
        return {
            "id": next_id,
            "id_match": match["id"],
            "id_user": user["id"],
            "id_character_template": template.get("id_tipo"),
            "dexterity": dexterity,
            "intelligence": intelligence,
            "constitution": constitution,
            "life": life_max,      # start full
            "energy": energy_max,  # start full
            "sad": 0,
            "id_location": story.get("id_location_start"),
            "is_sleeping": 0,
            "is_coma": 0,
        }

    def _to_info(self, saved, match, story, user_uuid, template_uuid, class_uuid, trait_uuids):
        location_uuid = None
        location_name = None
        loc_id = saved.get("id_location")
        if loc_id is not None and story is not None:
            for loc in self.story_read_port.find_locations_by_story_id(story["id"]):
                if loc["id"] == loc_id:
                    location_uuid = loc["uuid"]
                    location_name = f"location-{loc['id']}"
                    break
        return CharacterInstanceInfo(
            uuid=saved["uuid"],
            match_uuid=match["uuid"],
            user_uuid=user_uuid,
            character_template_uuid=template_uuid,
            class_uuid=class_uuid,
            dexterity=saved["dexterity"],
            intelligence=saved["intelligence"],
            constitution=saved["constitution"],
            energy=saved["energy"],
            life=saved["life"],
            sad=saved["sad"],
            id_location=loc_id,
            location_uuid=location_uuid,
            location_name=location_name,
            is_sleeping=saved["is_sleeping"],
            is_coma=saved["is_coma"],
            trait_uuids=list(trait_uuids),
            food=0,
            magic=0,
            coin=0,
        )


def _nz(value) -> int:
    return int(value) if value is not None else 0


_TRAIT_STAT_KEYS = {
    "dexterity": "dexterity",
    "intelligence": "intelligence",
    "constitution": "constitution",
    "life": "life",
    "energy": "energy",
}


def _sum_trait(traits: List[Dict[str, Any]], stat: str) -> int:
    key = _TRAIT_STAT_KEYS.get(stat)
    if key is None:
        return 0
    return sum(_nz(t.get(key)) for t in traits)


def _sum_bonus(bonuses: List[Dict[str, Any]], stat: str) -> int:
    return sum(_nz(b.get("value")) for b in bonuses
               if (b.get("statistic") or "").lower() == stat)
