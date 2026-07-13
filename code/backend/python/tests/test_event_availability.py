"""Step 29 — the check procedure.

Pure function, so every branch is reachable directly: one test per reason it can produce,
plus the boundaries and the precedence order. Mirrors EventAvailabilityCheckerTest.java.
"""
from app.core.models.match.event_models import EventCheckContext, EventError
from app.core.services.match.event_availability import check

CHAR_ID = 7
LOC = 100


def event(**overrides):
    """An event with no condition at all: executable by anyone, anywhere, for free."""
    base = {"id": 1, "type": "NORMAL", "cost_enery": 0, "coin_cost": 0}
    base.update(overrides)
    return base


def ctx(**overrides):
    """A healthy actor standing at LOC with 10 energy and 10 coins."""
    base = dict(id_character=CHAR_ID, id_location=LOC, sleeping=False, coma=False,
                energy=10, coin=10, id_class=50, owned_item_ids=set(),
                current_weather_id=None, consumed_event_ids=set(), registry={})
    base.update(overrides)
    return EventCheckContext(**base)


def assert_blocked(verdict, reason):
    assert verdict.available is False
    assert verdict.reason == reason


# ── available ───────────────────────────────────────────────────────────────

def test_plain_normal_event_is_available():
    v = check(event(), ctx())
    assert v.available is True
    assert v.reason is None


def test_once_not_yet_consumed_is_available():
    assert check(event(type="ONCE"), ctx()).available is True


def test_null_location_means_no_location_constraint():
    assert check(event(id_specific_location=None), ctx(id_location=999)).available is True


def test_type_is_case_insensitive():
    assert check(event(type="once"), ctx()).available is True


def test_cost_exactly_equal_is_enough():
    assert check(event(cost_enery=10, coin_cost=10), ctx()).available is True


def test_every_condition_satisfied():
    e = event(id_specific_location=LOC, registry_key_condition="GATE",
              registry_value_condition="OPEN", id_weather=3, id_item_condition=42,
              id_class_condition=50)
    v = check(e, ctx(registry={"GATE": "OPEN"}, current_weather_id=3,
                     owned_item_ids={42}, id_class=50))
    assert v.available is True, v.reason


# ── one test per rejection code ─────────────────────────────────────────────

def test_missing_event():
    assert_blocked(check(None, ctx()), EventError.EVENT_NOT_FOUND)


def test_no_context():
    assert_blocked(check(event(), None), EventError.CHARACTER_CANNOT_ACT)


def test_no_character():
    assert_blocked(check(event(), EventCheckContext.no_character()),
                   EventError.CHARACTER_CANNOT_ACT)


def test_sleeping_cannot_act():
    assert_blocked(check(event(), ctx(sleeping=True)), EventError.SLEEPING)


def test_coma_cannot_act():
    assert_blocked(check(event(), ctx(coma=True)), EventError.COMA)


def test_coma_outranks_sleep():
    """A comatose character is also flagged asleep — the player must hear the worse news."""
    assert_blocked(check(event(), ctx(sleeping=True, coma=True)), EventError.COMA)


def test_automatic_and_first_are_not_player_executable():
    for t in ("AUTOMATIC", "FIRST", "END", "END_GAME", None):
        assert_blocked(check(event(type=t), ctx()), EventError.EVENT_NOT_EXECUTABLE_TYPE)


def test_once_already_consumed():
    assert_blocked(check(event(type="ONCE"), ctx(consumed_event_ids={1})),
                   EventError.ONCE_ALREADY_CONSUMED)


def test_a_consumed_normal_event_stays_available():
    # ONCE is what makes an event single-use; NORMAL is repeatable.
    assert check(event(), ctx(consumed_event_ids={1})).available is True


def test_wrong_location():
    assert_blocked(check(event(id_specific_location=999), ctx()), EventError.WRONG_LOCATION)


def test_character_with_no_location():
    assert_blocked(check(event(id_specific_location=LOC), ctx(id_location=None)),
                   EventError.WRONG_LOCATION)


def test_not_enough_energy():
    assert_blocked(check(event(cost_enery=11), ctx()), EventError.NOT_ENOUGH_ENERGY)


def test_not_enough_coins():
    assert_blocked(check(event(coin_cost=11), ctx()), EventError.NOT_ENOUGH_COINS)


def test_registry_key_absent():
    e = event(registry_key_condition="GATE", registry_value_condition="OPEN")
    assert_blocked(check(e, ctx()), EventError.REGISTRY_CONDITION_NOT_MET)


def test_registry_value_differs():
    e = event(registry_key_condition="GATE", registry_value_condition="OPEN")
    assert_blocked(check(e, ctx(registry={"GATE": "SHUT"})),
                   EventError.REGISTRY_CONDITION_NOT_MET)


def test_registry_key_with_no_expected_value_is_never_met():
    e = event(registry_key_condition="GATE", registry_value_condition=None)
    assert_blocked(check(e, ctx(registry={"GATE": "OPEN"})),
                   EventError.REGISTRY_CONDITION_NOT_MET)


def test_blank_registry_key_is_no_condition():
    assert check(event(registry_key_condition="   "), ctx()).available is True


def test_weather_differs():
    assert_blocked(check(event(id_weather=3), ctx(current_weather_id=4)),
                   EventError.WEATHER_CONDITION_NOT_MET)


def test_weather_unset():
    assert_blocked(check(event(id_weather=3), ctx()), EventError.WEATHER_CONDITION_NOT_MET)


def test_item_not_carried():
    assert_blocked(check(event(id_item_condition=42), ctx(owned_item_ids={43})),
                   EventError.ITEM_CONDITION_NOT_MET)


def test_class_differs():
    assert_blocked(check(event(id_class_condition=50), ctx(id_class=51)),
                   EventError.CLASS_CONDITION_NOT_MET)


def test_class_unset():
    assert_blocked(check(event(id_class_condition=50), ctx(id_class=None)),
                   EventError.CLASS_CONDITION_NOT_MET)


# ── precedence: the first failing check names the reason ────────────────────

def test_actor_state_wins_over_everything():
    e = event(id_specific_location=999, cost_enery=999, coin_cost=999)
    assert_blocked(check(e, ctx(sleeping=True)), EventError.SLEEPING)


def test_once_consumed_wins_over_location_and_cost():
    e = event(type="ONCE", id_specific_location=999, cost_enery=999)
    assert_blocked(check(e, ctx(consumed_event_ids={1})), EventError.ONCE_ALREADY_CONSUMED)


def test_location_wins_over_cost():
    assert_blocked(check(event(id_specific_location=999, cost_enery=999), ctx()),
                   EventError.WRONG_LOCATION)


def test_energy_wins_over_coins():
    assert_blocked(check(event(cost_enery=999, coin_cost=999), ctx()),
                   EventError.NOT_ENOUGH_ENERGY)


def test_registry_wins_over_weather_item_and_class():
    e = event(registry_key_condition="GATE", registry_value_condition="OPEN",
              id_weather=3, id_item_condition=42, id_class_condition=51)
    assert_blocked(check(e, ctx()), EventError.REGISTRY_CONDITION_NOT_MET)
