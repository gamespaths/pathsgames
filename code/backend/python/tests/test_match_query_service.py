"""Tests for MatchQueryService — Step 19."""
from unittest.mock import MagicMock

from app.core.services.match.match_query_service import MatchQueryService


def _user(uid=7, uuid="user-uuid"):
    return {"id": uid, "uuid": uuid, "username": "u", "role": "PLAYER", "state": 2}


def _match(creator=7, mid=99, story=2, diff=3, mu="match-uuid"):
    return {
        "id": mid,
        "uuid": mu,
        "id_story": story,
        "id_difficulty": diff,
        "id_user_creator": creator,
        "name": "n",
        "status": "CREATED",
        "current_clock": 0,
        "exp_cost": 5,
        "ts_insert": "now",
        "ts_update": "now",
        "single_player": 1,
        "character_template_uuid": "ct",
        "class_uuid": "cl",
        "trait_uuids": ["t1", "t2"],
    }


def _build(user=None, match=None, matches=None, story=None, difficulty=None, locations=None,
           state_locations=None, registry=None):
    persistence = MagicMock()
    story_read = MagicMock()
    user_access = MagicMock()
    user_access.find_by_uuid.return_value = user
    persistence.find_match_by_uuid.return_value = match
    persistence.find_matches_by_user_id.return_value = matches or []
    story_read.find_story_by_id.return_value = story
    story_read.find_difficulty_by_id.return_value = difficulty
    story_read.find_locations_by_story_id.return_value = locations or []
    persistence.find_locations_by_match_id.return_value = state_locations or []
    persistence.find_registry_by_match_id.return_value = registry or []
    return MatchQueryService(persistence, story_read, user_access), {
        "persistence": persistence,
        "story_read": story_read,
        "user_access": user_access,
    }


def test_list_user_matches_blank_user():
    service, _ = _build()
    assert service.list_user_matches("") == []
    assert service.list_user_matches(None) == []


def test_list_user_matches_unknown_user():
    service, mocks = _build(user=None)
    assert service.list_user_matches("u") == []
    mocks["persistence"].find_matches_by_user_id.assert_not_called()


def test_list_user_matches_returns_summaries():
    service, _ = _build(user=_user(), matches=[_match()])
    summaries = service.list_user_matches("u")
    assert len(summaries) == 1
    assert summaries[0].uuid == "match-uuid"
    assert summaries[0].user_creator_uuid == "user-uuid"
    assert summaries[0].single_player == 1
    assert summaries[0].character_template_uuid == "ct"
    assert summaries[0].class_uuid == "cl"
    assert summaries[0].trait_uuids == ["t1", "t2"]


def test_list_user_matches_resolves_story_and_difficulty():
    # Regression: the list used to return story_uuid=None because the story
    # entity was not resolved for each match (only get_match_info did).
    service, _ = _build(
        user=_user(),
        matches=[_match()],
        story={"id": 2, "uuid": "story-uuid", "id_location_start": 10},
        difficulty={"id": 3, "uuid": "diff-uuid"},
    )
    summaries = service.list_user_matches("u")
    assert len(summaries) == 1
    assert summaries[0].story_uuid == "story-uuid"
    assert summaries[0].difficulty_uuid == "diff-uuid"


def test_list_all_matches_empty():
    service, mocks = _build()
    mocks["persistence"].find_all_matches.return_value = []
    assert service.list_all_matches() == []


def test_list_all_matches_returns_all_summaries():
    service, mocks = _build()
    mocks["persistence"].find_all_matches.return_value = [
        _match(creator=7, mu="m1"),
        _match(creator=8, mu="m2"),
    ]
    summaries = service.list_all_matches()
    assert [s.uuid for s in summaries] == ["m1", "m2"]
    assert summaries[0].single_player == 1


def test_get_match_info_blank_inputs():
    service, _ = _build()
    assert service.get_match_info("", "u") is None
    assert service.get_match_info("m", "") is None
    assert service.get_match_info(None, "u") is None


def test_get_match_info_unknown_user():
    service, _ = _build(user=None)
    assert service.get_match_info("m", "u") is None


def test_get_match_info_match_not_found():
    service, _ = _build(user=_user(), match=None)
    assert service.get_match_info("m", "u") is None


def test_get_match_info_other_owner():
    service, _ = _build(user=_user(), match=_match(creator=99))
    assert service.get_match_info("m", "u") is None


