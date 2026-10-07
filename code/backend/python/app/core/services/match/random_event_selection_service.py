"""Step 39 — picks at most one global random event per time-start (mirrors the Java reference).
``probability`` is an absolute percentage; a total above 100 scales every row down.
"""
import random
from typing import Any, Dict, List, Optional, Set

from app.core.models.match import match_statuses
from app.core.services.match import registry_service

# Keeps the random roll of day N away from the weather roll of day N+1 (seed + clock).
SEED_SALT = 1_000_003
PERCENT = 100
TYPE_ONCE = "ONCE"


class RandomEventSelectionService:
    def __init__(self, store, registry_service_instance=None) -> None:
        self.store = store
        self.registry_service = registry_service_instance

    def pick_at_time_start(self, id_match: int) -> Optional[Dict[str, int]]:
        """The event to fire at this time-start as ``{"id_random_event", "id_event"}``, or None."""
        ctx = self.store.load_context(id_match)
        if (ctx is None or ctx.get("status") != match_statuses.RUNNING
                or (ctx.get("current_clock") or 0) <= 0):
            return None
        rows = self.store.find_random_events(ctx["id_story"]) or []
        if not rows:
            return None
        consumed = self.store.find_consumed_event_ids(id_match)
        eligible = [r for r in rows
                    if self.is_runnable(r, consumed) and self._condition_matches(r, id_match)]
        chosen = self.pick(eligible, self.seed_for(ctx))
        if chosen is None:
            return None
        return {"id_random_event": chosen["id"], "id_event": chosen["id_event"]}

    @staticmethod
    def is_runnable(row: Dict[str, Any], consumed: Optional[Set[int]]) -> bool:
        """Positive probability, existing event without choices, and not a spent ONCE event."""
        if (_probability(row) <= 0 or not row.get("id_event") or row["id_event"] <= 0
                or not row.get("event_exists") or row.get("event_owns_choices")):
            return False
        once = (row.get("event_type") or "").upper() == TYPE_ONCE
        return not (once and consumed and row["id_event"] in consumed)

    def _condition_matches(self, row: Dict[str, Any], id_match: int) -> bool:
        key = row.get("condition_key")
        if registry_service.no_condition(key):
            return True
        return registry_service.evaluate(row.get("registry_value_operator_condition"),
                                         row.get("condition_value"),
                                         self.registry_service.find(id_match, key))

    @staticmethod
    def order(eligible: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Probability DESC, then id ASC: the fixed order of the cumulative walk."""
        return sorted(eligible, key=lambda r: (-_probability(r), r["id"]))

    @staticmethod
    def walk(ordered: List[Dict[str, Any]], roll: int) -> Optional[Dict[str, Any]]:
        """The row whose cumulative range holds ``roll``; None when roll lands past the total."""
        cumulative = 0
        for r in ordered:
            cumulative += _probability(r)
            if roll < cumulative:
                return r
        return None

    @classmethod
    def pick(cls, eligible: List[Dict[str, Any]], seed: int) -> Optional[Dict[str, Any]]:
        """Roll in [0, max(100, total)): below 100 the gap is "nothing", above it the rows scale."""
        if not eligible:
            return None
        # Safe: seed is provided externally (deterministic, not for security).
        roll = random.Random(int(seed)).randrange(max(PERCENT, cls.total(eligible)))  # NOSONAR
        return cls.walk(cls.order(eligible), roll)

    @staticmethod
    def total(eligible: List[Dict[str, Any]]) -> int:
        return sum(_probability(r) for r in eligible)

    @staticmethod
    def seed_for(ctx: Dict[str, Any]) -> int:
        base = ctx.get("rng_seed") if ctx.get("rng_seed") is not None else ctx["id_story"]
        return int(base) + int(ctx.get("current_clock") or 0) + SEED_SALT


def _probability(row: Dict[str, Any]) -> int:
    return int(row.get("probability") or 0)
