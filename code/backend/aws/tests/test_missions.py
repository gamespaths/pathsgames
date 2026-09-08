"""Step 37 — the mission engine as a pure module: conditions, the machine, the payload."""
from match import missions as m


def _mission(id_, key="k", value="1", values=None, event=None):
    return {"id": id_, "uuid": f"m-{id_}", "conditionKey": key, "conditionValue": value,
            "conditionValues": values, "idEventCompleted": event}


def _step(id_, id_mission, order, key, value="1", event=None):
    return {"id": id_, "uuid": f"s-{id_}", "idMission": id_mission, "step": order,
            "conditionKey": key, "conditionValue": value, "idEventCompleted": event}


def _story(missions=None, steps=None):
    return {"missions": missions or [], "missionSteps": steps or [],
            "raw_texts": [], "raw_cards": []}


def _match(**registry):
    return {"uuid": "m1", "registry": [
        {"id": i + 1, "key": k, "stringValue": v, "intValue": None}
        for i, (k, v) in enumerate(registry.items())]}


def _state(match, id_mission):
    return next((r for r in m._registry.mission_states(match)
                 if r["idMission"] == id_mission), None)


# ── conditions ───────────────────────────────────────────────────────────────

def test_a_pipe_list_is_split_trimmed_and_its_empty_segments_dropped():
    assert m.parse_values(None, " a | b ||  c |") == ["a", "b", "c"]


def test_condition_values_wins_over_condition_value():
    assert m.parse_values("single", "x") == ["x"]
    assert m.parse_values("single", "  |  ") == ["single"]
    assert m.parse_values(None, None) == []


def test_a_blank_condition_key_is_never_satisfied():
    assert not m.satisfied(_mission(1, key=None), {"k": ["1"]})
    assert not m.satisfied(_mission(1, key="  "), {"k": ["1"]})
    assert not m.satisfied(None, {})
    assert not m.satisfied(_mission(1, value=None), {"k": ["1"]})


def test_comparison_is_blind_to_case_and_padding_and_reads_a_set_as_contained_in():
    assert m.satisfied(_mission(1, value=" gold "), {"k": ["Gold"]})
    assert m.satisfied(_mission(1, value="letter"), {"k": ["ledger", "letter"]})
    assert not m.satisfied(_mission(1, value="map"), {"k": ["ledger", "letter"]})
    assert not m.satisfied(_mission(1), {})


def test_condition_values_is_an_and_over_the_set():
    mission = _mission(1, value=None, values="ledger|letter")
    assert m.satisfied(mission, {"k": ["letter", "ledger", "map"]})
    assert not m.satisfied(mission, {"k": ["ledger"]})


# ── the status machine ───────────────────────────────────────────────────────

def test_a_mission_whose_condition_is_met_becomes_available():
    match = _match(k="1")
    story = _story([_mission(1)], [_step(10, 1, 1, "s1"), _step(11, 1, 2, "s2")])

    assert m.evaluate(match, story, 4) == []
    row = _state(match, 1)
    assert row["stringValue"] == m.STATUS_AVAILABLE
    assert row["idMissionSteps"] is None
    assert row["key"] == "mission:m-1"
    assert row["clock"] == 4


def test_a_mission_whose_condition_is_not_met_writes_nothing():
    match = _match(k="other")
    m.evaluate(match, _story([_mission(1)], []))
    assert m._registry.mission_states(match) == []


def test_a_mission_with_no_steps_completes_on_its_own_condition():
    match = _match(k="1")
    assert m.evaluate(match, _story([_mission(1, event=99)], [])) == [99]
    assert _state(match, 1)["stringValue"] == m.STATUS_COMPLETED


def test_a_single_step_mission_skips_active():
    match = _match(k="1", s1="1")
    m.evaluate(match, _story([_mission(1)], [_step(10, 1, 1, "s1")]))
    assert _state(match, 1)["stringValue"] == m.STATUS_COMPLETED
    assert _state(match, 1)["idMissionSteps"] == 10