def test_get_match_info_full():
    service, _ = _build(
        user=_user(),
        match=_match(),
        story={"id": 2, "uuid": "story-uuid", "id_location_start": 10},
        difficulty={"id": 3, "uuid": "diff-uuid"},
        locations=[
            {"id": 10, "uuid": "loc-10"},
            {"id": 11, "uuid": "loc-11"},
        ],
        state_locations=[
            {"id_match": 99, "id_location": 10, "uuid": "ls10",
             "flag_already_actived": 0, "clock_counter": 5},
            {"id_match": 99, "id_location": 11, "uuid": "ls11",
             "flag_already_actived": 0, "clock_counter": 0},
        ],
        registry=[
            {"id": 1, "id_match": 99, "uuid": "r1", "key": "k", "string_value": None, "int_value": 1},
        ],
    )
    detail = service.get_match_info("m", "u")
    assert detail is not None
    assert detail.match.story_uuid == "story-uuid"
    assert detail.match.difficulty_uuid == "diff-uuid"
    assert detail.current_location_id == 10
    assert detail.current_location_uuid == "loc-10"
    assert detail.current_location_name == "location-10"
    assert len(detail.locations) == 2
    assert detail.locations[0].name == "location-10"
    assert len(detail.registry) == 1
    assert detail.events == []
    assert detail.choices == []


def test_get_match_info_no_start_location():
    service, _ = _build(
        user=_user(),
        match=_match(),
        story={"id": 2, "uuid": "story-uuid", "id_location_start": None},
        difficulty={"id": 3, "uuid": "diff-uuid"},
    )
    detail = service.get_match_info("m", "u")
    assert detail is not None
    assert detail.current_location_id is None
    assert detail.current_location_uuid is None


def test_get_match_info_start_location_missing_in_locations_list():
    service, _ = _build(
        user=_user(),
        match=_match(),
        story={"id": 2, "uuid": "story-uuid", "id_location_start": 10},
        difficulty={"id": 3, "uuid": "diff-uuid"},
        locations=[],
    )
    detail = service.get_match_info("m", "u")
    assert detail.current_location_id == 10
    assert detail.current_location_uuid is None


def test_get_match_info_story_missing():
    service, _ = _build(
        user=_user(),
        match=_match(),
        story=None,
    )
    detail = service.get_match_info("m", "u")
    assert detail is not None
    assert detail.match.story_uuid is None
    assert detail.match.difficulty_uuid is None


# ── get_match_info_for_admin (no ownership check) ─────────────────────────────

def test_get_match_info_for_admin_blank_uuid():
    service, _ = _build()
    assert service.get_match_info_for_admin("") is None
    assert service.get_match_info_for_admin(None) is None


def test_get_match_info_for_admin_match_not_found():
    service, _ = _build(match=None)
    assert service.get_match_info_for_admin("m") is None


def test_get_match_info_for_admin_returns_detail_of_any_owner():
    # match created by user 99 — admin info skips the ownership check
    service, _ = _build(
        match=_match(creator=99),
        story={"id": 2, "uuid": "story-uuid", "id_location_start": None},
        difficulty={"id": 3, "uuid": "diff-uuid"},
        registry=[{"uuid": "r1", "key": "k", "string_value": None, "int_value": 0}],
    )
    detail = service.get_match_info_for_admin("m")
    assert detail is not None
    assert detail.match.uuid == "match-uuid"
    assert detail.match.story_uuid == "story-uuid"
    assert len(detail.registry) == 1


# ── Step 27.x — locations_active enrichment ───────────────────────────────────

def _character(loc=10):
    return {
        "id": 1, "uuid": "char-uuid", "id_user": 7, "id_character_template": 90001,
        "dexterity": 5, "intelligence": 4, "constitution": 3, "energy": 9,
        "life": 8, "sad": 0, "is_sleeping": 0, "is_coma": 0, "id_location": loc,
    }


