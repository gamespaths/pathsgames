"""Step 37 — the mission engine: conditions, the status machine, events and the API reads."""
import json
from unittest.mock import MagicMock

import pytest

from app.core.services.match.mission_service import (
    KEY_PREFIX, STATUS_ACTIVE, STATUS_AVAILABLE, STATUS_COMPLETED, STATUS_FAILED,
    MissionService, parse_values, satisfied,
)

MATCH = 7
STORY = 3


def _mission(id_, key="k", value="1", values=None, event=None):
    return {"id": id_, "uuid": f"m-{id_}", "condition_key": key, "condition_value": value,
            "condition_values": values, "id_event_completed": event,
            "id_text_name": None, "id_text_description": None, "id_card": None}


def _step(id_, id_mission, order, key, value="1", event=None):
    return {"id": id_, "uuid": f"s-{id_}", "id_mission": id_mission, "step": order,
            "condition_key": key, "condition_value": value, "condition_values": None,
            "id_event_completed": event, "id_text_name": None,
            "id_text_description": None, "id_card": None}


def _state(id_mission, id_step, status):
    return {"id_mission": id_mission, "id_mission_steps": id_step, "status": status}


@pytest.fixture
def store():
    s = MagicMock()
    s.find_story_id_by_match.return_value = STORY
    s.find_by_match.return_value = []
    s.find_mission_states.return_value = []
    return s


@pytest.fixture
def read_port():
    p = MagicMock()
    p.find_entities_for_story.return_value = []
    p.find_text_by_story_id_text_and_lang.return_value = None
    return p


@pytest.fixture
def service(store, read_port):
    return MissionService(store, read_port)


def _story(read_port, missions, steps):
    def by_table(_story_id, table):
        return missions if table == "list_missions" else steps
    read_port.find_entities_for_story.side_effect = by_table


def _registry(store, **pairs):
    store.find_by_match.return_value = [
        {"key": k, "string_value": v, "int_value": None} for k, v in pairs.items()]


# ── conditions ───────────────────────────────────────────────────────────────

def test_a_pipe_list_is_split_trimmed_and_its_empty_segments_dropped():
    assert parse_values(None, " a | b ||  c |") == ["a", "b", "c"]


def test_condition_values_wins_over_condition_value_when_it_holds_anything():
    assert parse_values("single", "x") == ["x"]
    assert parse_values("single", "  |  ") == ["single"]
    assert parse_values(" single ", None) == ["single"]
    assert parse_values(None, None) == []


def test_a_blank_condition_key_is_never_satisfied():
    assert not satisfied(_mission(1, key=None), {"k": ["1"]})
    assert not satisfied(_mission(1, key="  "), {"k": ["1"]})
    assert not satisfied(None, {})
    assert not satisfied(_mission(1, value=None), {"k": ["1"]})


def test_a_single_key_compares_equal_blind_to_case_and_padding():
    assert satisfied(_mission(1, value=" gold "), {"k": ["Gold"]})
    assert not satisfied(_mission(1, value="silver"), {"k": ["Gold"]})


def test_on_a_set_key_one_value_means_contained_in():
    assert satisfied(_mission(1, value="letter"), {"k": ["ledger", "letter"]})
    assert not satisfied(_mission(1, value="map"), {"k": ["ledger", "letter"]})


def test_condition_values_is_an_and_over_the_set():
    m = _mission(1, value=None, values="ledger|letter")
    assert satisfied(m, {"k": ["letter", "ledger", "map"]})
    assert not satisfied(m, {"k": ["ledger"]})


def test_a_key_the_match_never_wrote_satisfies_nothing():
    assert not satisfied(_mission(1), {})


# ── the status machine ───────────────────────────────────────────────────────

def test_a_mission_whose_condition_is_met_becomes_available(service, store, read_port):
    _story(read_port, [_mission(1)], [_step(10, 1, 1, "s1"), _step(11, 1, 2, "s2")])
    _registry(store, k="1")
    service.on_registry_change(MATCH, 4, STORY)
    store.upsert_mission_state.assert_called_once_with(
        MATCH, f"{KEY_PREFIX}m-1", STATUS_AVAILABLE, 1, None, 4)


