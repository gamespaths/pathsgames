"""Step 31 — the per-option verdict of the choice engine. Mirrors ``ChoiceAvailabilityChecker.java``.

One pure function, no ports, no I/O — the twin of :mod:`event_availability`, answering
"can this choice be selected?" for every option a choice-event presents. Non-available
options are still returned to the player (shown disabled), so the verdict is a property
of the option, never a reason to drop it.

Evaluation contract, in order:

1. ``otherwise_flag = 1`` wins outright (INV-29): the fallback option is always
   selectable, its limits and conditions are not even read.
2. The inline limits combine in AND, before the condition rows: ``limit_dex``,
   ``limit_int`` and ``limit_cos`` are minimum requirements (stat >= limit) while
   ``limit_sad`` is a maximum (sad <= limit). A null limit is no constraint.
3. The condition rows combine under the choice's ``logic_operator`` (INV-31: all-AND or
   all-OR, never mixed). Under AND the first failing row names the reason; under OR one
   passing row is enough and the aggregate CONDITIONS_NOT_MET is reported when none
   passes. No rows at all means available — a bare choice must be selectable.

An unknown condition type, an unparseable value or a blank key make that condition NOT
met: a typo locks the option visibly rather than silently unlocking it (the
``registry_met`` doctrine — deliberately the opposite of the effect engine, where
authored noise is skipped, because skipping here would GRANT something).
"""
from typing import Any, Dict, List, Optional

from app.core.models.match.event_models import ChoiceAvailability, ChoiceCheckContext
from app.core.services.match import registry_service

# ── reason vocabulary (per-option, returned on the response) ────────────────
LIMIT_SAD_EXCEEDED = "LIMIT_SAD_EXCEEDED"
LIMIT_DEX_NOT_MET = "LIMIT_DEX_NOT_MET"
LIMIT_INT_NOT_MET = "LIMIT_INT_NOT_MET"
LIMIT_COS_NOT_MET = "LIMIT_COS_NOT_MET"
CONDITION_KEYS_NOT_MET = "CONDITION_KEYS_NOT_MET"
CONDITION_ITEM_NOT_MET = "CONDITION_ITEM_NOT_MET"
CONDITION_CLASS_NOT_MET = "CONDITION_CLASS_NOT_MET"
CONDITION_LOCATION_NOT_MET = "CONDITION_LOCATION_NOT_MET"
CONDITION_ALL_IN_SAME_LOC_NOT_MET = "CONDITION_ALL_IN_SAME_LOC_NOT_MET"
CONDITION_TRAITS_NOT_MET = "CONDITION_TRAITS_NOT_MET"
CONDITION_STATISTICS_NOT_MET = "CONDITION_STATISTICS_NOT_MET"
CONDITION_STATISTICS_SUM_NOT_MET = "CONDITION_STATISTICS_SUM_NOT_MET"
# OR aggregate (no single row is "the" culprit) and unknown-type fallback.
CONDITIONS_NOT_MET = "CONDITIONS_NOT_MET"

_REASON_BY_TYPE = {
    "KEYS": CONDITION_KEYS_NOT_MET,
    "ITEM": CONDITION_ITEM_NOT_MET,
    "CLASS": CONDITION_CLASS_NOT_MET,
    "LOCATION": CONDITION_LOCATION_NOT_MET,
    "ALL_IN_SAME_LOC": CONDITION_ALL_IN_SAME_LOC_NOT_MET,
    "TRAITS": CONDITION_TRAITS_NOT_MET,
    "STATISTICS": CONDITION_STATISTICS_NOT_MET,
    "STATISTICS_SUM": CONDITION_STATISTICS_SUM_NOT_MET,
}


def check(choice: Optional[Dict[str, Any]], conditions: Optional[List[Dict[str, Any]]],
          ctx: Optional[ChoiceCheckContext]) -> ChoiceAvailability:
    """The single verdict. Null inputs can never be selectable."""
    if choice is None or ctx is None:
        return ChoiceAvailability.no(CONDITIONS_NOT_MET)
    if (choice.get("otherwise_flag") or 0) == 1:
        return ChoiceAvailability.ok()
    limit_reason = _failed_limit(choice, ctx)
    if limit_reason:
        return ChoiceAvailability.no(limit_reason)
    rows = conditions or []
    if not rows:
        return ChoiceAvailability.ok()
    if (choice.get("logic_operator") or "").strip().upper() == "OR":
        for row in rows:
            if _condition_met(row, ctx):
                return ChoiceAvailability.ok()
        return ChoiceAvailability.no(CONDITIONS_NOT_MET)
    for row in rows:
        if not _condition_met(row, ctx):
            return ChoiceAvailability.no(_REASON_BY_TYPE.get(_type(row), CONDITIONS_NOT_MET))
    return ChoiceAvailability.ok()


