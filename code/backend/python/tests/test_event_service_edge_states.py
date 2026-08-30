"""Step 30 — EventService: the all-players-in-coma epilogue and its early exits.

Mirrors ``EventExecutionServiceEdgeStatesTest.java``. The roster is a single character on
purpose: in single player that one coma IS the whole party going down.
"""
from unittest.mock import MagicMock

import pytest

from app.core.models.match.event_models import EventCheckContext
from app.core.ports.match.edge_state_ports import MSG_ALL_PLAYER_COMA
from app.core.services.match.event_service import EventService

MATCH_UUID = "match-uuid"
USER_UUID = "user-uuid"
MATCH_ID, USER_ID, CHAR_ID, STORY_ID, LOC = 1, 2, 3, 4, 100
CLOCK = 7
COMA_EVENT_ID = 5


def _character(cid, uuid, id_user, id_class, id_location, **over):
    base = dict(id=cid, uuid=uuid, id_user=id_user, id_class=id_class,
                id_location=id_location, dexterity=10, intelligence=10, constitution=10,
                energy=20, life=30, sad=0, exp=0, energy_max=100, life_max=100, sad_max=50,
                is_sleeping=False, is_coma=False, characteristics=None)
    base.update(over)
    return base


def _event(**over):
    base = dict(id=1, uuid="event-1", type="NORMAL", id_card=None, cost_enery=0,
                cost_coin=0, flag_end_time=0, id_event_next=None,
                id_specific_location=None, id_weather=None,
                registry_key_condition=None, registry_value_condition=None,
                id_item_condition=None, id_class_condition=None)
    base.update(over)
    return base


def _coma_event(**over):
    return _event(id=COMA_EVENT_ID, uuid="coma-event-uuid", id_card=77, **over)


def _effect(**over):
    base = dict(id=1, uuid="effect-1", id_card=None, id_event=1, statistics=None, value=0,
                target="ONLY_ONE", target_class=None, traits_to_add=None,
                traits_to_remove=None, id_item_target=None, item_action=None,
                key_to_add=None, key_value_to_add=None, characteristic_to_add=None,
                characteristic_to_remove=None, id_weather=None)
    base.update(over)
    return base


@pytest.fixture
def store():
    s = MagicMock()
    s.find_user_id_by_uuid.return_value = USER_ID
    s.find_match_for_event.return_value = {
        "id": MATCH_ID, "uuid": MATCH_UUID, "status": "RUNNING", "current_clock": CLOCK,
        "id_story": STORY_ID, "id_user_creator": USER_ID, "id_current_weather": None,
    }
    actor = _character(CHAR_ID, "char-uuid", USER_ID, 50, LOC)
    s.find_character_by_match_and_user.return_value = actor
    s.find_characters_for_event.return_value = [actor]
    s.find_backpack.return_value = {"food": 0, "magic": 0, "coin": 0}
    s.find_event_by_story_and_uuid.return_value = _event()
    s.find_events_by_id.return_value = {1: _event(), COMA_EVENT_ID: _coma_event()}
    s.find_effects_by_event_id.return_value = {}
    s.find_id_event_end_game.return_value = None
    s.find_id_event_all_player_coma.return_value = None
    s.find_item_uuids_by_id.return_value = {}
    s.find_trait_uuids_by_id.return_value = {}
    s.load_check_context.return_value = EventCheckContext(
        id_character=CHAR_ID, id_location=LOC, energy=20, coin=10, id_class=50)
    # Step 31: a plain event owns no choices — these tests exercise the APPLIED flow.
    s.find_choices_by_event_id.return_value = []
    return s


@pytest.fixture
def edge_store():
    return MagicMock()


@pytest.fixture
def content_port():
    # v0.35.8 — the port returns the RAW card row; the service maps it to the
    # CardInfoResponse shape and resolves id_text_title into `title`.
    p = MagicMock()
    p.find_card_by_story_id_and_card_id.side_effect = \
        lambda id_story, id_card: {"uuid": f"card-uuid-{id_card}", "id_text_title": id_card}
    p.find_text_by_story_id_text_and_lang.side_effect = \
        lambda id_story, id_text, lang: {"short_text": f"card-{id_text}"}
    return p


@pytest.fixture
def service(store, edge_store, content_port):
    return EventService(store, edge_store=edge_store, content_read_port=content_port,
                        time_service=None)


def kill_the_party(service, store):
    """Drop the only character to zero life — in single player that is the whole party."""
    store.find_effects_by_event_id.return_value = {
        1: [_effect(statistics="life", value=-9999)]}
    return service.execute_event(MATCH_UUID, USER_UUID, "event-1", "en")


