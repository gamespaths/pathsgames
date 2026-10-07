"""Step 40 — forced time-end news (counterZero + weather) and party-run gains.

Mirrors TimeAdvancementServiceWeatherTest and EventExecutionServiceStep40Test on the Java side.
"""
from unittest.mock import MagicMock

import pytest

from app.adapters.rest.match.event_controller import _result_to_camel
from app.adapters.rest.match.movement_controller import _movement_to_camel
from app.core.models.match import location_entry_models as lem
from app.core.models.match.event_models import EdgeStateOutcome, EventCheckContext
from app.core.models.match.location_entry_models import ArrivalContext
from app.core.models.match.movement_models import MovementResult
from app.core.models.match.time_models import TimeEndNews, TimeEndOutcome, TimeStartWeather
from app.core.services.match.event_service import EventService
from app.core.services.match.movement_service import time_end_of
from app.core.services.match.time_advancement_service import TimeAdvancementService
from app.core.services.match.weather_selection_service import WeatherSelectionService

MATCH_UUID, USER_UUID = "m1", "user-uuid"
MATCH_ID, STORY_ID, CHAR_ID, USER_ID, LOCATION, CLOCK = 1, 9, 7, 3, 90002, 4


def _weather(wid):
    return {"id_weather": wid, "uuid": f"w-{wid}", "id_card": 30 + wid, "delta_energy": -2,
            "cost_move_safe_location": 3, "cost_move_not_safe_location": 4}


# ── TimeAdvancementService ──────────────────────────────────────────────────

def test_weather_view_flags_a_change():
    assert TimeAdvancementService.weather_view(None, None) is None
    assert TimeAdvancementService.weather_view(_weather(1), None) is None
    first = TimeAdvancementService.weather_view(None, _weather(2))
    assert first.changed is True and first.id_card == 32
    same = TimeAdvancementService.weather_view(_weather(2), _weather(2))
    assert same.changed is False
    switched = TimeAdvancementService.weather_view(_weather(1), _weather(2))
    assert switched.changed is True and switched.uuid == "w-2"
    assert switched.delta_energy == -2 and switched.cost_move_not_safe_location == 4


def _time_service(weather_service=None, runner=None):
    store = MagicMock()
    store.find_match_by_uuid.return_value = {"id": MATCH_ID, "uuid": MATCH_UUID,
                                             "status": "RUNNING", "current_clock": CLOCK}
    store.increment_match_clock.return_value = CLOCK + 1
    store.find_characters_by_match_id.return_value = []
    recovery = MagicMock()
    recovery.apply_at_time_start.return_value = MagicMock(
        recovery=[], pending=["p"], edge_state=EdgeStateOutcome.none())
    svc = TimeAdvancementService(store, MagicMock(), recovery_service=recovery,
                                 weather_service=weather_service)
    if runner is not None:
        svc.set_automatic_event_runner(runner)
    return svc


def test_force_time_end_answers_the_weather_and_the_recipients_counter_zero():
    weather = MagicMock()
    weather.current_weather_by_id.side_effect = [_weather(1), _weather(2)]
    runner = MagicMock()
    fired = [MagicMock(edge_state=EdgeStateOutcome.none())]
    runner.run_pending_automatic_events.return_value = fired
    runner.describe_for_recipient.return_value = ["cz"]

    out = _time_service(weather, runner).force_time_end(MATCH_UUID, CHAR_ID)

    assert out.new_clock == CLOCK + 1
    assert out.counter_zero == ["cz"]
    assert out.weather.changed is True and out.weather.id_weather == 2
    runner.describe_for_recipient.assert_called_once_with(MATCH_ID, CHAR_ID, CLOCK + 1, fired, "en")
    weather.apply_at_time_start.assert_called_once_with(MATCH_ID)


def test_force_time_end_without_a_weather_engine_answers_no_weather():
    out = _time_service().force_time_end(MATCH_UUID)
    assert out.weather is None and out.counter_zero == []


def test_weather_service_reads_the_current_weather_by_match_id():
    store = MagicMock()
    store.find_current_weather.return_value = _weather(5)
    assert WeatherSelectionService(store).current_weather_by_id(MATCH_ID)["id_weather"] == 5
    store.find_current_weather.assert_called_once_with(MATCH_ID)


