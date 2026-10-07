"""Step 38 — what a +1 on DEX/INT/COS costs and whether it is allowed.

Pure arithmetic shared by ``/info`` (``expCosts``) and the use-exp action, so both agree:
``cost = max(1, exp_cost × current + exp_cost_base)``; ``max_stat_value`` caps the stat
(``<= 0``/``None`` = no cap). Mirrors the Java ``ExperienceCostCalculator``.
"""
from typing import Any, Dict, Optional

STATS = ("dex", "int", "cos")
STAT_FIELD = {"dex": "dexterity", "int": "intelligence", "cos": "constitution"}


class ExperienceCost:
    def __init__(self, exp_cost: Optional[int], exp_cost_base: Optional[int],
                 max_stat_value: Optional[int]):
        self.exp_cost = 1 if exp_cost is None or exp_cost <= 0 else int(exp_cost)
        self.exp_cost_base = 0 if exp_cost_base is None or exp_cost_base < 0 else int(exp_cost_base)
        self.max_stat_value = (None if max_stat_value is None or max_stat_value <= 0
                               else int(max_stat_value))

    @classmethod
    def of(cls, difficulty: Optional[Dict[str, Any]], fallback_exp_cost: Optional[int]) -> "ExperienceCost":
        """Reads the difficulty row (snake_case keys); a missing row prices with the match's exp_cost."""
        if not isinstance(difficulty, dict):
            return cls(fallback_exp_cost, 0, 0)
        return cls(difficulty.get("exp_cost"), difficulty.get("exp_cost_base"),
                   difficulty.get("max_stat_value"))

    def cost(self, current: int) -> int:
        return max(1, self.exp_cost * int(current or 0) + self.exp_cost_base)

    def at_cap(self, current: int) -> bool:
        return self.max_stat_value is not None and int(current or 0) >= self.max_stat_value

    def cost_or_none(self, current: int) -> Optional[int]:
        return None if self.at_cap(current) else self.cost(current)

    def costs(self, dexterity: int, intelligence: int, constitution: int) -> Dict[str, Optional[int]]:
        """``{dex, int, cos}`` → cost of the next point, None at cap. Insertion-ordered."""
        return {
            "dex": self.cost_or_none(dexterity),
            "int": self.cost_or_none(intelligence),
            "cos": self.cost_or_none(constitution),
        }