def _party_rows(edge_store):
    return [c for c in edge_store.log_edge_state.call_args_list
            if c[0][4].startswith(MSG_ALL_PLAYER_COMA)]


# ── the happy path ──────────────────────────────────────────────────────────

def test_everyone_down_runs_the_epilogue_and_keeps_it_separate(service, store, edge_store):
    store.find_id_event_all_player_coma.return_value = COMA_EVENT_ID

    r = kill_the_party(service, store)

    assert r.edge_state.all_players_in_coma is True
    assert r.edge_state.coma_uuids == ["char-uuid"]
    assert r.edge_state.coma_event_uuid == "coma-event-uuid"
    assert r.edge_state.coma_event_card["title"] == "card-77"
    assert r.edge_state.coma_event_card["uuid"] == "card-uuid-77"
    assert r.edge_state.coma_executed_event_uuids == ["coma-event-uuid"]
    # The player's own chain must not contain the epilogue.
    assert r.executed_event_uuids == ["event-1"]
    assert r.coma_triggered is True
    edge_store.set_coma.assert_called_once_with(MATCH_ID, CHAR_ID, CLOCK)
    assert len(_party_rows(edge_store)) == 1


def test_the_match_is_not_moved_to_gameover(service, store):
    store.find_id_event_all_player_coma.return_value = COMA_EVENT_ID
    # GAMEOVER is step 59; here it stays a flag driven only by id_event_end_game.
    assert kill_the_party(service, store).game_over is False


# ── the early exits ─────────────────────────────────────────────────────────

def test_a_survivor_means_no_epilogue(service, store, edge_store):
    store.find_characters_for_event.return_value = [
        _character(CHAR_ID, "char-uuid", USER_ID, 50, LOC),
        _character(30, "mate-uuid", 20, 51, LOC),
    ]
    store.find_id_event_all_player_coma.return_value = COMA_EVENT_ID

    r = kill_the_party(service, store)

    assert r.edge_state.all_players_in_coma is False
    assert r.edge_state.coma_event_uuid is None
    assert r.edge_state.coma_uuids == ["char-uuid"]
    assert _party_rows(edge_store) == []


def test_an_untouched_comatose_character_still_counts_as_down(service, store):
    store.find_characters_for_event.return_value = [
        _character(CHAR_ID, "char-uuid", USER_ID, 50, LOC),
        _character(30, "mate-uuid", 20, 51, 999, life=0, is_coma=True, is_sleeping=True),
    ]
    store.find_id_event_all_player_coma.return_value = COMA_EVENT_ID

    assert kill_the_party(service, store).edge_state.all_players_in_coma is True
    # Reading is_coma off the view must not drag the character into the flush.
    store.find_backpack.assert_called_once_with(MATCH_ID, CHAR_ID)


def test_a_story_with_no_authored_epilogue_still_logs_the_collapse(service, store, edge_store):
    store.find_id_event_all_player_coma.return_value = None

    r = kill_the_party(service, store)

    assert r.edge_state.all_players_in_coma is True
    assert r.edge_state.coma_event_uuid is None
    assert len(_party_rows(edge_store)) == 1


def test_a_dangling_epilogue_id_is_authored_noise(service, store):
    store.find_id_event_all_player_coma.return_value = 999

    r = kill_the_party(service, store)

    assert r.edge_state.all_players_in_coma is True
    assert r.edge_state.coma_event_uuid is None


def test_a_once_epilogue_already_spent_does_not_fire_again(service, store):
    store.find_events_by_id.return_value = {1: _event(), COMA_EVENT_ID: _coma_event(type="ONCE")}
    store.find_id_event_all_player_coma.return_value = COMA_EVENT_ID
    ctx = EventCheckContext(id_character=CHAR_ID, id_location=LOC, energy=20, coin=10,
                            id_class=50)
    ctx.consumed_event_ids.add(COMA_EVENT_ID)
    store.load_check_context.return_value = ctx

    r = kill_the_party(service, store)

    assert r.edge_state.all_players_in_coma is True
    assert r.edge_state.coma_event_uuid is None  # spent once, spent for the whole match


def test_a_quiet_execution_leaves_the_edge_state_empty(service, store):
    store.find_effects_by_event_id.return_value = {
        1: [_effect(statistics="life", value=-1)]}

    r = service.execute_event(MATCH_UUID, USER_UUID, "event-1", "en")

    assert r.edge_state.anything() is False
    assert r.edge_state.coma_uuids == []
    assert r.edge_state.sadness_overflow_uuids == []
    store.find_id_event_all_player_coma.assert_not_called()


