"""The one move verdict, shared by /info (which reports it) and action/move (which enforces
it). The tests pin the ORDER of the reasons as much as the reasons themselves: the order is
the contract — a comatose, exhausted character must be told about the coma.

Mirrors ``MovementAvailabilityCheckerTest.java``.
"""
from app.core.models.match.movement_models import MovementError
from app.core.services.match import movement_availability
from app.core.services.match.movement_availability import MoveCheckContext, MoveEdgeCheck


def ctx(match_running=True, has_character=True, coma=False, sleeping=False,
        energy=100, carried_weight=0, weight_max=50) -> MoveCheckContext:
    return MoveCheckContext(match_running, has_character, coma, sleeping,
                            energy, carried_weight, weight_max)


def edge(condition_met=True, total=10, max_characters=0, at_target=0) -> MoveEdgeCheck:
    return MoveEdgeCheck(condition_met, total, max_characters, at_target)


def test_available_has_no_reason():
    verdict = movement_availability.check(ctx(), edge())
    assert verdict.available
    assert verdict.reason is None


def test_no_character_cannot_act():
    assert movement_availability.check(
        MoveCheckContext.no_character(), edge()).reason == MovementError.CHARACTER_CANNOT_ACT


def test_none_context_never_yields_a_silent_yes():
    verdict = movement_availability.check(None, edge())
    assert not verdict.available
    assert verdict.reason == MovementError.CHARACTER_CANNOT_ACT


def test_match_not_running():
    assert movement_availability.check(
        ctx(match_running=False), edge()).reason == MovementError.MATCH_NOT_RUNNING


def test_coma():
    assert movement_availability.check(ctx(coma=True), edge()).reason == MovementError.COMA


def test_sleeping():
    assert movement_availability.check(
        ctx(sleeping=True), edge()).reason == MovementError.SLEEPING


def test_coma_outranks_sleep():
    # a coma needs a rescue, sleep only needs time: they are not the same news
    assert movement_availability.check(
        ctx(coma=True, sleeping=True), edge()).reason == MovementError.COMA


def test_mover_state_outranks_the_edge_cost():
    assert movement_availability.check(
        ctx(coma=True, energy=0), edge()).reason == MovementError.COMA


def test_no_edge_means_not_a_neighbor():
    # the caller resolves the edge; the checker only says "the mover is fine, give me one"
    assert movement_availability.check(ctx(), None).reason == MovementError.NOT_A_NEIGHBOR


def test_condition_not_met():
    assert movement_availability.check(
        ctx(), edge(condition_met=False)).reason == MovementError.MOVEMENT_CONDITION_NOT_MET


def test_overweight():
    assert movement_availability.check(
        ctx(carried_weight=51, weight_max=50), edge()).reason == MovementError.OVERWEIGHT


def test_insufficient_energy():
    assert movement_availability.check(
        ctx(energy=9), edge(total=10)).reason == MovementError.INSUFFICIENT_ENERGY


def test_exactly_enough_energy_is_allowed():
    assert movement_availability.check(ctx(energy=10), edge(total=10)).available


def test_location_full():
    assert movement_availability.check(
        ctx(), edge(max_characters=2, at_target=2)).reason == MovementError.LOCATION_FULL


def test_no_capacity_limit_however_crowded():
    assert movement_availability.check(ctx(), edge(max_characters=0, at_target=99)).available