def test_a_mission_whose_condition_is_not_met_is_not_even_written(service, store, read_port):
    _story(read_port, [_mission(1)], [])
    _registry(store, k="other")
    service.on_registry_change(MATCH, None, STORY)
    store.upsert_mission_state.assert_not_called()


def test_a_mission_with_no_steps_completes_on_its_own_condition(service, store, read_port):
    _story(read_port, [_mission(1)], [])
    _registry(store, k="1")
    service.on_registry_change(MATCH, None, STORY)
    store.upsert_mission_state.assert_called_once_with(
        MATCH, f"{KEY_PREFIX}m-1", STATUS_COMPLETED, 1, None, None)


def test_a_single_step_mission_skips_active(service, store, read_port):
    _story(read_port, [_mission(1)], [_step(10, 1, 1, "s1")])
    _registry(store, k="1", s1="1")
    service.on_registry_change(MATCH, None, STORY)
    store.upsert_mission_state.assert_called_once_with(
        MATCH, f"{KEY_PREFIX}m-1", STATUS_COMPLETED, 1, 10, None)


def test_the_first_step_of_a_longer_mission_moves_it_to_active(service, store, read_port):
    _story(read_port, [_mission(1)], [_step(10, 1, 1, "s1"), _step(11, 1, 2, "s2")])
    _registry(store, k="1", s1="1")
    store.find_mission_states.return_value = [_state(1, None, STATUS_AVAILABLE)]
    service.on_registry_change(MATCH, None, STORY)
    store.upsert_mission_state.assert_called_once_with(
        MATCH, f"{KEY_PREFIX}m-1", STATUS_ACTIVE, 1, 10, None)


def test_an_intermediate_step_moves_the_step_and_not_the_status(service, store, read_port):
    _story(read_port, [_mission(1)],
           [_step(10, 1, 1, "s1"), _step(11, 1, 2, "s2"), _step(12, 1, 3, "s3")])
    _registry(store, k="1", s1="1", s2="1")
    store.find_mission_states.return_value = [_state(1, 10, STATUS_ACTIVE)]
    service.on_registry_change(MATCH, None, STORY)
    store.upsert_mission_state.assert_called_once_with(
        MATCH, f"{KEY_PREFIX}m-1", STATUS_ACTIVE, 1, 11, None)


def test_one_write_may_close_several_steps_and_the_mission(service, store, read_port):
    _story(read_port, [_mission(1)],
           [_step(10, 1, 1, "s1"), _step(11, 1, 2, "s2"), _step(12, 1, 3, "s3")])
    _registry(store, k="1", s1="1", s2="1", s3="1")
    service.on_registry_change(MATCH, None, STORY)
    store.upsert_mission_state.assert_called_once_with(
        MATCH, f"{KEY_PREFIX}m-1", STATUS_COMPLETED, 1, 12, None)


def test_the_walk_stops_at_the_first_step_not_yet_met(service, store, read_port):
    _story(read_port, [_mission(1)],
           [_step(10, 1, 1, "s1"), _step(11, 1, 2, "s2"), _step(12, 1, 3, "s3")])
    _registry(store, k="1", s1="1", s3="1")
    service.on_registry_change(MATCH, None, STORY)
    store.upsert_mission_state.assert_called_once_with(
        MATCH, f"{KEY_PREFIX}m-1", STATUS_ACTIVE, 1, 10, None)


def test_a_step_with_a_blank_condition_key_blocks_the_walk(service, store, read_port):
    _story(read_port, [_mission(1)], [_step(10, 1, 1, ""), _step(11, 1, 2, "s2")])
    _registry(store, k="1", s2="1")
    service.on_registry_change(MATCH, None, STORY)
    store.upsert_mission_state.assert_called_once_with(
        MATCH, f"{KEY_PREFIX}m-1", STATUS_AVAILABLE, 1, None, None)


