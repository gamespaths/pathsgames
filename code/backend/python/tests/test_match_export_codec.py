"""v0.41.4 Step 41 H.2.3 — python rows ↔ neutral sections (python log columns), the reconciliation (H.2.4)."""
from app.core.services.match import neutral_codec as nc

C1 = "c4c4c4c4-0000-4000-8000-000000000001"
LOOKUP = nc.Lookup({42: "u-42"}, {1: C1}, {"tpl-1": 1}, {"cl-1": 1}, {"tr-1": 1, "tr-2": 2})


def _character_row(**over):
    row = {"id": 1, "uuid": C1, "id_user": 42, "id_character_template": 1, "id_class": 0, "dexterity": 3,
           "life": 9, "energy": 18, "sad": 1, "life_max": 10, "id_location": 2, "is_sleeping": 1, "is_coma": 0,
           "timestamp_last_pass": "2026-10-01 09:00:00", "characteristics": "brave, bold"}
    row.update(over)
    return row


def test_character_round_trip():
    c = nc.character(_character_row(), LOOKUP, {"food": 1, "magic": 0, "coin": 2}, [{"id_traits": 1, "id_event": 13}],
                     [{"id_item": 5, "amount": 1, "state": "OK"}])
    assert c["isSleeping"] is True and c["isComa"] is False and c["classId"] is None
    assert c["userUuid"] == "u-42" and c["timestampLastPass"] == "2026-10-01T09:00:00.000Z"
    assert c["characteristics"] == ["brave", "bold"]
    assert c["resources"] == {"food": 1, "magic": 0, "coin": 2}
    row = nc.character_row(c, "now")
    assert row["is_sleeping"] == 1 and row["is_coma"] == 0 and row["id"] == 1
    assert row["characteristics"] == "brave,bold" and row["weight_max"] == 0 and row["intelligence"] == 1
    assert nc.character_row({"ordinal": 1}, "now")["characteristics"] is None
    assert "resources" not in nc.character(_character_row(), LOOKUP, None, [], [])


def test_match_round_trip():
    m = {"uuid": "m-1", "id_difficulty": 1, "rng_seed": None, "single_player": 0, "character_template_uuid": "tpl-1",
         "class_uuid": "cl-1", "trait_uuids": "tr-1,missing,tr-2", "id_user_creator": 42, "current_clock": 3,
         "status": "RUNNING", "id_current_weather": 1, "id_character_current_turn": 1,
         "ts_insert": "2026-10-01T08:59:00.123456+00:00", "timestamp_end": "not a date"}
    n = nc.match(m, LOOKUP, 2, 9)
    assert n["rngSeed"] == 9 and n["singlePlayer"] is False and n["loadout"]["traitIds"] == [1, 2]
    assert n["activeCharacterUuid"] == C1 and n["createdAt"] == "2026-10-01T08:59:00.123Z"
    assert n["timestampEnd"] == "not a date"
    assert nc.match({"uuid": "m"}, LOOKUP, None, 9)["singlePlayer"] is None
    row = nc.match_row(n, 5, {C1: 1}, {1: "tpl-T"}, {1: "cl-T"}, {1: "tr-T", 2: "tr-T2"}, "now")
    assert row["status"] == "PAUSED" and row["single_player"] == 0 and row["trait_uuids"] == "tr-T,tr-T2"
    assert row["character_template_uuid"] == "tpl-T" and row["id_character_current_turn"] == 1
    defaults = nc.match_row({"uuid": "x"}, 1, {}, {}, {}, {}, "now")
    assert defaults["single_player"] == 1 and defaults["ts_insert"] == "now" and defaults["exp_cost"] == 5


def test_state_sections_round_trip():
    r = nc.registry({"key": "quest", "string_value": "done", "id_character": 1, "id_event": 14, "multi_value": 1,
                     "clock": 2, "id_mission_steps": 3}, LOOKUP)
    assert r["characterUuid"] == C1 and r["multiValue"] is True
    back = nc.registry_row(r, {C1: 1}, "now")
    assert back["multi_value"] == 1 and back["id_mission_steps"] == 3
    assert nc.registry_row({"key": "k"}, {}, "now")["multi_value"] is None
    assert nc.registry({"key": "k"}, LOOKUP)["multiValue"] is None
    loc = {"id_location": 2, "flag_already_actived": True, "flag_visited": "1", "clock_counter": 3}
    assert nc.is_non_default_location(loc, 1) and nc.is_non_default_location({"id_location": 1}, 1)
    assert not nc.is_non_default_location({"id_location": 3, "flag_visited": "no"}, 1)
    neutral = nc.location(loc)
    assert neutral["flagVisited"] is True
    assert nc.location_row(2, neutral, "now")["flag_already_actived"] == 1
    assert nc.location_row(9, None, "now")["flag_visited"] == 0
    t = nc.turn({"id_character_match": 1, "clock": 3, "priority": 2}, LOOKUP)
    assert t["status"] == "WAITING" and nc.turn_row(t, 1, "now")["id_character_match"] == 1
    p = nc.progress({"clock": 2, "id_event": 14, "id_choise": 7})
    assert nc.progress_row(p, "now")["id_choise"] == 7
    h = nc.choice_row({"clock": 2, "id_event": 14, "id_choise": 7, "log_message": "m", "ts_insert": "2026-10-01T09:00:00Z"})
    assert nc.choice_executed_row(h, "now")["ts_insert"] == "2026-10-01T09:00:00.000Z"
    assert nc.choice_executed_row({}, "now")["ts_insert"] == "now"
    assert nc.resources_row({"ordinal": 2, "resources": {"coin": 4}}, "now")["coin"] == 4
    assert nc.item_row({"itemId": 5}, 2, "now")["amount"] == 1
    assert nc.trait_row({"traitId": 1, "eventId": 13}, 2, "now")["id_event"] == 13


