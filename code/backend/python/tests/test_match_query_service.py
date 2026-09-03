"""Tests for MatchQueryService — Step 19."""
from unittest.mock import MagicMock

from app.core.models.match.match_models import MatchListFilter
from app.core.services.match.match_query_service import (
    MatchQueryService,
    _clamp_limit,
    _decode_cursor,
    _encode_cursor,
    _since_days_to_ts,
)


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
    registry_service = MagicMock()
    registry_service.list_entries.return_value = registry or []
    registry_service.load_all.return_value = {}
    return MatchQueryService(persistence, story_read, user_access,
                             registry_service_instance=registry_service), {
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


# ── list_matches_page (v0.28.1) ──────────────────────────────────────────────

def _page_call(mocks):
    """The positional args passed to find_matches_page on the last call."""
    return mocks["persistence"].find_matches_page.call_args.args


def _row(mid, mu, ts):
    r = _match(mid=mid, mu=mu)
    r["ts_insert"] = ts
    return r


def test_list_matches_page_defaults():
    service, mocks = _build()
    mocks["persistence"].find_matches_page.return_value = []
    page = service.list_matches_page(MatchListFilter())
    assert page.items == []
    assert page.next_cursor is None
    assert page.limit == 50
    # no filters; over-fetch by one (50 + 1) to detect a further page
    assert _page_call(mocks) == (None, None, None, None, None, None, 51)


def test_list_matches_page_emits_next_cursor():
    service, mocks = _build()
    mocks["persistence"].find_matches_page.return_value = [
        _row(3, "m3", "2024-03-03T00:00:00+00:00"),
        _row(2, "m2", "2024-02-02T00:00:00+00:00"),
        _row(1, "m1", "2024-01-01T00:00:00+00:00"),
    ]
    page = service.list_matches_page(MatchListFilter(limit=2))
    assert [s.uuid for s in page.items] == ["m3", "m2"]
    # cursor points at the last *kept* row (m2), not the over-fetched m1
    assert _decode_cursor(page.next_cursor) == ("2024-02-02T00:00:00+00:00", 2)
    assert _page_call(mocks)[6] == 3  # limit 2 + 1


def test_list_matches_page_last_page_has_no_cursor():
    service, mocks = _build()
    mocks["persistence"].find_matches_page.return_value = [_row(1, "m1", "2024-01-01")]
    page = service.list_matches_page(MatchListFilter(limit=5))
    assert len(page.items) == 1
    assert page.next_cursor is None


def test_list_matches_page_status_forwarded():
    service, mocks = _build()
    mocks["persistence"].find_matches_page.return_value = []
    service.list_matches_page(MatchListFilter(status="RUNNING"))
    assert _page_call(mocks)[0] == "RUNNING"


def test_list_matches_page_resolves_user():
    service, mocks = _build(user=_user(uid=7))
    mocks["persistence"].find_matches_page.return_value = []
    service.list_matches_page(MatchListFilter(user_uuid="u-7"))
    assert _page_call(mocks)[1] == 7


def test_list_matches_page_unknown_user_is_empty():
    service, mocks = _build(user=None)
    page = service.list_matches_page(MatchListFilter(user_uuid="ghost"))
    assert page.items == [] and page.next_cursor is None
    mocks["persistence"].find_matches_page.assert_not_called()


def test_list_matches_page_resolves_story():
    service, mocks = _build()
    mocks["story_read"].find_story_by_uuid.return_value = {"id": 2, "uuid": "s-2"}
    mocks["persistence"].find_matches_page.return_value = []
    service.list_matches_page(MatchListFilter(story_uuid="s-2"))
    assert _page_call(mocks)[2] == 2


def test_list_matches_page_unknown_story_is_empty():
    service, mocks = _build()
    mocks["story_read"].find_story_by_uuid.return_value = None
    page = service.list_matches_page(MatchListFilter(story_uuid="nope"))
    assert page.items == []
    mocks["persistence"].find_matches_page.assert_not_called()


def test_list_matches_page_since_days_becomes_ts_from():
    service, mocks = _build()
    mocks["persistence"].find_matches_page.return_value = []
    service.list_matches_page(MatchListFilter(since_days=7))
    assert _page_call(mocks)[3] is not None


def test_list_matches_page_since_days_non_positive_ignored():
    service, mocks = _build()
    mocks["persistence"].find_matches_page.return_value = []
    service.list_matches_page(MatchListFilter(since_days=0))
    assert _page_call(mocks)[3] is None


def test_list_matches_page_cursor_decoded():
    service, mocks = _build()
    mocks["persistence"].find_matches_page.return_value = []
    cursor = _encode_cursor("2024-02-02T00:00:00+00:00", 9)
    service.list_matches_page(MatchListFilter(cursor=cursor))
    args = _page_call(mocks)
    assert args[4] == "2024-02-02T00:00:00+00:00"
    assert args[5] == 9


def test_list_matches_page_clamps_limit():
    service, mocks = _build()
    mocks["persistence"].find_matches_page.return_value = []
    service.list_matches_page(MatchListFilter(limit=9999))
    assert _page_call(mocks)[6] == 201  # 200 (max) + 1
    service.list_matches_page(MatchListFilter(limit=0))
    assert _page_call(mocks)[6] == 2  # 1 (min) + 1


# ── pagination helpers ───────────────────────────────────────────────────────

def test_clamp_limit():
    assert _clamp_limit(None) == 50
    assert _clamp_limit("abc") == 50
    assert _clamp_limit(9999) == 200
    assert _clamp_limit(0) == 1
    assert _clamp_limit(25) == 25


def test_since_days_to_ts():
    assert _since_days_to_ts(None) is None
    assert _since_days_to_ts(0) is None
    assert _since_days_to_ts("x") is None
    assert isinstance(_since_days_to_ts(7), str)


def test_cursor_round_trip_and_malformed():
    token = _encode_cursor("2024-01-01T00:00:00+00:00", 42)
    assert _decode_cursor(token) == ("2024-01-01T00:00:00+00:00", 42)
    assert _encode_cursor(None, 1) is None
    assert _encode_cursor("2024", None) is None
    assert _decode_cursor(None) == (None, None)
    assert _decode_cursor("") == (None, None)
    assert _decode_cursor("@@@") == (None, None)
    import base64
    no_sep = base64.urlsafe_b64encode(b"noseparator").decode()
    assert _decode_cursor(no_sep) == (None, None)
    bad_id = base64.urlsafe_b64encode(b"2024|abc").decode()
    assert _decode_cursor(bad_id) == (None, None)
    # decodes to bytes that are not valid UTF-8 → ValueError path
    invalid_utf8 = base64.urlsafe_b64encode(b"\xff\xfe").decode()
    assert _decode_cursor(invalid_utf8) == (None, None)


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
    assert len(detail.locations) == 2
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
         "flag_back": 1, "energy_cost": 2, "id_card": 200},
        {"id_location_from": 11, "id_location_to": 10, "direction": "S",
         "flag_back": 1, "energy_cost": 1, "id_card": 210},
    ]
    story_read.find_events_by_story_id.return_value = [
        {"id": 1, "uuid": "evt-1", "type": "NORMAL", "id_specific_location": 10, "id_card": 300},
        {"id": 2, "uuid": "evt-other", "type": "NORMAL", "id_specific_location": 11, "id_card": 310},
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

    registry_service = MagicMock()
    registry_service.list_entries.return_value = []
    registry_service.load_all.return_value = {}
    service = MatchQueryService(persistence, story_read, user_access, character_read,
                                registry_service_instance=registry_service)
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
    # Step 0.28.2 — orientation exposed; card_back falls back to the forward card.
    fwd = next(n for n in active.neighbors if n.id_location == 12)
    assert fwd.id_location_from == 10
    assert fwd.id_location_to == 12
    assert fwd.card_back["title"] == fwd.card["title"] == "Cave"
    # event filtered to location 10 only
    assert len(active.events) == 1
    assert active.events[0].uuid == "evt-1"
    assert active.events[0].end_game is True  # evt-1 (id 1) == story id_event_end_game
    assert active.events[0].card["title"] == "Stranger"


def test_one_way_neighbor_hidden_when_standing_on_destination():
    service = _build_enriched(player_loc=10)
    # Link 11->10 is one-way (flag_back=0): standing on 10 (the destination) it
    # must NOT be exposed. Link 10->12 stays (forward from 10).
    service.story_read_port.find_location_neighbors_by_story_id.return_value = [
        {"id_location_from": 10, "id_location_to": 12, "direction": "N",
         "flag_back": 1, "energy_cost": 2, "id_card": 200},
        {"id_location_from": 11, "id_location_to": 10, "direction": "S",
         "flag_back": 0, "energy_cost": 1, "id_card": 210},
    ]
    detail = service.get_match_info("m", "u")
    others = {n.id_location for n in detail.locations_active[0].neighbors}
    assert others == {12}


def test_neighbor_resolves_dedicated_return_card_when_id_card_back_set():
    service = _build_enriched(player_loc=10)
    # Override neighbors: 10->12 link now carries a distinct return card (300 = Stranger).
    service.story_read_port.find_location_neighbors_by_story_id.return_value = [
        {"id_location_from": 10, "id_location_to": 12, "direction": "N",
         "energy_cost": 2, "id_card": 200, "id_card_back": 300},
    ]
    detail = service.get_match_info("m", "u")
    n = next(x for x in detail.locations_active[0].neighbors if x.id_location == 12)
    assert n.card["title"] == "Cave"          # forward card (id_card 200)
    assert n.card_back["title"] == "Stranger"  # return card (id_card_back 300)
    assert n.id_location_from == 10
    assert n.id_location_to == 12


def _with_fog(service, visited):
    """Wire a movement store on the service so fog-of-war gating is active.

    The store is also what match-info asks for the move verdict on every neighbor, so it must
    answer those questions too: no character (the fog tests care about cards, not about who
    may walk where), no weather modifier, nobody standing anywhere.
    """
    service.movement_store = MagicMock()
    service.movement_store.find_visited_location_ids.return_value = list(visited)
    service.movement_store.find_character_by_match_and_user.return_value = None
    service.movement_store.find_characters_for_movement.return_value = []
    service.movement_store.find_current_weather_move_cost.return_value = (0, 0)
    return service


def test_info_hides_location_card_fallback_for_unvisited_neighbor():
    service = _with_fog(_build_enriched(player_loc=10), visited=[10])  # 12 unvisited
    # Neighbor 10->12 has NO authored link card → would fall back to location 12's card.
    service.story_read_port.find_location_neighbors_by_story_id.return_value = [
        {"id_location_from": 10, "id_location_to": 12, "direction": "N",
         "flag_back": 1, "energy_cost": 2},
    ]
    detail = service.get_match_info("m", "u")
    n = next(x for x in detail.locations_active[0].neighbors if x.id_location == 12)
    assert n.card is None       # location-card fallback hidden
    assert n.card_back is None


def test_info_keeps_authored_link_card_for_unvisited_neighbor():
    service = _with_fog(_build_enriched(player_loc=10), visited=[10])  # 12 unvisited
    # Neighbor 10->12 HAS an authored link card (200) → shown regardless.
    service.story_read_port.find_location_neighbors_by_story_id.return_value = [
        {"id_location_from": 10, "id_location_to": 12, "direction": "N",
         "flag_back": 1, "energy_cost": 2, "id_card": 200},
    ]
    detail = service.get_match_info("m", "u")
    n = next(x for x in detail.locations_active[0].neighbors if x.id_location == 12)
    assert n.card["title"] == "Cave"   # authored link card (200)


def test_info_reveals_location_card_fallback_for_visited_neighbor():
    service = _with_fog(_build_enriched(player_loc=10), visited=[10, 12])  # 12 visited
    service.story_read_port.find_location_neighbors_by_story_id.return_value = [
        {"id_location_from": 10, "id_location_to": 12, "direction": "N",
         "flag_back": 1, "energy_cost": 2},  # no link card → fallback to loc 12 (id_card 120)
    ]
    cards = {120: {"uuid": "c120", "card_type": "location", "id_text_title": 1200}}
    service.story_read_port.find_card_by_story_id_and_card_id.side_effect = (
        lambda sid, cid: cards.get(cid)
    )
    service.story_read_port.find_text_by_story_id_text_and_lang.side_effect = (
        lambda sid, tid, lang: {"short_text": "Forest"} if tid == 1200 else None
    )
    detail = service.get_match_info("m", "u")
    n = next(x for x in detail.locations_active[0].neighbors if x.id_location == 12)
    assert n.card["title"] == "Forest"  # location 12's card revealed once visited


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


# ── v0.28.6 — visited-only locations[] + cardLocationFrom / cardLocationTo ──


def test_info_locations_only_visited_admin_keeps_all():
    """The player endpoint projects only the visited locations; the admin endpoint
    keeps every one so the console can render the full runtime table."""
    service = _build_enriched(player_loc=10)
    service.match_persistence_port.find_locations_by_match_id.return_value = [
        {"id_location": 10, "uuid": "ls-10", "flag_already_actived": 0, "clock_counter": 5},
        {"id_location": 11, "uuid": "ls-11", "flag_already_actived": 0, "clock_counter": 5},
        {"id_location": 12, "uuid": "ls-12", "flag_already_actived": 0, "clock_counter": 5},
    ]
    _with_fog(service, visited=[10])

    player = service.get_match_info("m", "u")
    assert [l.id_location for l in player.locations] == [10]

    admin = service.get_match_info_for_admin("m")
    assert [l.id_location for l in admin.locations] == [10, 11, 12]


def test_neighbor_carries_location_card_of_visited_endpoint_only():
    """Each endpoint's LOCATION card is gated on its OWN visited flag."""
    service = _with_fog(_build_enriched(player_loc=10), visited=[10])  # 12 unvisited
    service.story_read_port.find_location_neighbors_by_story_id.return_value = [
        {"id_location_from": 10, "id_location_to": 12, "direction": "N",
         "flag_back": 1, "energy_cost": 2, "id_card": 200},
    ]
    detail = service.get_match_info("m", "u")
    n = next(x for x in detail.locations_active[0].neighbors if x.id_location == 12)
    assert n.card_location_from["title"] == "Tavern"  # loc 10 — the player stands there
    assert n.card_location_to is None                 # loc 12 still under fog


def test_neighbor_carries_both_location_cards_when_both_visited():
    service = _with_fog(_build_enriched(player_loc=10), visited=[10, 12])
    service.story_read_port.find_location_neighbors_by_story_id.return_value = [
        {"id_location_from": 10, "id_location_to": 12, "direction": "N",
         "flag_back": 1, "energy_cost": 2, "id_card": 200},
    ]
    cards = {
        100: {"uuid": "c100", "card_type": "location", "id_text_title": 1000},
        120: {"uuid": "c120", "card_type": "location", "id_text_title": 1200},
        200: {"uuid": "c200", "card_type": "location", "id_text_title": 2000},
    }
    texts = {1000: "Tavern", 1200: "Forest", 2000: "Cave"}
    service.story_read_port.find_card_by_story_id_and_card_id.side_effect = (
        lambda sid, cid: cards.get(cid)
    )
    service.story_read_port.find_text_by_story_id_text_and_lang.side_effect = (
        lambda sid, tid, lang: {"short_text": texts.get(tid)} if tid in texts else None
    )
    detail = service.get_match_info("m", "u")
    n = next(x for x in detail.locations_active[0].neighbors if x.id_location == 12)
    assert n.card_location_from["title"] == "Tavern"
    assert n.card_location_to["title"] == "Forest"
    # The LINK card stays the authored one — the location cards are separate.
    assert n.card["title"] == "Cave"


def test_neighbor_location_card_when_standing_on_to_endpoint():
    """Player on the edge's `to` endpoint: the move is a RETURN toward `from`, so
    card_location_to is the current location and card_location_from is the (still
    hidden) destination."""
    service = _with_fog(_build_enriched(player_loc=11), visited=[11])
    service.story_read_port.find_location_neighbors_by_story_id.return_value = [
        {"id_location_from": 10, "id_location_to": 11, "direction": "N",
         "flag_back": 1, "energy_cost": 2, "id_card": 200},
    ]
    cards = {110: {"uuid": "c110", "card_type": "location", "id_text_title": 1100}}
    service.story_read_port.find_card_by_story_id_and_card_id.side_effect = (
        lambda sid, cid: cards.get(cid)
    )
    service.story_read_port.find_text_by_story_id_text_and_lang.side_effect = (
        lambda sid, tid, lang: {"short_text": "Cellar"} if tid == 1100 else None
    )
    detail = service.get_match_info("m", "u")
    n = next(x for x in detail.locations_active[0].neighbors if x.id_location == 10)
    assert n.card_location_from is None            # destination still under fog
    assert n.card_location_to["title"] == "Cellar"  # where the player stands