def test_nothing_is_written_when_nothing_moved(service, store, read_port):
    _story(read_port, [_mission(1)], [_step(10, 1, 1, "s1"), _step(11, 1, 2, "s2")])
    _registry(store, k="1", s1="1")
    store.find_mission_states.return_value = [_state(1, 10, STATUS_ACTIVE)]
    service.on_registry_change(MATCH, None, STORY)
    store.upsert_mission_state.assert_not_called()


def test_a_terminal_state_is_never_revisited(service, store, read_port):
    _story(read_port, [_mission(1)], [_step(10, 1, 1, "s1")])
    _registry(store, k="1", s1="1")
    store.find_mission_states.return_value = [_state(1, 10, STATUS_COMPLETED)]
    service.on_registry_change(MATCH, None, STORY)
    store.upsert_mission_state.assert_not_called()


def test_a_status_is_never_lost_when_the_condition_stops_holding(service, store, read_port):
    _story(read_port, [_mission(1)], [_step(10, 1, 1, "s1"), _step(11, 1, 2, "s2")])
    _registry(store, k="other")
    store.find_mission_states.return_value = [_state(1, 10, STATUS_ACTIVE)]
    service.on_registry_change(MATCH, None, STORY)
    store.upsert_mission_state.assert_not_called()


def test_the_story_id_is_resolved_from_the_match_when_the_caller_lacks_it(
        service, store, read_port):
    _story(read_port, [_mission(1)], [])
    _registry(store, k="1")
    service.on_registry_change(MATCH, 2)
    store.find_story_id_by_match.assert_called_once_with(MATCH)
    store.upsert_mission_state.assert_called_once_with(
        MATCH, f"{KEY_PREFIX}m-1", STATUS_COMPLETED, 1, None, 2)


def test_a_story_with_no_missions_or_none_at_all_does_nothing(service, store):
    service.on_registry_change(MATCH, None, STORY)
    store.find_story_id_by_match.return_value = None
    service.on_registry_change(MATCH, None)
    store.upsert_mission_state.assert_not_called()


# ── completion events ────────────────────────────────────────────────────────

def test_a_steps_event_runs_when_that_step_closes(service, store, read_port):
    port = MagicMock()
    service.event_port = port
    _story(read_port, [_mission(1, event=99)],
           [_step(10, 1, 1, "s1", event=50), _step(11, 1, 2, "s2", event=51)])
    _registry(store, k="1", s1="1")
    service.on_registry_change(MATCH, None, STORY)
    port.run_mission_event.assert_called_once_with(MATCH, 50, 1)


def test_steps_fire_in_order_and_the_missions_own_event_fires_last(service, store, read_port):
    port = MagicMock()
    service.event_port = port
    _story(read_port, [_mission(1, event=99)],
           [_step(10, 1, 1, "s1", event=50), _step(11, 1, 2, "s2", event=51)])
    _registry(store, k="1", s1="1", s2="1")
    service.on_registry_change(MATCH, None, STORY)
    assert [c.args[1] for c in port.run_mission_event.call_args_list] == [50, 51, 99]


def test_a_null_or_non_positive_event_id_is_not_a_trigger(service, store, read_port):
    port = MagicMock()
    service.event_port = port
    _story(read_port, [_mission(1, event=0)], [_step(10, 1, 1, "s1")])
    _registry(store, k="1", s1="1")
    service.on_registry_change(MATCH, None, STORY)
    port.run_mission_event.assert_not_called()


def test_events_wait_while_an_execution_holds_the_engine_back(service, store, read_port):
    port = MagicMock()
    service.event_port = port
    _story(read_port, [_mission(1, event=99)], [])
    _registry(store, k="1")
    service.begin_deferral()
    service.on_registry_change(MATCH, None, STORY)
    port.run_mission_event.assert_not_called()
    service.end_deferral()
    port.run_mission_event.assert_called_once_with(MATCH, 99, 1)


