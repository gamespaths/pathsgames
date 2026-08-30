"""Step 33 — location entry events: the events nobody asks for.

Mirrors ``EventExecutionServiceAutomaticTest`` on the Java side. Everything here goes
through the location engine that ``EventService`` implements: an arrival, or a time-start
that collected a counter fuse. What separates these from Step 29 execution is what they do
*not* do — no cost, no availability verdict, no choices — and the one thing only they can
do: run with no actor at all.
"""
from unittest.mock import MagicMock

import pytest

from app.core.models.match import location_entry_models as lem
from app.core.models.match.event_models import EventCheckContext
from app.core.models.match.location_entry_models import ArrivalContext, PendingAutomaticEvent
from app.core.services.match.event_service import EventService

MATCH_ID, STORY_ID, CHAR_ID, LOCATION, CLOCK = 1, 9, 7, 90002, 4
OTHER_LOCATION = 90003


def _character(cid=CHAR_ID, id_location=LOCATION):
    return dict(id=cid, uuid=f"char-{cid}", id_user=2, id_class=None,
                id_location=id_location, dexterity=5, intelligence=5, constitution=5,
                energy=10, life=10, sad=0, exp=0, energy_max=20, life_max=20, sad_max=50,
                is_sleeping=False, is_coma=False, characteristics=None)


def _event(eid, uuid, **over):
    base = dict(id=eid, uuid=uuid, type="AUTOMATIC", id_card=None, cost_enery=0,
                cost_coin=0, flag_end_time=0, id_event_next=None,
                id_specific_location=None, id_weather=None,
                registry_key_condition=None, registry_value_condition=None,
                id_item_condition=None, id_class_condition=None)
    base.update(over)
    return base


def _effect(**over):
    base = dict(id=1, uuid="effect-1", id_card=None, id_event=1, statistics=None, value=0,
                target="ONLY_ONE", target_class=None, traits_to_add=None,
                traits_to_remove=None, id_item_target=None, item_action=None,
                key_to_add=None, key_value_to_add=None, characteristic_to_add=None,
                characteristic_to_remove=None, id_weather=None, id_location=None)
    base.update(over)
    return base


def _triggers(first=None, not_first=None, alone=None, id_location=LOCATION):
    return {
        "id_location": id_location,
        "id_card": 500,
        "id_event_if_first_time": first,
        "id_event_not_first_time": not_first,
        "id_event_if_character_enter_empty_location": alone,
        "id_event_if_character_start_time": None,
        "id_event_if_counter_zero": None,
        "priority_automatic_event": 0,
    }


@pytest.fixture
def store():
    s = MagicMock()
    s.find_match_by_id.return_value = {
        "id": MATCH_ID, "uuid": "m1", "status": "RUNNING", "current_clock": CLOCK,
        "id_story": STORY_ID, "id_user_creator": 3, "id_current_weather": None,
    }
    s.find_character_by_match_and_id.return_value = _character()
    s.load_check_context.side_effect = lambda m, c: (
        EventCheckContext(id_character=c, id_location=LOCATION, energy=10, coin=0)
        if c is not None else EventCheckContext(id_character=None)
    )
    s.find_choices_by_event_id.return_value = []
    s.find_effects_by_event_id.return_value = {}
    s.find_id_event_end_game.return_value = None
    s.find_id_event_all_player_coma.return_value = None
    s.find_characters_for_event.return_value = [_character()]
    s.find_backpack.return_value = {"food": 0, "magic": 0, "coin": 0}
    s.find_location_uuids_by_id.return_value = {LOCATION: "loc-b", OTHER_LOCATION: "loc-c"}
    s.find_item_uuids_by_id.return_value = {}
    s.find_trait_uuids_by_id.return_value = {}
    return s


@pytest.fixture
def location_store():
    ls = MagicMock()
    ls.find_flag_visited.return_value = 0
    ls.count_other_characters_at_location.return_value = 0
    return ls


@pytest.fixture
def service(store, location_store):
    return EventService(store, edge_store=MagicMock(), location_store=location_store)


def _arrival():
    return ArrivalContext(MATCH_ID, STORY_ID, CHAR_ID, LOCATION, CLOCK, "en")


# ── arrival dispatch ─────────────────────────────────────────────────────────