# ── EventService ────────────────────────────────────────────────────────────

def _character(cid=CHAR_ID):
    return dict(id=cid, uuid=f"char-{cid}", id_user=USER_ID, id_class=None,
                id_location=LOCATION, dexterity=5, intelligence=5, constitution=5,
                energy=10, life=10, sad=0, exp=0, energy_max=20, life_max=20, sad_max=50,
                is_sleeping=False, is_coma=False, characteristics=None)


def _event(eid, end_time=False, etype="AUTOMATIC"):
    return dict(id=eid, uuid=f"evt-{eid}", type=etype, id_card=None, cost_enery=0,
                cost_coin=0, flag_end_time=1 if end_time else 0, id_event_next=None,
                id_specific_location=None, id_weather=None, registry_key_condition=None,
                registry_value_condition=None, id_item_condition=None, id_class_condition=None)


def _effect(stat, value, eid):
    return dict(id=eid * 10, uuid=f"eff-{eid}", id_card=None, id_event=eid, statistics=stat,
                value=value, target="ALL", target_class=None, traits_to_add=None,
                traits_to_remove=None, id_item_target=None, item_action=None, key_to_add=None,
                key_value_to_add=None, characteristic_to_add=None,
                characteristic_to_remove=None, id_weather=None, id_location=None)


@pytest.fixture
def store():
    s = MagicMock()
    match = {"id": MATCH_ID, "uuid": MATCH_UUID, "status": "RUNNING", "current_clock": CLOCK,
             "id_story": STORY_ID, "id_user_creator": USER_ID, "id_current_weather": None}
    s.find_match_by_id.return_value = match
    s.find_match_for_event.return_value = match
    s.find_user_id_by_uuid.return_value = USER_ID
    s.find_character_by_match_and_id.return_value = _character()
    s.find_character_by_match_and_user.return_value = _character()
    s.load_check_context.side_effect = lambda m, c: (
        EventCheckContext(id_character=c, id_location=LOCATION, energy=10, coin=0)
        if c is not None else EventCheckContext(id_character=None))
    s.find_choices_by_event_id.return_value = []
    s.find_effects_by_event_id.return_value = {}
    s.find_id_event_end_game.return_value = None
    s.find_id_event_all_player_coma.return_value = None
    s.find_characters_for_event.return_value = [_character()]
    s.find_backpack.return_value = {"food": 0, "magic": 0, "coin": 0}
    s.find_location_uuids_by_id.return_value = {LOCATION: "loc-b"}
    s.find_item_uuids_by_id.return_value = {}
    s.find_trait_uuids_by_id.return_value = {}
    s.find_trait_stats_by_id.return_value = {}
    return s


@pytest.fixture
def location_store():
    ls = MagicMock()
    ls.find_flag_visited.return_value = 0
    ls.count_other_characters_at_location.return_value = 0
    return ls


def _service(store, location_store, time_service=None, content=None):
    return EventService(store, edge_store=MagicMock(), location_store=location_store,
                        time_service=time_service, content_read_port=content,
                        registry_service_instance=MagicMock())


def _gains_of(store, id_event):
    for call in store.log_event_executed.call_args_list:
        if call.args[2] == id_event:
            return call.args[1], call.args[9]
    raise AssertionError(f"no row for event {id_event}")


def test_a_random_event_sums_the_coins_of_the_whole_party(store, location_store):
    store.find_characters_for_event.return_value = [_character(), _character(8)]
    store.find_events_by_id.return_value = {70: _event(70)}
    store.find_effects_by_event_id.return_value = {70: [_effect("coin", 1, 70)]}

    _service(store, location_store).run_random_event(MATCH_ID, CLOCK, 70, "en")

    actor, gained = _gains_of(store, 70)
    assert actor is None
    assert gained["coin"] == 2


def test_a_mission_reward_logs_its_magic_with_no_actor(store, location_store):
    store.find_events_by_id.return_value = {60: _event(60)}
    store.find_effects_by_event_id.return_value = {60: [_effect("magic", 1, 60)]}

    _service(store, location_store).run_mission_event(MATCH_ID, 60, 0)

    actor, gained = _gains_of(store, 60)
    assert actor is None and gained["magic"] == 1


