"""Tests for the Step 21 character query service."""
from unittest.mock import MagicMock

import pytest

from app.core.services.match.character_query_service import CharacterQueryService


STORY_ID = 9001
MATCH_ID = 500
USER_ID = 7


def _match(creator_id=USER_ID):
    return {"id": MATCH_ID, "uuid": "match-uuid", "id_story": STORY_ID,
            "id_user_creator": creator_id}


def _user():
    return {"id": USER_ID, "uuid": "user-uuid", "state": 6}


def _character():
    return {"id": 1, "uuid": "char-uuid", "id_match": MATCH_ID, "id_user": USER_ID,
            "id_character_template": 90001, "dexterity": 19, "intelligence": 18,
            "constitution": 19, "energy": 127, "life": 137, "sad": 0,
            "life_max": 137, "energy_max": 127, "sad_max": 8, "weight_max": 24,
            "id_location": 90001, "is_sleeping": 0, "is_coma": 0}


@pytest.fixture()
def env():
    match_p = MagicMock()
    char_r = MagicMock()
    story = MagicMock()
    user_a = MagicMock()
    service = CharacterQueryService(match_p, char_r, story, user_a)
    return service, match_p, char_r, story, user_a


def _wire_lookups(char_r, story):
    story.find_character_templates_by_story_id.return_value = [{"id_tipo": 90001, "uuid": "tpl-uuid"}]
    story.find_traits_by_story_id.return_value = [{"id": 90001, "uuid": "trait-1"}]
    story.find_locations_by_story_id.return_value = [{"id": 90001, "uuid": "loc-uuid"}]
    # Step 27 — one story item (weight 2) carried in the inventory (amount 3) -> weight 6
    story.find_items_by_story_id.return_value = [{"id": 40001, "uuid": "item-uuid", "weight": 2}]
    char_r.find_backpack.return_value = {"food": 1, "magic": 2, "coin": 3}
    char_r.find_traits.return_value = [{"id_traits": 90001}]
    char_r.find_inventory.return_value = [
        {"uuid": "inv-uuid", "id_item": 40001, "amount": 3, "state": "ACTIVE"}
    ]


# ─── list_players ─────────────────────────────────────────────────────────────

def test_list_players_blank(env):
    service = env[0]
    assert service.list_players("", "u") is None
    assert service.list_players("m", "") is None


def test_list_players_match_not_found(env):
    service, match_p, *_ = env
    match_p.find_match_by_uuid.return_value = None
    assert service.list_players("m", "u") is None


def test_list_players_user_unknown(env):
    service, match_p, char_r, story, user_a = env
    match_p.find_match_by_uuid.return_value = _match()
    user_a.find_by_uuid.return_value = None
    assert service.list_players("match-uuid", "user-uuid") is None


def test_list_players_no_access(env):
    service, match_p, char_r, story, user_a = env
    match_p.find_match_by_uuid.return_value = _match(creator_id=999)
    user_a.find_by_uuid.return_value = _user()
    char_r.find_characters_by_match_id.return_value = []
    assert service.list_players("match-uuid", "user-uuid") is None


def test_list_players_creator(env):
    service, match_p, char_r, story, user_a = env
    match_p.find_match_by_uuid.return_value = _match()
    user_a.find_by_uuid.return_value = _user()
    char_r.find_characters_by_match_id.return_value = [_character()]
    _wire_lookups(char_r, story)

    players = service.list_players("match-uuid", "user-uuid")

    assert len(players) == 1
    p = players[0]
    assert p.uuid == "char-uuid"
    assert p.character_template_uuid == "tpl-uuid"
    assert p.user_uuid == "user-uuid"
    assert p.trait_uuids == ["trait-1"]
    assert p.location_uuid == "loc-uuid"
    assert p.food == 1
    # Step 27 — persisted max values + inventory read path
    assert p.life_max == 137
    assert p.energy_max == 127
    assert p.sad_max == 8
    assert p.weight_max == 24
    assert len(p.items) == 1
    assert p.items[0].item_uuid == "item-uuid"
    assert p.items[0].weight == 2
    assert p.items[0].amount == 3
    assert p.weight == 6


def test_list_players_participant(env):
    service, match_p, char_r, story, user_a = env
    match_p.find_match_by_uuid.return_value = _match(creator_id=999)
    user_a.find_by_uuid.return_value = _user()
    char_r.find_characters_by_match_id.return_value = [_character()]
    _wire_lookups(char_r, story)

    players = service.list_players("match-uuid", "user-uuid")
    assert len(players) == 1


# ─── get_character ─────────────────────────────────────────────────────────────

def test_get_character_blank(env):
    service = env[0]
    assert service.get_character("", "c", "u") is None
    assert service.get_character("m", "", "u") is None


def test_get_character_match_not_found(env):
    service, match_p, *_ = env
    match_p.find_match_by_uuid.return_value = None
    assert service.get_character("m", "c", "u") is None


def test_get_character_no_access(env):
    service, match_p, char_r, story, user_a = env
    match_p.find_match_by_uuid.return_value = _match(creator_id=999)
    user_a.find_by_uuid.return_value = _user()
    char_r.find_characters_by_match_id.return_value = []
    assert service.get_character("match-uuid", "c", "user-uuid") is None


def test_get_character_not_found(env):
    service, match_p, char_r, story, user_a = env
    match_p.find_match_by_uuid.return_value = _match()
    user_a.find_by_uuid.return_value = _user()
    char_r.find_character_by_match_and_uuid.return_value = None
    assert service.get_character("match-uuid", "c", "user-uuid") is None


def test_get_character_found(env):
    service, match_p, char_r, story, user_a = env
    match_p.find_match_by_uuid.return_value = _match()
    user_a.find_by_uuid.return_value = _user()
    char_r.find_character_by_match_and_uuid.return_value = _character()
    _wire_lookups(char_r, story)

    info = service.get_character("match-uuid", "char-uuid", "user-uuid")

    assert info is not None
    assert info.uuid == "char-uuid"
    assert info.life == 137
    assert info.trait_uuids == ["trait-1"]
    assert info.magic == 2
