"""Step 29 — the check procedure and the effect helpers of the AWS event engine.

The checker is a pure function, so every branch is reachable directly: one test per reason
it can produce, plus the boundaries and the precedence order. Mirrors
EventAvailabilityCheckerTest.java and tests/test_event_availability.py.
"""
import pytest

from match import events


LOC = 100


def event(**over):
    """An event with no condition at all: executable by anyone, anywhere, for free."""
    base = {"id": 1, "uuid": "evt-1", "type": "NORMAL", "costEnery": 0, "coinCost": 0}
    base.update(over)
    return base


def ctx(**over):
    """A healthy actor standing at LOC with 10 energy and 10 coins."""
    base = {
        "idCharacter": 7, "idLocation": LOC, "sleeping": False, "coma": False,
        "energy": 10, "coin": 10, "idClass": 50, "ownedItemIds": set(),
        "currentWeatherId": None, "consumedEventIds": set(), "registry": {},
    }
    base.update(over)
    return base


def blocked(verdict, reason):
    assert verdict == (False, reason)


# ── available ───────────────────────────────────────────────────────────────

def test_plain_normal_event_is_available():
    assert events.check(event(), ctx()) == (True, None)


def test_once_not_yet_consumed():
    assert events.check(event(type="ONCE"), ctx()) == (True, None)


def test_type_is_case_insensitive():
    assert events.check(event(type="once"), ctx()) == (True, None)


def test_null_location_means_no_constraint():
    assert events.check(event(), ctx(idLocation=999)) == (True, None)


def test_cost_exactly_equal_is_enough():
    assert events.check(event(costEnery=10, coinCost=10), ctx()) == (True, None)


def test_all_conditions_satisfied():
    e = event(idSpecificLocation=LOC, registryKeyCondition="GATE",
              registryValueCondition="OPEN", idWeather=3, idItemCondition=42,
              idClassCondition=50)
    c = ctx(registry={"GATE": "OPEN"}, currentWeatherId=3, ownedItemIds={42}, idClass=50)
    assert events.check(e, c) == (True, None)


# ── one test per rejection code ─────────────────────────────────────────────

def test_missing_event():
    blocked(events.check(None, ctx()), "EVENT_NOT_FOUND")


def test_no_context_or_no_character():
    blocked(events.check(event(), None), "CHARACTER_CANNOT_ACT")
    blocked(events.check(event(), {"idCharacter": None}), "CHARACTER_CANNOT_ACT")


@pytest.mark.parametrize("state,expected", [
    ({"sleeping": True}, "SLEEPING"),
    ({"coma": True}, "COMA"),
    # Coma outranks sleep: a comatose character is also flagged asleep, and only one of the
    # two tells the player they need a rescue.
    ({"sleeping": True, "coma": True}, "COMA"),
])
def test_sleeping_and_coma_are_told_apart(state, expected):
    blocked(events.check(event(), ctx(**state)), expected)


@pytest.mark.parametrize("t", ["AUTOMATIC", "FIRST", "END", "END_GAME", None])
def test_only_normal_and_once_are_player_executable(t):
    blocked(events.check(event(type=t), ctx()), "EVENT_NOT_EXECUTABLE_TYPE")


def test_once_already_consumed():
    blocked(events.check(event(type="ONCE"), ctx(consumedEventIds={1})),
            "ONCE_ALREADY_CONSUMED")


def test_a_consumed_normal_event_stays_available():
    # ONCE is what makes an event single-use; NORMAL is repeatable.
    assert events.check(event(), ctx(consumedEventIds={1})) == (True, None)


def test_wrong_location():
    blocked(events.check(event(idSpecificLocation=999), ctx()), "WRONG_LOCATION")


def test_the_legacy_idlocation_alias_is_honoured():
    # Seeded events only carry the alias; admin edits write idSpecificLocation.
    blocked(events.check(event(idLocation=999), ctx()), "WRONG_LOCATION")
    assert events.check(event(idLocation=LOC), ctx()) == (True, None)


def test_idspecificlocation_wins_over_the_stale_alias():
    # The AWS bug this guards: match-info once filtered on idLocation, which is set at
    # import and NOT refreshed when the admin rebinds the event.
    assert events.check(event(idLocation=999, idSpecificLocation=LOC), ctx()) == (True, None)


def test_not_enough_energy_and_coins():
    blocked(events.check(event(costEnery=11), ctx()), "NOT_ENOUGH_ENERGY")
    blocked(events.check(event(coinCost=11), ctx()), "NOT_ENOUGH_COINS")


def test_registry_key_absent_or_different():
    e = event(registryKeyCondition="GATE", registryValueCondition="OPEN")
    blocked(events.check(e, ctx()), "REGISTRY_CONDITION_NOT_MET")
    blocked(events.check(e, ctx(registry={"GATE": "SHUT"})), "REGISTRY_CONDITION_NOT_MET")