def test_first_arrival_fires_id_event_if_first_time(service, store, location_store):
    store.find_events_by_id.return_value = {40: _event(40, "evt-first")}
    location_store.find_location_triggers.return_value = _triggers(first=40)

    fired = service.on_arrival(_arrival())

    assert len(fired) == 1
    assert fired[0].trigger == lem.TRIGGER_FIRST_ENTRY
    assert fired[0].event_uuid == "evt-first"
    assert fired[0].id_location == LOCATION


def test_v0356_a_lethal_arrival_carries_its_edge_state(service, store, location_store):
    """An arrival kills exactly as an executed event does, epilogue and all."""
    store.find_events_by_id.return_value = {40: _event(40, "evt-trap"),
                                            50: _event(50, "evt-coma")}
    store.find_effects_by_event_id.return_value = {40: [_effect(statistics="life", value=-99)]}
    store.find_id_event_all_player_coma.return_value = 50
    location_store.find_location_triggers.return_value = _triggers(first=40)

    fired = service.on_arrival(_arrival())

    edge = fired[0].edge_state
    assert "char-7" in edge.coma_uuids
    assert edge.all_players_in_coma is True
    assert edge.coma_event_uuid == "evt-coma"
    assert edge.coma_executed_event_uuids == ["evt-coma"]


def test_v0356_a_quiet_arrival_carries_an_empty_edge_state(service, store, location_store):
    store.find_events_by_id.return_value = {40: _event(40, "evt-first")}
    location_store.find_location_triggers.return_value = _triggers(first=40)

    fired = service.on_arrival(_arrival())

    assert fired[0].edge_state is not None
    assert fired[0].edge_state.anything() is False


def test_a_visited_destination_fires_id_event_not_first_time(service, store, location_store):
    store.find_events_by_id.return_value = {40: _event(40, "evt-first"),
                                            41: _event(41, "evt-again")}
    location_store.find_location_triggers.return_value = _triggers(first=40, not_first=41)
    location_store.find_flag_visited.return_value = 1

    fired = service.on_arrival(_arrival())

    assert len(fired) == 1
    assert fired[0].trigger == lem.TRIGGER_SUBSEQUENT_ENTRY
    assert fired[0].event_uuid == "evt-again"


def test_the_two_history_triggers_are_exclusive(service, store, location_store):
    store.find_events_by_id.return_value = {40: _event(40, "evt-first"),
                                            41: _event(41, "evt-again")}
    location_store.find_location_triggers.return_value = _triggers(first=40, not_first=41)

    fired = service.on_arrival(_arrival())

    assert [f.event_uuid for f in fired] == ["evt-first"]


def test_an_empty_destination_also_fires_first_in_location(service, store, location_store):
    store.find_events_by_id.return_value = {40: _event(40, "evt-first"),
                                            42: _event(42, "evt-alone")}
    location_store.find_location_triggers.return_value = _triggers(first=40, alone=42)

    fired = service.on_arrival(_arrival())

    assert [f.trigger for f in fired] == [lem.TRIGGER_FIRST_ENTRY,
                                          lem.TRIGGER_MOVE_INTO_EMPTY_LOCATION]


def test_somebody_else_here_suppresses_first_in_location(service, store, location_store):
    store.find_events_by_id.return_value = {42: _event(42, "evt-alone")}
    location_store.find_location_triggers.return_value = _triggers(alone=42)
    location_store.count_other_characters_at_location.return_value = 1

    assert service.on_arrival(_arrival()) == []


def test_flag_visited_is_latched_after_the_triggers_are_read(service, store, location_store):
    store.find_events_by_id.return_value = {40: _event(40, "evt-first")}
    location_store.find_location_triggers.return_value = _triggers(first=40, not_first=41)

    fired = service.on_arrival(_arrival())

    # Had the flag been written first, this same arrival would have read 1 and reported
    # SUBSEQUENT_ENTRY — the discovery would never fire for anyone.
    assert fired[0].trigger == lem.TRIGGER_FIRST_ENTRY
    location_store.mark_state_location_visited.assert_called_once_with(MATCH_ID, LOCATION)


def test_a_location_with_no_trigger_is_still_marked_visited(service, store, location_store):
    store.find_events_by_id.return_value = {}
    location_store.find_location_triggers.return_value = _triggers()

    assert service.on_arrival(_arrival()) == []
    location_store.mark_state_location_visited.assert_called_once_with(MATCH_ID, LOCATION)


