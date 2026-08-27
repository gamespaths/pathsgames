"""THE check procedure of the movement system for the AWS backend.

Mirrors ``MovementAvailabilityChecker.java`` (and ``movement_availability.py`` on the Python
backend), and is the twin of ``events.check`` for movement: a pure function over a pre-loaded
context, so match-info judges N neighbors against ONE context — the very same verdict
``action/move`` enforces. A path the board offers can therefore never be refused, and a
blocked one already knows why.

The order below is the contract: the first failing check names the reason, and the most
explanatory reasons come first (a comatose character is told they need a rescue, not that they
are short on energy). ``MATCH_NOT_FOUND`` and ``NOT_A_NEIGHBOR`` are not decided here: they
are about *finding* the match/edge, not about judging one the caller already holds.
"""

from match import inventory as _inventory


def _nz(v):
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        return 0


def move_check_context(match, caller, story=None):
    """The mover's edge-independent state — loaded once, then reused for every neighbor.

    ``caller`` is None when the user owns no character in the match, in which case no move is
    ever possible. ``story`` carries the item weights (step 35); without it the carried
    weight is 0 and the OVERWEIGHT gate cannot fire.
    """
    if not caller:
        return {"hasCharacter": False}
    return {
        "hasCharacter": True,
        "matchRunning": (match or {}).get("status") == "RUNNING",
        "coma": _nz(caller.get("isComa")) == 1,
        "sleeping": _nz(caller.get("isSleeping")) == 1,
        "energy": _nz(caller.get("energy")),
        # Step 35 — the real Sigma (item.weight x amount), the same formula /info reports.
        "carriedWeight": _inventory.carried_weight(caller, story or {}),
        "weightMax": _nz(caller.get("weightMax")),
        # v0.35.3 — the backpack, for the edge resource costs.
        "food": _nz(caller.get("food")),
        "magic": _nz(caller.get("magic")),
        "coin": _nz(caller.get("coin")),
    }


def edge_check(condition_met, total_energy_cost, max_characters, characters_at_target,
               cost_food=0, cost_magic=0, cost_coin=0):
    """The per-edge facts. ``max_characters <= 0`` means no capacity limit.

    v0.35.3 — the three resource costs come from the EDGE alone: unlike energy, which sums
    the edge, the destination entry cost and the weather modifier, they have one source.
    """
    return {
        "conditionMet": bool(condition_met),
        "totalEnergyCost": _nz(total_energy_cost),
        "maxCharacters": _nz(max_characters),
        "charactersAtTarget": _nz(characters_at_target),
        "costFood": _nz(cost_food),
        "costMagic": _nz(cost_magic),
        "costCoin": _nz(cost_coin),
    }


def check(ctx, edge):
    """The single verdict: ``(available, reason)``. ``reason`` is None when available."""
    if not ctx or not ctx.get("hasCharacter"):
        return False, "CHARACTER_CANNOT_ACT"
    if not ctx.get("matchRunning"):
        return False, "MATCH_NOT_RUNNING"
    # Coma outranks sleep: a comatose character is also flagged asleep, and the two are not the
    # same news for the player — one waits, the other needs a rescue.
    if ctx.get("coma"):
        return False, "COMA"
    if ctx.get("sleeping"):
        return False, "SLEEPING"

    if not edge:
        return False, "NOT_A_NEIGHBOR"
    if not edge.get("conditionMet"):
        return False, "MOVEMENT_CONDITION_NOT_MET"
    if _nz(ctx.get("carriedWeight")) > _nz(ctx.get("weightMax")):
        return False, "OVERWEIGHT"
    if _nz(ctx.get("energy")) < _nz(edge.get("totalEnergyCost")):
        return False, "INSUFFICIENT_ENERGY"
    # v0.35.3 — after energy and before capacity: a mover who cannot afford the road is told
    # about the road, not about how crowded the place they cannot reach is.
    if _nz(ctx.get("coin")) < _nz(edge.get("costCoin")):
        return False, "NOT_ENOUGH_COINS"
    if _nz(ctx.get("food")) < _nz(edge.get("costFood")):
        return False, "NOT_ENOUGH_FOOD"
    if _nz(ctx.get("magic")) < _nz(edge.get("costMagic")):
        return False, "NOT_ENOUGH_MAGIC"
    max_chars = _nz(edge.get("maxCharacters"))
    if max_chars > 0 and _nz(edge.get("charactersAtTarget")) >= max_chars:
        return False, "LOCATION_FULL"

    return True, None