def test_registry_key_with_no_expected_value_is_never_met():
    e = event(registryKeyCondition="GATE", registryValueCondition=None)
    blocked(events.check(e, ctx(registry={"GATE": "OPEN"})), "REGISTRY_CONDITION_NOT_MET")


def test_weather_item_and_class_conditions():
    blocked(events.check(event(idWeather=3), ctx()), "WEATHER_CONDITION_NOT_MET")
    blocked(events.check(event(idItemCondition=42), ctx(ownedItemIds={43})),
            "ITEM_CONDITION_NOT_MET")
    blocked(events.check(event(idClassCondition=50), ctx(idClass=51)),
            "CLASS_CONDITION_NOT_MET")


# ── precedence: the first failing check names the reason ────────────────────

def test_actor_state_wins_over_everything():
    e = event(idSpecificLocation=999, costEnery=999, coinCost=999)
    blocked(events.check(e, ctx(sleeping=True)), "SLEEPING")


def test_location_wins_over_cost_and_energy_over_coins():
    blocked(events.check(event(idSpecificLocation=999, costEnery=999), ctx()),
            "WRONG_LOCATION")
    blocked(events.check(event(costEnery=999, coinCost=999), ctx()), "NOT_ENOUGH_ENERGY")


# ── the consumed-ONCE set must ignore merely-referenced events ──────────────

def test_consumed_set_only_counts_executed_rows():
    match = {"eventLog": [
        {"idEvent": 5, "message": "EVENT_EXECUTED 5"},
        # Written by the recovery / weather engine for an event that never ran.
        {"idEvent": 6, "message": "counter reached zero at location 3; pending event 6"},
        {"idEvent": 7, "message": "Weather 2 triggered event 7"},
    ]}
    assert events.consumed_event_ids(match) == {5}


# ── the check context ───────────────────────────────────────────────────────

def test_build_context_resolves_the_class_id_from_the_class_uuid():
    story = {"classes": [{"uuid": "cl-1", "id": 42}]}
    caller = {"id": 1, "uuid": "c1", "classUuid": "cl-1", "energy": 5, "coin": 3,
              "idLocation": LOC, "items": [{"idItem": 9, "amount": 2},
                                           {"idItem": 8, "amount": 0}]}
    match = {"registry": [{"key": "K", "intValue": 3}], "currentWeatherId": 1}

    c = events.build_context(match, story, caller)

    assert c["idClass"] == 42
    assert c["ownedItemIds"] == {9}          # a zero-amount row is not "owned"
    assert c["registry"] == {"K": "3"}       # the int is stringified, like the other backends
    assert c["currentWeatherId"] == 1


def test_build_context_with_no_caller():
    assert events.build_context({}, {}, None)["idCharacter"] is None


# ── effects ─────────────────────────────────────────────────────────────────

def _char(**over):
    base = {"uuid": "c1", "idLocation": LOC, "life": 30, "lifeMax": 100, "energy": 20,
            "energyMax": 100, "sad": 0, "sadMax": 50, "exp": 0, "dexterity": 10,
            "intelligence": 10, "constitution": 10, "food": 5, "magic": 5, "coin": 10}
    base.update(over)
    return base


def test_stats_clamp_at_the_max_and_at_zero():
    c, changes = _char(), []
    events.apply_stat(c, {"statistics": "life", "value": 9999}, changes)
    assert c["life"] == 100 and changes[0]["after"] == 100

    c, changes = _char(), []
    events.apply_stat(c, {"statistics": "energy", "value": -9999}, changes)
    assert c["energy"] == 0


def test_backpack_stats_and_aliases():
    c, changes = _char(), []
    events.apply_stat(c, {"statistics": "coin", "value": 5}, changes)
    events.apply_stat(c, {"statistics": "dex", "value": 2}, changes)
    assert c["coin"] == 15
    assert c["dexterity"] == 12  # dex -> dexterity


def test_an_unknown_statistic_is_ignored():
    c, changes = _char(), []
    assert events.apply_stat(c, {"statistics": "charisma", "value": 5}, changes) is False
    assert changes == []


def test_target_all_reaches_the_actors_location_only():
    actor = _char(uuid="a")
    mate = _char(uuid="b")
    far = _char(uuid="c", idLocation=999)

    hit = events.resolve_recipients({"target": "ALL"}, actor, [actor, mate, far])

    assert [c["uuid"] for c in hit] == ["a", "b"]


def test_only_one_and_target_class():
    actor = _char(uuid="a", classId=1)
    mate = _char(uuid="b", classId=2)
    everyone = [actor, mate]

    assert events.resolve_recipients({"target": "ONLY_ONE"}, actor, everyone) == [actor]
    narrowed = events.resolve_recipients({"target": "ALL", "targetClass": 2}, actor, everyone)
    assert [c["uuid"] for c in narrowed] == ["b"]
    # A class matching nobody is legal and simply applies nothing.
    assert events.resolve_recipients({"target": "ALL", "targetClass": 9}, actor, everyone) == []