def test_a_dangling_event_id_is_skipped_not_fatal(service, store, location_store):
    store.find_events_by_id.return_value = {}
    location_store.find_location_triggers.return_value = _triggers(first=999)

    assert service.on_arrival(_arrival()) == []


def test_an_unknown_location_resolves_to_nothing(service, location_store):
    location_store.find_location_triggers.return_value = None
    assert service.on_arrival(_arrival()) == []


def test_a_match_that_is_not_running_fires_nothing(service, store, location_store):
    store.find_match_by_id.return_value["status"] = "PAUSED"
    store.find_events_by_id.return_value = {40: _event(40, "evt-first")}
    location_store.find_location_triggers.return_value = _triggers(first=40)

    assert service.on_arrival(_arrival()) == []


# ── what an automatic event may not do ───────────────────────────────────────

def test_a_choice_owning_event_is_refused_and_logged(service, store, location_store):
    store.find_events_by_id.return_value = {40: _event(40, "evt-first")}
    store.find_choices_by_event_id.return_value = [{"id": 1}]
    location_store.find_location_triggers.return_value = _triggers(first=40)

    assert service.on_arrival(_arrival()) == []
    # No EVENT_EXECUTED marker: writing one would open a cycle that no select-choice call
    # could ever close, and the match would carry it for ever.
    store.log_event_executed.assert_not_called()
    assert "may not own choices" in location_store.log_automatic_event.call_args[0][5]


def test_nobody_pays_for_an_automatic_event(service, store, location_store):
    store.find_events_by_id.return_value = {40: _event(40, "evt-costly", cost_enery=99,
                                                       cost_coin=99)}
    location_store.find_location_triggers.return_value = _triggers(first=40)

    fired = service.on_arrival(_arrival())

    assert len(fired) == 1
    assert fired[0].stat_changes == []


def test_a_forced_movement_loop_aborts_at_the_depth_cap(service, store, location_store):
    """The story an author can write in two admin form fields: 40 pushes you to 90003,
    whose trigger 41 pushes you back to 90002, whose trigger is 40 again. Nothing inside
    the chain runner stops this — each arrival gets a fresh visited set."""
    where = {"at": LOCATION}
    store.update_character_location.side_effect = \
        lambda m, c, loc: where.__setitem__("at", loc)
    store.find_character_by_match_and_id.side_effect = \
        lambda m, c: _character(id_location=where["at"])
    store.find_events_by_id.return_value = {40: _event(40, "evt-to-c"),
                                            41: _event(41, "evt-to-b")}
    store.find_effects_by_event_id.return_value = {
        40: [_effect(id_location=OTHER_LOCATION)],
        41: [_effect(id_location=LOCATION)],
    }
    location_store.find_location_triggers.side_effect = lambda s, loc: (
        _triggers(first=40, not_first=40) if loc == LOCATION
        else _triggers(first=41, not_first=41, id_location=OTHER_LOCATION))

    fired = service.on_arrival(_arrival())

    # It terminates — that is the whole point — and it says so in the log rather than
    # hanging the request that triggered it.
    assert len(fired) <= 16
    aborts = [c for c in location_store.log_automatic_event.call_args_list
              if "aborted" in c[0][5]]
    assert aborts, "the runaway cascade must log an abort"


# ── the counter-zero / time-start path ───────────────────────────────────────

def test_pending_events_run_in_the_order_given(service, store, location_store):
    store.find_events_by_id.return_value = {50: _event(50, "evt-a"), 51: _event(51, "evt-b")}

    fired = service.run_pending_automatic_events(MATCH_ID, CLOCK, [
        PendingAutomaticEvent(lem.TRIGGER_COUNTER_ZERO, LOCATION, 50, CHAR_ID, 1),
        PendingAutomaticEvent(lem.TRIGGER_CHARACTER_START_TIME, OTHER_LOCATION, 51, None, 2),
    ], "en")

    assert [f.event_uuid for f in fired] == ["evt-a", "evt-b"]


def test_a_fuse_in_an_empty_location_still_writes_the_registry(service, store, location_store):
    store.find_events_by_id.return_value = {50: _event(50, "evt-empty-room")}
    store.find_effects_by_event_id.return_value = {
        50: [_effect(key_to_add="DOOR_OPEN", key_value_to_add="YES")]}

    fired = service.run_pending_automatic_events(MATCH_ID, CLOCK, [
        PendingAutomaticEvent(lem.TRIGGER_COUNTER_ZERO, LOCATION, 50, None, 0)], "en")

    assert len(fired) == 1
    # id_character None: the world changed, but around no one.
    store.upsert_registry.assert_called_once()
    assert store.upsert_registry.call_args[0][3] is None
    store.update_character_stats.assert_not_called()