def test_nested_holds_release_only_on_the_outermost_one(service, store, read_port):
    port = MagicMock()
    service.event_port = port
    _story(read_port, [_mission(1, event=99)], [])
    _registry(store, k="1")
    service.begin_deferral()
    service.begin_deferral()
    service.on_registry_change(MATCH, None, STORY)
    service.end_deferral()
    port.run_mission_event.assert_not_called()
    service.end_deferral()
    port.run_mission_event.assert_called_once_with(MATCH, 99, 1)
    # One release too many is harmless: the counter never goes below zero.
    service.end_deferral()


def test_with_no_event_port_the_queue_is_emptied_not_left_to_grow(service, store, read_port):
    _story(read_port, [_mission(1, event=99)], [])
    _registry(store, k="1")
    service.on_registry_change(MATCH, None, STORY)
    assert service._pending == []


# ── end of story ─────────────────────────────────────────────────────────────

def test_what_opened_and_never_closed_fails_and_what_closed_is_left_alone(service, store):
    store.find_mission_states.return_value = [
        _state(1, None, STATUS_AVAILABLE), _state(2, 20, STATUS_ACTIVE),
        _state(3, 30, STATUS_COMPLETED)]
    service.on_story_end(MATCH)
    assert store.upsert_mission_state.call_count == 2
    store.upsert_mission_state.assert_any_call(MATCH, f"{KEY_PREFIX}1", STATUS_FAILED,
                                               1, None, None)
    store.upsert_mission_state.assert_any_call(MATCH, f"{KEY_PREFIX}2", STATUS_FAILED,
                                               2, 20, None)


# ── the API reads ────────────────────────────────────────────────────────────

def test_only_missions_the_match_has_reached_are_listed(service, store, read_port):
    _story(read_port, [_mission(1), _mission(2)], [])
    store.find_mission_states.return_value = [_state(1, None, STATUS_AVAILABLE)]
    out = service.list(MATCH, STORY)
    assert [m["uuid"] for m in out] == ["m-1"]
    assert out[0]["status"] == STATUS_AVAILABLE


def test_the_status_filter_is_read_whatever_case_it_is_asked_in(service, store, read_port):
    _story(read_port, [_mission(1), _mission(2)], [])
    store.find_mission_states.return_value = [_state(1, None, STATUS_AVAILABLE),
                                              _state(2, None, STATUS_COMPLETED)]
    assert len(service.list(MATCH, STORY, " completed ")) == 1
    assert len(service.list(MATCH, STORY, "  ")) == 2
    assert service.list(MATCH, STORY, "NONSENSE") == []


def test_steps_report_done_up_to_the_one_reached(service, store, read_port):
    _story(read_port, [_mission(1)],
           [_step(10, 1, 1, "s1"), _step(11, 1, 2, "s2"), _step(12, 1, 3, "s3")])
    store.find_mission_states.return_value = [_state(1, 11, STATUS_ACTIVE)]
    m = service.list(MATCH, STORY)[0]
    assert m["stepsTotal"] == 3
    assert m["stepReached"] == 2
    assert [s["done"] for s in m["steps"]] == [True, True, False]


def test_a_completed_mission_reports_every_step_done(service, store, read_port):
    _story(read_port, [_mission(1)], [_step(10, 1, 1, "s1"), _step(11, 1, 2, "s2")])
    store.find_mission_states.return_value = [_state(1, 11, STATUS_COMPLETED)]
    m = service.list(MATCH, STORY)[0]
    assert all(s["done"] for s in m["steps"])


def test_an_untouched_mission_reports_no_step_reached(service, store, read_port):
    _story(read_port, [_mission(1)], [_step(10, 1, 1, "s1")])
    store.find_mission_states.return_value = [_state(1, None, STATUS_AVAILABLE)]
    m = service.list(MATCH, STORY)[0]
    assert m["stepReached"] is None
    assert not m["steps"][0]["done"]