def test_the_epilogue_is_resolved_once_even_when_it_deepens_the_coma(service, store, edge_store):
    store.find_id_event_all_player_coma.return_value = COMA_EVENT_ID
    store.find_effects_by_event_id.return_value = {
        1: [_effect(statistics="life", value=-9999)],
        COMA_EVENT_ID: [_effect(id_event=COMA_EVENT_ID, statistics="life", value=-50)],
    }

    r = service.execute_event(MATCH_UUID, USER_UUID, "event-1", "en")

    assert r.edge_state.coma_event_uuid == "coma-event-uuid"
    # One collapse, one row: re-entry would write a second.
    assert len(_party_rows(edge_store)) == 1
    edge_store.set_coma.assert_called_once_with(MATCH_ID, CHAR_ID, CLOCK)


def test_a_sadness_overflow_that_kills_also_runs_the_epilogue(service, store):
    # sad to the cap costs COS=10 life; start at 8 so the hit empties the bar.
    frail = _character(CHAR_ID, "char-uuid", USER_ID, 50, LOC, life=8)
    store.find_character_by_match_and_user.return_value = frail
    store.find_characters_for_event.return_value = [frail]
    store.find_id_event_all_player_coma.return_value = COMA_EVENT_ID
    store.find_effects_by_event_id.return_value = {
        1: [_effect(statistics="sad", value=9999)]}

    r = service.execute_event(MATCH_UUID, USER_UUID, "event-1", "en")

    assert r.edge_state.sadness_overflow_uuids == ["char-uuid"]
    assert r.edge_state.coma_uuids == ["char-uuid"]
    assert r.edge_state.all_players_in_coma is True
    assert r.edge_state.coma_event_uuid == "coma-event-uuid"


def test_sadness_never_rests_at_its_cap(service, store, edge_store):
    store.find_effects_by_event_id.return_value = {
        1: [_effect(statistics="sad", value=9999)]}

    r = service.execute_event(MATCH_UUID, USER_UUID, "event-1", "en")

    assert r.edge_state.sadness_overflow_uuids == ["char-uuid"]
    assert r.forced_sleep is True
    assert r.coma_triggered is False  # life 30 - COS 10 = 20, still standing
    edge_store.set_sleeping.assert_called_once_with(MATCH_ID, CHAR_ID)
    stats = store.update_character_stats.call_args[0][2]
    assert stats["sad"] == 0 and stats["life"] == 20


def test_the_card_goes_out_in_the_api_contract_not_as_a_raw_row(content_port):
    """v0.35.8 — execute-event shipped the raw DB row: snake_case keys and the
    id_text_* references unresolved, so a client reading card.title / card.description /
    card.urlImage rendered an empty card."""
    from unittest.mock import MagicMock
    from app.core.services.match.event_service import EventService

    content_port.find_card_by_story_id_and_card_id.side_effect = lambda id_story, id_card: {
        "uuid": "card-uuid", "card_type": None,
        "url_image": "http://img", "alternative_image": None, "awesome_icon": None,
        "style_main": None, "style_detail": None, "style_image_little": None,
        "style_image_medium": None, "style_image_large": "ob-c-20",
        "id_text_title": 362, "id_text_name": 362,
        "id_text_description": 366, "id_text_copyright": 365,
        "link_copyright": "http://unsplash",
    }
    content_port.find_text_by_story_id_text_and_lang.side_effect = \
        lambda id_story, id_text, lang: {"short_text": f"text-{id_text}-{lang}"}

    service = EventService(MagicMock(), content_read_port=content_port)
    card = service._resolve_card_for(101, 125, "it")

    assert card["urlImage"] == "http://img"
    assert card["styleImageLarge"] == "ob-c-20"
    assert card["linkCopyright"] == "http://unsplash"
    # the three texts the board renders, resolved in the requested language
    assert card["title"] == "text-362-it"
    assert card["description"] == "text-366-it"
    assert card["copyrightText"] == "text-365-it"
    # not a single snake_case key survives
    assert not [k for k in card if "_" in k]


def test_card_text_falls_back_to_english(content_port):
    from unittest.mock import MagicMock
    from app.core.services.match.event_service import EventService

    content_port.find_card_by_story_id_and_card_id.side_effect = \
        lambda id_story, id_card: {"uuid": "c", "id_text_name": 7}
    content_port.find_text_by_story_id_text_and_lang.side_effect = \
        lambda id_story, id_text, lang: {"short_text": "English"} if lang == "en" else None

    service = EventService(MagicMock(), content_read_port=content_port)
    # id_text_title is absent: id_text_name is the fallback, exactly as elsewhere
    assert service._resolve_card_for(101, 1, "it")["title"] == "English"
    # no card, no crash
    content_port.find_card_by_story_id_and_card_id.side_effect = lambda *a: None
    assert service._resolve_card_for(101, 1, "en") is None
    assert service._resolve_card_for(101, None, "en") is None