def test_an_empty_pending_list_does_nothing(service, store):
    assert service.run_pending_automatic_events(MATCH_ID, CLOCK, [], "en") == []
    store.find_match_by_id.assert_not_called()


# ── fog of war ───────────────────────────────────────────────────────────────

EVENT_CARD = {"title": "The fuse burns out"}
EFFECT_CARD = {"title": "You feel weaker"}
LOCATION_CARD = {"title": "The old mill"}
# v0.35.8 — what the port actually returns: the raw row, which the service maps.
LOCATION_CARD_ROW = {"uuid": "card-loc", "id_text_title": 501, "url_image": "http://img"}


def _fired_at(id_location=LOCATION):
    from app.core.models.match.event_models import AppliedEffect
    return [lem.AutomaticEventFired(
        lem.TRIGGER_COUNTER_ZERO, id_location, "evt-a", EVENT_CARD,
        effects=[AppliedEffect(event_uuid="evt-a", effect_uuid="eff-1", statistic="energy",
                               value=-3, target="ONLY_ONE", target_class=None,
                               character_uuids=["char-1"], card=EFFECT_CARD)])]


@pytest.fixture
def service_with_cards(store, location_store):
    """The location card is authored, so cardLocation actually resolves to something."""
    content = MagicMock()
    content.find_card_by_story_id_and_card_id.return_value = LOCATION_CARD_ROW
    content.find_text_by_story_id_text_and_lang.return_value = {"short_text": "The old mill"}
    location_store.find_location_triggers.return_value = _triggers()
    return EventService(store, edge_store=MagicMock(), location_store=location_store,
                        content_read_port=content)


def test_standing_there_is_full(service_with_cards, location_store):
    location_store.find_character_location.return_value = LOCATION
    location_store.find_visited_location_ids.return_value = [LOCATION]

    told = service_with_cards.describe_for_recipient(MATCH_ID, CHAR_ID, CLOCK, _fired_at(), "en")

    assert told[0].visibility == lem.VISIBILITY_FULL
    assert told[0].clock == CLOCK
    # v0.33.1: the news is the event and what it did, not the name of the place.
    assert told[0].card == EVENT_CARD
    # the raw row is mapped to the API contract, with the title resolved
    assert told[0].card_location["title"] == "The old mill"
    assert told[0].card_location["urlImage"] == "http://img"
    assert [e.card for e in told[0].card_effects] == [EFFECT_CARD]


def test_having_been_there_before_is_named(service_with_cards, location_store):
    location_store.find_character_location.return_value = OTHER_LOCATION
    location_store.find_visited_location_ids.return_value = [LOCATION, OTHER_LOCATION]

    told = service_with_cards.describe_for_recipient(MATCH_ID, CHAR_ID, CLOCK, _fired_at(), "en")

    assert told[0].visibility == lem.VISIBILITY_NAMED
    assert told[0].card == EVENT_CARD
    assert told[0].card_location["title"] == "The old mill"
    assert len(told[0].card_effects) == 1


def test_an_event_with_no_effects_still_tells_its_own_card(service_with_cards, location_store):
    location_store.find_character_location.return_value = LOCATION
    location_store.find_visited_location_ids.return_value = [LOCATION]
    bare = [lem.AutomaticEventFired(lem.TRIGGER_COUNTER_ZERO, LOCATION, "evt-a", EVENT_CARD)]

    told = service_with_cards.describe_for_recipient(MATCH_ID, CHAR_ID, CLOCK, bare, "en")

    assert told[0].card == EVENT_CARD
    assert told[0].card_effects == []


def test_a_place_never_seen_is_anonymous_and_unnamed(service, location_store):
    location_store.find_character_location.return_value = OTHER_LOCATION
    location_store.find_visited_location_ids.return_value = [OTHER_LOCATION]

    told = service.describe_for_recipient(MATCH_ID, CHAR_ID, CLOCK, _fired_at(), "en")

    assert told[0].visibility == lem.VISIBILITY_ANONYMOUS
    # A name that never leaves the server cannot leak: no card of any kind is even looked up.
    assert told[0].card is None
    assert told[0].card_location is None
    assert told[0].card_effects == []
    location_store.find_location_triggers.assert_not_called()