def test_texts_resolve_in_the_language_asked_for_falling_back_to_english(
        service, store, read_port):
    mission = _mission(1)
    mission["id_text_name"] = 900
    mission["id_text_description"] = 900
    _story(read_port, [mission], [])
    store.find_mission_states.return_value = [_state(1, None, STATUS_AVAILABLE)]
    read_port.find_text_by_story_id_text_and_lang.side_effect = (
        lambda _s, _t, lang: None if lang == "it"
        else {"short_text": "Tutorial", "long_text": "The long one"})
    out = service.list(MATCH, STORY, None, "it")[0]
    assert out["name"] == "Tutorial"
    assert out["description"] == "The long one"


def test_detail_answers_for_a_mission_reached_and_none_for_anything_else(
        service, store, read_port):
    mission = _mission(1)
    _story(read_port, [mission], [_step(10, 1, 1, "s1")])
    store.find_mission_states.return_value = [_state(1, None, STATUS_AVAILABLE)]
    read_port.find_entity_by_story_and_uuid.side_effect = (
        lambda _s, _t, uuid: mission if uuid == "m-1" else None)
    assert service.detail(MATCH, STORY, "m-1") is not None
    assert service.detail(MATCH, STORY, "nope") is None
    assert service.detail(MATCH, STORY, "  ") is None
    assert service.detail(MATCH, None, "m-1") is None


def test_a_mission_the_match_has_not_reached_is_not_found_either(service, store, read_port):
    mission = _mission(1)
    _story(read_port, [mission], [])
    read_port.find_entity_by_story_and_uuid.return_value = mission
    assert service.detail(MATCH, STORY, "m-1") is None


def test_with_no_state_and_with_no_story_the_list_is_simply_empty(service, store):
    assert service.list(MATCH, STORY) == []
    assert service.list(MATCH, None) == []
    assert MissionService(store).list(MATCH, STORY) == []


def test_a_card_is_resolved_only_when_a_content_port_is_wired(store, read_port):
    content = MagicMock()
    content.get_card_by_story_id_and_card_id.return_value = {"uuid": "c-1"}
    mission = _mission(1)
    mission["id_card"] = 5
    _story(read_port, [mission], [])
    store.find_mission_states.return_value = [_state(1, None, STATUS_AVAILABLE)]

    assert MissionService(store, read_port).list(MATCH, STORY)[0]["card"] is None
    assert MissionService(store, read_port, content).list(MATCH, STORY)[0]["card"] == {"uuid": "c-1"}


# ── v0.37.2 — every move says so on the log ──────────────────────────────────

def _last_message(store):
    """The message of the last MISSION_CHANGE row written."""
    rows = [c.args[5] for c in store.log_change.call_args_list]
    assert rows, "no log row was written at all"
    return rows[-1]


def test_opening_a_mission_names_it_both_statuses_and_no_step_yet(service, store, read_port):
    _story(read_port, [_mission(1)], [_step(10, 1, 1, "s1")])
    _registry(store, k="1")

    service.on_registry_change(MATCH, 4, STORY)

    assert _last_message(store) == "MISSION_CHANGE m-1 none -> AVAILABLE"


def test_closing_a_step_names_the_number_the_author_wrote(service, store, read_port):
    _story(read_port, [_mission(1)], [_step(10, 1, 7, "s1"), _step(11, 1, 9, "s2")])
    _registry(store, k="1", s1="1")
    store.find_mission_states.return_value = [_state(1, None, STATUS_AVAILABLE)]

    service.on_registry_change(MATCH, 5, STORY)

    assert _last_message(store) == "MISSION_CHANGE m-1 AVAILABLE -> ACTIVE step 7"


def test_a_mission_with_no_step_completes_and_the_row_says_so(service, store, read_port):
    _story(read_port, [_mission(1)], [])
    _registry(store, k="1")

    service.on_registry_change(MATCH, 2, STORY)

    assert _last_message(store) == "MISSION_CHANGE m-1 none -> COMPLETED"