def _build_enriched(player_loc=10):
    persistence = MagicMock()
    story_read = MagicMock()
    user_access = MagicMock()
    character_read = MagicMock()

    user_access.find_by_uuid.return_value = _user()
    persistence.find_match_by_uuid.return_value = _match()
    story_read.find_story_by_id.return_value = {
        "id": 2, "uuid": "story-uuid", "id_location_start": 11, "id_event_end_game": 1,
    }
    story_read.find_difficulty_by_id.return_value = {"id": 3, "uuid": "diff-uuid"}
    locations = [
        {"id": 10, "uuid": "loc-10", "id_card": 100},
        {"id": 11, "uuid": "loc-11", "id_card": 110},
        {"id": 12, "uuid": "loc-12", "id_card": 120},
    ]
    story_read.find_locations_by_story_id.return_value = locations
    persistence.find_locations_by_match_id.return_value = []
    persistence.find_registry_by_match_id.return_value = []
    # build_character_infos lookups
    story_read.find_character_templates_by_story_id.return_value = [
        {"id_tipo": 90001, "uuid": "tpl-uuid"}
    ]
    story_read.find_traits_by_story_id.return_value = []
    story_read.find_items_by_story_id.return_value = []
    character_read.find_characters_by_match_id.return_value = [_character(player_loc)]
    character_read.find_backpack.return_value = None
    character_read.find_traits.return_value = []
    character_read.find_inventory.return_value = []
    # enrichment lookups
    story_read.find_location_neighbors_by_story_id.return_value = [
        {"id_location_from": 10, "id_location_to": 12, "direction": "N",
         "energy_cost": 2, "id_card": 200},
        {"id_location_from": 11, "id_location_to": 10, "direction": "S",
         "energy_cost": 1, "id_card": 210},
    ]
    story_read.find_events_by_story_id.return_value = [
        {"id": 1, "uuid": "evt-1", "type": "NORMAL", "id_location": 10, "id_card": 300},
        {"id": 2, "uuid": "evt-other", "type": "NORMAL", "id_location": 11, "id_card": 310},
    ]
    cards = {
        100: {"uuid": "c100", "card_type": "location", "url_image": "u",
              "awesome_icon": "fa-x", "id_text_title": 1000},
        200: {"uuid": "c200", "card_type": "location", "id_text_title": 2000},
        300: {"uuid": "c300", "card_type": "event", "id_text_title": 3000},
    }
    story_read.find_card_by_story_id_and_card_id.side_effect = (
        lambda sid, cid: cards.get(cid)
    )
    texts = {1000: "Tavern", 2000: "Cave", 3000: "Stranger"}
    story_read.find_text_by_story_id_text_and_lang.side_effect = (
        lambda sid, tid, lang: {"short_text": texts.get(tid)} if tid in texts else None
    )

    service = MatchQueryService(persistence, story_read, user_access, character_read)
    return service


def test_locations_active_current_location_from_player():
    service = _build_enriched(player_loc=10)
    detail = service.get_match_info("m", "u")
    assert detail.current_location_id == 10
    assert detail.current_location_uuid == "loc-10"


def test_locations_active_carries_card_neighbors_events():
    service = _build_enriched(player_loc=10)
    detail = service.get_match_info("m", "u")

    assert len(detail.locations_active) == 1
    active = detail.locations_active[0]
    assert active.id_location == 10
    assert active.card["title"] == "Tavern"
    # neighbors: both links touch location 10 → others are 12 and 11
    assert {n.id_location for n in active.neighbors} == {12, 11}
    # event filtered to location 10 only
    assert len(active.events) == 1
    assert active.events[0].uuid == "evt-1"
    assert active.events[0].end_game is True  # evt-1 (id 1) == story id_event_end_game
    assert active.events[0].card["title"] == "Stranger"


def test_get_match_info_resolves_cards_in_requested_lang():
    service = _build_enriched(player_loc=10)
    # Make the text lookup lang-aware: Italian variant for the active card title.
    it_texts = {1000: "Taverna", 2000: "Cave", 3000: "Stranger"}
    en_texts = {1000: "Tavern", 2000: "Cave", 3000: "Stranger"}
    service.story_read_port.find_text_by_story_id_text_and_lang.side_effect = (
        lambda sid, tid, lang: (
            {"short_text": (it_texts if lang == "it" else en_texts).get(tid)}
            if tid in en_texts else None
        )
    )

    detail = service.get_match_info("m", "u", "it")

    active = detail.locations_active[0]
    assert active.card["title"] == "Taverna"
    service.story_read_port.find_text_by_story_id_text_and_lang.assert_any_call(2, 1000, "it")


def test_get_match_info_blank_lang_falls_back_to_english():
    service = _build_enriched(player_loc=10)
    detail = service.get_match_info("m", "u", "  ")
    assert detail.locations_active[0].card["title"] == "Tavern"
    service.story_read_port.find_text_by_story_id_text_and_lang.assert_any_call(2, 1000, "en")


def test_locations_active_empty_without_players_falls_back_to_start():
    service = _build_enriched(player_loc=10)
    # no character joined → no active locations, current location = story start
    service.character_read_port.find_characters_by_match_id.return_value = []
    detail = service.get_match_info("m", "u")
    assert detail.locations_active == []
    assert detail.current_location_id == 11  # story start fallback
