"""The one move verdict, shared by /info (which reports it) and action/move (which enforces
it). The tests pin the ORDER of the reasons as much as the reasons themselves: the order is
the contract — a comatose, exhausted character must be told about the coma.

Mirrors ``MovementAvailabilityCheckerTest.java``.
"""
from app.core.models.match.movement_models import MovementError
from app.core.services.match import movement_availability
from app.core.services.match.movement_availability import MoveCheckContext, MoveEdgeCheck


def ctx(match_running=True, has_character=True, coma=False, sleeping=False,
        energy=100, carried_weight=0, weight_max=50,
        food=10, magic=10, coin=10) -> MoveCheckContext:
    return MoveCheckContext(match_running, has_character, coma, sleeping,
                            energy, carried_weight, weight_max, food, magic, coin)


def edge(condition_met=True, total=10, max_characters=0, at_target=0,
         cost_food=0, cost_magic=0, cost_coin=0) -> MoveEdgeCheck:
    return MoveEdgeCheck(condition_met, total, max_characters, at_target,
                         cost_food, cost_magic, cost_coin)


def test_not_enough_coins_for_the_edge():
    """v0.35.3 — the edge has a toll and the mover cannot pay it."""
    verdict = movement_availability.check(ctx(coin=1), edge(cost_coin=2))
    assert verdict.reason == MovementError.NOT_ENOUGH_COINS


def test_not_enough_food_for_the_edge():
    verdict = movement_availability.check(ctx(food=1), edge(cost_food=2))
    assert verdict.reason == MovementError.NOT_ENOUGH_FOOD


def test_not_enough_magic_for_the_edge():
    verdict = movement_availability.check(ctx(magic=1), edge(cost_magic=2))
    assert verdict.reason == MovementError.NOT_ENOUGH_MAGIC


def test_an_edge_costing_exactly_what_is_held_is_traversable():
    verdict = movement_availability.check(ctx(food=2, magic=3, coin=4),
                                          edge(cost_food=2, cost_magic=3, cost_coin=4))
    assert verdict.available


def test_energy_is_judged_before_the_resources_capacity_after_them():
    broke = ctx(energy=1, food=0, magic=0, coin=0)
    full = edge(total=10, max_characters=1, at_target=5,
                cost_food=1, cost_magic=1, cost_coin=1)
    assert movement_availability.check(broke, full).reason == MovementError.INSUFFICIENT_ENERGY

    # The destination is full too, but a mover who cannot pay the road hears about the road.
    rested = ctx(energy=100, food=0, magic=0, coin=0)
    assert movement_availability.check(rested, full).reason == MovementError.NOT_ENOUGH_COINS


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