def test_a_mission_that_does_not_move_writes_no_row_at_all(service, store, read_port):
    _story(read_port, [_mission(1)], [_step(10, 1, 1, "s1")])
    _registry(store, k="other")

    service.on_registry_change(MATCH, 1, STORY)

    store.log_change.assert_not_called()


def test_what_the_story_end_fails_is_named_by_uuid(service, store, read_port):
    _story(read_port, [_mission(1)], [])
    store.find_mission_states.return_value = [_state(1, None, STATUS_ACTIVE)]

    service.on_story_end(MATCH)

    assert _last_message(store) == "MISSION_CHANGE m-1 ACTIVE -> FAILED"


def test_with_no_story_port_the_failed_row_falls_back_to_the_id(store):
    bare = MissionService(store)
    store.find_mission_states.return_value = [_state(1, None, STATUS_AVAILABLE)]

    bare.on_story_end(MATCH)

    assert _last_message(store) == "MISSION_CHANGE 1 AVAILABLE -> FAILED"


# ── v0.37.2 — one row per thing that happened, each with its own card ─────────

def _all_messages(store):
    return [c.args[5] for c in store.log_change.call_args_list]


def test_closing_the_last_step_writes_the_step_row_then_the_missions(service, store, read_port):
    _story(read_port, [_mission(1)], [_step(10, 1, 7, "s1")])
    _registry(store, k="1", s1="1")
    store.find_mission_states.return_value = [_state(1, None, STATUS_AVAILABLE)]

    service.on_registry_change(MATCH, 6, STORY)

    # Two rows: the step is the step's news, the end is the mission's — and the timeline
    # narrates each with its own card.
    assert _all_messages(store) == [
        "MISSION_CHANGE m-1 AVAILABLE -> COMPLETED step 7",
        "MISSION_CHANGE m-1 AVAILABLE -> COMPLETED",
    ]


def test_two_steps_closed_at_once_are_two_rows_in_the_storys_order(service, store, read_port):
    _story(read_port, [_mission(1)],
           [_step(10, 1, 1, "s1"), _step(11, 1, 2, "s2"), _step(12, 1, 3, "s3")])
    _registry(store, k="1", s1="1", s2="1")
    store.find_mission_states.return_value = [_state(1, None, STATUS_AVAILABLE)]

    service.on_registry_change(MATCH, 7, STORY)

    assert _all_messages(store) == [
        "MISSION_CHANGE m-1 AVAILABLE -> ACTIVE step 1",
        "MISSION_CHANGE m-1 AVAILABLE -> ACTIVE step 2",
    ]


def test_a_mission_that_opens_and_closes_a_step_says_both(service, store, read_port):
    _story(read_port, [_mission(1)], [_step(10, 1, 1, "k"), _step(11, 1, 2, "s2")])
    _registry(store, k="1")

    service.on_registry_change(MATCH, 8, STORY)

    assert _all_messages(store) == [
        "MISSION_CHANGE m-1 none -> ACTIVE",
        "MISSION_CHANGE m-1 none -> ACTIVE step 1",
    ]


def test_a_card_comes_back_as_a_plain_dict_the_api_can_serialize(store, read_port):
    # v0.37.2 — the port answers a CardInfo dataclass; JSONResponse only speaks dict.
    from app.core.models.story.card_info import CardInfo
    content = MagicMock()
    content.get_card_by_story_id_and_card_id.return_value = CardInfo(uuid="c-1", title="Quest")
    mission = _mission(1)
    mission["id_card"] = 5
    _story(read_port, [mission], [])
    store.find_mission_states.return_value = [_state(1, None, STATUS_AVAILABLE)]

    card = MissionService(store, read_port, content).list(MATCH, STORY)[0]["card"]
    assert isinstance(card, dict)
    assert card["uuid"] == "c-1" and card["title"] == "Quest"
    json.dumps(card)