def test_execute_event_with_flag_end_time_carries_the_news(store, location_store, monkeypatch):
    event = _event(50, end_time=True, etype="NORMAL")
    store.find_events_by_id.return_value = {50: event}
    store.find_event_by_story_and_uuid.return_value = event
    time_service = MagicMock()
    weather = TimeStartWeather(2, "w2", 33, None, -1, 1, 2, False)
    item = lem.CounterZeroItem("COUNTER_ZERO", LOCATION, None, None, [], "evt-cz", 5, "FULL")
    time_service.force_time_end.return_value = TimeEndOutcome(
        CLOCK + 1, [], [item], EdgeStateOutcome.none(), weather)
    monkeypatch.setattr("app.core.services.match.event_service.resolve_card",
                        lambda port, story, card, lang: {"uuid": f"card-{card}"})
    svc = _service(store, location_store, time_service, content=MagicMock())

    r = svc.execute_event(MATCH_UUID, USER_UUID, "evt-50", "en")

    time_service.force_time_end.assert_called_once_with(MATCH_UUID, CHAR_ID)
    assert r.time_ended is True
    assert r.time_end.counter_zero == [item]
    assert r.time_end.weather.card == {"uuid": "card-33"}
    body = _result_to_camel(r)
    assert body["weather"]["changed"] is False
    assert body["weather"]["card"] == {"uuid": "card-33"}
    assert body["counterZero"][0]["eventUuid"] == "evt-cz"


def test_execute_event_without_a_time_end_answers_null_and_empty(store, location_store):
    event = _event(51, etype="NORMAL")
    store.find_events_by_id.return_value = {51: event}
    store.find_event_by_story_and_uuid.return_value = event

    r = _service(store, location_store).execute_event(MATCH_UUID, USER_UUID, "evt-51", "en")

    assert r.time_end is None
    body = _result_to_camel(r)
    assert body["weather"] is None and body["counterZero"] == []


def test_an_arrival_that_ends_the_time_carries_the_news(store, location_store):
    store.find_events_by_id.return_value = {40: _event(40, end_time=True)}
    location_store.find_location_triggers.return_value = {
        "id_location": LOCATION, "id_card": 500, "id_event_if_first_time": 40,
        "id_event_not_first_time": None, "id_event_if_character_enter_empty_location": None,
        "id_event_if_character_start_time": None, "id_event_if_counter_zero": None,
        "priority_automatic_event": 0}
    time_service = MagicMock()
    time_service.force_time_end.return_value = TimeEndOutcome(
        CLOCK + 1, [], [], EdgeStateOutcome.none())

    fired = _service(store, location_store, time_service).on_arrival(
        ArrivalContext(MATCH_ID, STORY_ID, CHAR_ID, LOCATION, CLOCK, "en"))

    assert fired[0].time_end is not None
    assert fired[0].time_end.new_clock == CLOCK + 1
    assert fired[0].time_end.weather is None


# ── movement and the REST shapes ────────────────────────────────────────────

def test_time_end_of_picks_the_first_news():
    news = TimeEndNews(9, [], None)
    quiet = lem.AutomaticEventFired("FIRST_ENTRY", LOCATION, "a")
    ender = lem.AutomaticEventFired("FIRST_ENTRY", LOCATION, "b", time_end=news)
    assert time_end_of([quiet, ender]) is news
    assert time_end_of([quiet]) is None
    assert time_end_of(None) is None


def test_movement_answer_carries_time_ended_weather_and_counter_zero():
    item = lem.CounterZeroItem("COUNTER_ZERO", LOCATION, None, None, [], "evt", 5, "FULL")
    news = TimeEndNews(5, [item], TimeStartWeather(2, "w2", None, None, 0, 1, 2, True))
    with_news = _movement_to_camel(MovementResult(
        MATCH_UUID, "c", 1, None, 2, "l2", 1, 4, 5, time_end=news))
    assert with_news["timeEnded"] is True
    assert with_news["weather"]["uuid"] == "w2" and with_news["weather"]["changed"] is True
    assert with_news["counterZero"][0]["eventUuid"] == "evt"
    quiet = _movement_to_camel(MovementResult(MATCH_UUID, "c", 1, None, 2, "l2", 1, 4, 4))
    assert quiet["timeEnded"] is False
    assert quiet["weather"] is None and quiet["counterZero"] == []