def test_users_never_carry_secrets():
    u = nc.user({"uuid": "u", "username": "g", "state": 6, "role": "PLAYER", "guest_cookie_token": "t"})
    assert u["guest"] is True and "guest_cookie_token" not in u and u["emailAddress"] is None
    assert nc.user({"uuid": "u"})["guest"] is False


def test_logs_are_sorted_numbered_and_mapped_back():
    tables = {
        "log_events": [
            {"id": 3, "log_message": "EVENT_EXECUTED 13", "id_event": 13, "id_character_match": 1,
             "timestamp": "2026-10-01T09:06:00Z", "energy_cost": 1, "coin_gain": 2, "clock": 1},
            {"id": 4, "log_message": "ADMIN_PAUSE", "timestamp": "2026-10-01T09:07:00Z"},
            {"id": 5, "log_message": None},
            {"id": 6, "log_message": "COMA c", "timestamp": "2026-10-01T09:08:00Z"}],
        "log_movements": [{"id": 1, "id_character_match": 1, "id_location_from": 1, "id_location_to": 2,
                           "energy_cost": 2, "timestamp_start": "2026-10-01T09:05:00Z"}],
        "log_item_usage": [{"id": 1, "id_character_match": 1, "id_item": 5, "action": "add", "food": 1, "energy": -1,
                            "timestamp": "2026-10-01T09:21:00Z", "effects_json": "[]"},
                           {"id": 2, "action": "TRADE"}],
        "log_weather": [{"id": 1, "clock": 1, "id_weather": 1, "timestamp_start": "2026-10-01T09:00:00Z"}],
        "log_clock_history": [{"id": 1, "clock": 2, "ts_insert": "2026-10-01T09:25:00Z"}],
    }
    logs = nc.logs(tables, LOOKUP)
    assert [e["type"] for e in logs] == ["WEATHER", "MOVEMENT", "EVENT", "ADMIN_ACTION", "EDGE_STATE", "ITEM_ADD",
                                         "CLOCK_ADVANCE"]
    assert logs[0]["seq"] == 1 and logs[3]["message"] == "PAUSE" and logs[4]["message"] == "COMA"
    assert logs[5]["itemAction"] == "ADD" and logs[5]["cost"]["energy"] == 1 and logs[5]["gain"]["food"] == 1
    ordinals = {C1: 1}
    assert nc.log_row(logs[0], ordinals, "fb")[0] == "log_weather"
    table, columns = nc.log_row(logs[1], ordinals, "fb")
    assert table == "log_movements" and columns["energy_cost"] == 2 and columns["timestamp_start"]
    table, columns = nc.log_row(logs[2], ordinals, "fb")
    assert columns["log_message"] == "EVENT_EXECUTED 13" and columns["coin_gain"] == 2 and columns["energy_cost"] == 1
    assert nc.log_row(logs[3], ordinals, "fb")[1]["log_message"] == "ADMIN_PAUSE"
    table, columns = nc.log_row(logs[5], ordinals, "fb")
    assert table == "log_item_usage" and columns["energy"] == -1 and columns["food"] == 1
    assert nc.log_row(logs[6], ordinals, "fb")[0] == "log_clock_history"
    table, columns = nc.log_row({"type": "ITEM_USE", "message": "m"}, ordinals, "fb")
    assert table == "log_events" and columns["log_message"] == "ITEM_USE m" and columns["timestamp"] == "fb"
    assert nc.log_row({"type": "ITEM_USE"}, ordinals, "fb")[1]["log_message"] == "ITEM_USE"
    assert nc.log_row({"type": "ITEM_USE", "itemId": 5, "characterUuid": C1}, ordinals, "fb")[1]["action"] == "USE"
    assert nc.log_row({"type": "MOVEMENT"}, ordinals, "fb")[0] == "log_events"


def test_reconciliation_and_visited():
    logs = [{"type": "EVENT", "eventId": 13}, {"type": "EVENT", "eventId": 13}, {"type": "CHOICE", "eventId": 13},
            {"type": "EVENT"}, {"type": "MOVEMENT", "locationFromId": 1, "locationToId": 3}]
    r = nc.reconcile(logs, [{"eventId": 13, "executed": 1, "selected": 0},
                            {"eventId": 20, "executed": 1, "selected": 1}, {"noEvent": 1}])
    assert r.changed() and r.uncounted == {1, 2}
    assert r.missing == [(20, True, 1), (20, False, 1)]
    assert not nc.reconcile([], []).changed()
    assert nc.imported_visited([{"locationId": 2}, {}], logs) == [2, 1, 3]


def test_value_helpers():
    assert nc.ts(None) is None and nc.ts(" ") is None
    assert nc.ts("2026-10-01T12:00:00+02:00") == "2026-10-01T10:00:00.000Z"
    assert nc.epoch_millis("2026-09-24T10:00:00Z") == 1790244000000
    assert nc.epoch_millis("junk") is None and nc.epoch_millis(None) is None
    assert nc.lng(True) == 1 and nc.lng(False) == 0 and nc.lng("x") is None and nc.lng([]) is None
    assert nc.lng(2.0) == 2 and nc.lng(" 7 ") == 7
    assert nc.boolean("t") and not nc.boolean(None) and nc.boolean(2)
    assert nc.items("x") == [] and nc.mapping("x") == {} and nc.join_csv([]) is None