def test_no_recipient_yields_the_most_cautious_reading(service):
    told = service.describe_for_recipient(MATCH_ID, None, CLOCK, _fired_at(), "en")
    assert told[0].visibility == lem.VISIBILITY_ANONYMOUS
    assert told[0].card is None
    assert told[0].card_location is None
    assert told[0].card_effects == []


def test_nothing_fired_nothing_told(service):
    assert service.describe_for_recipient(MATCH_ID, CHAR_ID, CLOCK, [], "en") == []


# ── the pre-Step-33 engine ───────────────────────────────────────────────────

def test_without_a_location_store_the_engine_is_exactly_as_before(store):
    legacy = EventService(store, edge_store=MagicMock())

    assert legacy.on_arrival(_arrival()) == []
    assert legacy.run_pending_automatic_events(MATCH_ID, CLOCK, [
        PendingAutomaticEvent(lem.TRIGGER_COUNTER_ZERO, LOCATION, 50, None, 0)], "en") == []
    store.find_events_by_id.assert_not_called()


# ── the REST shape ───────────────────────────────────────────────────────────

def test_the_movement_payload_is_json_serializable():
    """Regression: the three lists hold the same dataclasses execute-event returns
    (AppliedEffect / StatChange / LocationChange). Handing them to the JSON encoder raw
    500s the whole movement response — which is how every Step 28 movement test failed
    too, not just the Step 33 ones."""
    import json
    from app.core.models.match.event_models import AppliedEffect, LocationChange, StatChange

    fired = lem.AutomaticEventFired(
        lem.TRIGGER_FIRST_ENTRY, 90002, 'evt-first', {'title': 'A door left open'},
        effects=[AppliedEffect(event_uuid='evt-first', effect_uuid='eff-1',
                               statistic='exp', value=11, target='ONLY_ONE',
                               target_class=None, character_uuids=['char-1'],
                               card={'title': 'x'})],
        stat_changes=[StatChange('char-1', 'exp', 0, 11, 11)],
        location_changes=[LocationChange('char-1', 'loc-a', 'loc-b')],
    )

    payload = lem.to_camel_automatic_event(fired)
    json.dumps(payload)  # must not raise

    assert payload['effects'][0]['eventUuid'] == 'evt-first'
    assert payload['statChanges'][0]['delta'] == 11
    assert payload['locationChanges'][0]['toLocationUuid'] == 'loc-b'


def test_the_counter_zero_payload_is_json_serializable():
    import json
    item = lem.CounterZeroItem(lem.TRIGGER_COUNTER_ZERO, 90001, None, None, [],
                               'evt-fuse', 7, lem.VISIBILITY_ANONYMOUS)
    payload = lem.to_camel_counter_zero(item)
    json.dumps(payload)
    # A name that never leaves the server cannot leak.
    assert payload['card'] is None
    assert payload['cardLocation'] is None
    assert payload['cardEffects'] == []
    assert payload['visibility'] == 'ANONYMOUS'


def test_the_counter_zero_card_effects_are_mapped_not_handed_over_raw():
    """Same regression as the movement payload: cardEffects holds AppliedEffect dataclasses,
    and a dataclass handed to the JSON encoder raw 500s the whole sleep response."""
    import json
    from app.core.models.match.event_models import AppliedEffect

    item = lem.CounterZeroItem(
        lem.TRIGGER_COUNTER_ZERO, 90001, EVENT_CARD, LOCATION_CARD,
        [AppliedEffect(event_uuid='evt-fuse', effect_uuid='eff-1', statistic='energy',
                       value=-3, target='ONLY_ONE', target_class=None,
                       character_uuids=['char-1'], card=EFFECT_CARD)],
        'evt-fuse', 7, lem.VISIBILITY_FULL)

    payload = lem.to_camel_counter_zero(item)
    json.dumps(payload)  # must not raise

    assert payload['card'] == EVENT_CARD
    assert payload['cardLocation'] == LOCATION_CARD
    assert payload['cardEffects'][0]['effectUuid'] == 'eff-1'
    assert payload['cardEffects'][0]['card'] == EFFECT_CARD