def test_the_first_step_of_a_longer_mission_moves_it_to_active():
    match = _match(k="1", s1="1")
    story = _story([_mission(1)], [_step(10, 1, 1, "s1"), _step(11, 1, 2, "s2")])
    m.evaluate(match, story)
    assert _state(match, 1)["stringValue"] == m.STATUS_ACTIVE


def test_an_intermediate_step_moves_the_step_and_not_the_status():
    match = _match(k="1", s1="1", s2="1")
    story = _story([_mission(1)],
                   [_step(10, 1, 1, "s1"), _step(11, 1, 2, "s2"), _step(12, 1, 3, "s3")])
    m.evaluate(match, story)
    assert _state(match, 1)["stringValue"] == m.STATUS_ACTIVE
    assert _state(match, 1)["idMissionSteps"] == 11


def test_one_write_may_close_several_steps_and_the_mission_with_them():
    match = _match(k="1", s1="1", s2="1", s3="1")
    story = _story([_mission(1, event=99)],
                   [_step(10, 1, 1, "s1", event=50), _step(11, 1, 2, "s2", event=51),
                    _step(12, 1, 3, "s3")])
    assert m.evaluate(match, story) == [50, 51, 99]
    assert _state(match, 1)["stringValue"] == m.STATUS_COMPLETED


def test_the_walk_stops_at_the_first_step_not_yet_met():
    match = _match(k="1", s1="1", s3="1")
    story = _story([_mission(1)],
                   [_step(10, 1, 1, "s1"), _step(11, 1, 2, "s2"), _step(12, 1, 3, "s3")])
    m.evaluate(match, story)
    assert _state(match, 1)["idMissionSteps"] == 10


def test_a_step_with_a_blank_condition_key_blocks_the_walk():
    match = _match(k="1", s2="1")
    story = _story([_mission(1)], [_step(10, 1, 1, ""), _step(11, 1, 2, "s2")])
    m.evaluate(match, story)
    assert _state(match, 1)["stringValue"] == m.STATUS_AVAILABLE


def test_a_terminal_state_is_never_revisited_and_a_status_is_never_lost():
    match = _match(k="1", s1="1")
    story = _story([_mission(1)], [_step(10, 1, 1, "s1")])
    m.evaluate(match, story)
    before = dict(_state(match, 1))

    # The registry moves on; the mission does not move back.
    match["registry"][0]["stringValue"] = "other"
    assert m.evaluate(match, story) == []
    assert _state(match, 1) == before


def test_a_null_or_non_positive_event_id_is_not_a_trigger():
    match = _match(k="1", s1="1")
    story = _story([_mission(1, event=0)], [_step(10, 1, 1, "s1", event=None)])
    assert m.evaluate(match, story) == []


def test_a_story_with_no_missions_does_nothing():
    match = _match(k="1")
    assert m.evaluate(match, _story()) == []
    assert m.evaluate(match, None) == []


# ── end of story ─────────────────────────────────────────────────────────────

def test_what_opened_and_never_closed_fails_and_what_closed_is_left_alone():
    match = _match(k="1", s1="1")
    story = _story([_mission(1), _mission(2, key="k2")],
                   [_step(10, 1, 1, "s1"), _step(11, 1, 2, "s2")])
    match["registry"].append({"id": 90, "key": "k2", "stringValue": "1", "intValue": None})
    m.evaluate(match, story)
    _state(match, 2)["stringValue"] = m.STATUS_COMPLETED

    m.on_story_end(match)

    assert _state(match, 1)["stringValue"] == m.STATUS_FAILED
    assert _state(match, 2)["stringValue"] == m.STATUS_COMPLETED


# ── the payload ──────────────────────────────────────────────────────────────

def test_only_missions_the_match_has_reached_are_listed():
    match = _match(k="1")
    story = _story([_mission(1), _mission(2, key="k2")], [])
    m.evaluate(match, story)

    out = m.list_missions(match, story)
    assert [x["uuid"] for x in out] == ["m-1"]


