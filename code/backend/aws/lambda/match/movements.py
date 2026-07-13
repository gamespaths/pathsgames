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


def _nz(v):
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        return 0


def move_check_context(match, caller):
    """The mover's edge-independent state — loaded once, then reused for every neighbor.

    ``caller`` is None when the user owns no character in the match, in which case no move is
    ever possible.
    """
    if not caller:
        return {"hasCharacter": False}
    return {
        "hasCharacter": True,
        "matchRunning": (match or {}).get("status") == "RUNNING",
        "coma": _nz(caller.get("isComa")) == 1,
        "sleeping": _nz(caller.get("isSleeping")) == 1,
        "energy": _nz(caller.get("energy")),
        # Step 34 owns the full weight formula; carried weight is 0 until inventory exists.
        "carriedWeight": 0,
        "weightMax": _nz(caller.get("weightMax")),
    }


def edge_check(condition_met, total_energy_cost, max_characters, characters_at_target):
    """The per-edge facts. ``max_characters <= 0`` means no capacity limit."""
    return {
        "conditionMet": bool(condition_met),
        "totalEnergyCost": _nz(total_energy_cost),
        "maxCharacters": _nz(max_characters),
        "charactersAtTarget": _nz(characters_at_target),
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
    max_chars = _nz(edge.get("maxCharacters"))
    if max_chars > 0 and _nz(edge.get("charactersAtTarget")) >= max_chars:
        return False, "LOCATION_FULL"

    return True, None