# ── inline limits ───────────────────────────────────────────────────────────

def _failed_limit(choice: Dict[str, Any], ctx: ChoiceCheckContext) -> Optional[str]:
    if choice.get("limit_sad") is not None and _stat(ctx, "sad") > choice["limit_sad"]:
        return LIMIT_SAD_EXCEEDED
    if choice.get("limit_dex") is not None and _stat(ctx, "dex") < choice["limit_dex"]:
        return LIMIT_DEX_NOT_MET
    if choice.get("limit_int") is not None and _stat(ctx, "int") < choice["limit_int"]:
        return LIMIT_INT_NOT_MET
    if choice.get("limit_cos") is not None and _stat(ctx, "cos") < choice["limit_cos"]:
        return LIMIT_COS_NOT_MET
    return None


# ── condition rows ──────────────────────────────────────────────────────────

def _condition_met(row: Dict[str, Any], ctx: ChoiceCheckContext) -> bool:
    kind = _type(row)
    if kind == "KEYS":
        return _keys_met(row, ctx)
    if kind == "ITEM":
        return _membership_met(row, ctx.owned_item_ids)
    if kind == "CLASS":
        return _identity_met(row, ctx.id_class)
    if kind == "LOCATION":
        return _identity_met(row, ctx.id_location)
    if kind == "ALL_IN_SAME_LOC":
        return _all_in_same_loc(ctx)
    if kind == "TRAITS":
        return _membership_met(row, ctx.trait_ids)
    if kind == "STATISTICS":
        return _stat_met(row, ctx.actor_stats)
    if kind == "STATISTICS_SUM":
        return _stat_met(row, ctx.party_stat_sums)
    return False  # an unknown type locks the option, it never unlocks it


def _keys_met(row: Dict[str, Any], ctx: ChoiceCheckContext) -> bool:
    """Registry comparison. Equality is textual (the check context renders every registry
    value as a string); > and < require both sides numeric. An absent key satisfies only
    != — "the flag was never set" IS different."""
    key = (row.get("key") or "").strip()
    if not key:
        return False
    return registry_service.evaluate(_operator(row), row.get("value"), ctx.registry.get(key))


def _membership_met(row: Dict[str, Any], held: Optional[set]) -> bool:
    """ITEM / traits: the story-local id sits in ``value`` (``key`` as fallback)."""
    member_id = _id_of(row)
    if member_id is None or held is None:
        return False
    op = _operator(row)
    if op == "=":
        return member_id in held
    if op == "!=":
        return member_id not in held
    return False  # an item is owned or not: ordering it is authored noise


def _identity_met(row: Dict[str, Any], actual: Optional[int]) -> bool:
    """CLASS / LOCATION: the actor either matches the id or does not."""
    expected = _id_of(row)
    if expected is None:
        return False
    op = _operator(row)
    if op == "=":
        return expected == actual
    if op == "!=":
        return expected != actual
    return False


def _all_in_same_loc(ctx: ChoiceCheckContext) -> bool:
    """Every character of the match stands where the actor stands. Key, value and operator
    are ignored — the type IS the condition. An unplaced character (None location, actor
    included) can never be "in the same location"; a solo party trivially is."""
    here = ctx.id_location
    if here is None:
        return False
    return all(at == here for at in ctx.party_locations)


def _stat_met(row: Dict[str, Any], stats: Optional[Dict[str, int]]) -> bool:
    """STATISTICS / STATISTICS_SUM: ``key`` names the stat, ``value`` is numeric."""
    if stats is None:
        return False
    actual = stats.get((row.get("key") or "").strip().lower())
    expected = _numeric(row.get("value"))
    if actual is None or expected is None:
        return False
    op = _operator(row)
    if op == "=":
        return actual == expected
    if op == "!=":
        return actual != expected
    if op == ">":
        return actual > expected
    if op == "<":
        return actual < expected
    return False


# ── helpers ─────────────────────────────────────────────────────────────────

def _type(row: Dict[str, Any]) -> str:
    """The docs mix cases (KEYS but traits); the match is case-blind."""
    return (row.get("type") or "").strip().upper()


def _operator(row: Dict[str, Any]) -> str:
    op = (row.get("operator") or "").strip()
    return op if op else "="


def _id_of(row: Dict[str, Any]) -> Optional[int]:
    from_value = _numeric(row.get("value"))
    return from_value if from_value is not None else _numeric(row.get("key"))


def _numeric(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def _stat(ctx: ChoiceCheckContext, name: str) -> int:
    return (ctx.actor_stats or {}).get(name) or 0