def test_the_status_filter_is_read_whatever_case_it_is_asked_in():
    match = _match(k="1")
    story = _story([_mission(1)], [])
    m.evaluate(match, story)

    assert len(m.list_missions(match, story, " completed ")) == 1
    assert len(m.list_missions(match, story, "  ")) == 1
    assert m.list_missions(match, story, "ACTIVE") == []


def test_steps_report_done_up_to_the_one_reached_and_all_once_completed():
    match = _match(k="1", s1="1", s2="1")
    story = _story([_mission(1)],
                   [_step(10, 1, 1, "s1"), _step(11, 1, 2, "s2"), _step(12, 1, 3, "s3")])
    m.evaluate(match, story)

    payload = m.list_missions(match, story)[0]
    assert payload["stepsTotal"] == 3
    assert payload["stepReached"] == 2
    assert [s["done"] for s in payload["steps"]] == [True, True, False]


def test_an_untouched_mission_reports_no_step_reached():
    match = _match(k="1")
    story = _story([_mission(1)], [_step(10, 1, 1, "s1"), _step(11, 1, 2, "s2")])
    m.evaluate(match, story)

    payload = m.list_missions(match, story)[0]
    assert payload["stepReached"] is None
    assert not payload["steps"][0]["done"]


def test_names_resolve_off_the_stories_raw_texts_falling_back_to_english():
    match = _match(k="1")
    mission = _mission(1)
    mission["idTextName"] = 900
    mission["idTextDescription"] = 900
    story = _story([mission], [])
    story["raw_texts"] = [{"idText": 900, "lang": "en", "shortText": "Tutorial"}]
    m.evaluate(match, story)

    assert m.list_missions(match, story, None, "it")[0]["name"] == "Tutorial"


def test_find_mission_answers_for_one_reached_and_none_for_anything_else():
    match = _match(k="1")
    story = _story([_mission(1)], [_step(10, 1, 1, "s1")])
    m.evaluate(match, story)

    assert m.find_mission(match, story, "m-1") is not None
    assert m.find_mission(match, story, "nope") is None
    assert m.find_mission(match, story, "  ") is None


def test_a_mission_the_match_has_not_reached_is_not_found_either():
    story = _story([_mission(1)], [])
    assert m.find_mission(_match(), story, "m-1") is None
    assert m.list_missions(_match(), story) == []


# ── isolation from the registry ──────────────────────────────────────────────

def test_a_mission_row_is_never_part_of_the_registry_the_engine_compares():
    match = _match(k="1")
    story = _story([_mission(1)], [])
    m.evaluate(match, story)

    assert m._registry.load_all(match) == {"k": ["1"]}
    assert m._registry.find(match, "mission:m-1") == []
    assert [e["key"] for e in m._registry.list_entries(match, story, include_hidden=True)] == ["k"]


# ── R10 is a report, not a gate ──────────────────────────────────────────────

def test_a_mission_with_no_condition_key_is_reported_only_when_asked_for():
    """The author's own validate pass says the mission is dead; import must not fail on it,
    because the engine IGNORES such a row rather than refusing it."""
    from story import story_validator

    data = {"missions": [{"id": 1}], "missionSteps": [{"id": 1, "idMission": 1}]}

    silent = story_validator.validate_story_dict(data)
    assert not [e for e in silent if e["rule"] == "R10_MISSION_CONDITION"]

    reported = story_validator.validate_story_dict(data, include_mission_conditions=True)
    rules = [(e["entityType"], e["field"]) for e in reported
             if e["rule"] == "R10_MISSION_CONDITION"]
    assert ("missions", "conditionKey") in rules
    assert ("mission-steps", "conditionKey") in rules


def test_a_condition_with_a_key_but_nothing_to_compare_is_reported_too():
    from story import story_validator

    data = {"missions": [{"id": 1, "conditionKey": "k", "conditionValues": " | "}]}

    reported = story_validator.validate_story_dict(data, include_mission_conditions=True)

    assert [e["field"] for e in reported
            if e["rule"] == "R10_MISSION_CONDITION"] == ["conditionValue"]
