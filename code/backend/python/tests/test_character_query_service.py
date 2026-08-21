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


# ── Step 34: inventory masking, item cards and the language ──────────────────

def _party_match():
    return {"id": 1, "uuid": "match-uuid", "id_story": 5}


def _party_character(cid, id_user):
    return {"id": cid, "uuid": f"char-{cid}", "id_user": id_user,
            "id_character_template": None, "id_class": None, "id_location": None,
            "dexterity": 1, "intelligence": 1, "constitution": 1, "energy": 1,
            "life": 1, "sad": 0, "life_max": 1, "energy_max": 1, "sad_max": 1,
            "weight_max": 30, "is_sleeping": False, "is_coma": False, "clock_in_coma": None,
            "exp": 0}


def _party_ports():
    from unittest.mock import MagicMock
    story = MagicMock()
    story.find_character_templates_by_story_id.return_value = []
    story.find_traits_by_story_id.return_value = []
    story.find_locations_by_story_id.return_value = []
    story.find_items_by_story_id.return_value = [{
        "id": 8, "uuid": "item-uuid", "weight": 2, "id_card": 77,
        "id_text_name": 99, "is_consumabile": 1,
        "id_class_permitted": None, "id_class_prohibited": None}]
    story.find_card_by_story_id_and_card_id.return_value = {"uuid": "card-77"}
    story.find_text_by_story_id_text_and_lang.return_value = {"short_text": "Corda"}
    story.find_item_effects_by_item_id.return_value = {}

    chars = MagicMock()
    chars.find_backpack.return_value = {}
    chars.find_traits.return_value = []
    chars.find_inventory.return_value = [
        {"uuid": "inv-1", "id_item": 8, "amount": 2, "state": "ACTIVE"}]
    return story, chars


def test_items_are_masked_for_the_other_players():
    """The key stays on every player; only the requester's array is populated."""
    from app.core.services.match.character_query_service import build_character_infos
    story, chars = _party_ports()

    players = build_character_infos(
        [_party_character(10, 7), _party_character(11, 8)], _party_match(),
        story, chars, "user-uuid", 7, lang="en", mask_other_inventories=True)

    assert len(players[0].items) == 1
    assert players[1].items == []
    # The masked branch does not even query the other player's inventory.
    chars.find_inventory.assert_called_once_with(1, 10)


def test_the_admin_view_is_not_masked():
    """It has no requester at all — masking would blank every player in the console."""
    from app.core.services.match.character_query_service import build_character_infos
    story, chars = _party_ports()

    players = build_character_infos(
        [_party_character(10, 7), _party_character(11, 8)], _party_match(),
        story, chars, None, None, lang="en", mask_other_inventories=False)

    assert len(players[0].items) == 1
    assert len(players[1].items) == 1


def test_item_cards_and_names_are_resolved_in_the_requested_language():
    from app.core.services.match.character_query_service import build_character_infos
    story, chars = _party_ports()

    item = build_character_infos([_party_character(10, 7)], _party_match(), story, chars,
                                 "user-uuid", 7, lang="it",
                                 mask_other_inventories=True)[0].items[0]

    assert item.id_card == 77
    assert item.card == {"uuid": "card-77"}
    assert item.name == "Corda"
    assert item.is_consumabile is True
    story.find_text_by_story_id_text_and_lang.assert_called_once_with(5, 99, "it")


def test_the_info_items_promise_the_effects_of_using_them():
    """Step 35 — the same promise the inventory endpoint reports, one query for the story."""
    from app.core.services.match.character_query_service import build_character_infos
    story, chars = _party_ports()
    story.find_item_effects_by_item_id.return_value = {8: [
        {"id": 1, "effect_code": "LIFE", "effect_value": 3},
        {"id": 2, "effect_code": "WISDOM", "effect_value": 9},
    ]}

    players = build_character_infos(
        [_party_character(10, 7), _party_character(11, 8)], _party_match(),
        story, chars, "user-uuid", 7, lang="en", mask_other_inventories=True)

    effects = players[0].items[0].effects
    # The unknown code is not promised: apply_stat would drop it in silence.
    assert [(e.statistic, e.value) for e in effects] == [("life", 3)]
    story.find_item_effects_by_item_id.assert_called_once_with(5)


def test_a_secret_item_promises_nothing_on_info():
    """v0.35.0 — flag_show_effects = 0 hides the promise on /info too, not only on
    the inventory endpoint: one gate, read by the one shared helper."""
    from app.core.services.match.character_query_service import build_character_infos
    story, chars = _party_ports()
    story.find_items_by_story_id.return_value = [{
        "id": 8, "uuid": "item-uuid", "weight": 2, "id_card": 77,
        "id_text_name": 99, "is_consumabile": 1, "flag_show_effects": 0,
        "id_class_permitted": None, "id_class_prohibited": None}]
    story.find_item_effects_by_item_id.return_value = {8: [
        {"id": 1, "effect_code": "LIFE", "effect_value": 3}]}

    players = build_character_infos(
        [_party_character(10, 7)], _party_match(), story, chars,
        "user-uuid", 7, lang="en", mask_other_inventories=True)

    assert players[0].items[0].effects == []


def test_the_default_call_keeps_the_pre_step34_behaviour():
    """No lang and no masking: English, every player's items visible."""
    from app.core.services.match.character_query_service import build_character_infos
    story, chars = _party_ports()

    players = build_character_infos(
        [_party_character(10, 7), _party_character(11, 8)], _party_match(),
        story, chars, "user-uuid", 7)

    assert len(players[1].items) == 1
    story.find_text_by_story_id_text_and_lang.assert_called_with(5, 99, "en")
