"""THE check procedure of the movement system.

One pure function, no ports, no I/O — and therefore exactly one answer to "can this
character take this edge?", shared by the two places that ask:

  * ``MatchQueryService``, for the ``available``/``reason`` pair it puts on every neighbor
    of ``GET /api/match/{uuid}/info``;
  * ``MovementService``, to accept or reject ``action/move``.

Same shape as ``event_availability`` (Step 29): a pure function over a pre-loaded context, so
match-info judges N neighbors without a query per neighbor, and the board can grey out a path
with its cause instead of letting the player discover it by being rejected.

The order below is the contract: the first failing check names the reason, and the most
explanatory reasons come first (a comatose character is told they need a rescue, not that they
are short on energy). It reproduces the validation order of ``MovementService``.
``MATCH_NOT_FOUND`` and ``NOT_A_NEIGHBOR`` are not decided here: they are about *finding* the
match/edge, not about judging one the caller already holds.

Mirrors ``MovementAvailabilityChecker.java``.
"""
from dataclasses import dataclass
from typing import Optional

from app.core.models.match.movement_models import MovementAvailability, MovementError


@dataclass(frozen=True)
class MoveCheckContext:
    """Everything about the mover that does not change from one edge to the next: loaded once
    per match. ``has_character`` is False when the caller owns no character in the match, in
    which case no move is ever possible."""

    match_running: bool
    has_character: bool
    coma: bool
    sleeping: bool
    energy: int
    carried_weight: int
    weight_max: int

    @staticmethod
    def no_character() -> "MoveCheckContext":
        """The context of a caller with no character: nothing is ever traversable."""
        return MoveCheckContext(False, False, False, False, 0, 0, 0)


@dataclass(frozen=True)
class MoveEdgeCheck:
    """The per-edge facts: whether the link's registry condition holds, what the move costs in
    this weather (edge + entry + weather modifier) and how full the destination is.
    ``max_characters <= 0`` means the destination has no capacity limit."""

    condition_met: bool
    total_energy_cost: int
    max_characters: int
    characters_at_target: int


def check(ctx: Optional[MoveCheckContext],
          edge: Optional[MoveEdgeCheck]) -> MovementAvailability:
    """The single verdict."""
    if ctx is None or not ctx.has_character:
        return MovementAvailability.no(MovementError.CHARACTER_CANNOT_ACT)
    if not ctx.match_running:
        return MovementAvailability.no(MovementError.MATCH_NOT_RUNNING)
    # Coma outranks sleep: a comatose character is also flagged asleep, and the two are not
    # the same news for the player — one waits, the other needs a rescue.
    if ctx.coma:
        return MovementAvailability.no(MovementError.COMA)
    if ctx.sleeping:
        return MovementAvailability.no(MovementError.SLEEPING)

    if edge is None:
        return MovementAvailability.no(MovementError.NOT_A_NEIGHBOR)
    if not edge.condition_met:
        return MovementAvailability.no(MovementError.MOVEMENT_CONDITION_NOT_MET)
    if ctx.carried_weight > ctx.weight_max:
        return MovementAvailability.no(MovementError.OVERWEIGHT)
    if ctx.energy < edge.total_energy_cost:
        return MovementAvailability.no(MovementError.INSUFFICIENT_ENERGY)
    if edge.max_characters > 0 and edge.characters_at_target >= edge.max_characters:
        return MovementAvailability.no(MovementError.LOCATION_FULL)

    return MovementAvailability.ok()