def test_items_are_added_and_removed():
    c, changes = _char(), []
    uuids = {42: "item-42"}

    added, removed = events.apply_item(c, {"idItemTarget": 42, "itemAction": "ADD"},
                                       uuids, changes)
    assert added
    # Step 34 — the row carries its OWN uuid: use-item and drop-item name the row.
    assert len(c["items"]) == 1
    assert c["items"][0]["idItem"] == 42
    assert c["items"][0]["amount"] == 1
    assert c["items"][0]["uuid"]
    assert c["items"][0]["state"] == "ACTIVE"
    assert changes[0]["itemUuid"] == "item-42"

    added, removed = events.apply_item(c, {"idItemTarget": 42, "itemAction": "REMOVE"},
                                       uuids, changes)
    assert removed and c["items"] == []

    # Removing what is not carried changes nothing.
    assert events.apply_item(c, {"idItemTarget": 42, "itemAction": "REMOVE"},
                             uuids, changes) == (False, False)
    # An unknown action is ignored.
    assert events.apply_item(c, {"idItemTarget": 42, "itemAction": "EAT"},
                             uuids, changes) == (False, False)


def test_traits_and_characteristics():
    c, changes = _char(), []
    events.apply_traits(c, {"traitsToAdd": "1,brave,", "traitsToRemove": None},
                        {1: "tr-1"}, changes)
    assert c["traitUuids"] == ["tr-1"]  # the non-numeric noise is skipped

    c, changes = _char(), []
    events.apply_characteristics(c, {"characteristicToAdd": "BRAVE,BOLD"}, changes)
    assert c["characteristics"] == ["BRAVE", "BOLD"]
    events.apply_characteristics(c, {"characteristicToRemove": "BRAVE"}, changes)
    assert c["characteristics"] == ["BOLD"]


def test_registry_upsert_reports_the_old_value_and_types_the_new_one():
    match, changes = {}, []
    events.apply_registry(match, "GATE", "OPEN", changes)
    assert changes[0] == {"key": "GATE", "oldValue": None, "newValue": "OPEN"}
    assert match["registry"][0]["stringValue"] == "OPEN"

    events.apply_registry(match, "GATE", "3", changes)
    assert changes[1]["oldValue"] == "OPEN"
    assert match["registry"][0]["intValue"] == 3       # a numeric value lands in intValue
    assert match["registry"][0]["stringValue"] is None  # never both


# ── forced movement (v0.29.3) ───────────────────────────────────────────────

_LOCATION_UUIDS = {LOC: "loc-here", 200: "loc-target"}


def test_forced_movement_moves_the_character_and_logs_at_cost_zero():
    match, changes = {}, []
    c = _char(uuid="a", locationUuid="loc-here")

    moved = events.apply_location(match, c, {"idLocation": 200}, _LOCATION_UUIDS, changes, 123)

    assert moved is True
    assert c["idLocation"] == 200 and c["locationUuid"] == "loc-target"
    assert match["movementLog"] == [{
        "characterUuid": "a", "idLocationFrom": LOC, "idLocationTo": 200,
        "energyCost": 0, "timestampStart": 123,
    }]
    assert changes == [{"characterUuid": "a", "fromLocationUuid": "loc-here",
                        "toLocationUuid": "loc-target"}]


def test_forced_movement_to_an_unknown_location_is_skipped():
    match, changes = {}, []
    c = _char(uuid="a")
    assert events.apply_location(match, c, {"idLocation": 555},
                                 _LOCATION_UUIDS, changes, 123) is False
    assert c["idLocation"] == LOC
    assert "movementLog" not in match and changes == []


def test_forced_movement_to_the_current_location_is_a_no_op():
    match, changes = {}, []
    c = _char(uuid="a")
    assert events.apply_location(match, c, {"idLocation": LOC},
                                 _LOCATION_UUIDS, changes, 123) is False
    assert "movementLog" not in match and changes == []


def test_a_moved_character_resolves_all_at_the_new_location():
    actor = _char(uuid="a")
    far = _char(uuid="c", idLocation=999)
    events.apply_location({}, actor, {"idLocation": 999}, {999: "loc-far"}, [], 123)
    hit = events.resolve_recipients({"target": "ALL"}, actor, [actor, far])
    assert [x["uuid"] for x in hit] == ["a", "c"]


def test_effects_are_grouped_by_event_in_authored_order():
    story = {"eventEffects": [
        {"id": 2, "idEvent": 1}, {"id": 1, "idEvent": 1}, {"id": 3, "idEvent": 2},
    ]}
    grouped = events.effects_by_event(story)
    assert [e["id"] for e in grouped[1]] == [1, 2]
    assert [e["id"] for e in grouped[2]] == [3]
