"""The check procedure of the AWS movement system.

The checker is a pure function, so every branch is reachable directly: one test per reason it
can produce, plus the boundaries and the precedence order — the order IS the contract, since a
comatose, exhausted character must be told about the coma. Mirrors
MovementAvailabilityCheckerTest.java and tests/test_movement_availability.py (python).
"""
from match import movements


def ctx(**over):
    """An awake, unburdened mover with 100 energy, in a RUNNING match."""
    base = {
        "hasCharacter": True, "matchRunning": True, "coma": False, "sleeping": False,
        "energy": 100, "carriedWeight": 0, "weightMax": 50,
    }
    base.update(over)
    return base


def edge(**over):
    """A free, empty, condition-less edge that costs 10."""
    base = {"conditionMet": True, "totalEnergyCost": 10,
            "maxCharacters": 0, "charactersAtTarget": 0}
    base.update(over)
    return base


def test_available_has_no_reason():
    assert movements.check(ctx(), edge()) == (True, None)


def test_no_character_cannot_act():
    assert movements.check({"hasCharacter": False}, edge()) == (False, "CHARACTER_CANNOT_ACT")


def test_empty_context_never_yields_a_silent_yes():
    assert movements.check(None, edge()) == (False, "CHARACTER_CANNOT_ACT")


def test_match_not_running():
    assert movements.check(ctx(matchRunning=False), edge())[1] == "MATCH_NOT_RUNNING"


def test_coma():
    assert movements.check(ctx(coma=True), edge())[1] == "COMA"


def test_sleeping():
    assert movements.check(ctx(sleeping=True), edge())[1] == "SLEEPING"


def test_coma_outranks_sleep():
    # a coma needs a rescue, sleep only needs time: they are not the same news
    assert movements.check(ctx(coma=True, sleeping=True), edge())[1] == "COMA"


def test_mover_state_outranks_the_edge_cost():
    assert movements.check(ctx(coma=True, energy=0), edge())[1] == "COMA"


def test_no_edge_means_not_a_neighbor():
    # the caller resolves the edge; the checker only says "the mover is fine, give me one"
    assert movements.check(ctx(), None)[1] == "NOT_A_NEIGHBOR"


def test_condition_not_met():
    assert movements.check(
        ctx(), edge(conditionMet=False))[1] == "MOVEMENT_CONDITION_NOT_MET"


def test_overweight():
    assert movements.check(ctx(carriedWeight=51, weightMax=50), edge())[1] == "OVERWEIGHT"


def test_insufficient_energy():
    assert movements.check(ctx(energy=9), edge(totalEnergyCost=10))[1] == "INSUFFICIENT_ENERGY"


def test_exactly_enough_energy_is_allowed():
    assert movements.check(ctx(energy=10), edge(totalEnergyCost=10)) == (True, None)


def test_location_full():
    assert movements.check(
        ctx(), edge(maxCharacters=2, charactersAtTarget=2))[1] == "LOCATION_FULL"


def test_no_capacity_limit_however_crowded():
    assert movements.check(ctx(), edge(maxCharacters=0, charactersAtTarget=99)) == (True, None)


def test_move_check_context_reads_the_character_flags():
    character = {"isComa": 1, "isSleeping": 1, "energy": 42, "weightMax": 30}
    built = movements.move_check_context({"status": "RUNNING"}, character)
    assert built["hasCharacter"] and built["matchRunning"]
    assert built["coma"] and built["sleeping"]
    assert built["energy"] == 42
    assert built["weightMax"] == 30


def test_move_check_context_without_a_character():
    assert movements.move_check_context({"status": "RUNNING"}, None) == {"hasCharacter": False}
