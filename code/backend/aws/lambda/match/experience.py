"""Step 38 — experience spent on DEX/INT/COS.

Pure engine, no DynamoDB: the handler hands in the live match/character dicts and persists
what changed. ``cost = max(1, expCost × current + expCostBase)``; ``maxStatValue`` caps the
stat (``<= 0``/missing = no cap). Mirrors the Java ``ExperienceCostCalculator``.
"""

STATS = ("dex", "int", "cos")
STAT_FIELD = {"dex": "dexterity", "int": "intelligence", "cos": "constitution"}
_RUNNING = "RUNNING"


def _nz(value):
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


class Pricing:
    def __init__(self, exp_cost, exp_cost_base, max_stat_value):
        self.exp_cost = 1 if _nz(exp_cost) <= 0 else _nz(exp_cost)
        self.exp_cost_base = 0 if _nz(exp_cost_base) < 0 else _nz(exp_cost_base)
        self.max_stat_value = None if _nz(max_stat_value) <= 0 else _nz(max_stat_value)

    def cost(self, current):
        return max(1, self.exp_cost * _nz(current) + self.exp_cost_base)

    def at_cap(self, current):
        return self.max_stat_value is not None and _nz(current) >= self.max_stat_value

    def cost_or_none(self, current):
        return None if self.at_cap(current) else self.cost(current)

    def costs(self, char):
        """``{dex, int, cos}`` → cost of the next point, None at cap. Insertion-ordered."""
        return {stat: self.cost_or_none(char.get(field)) for stat, field in STAT_FIELD.items()}


def difficulty_of(match, story):
    """The story difficulty row the match was created on, or None."""
    wanted = (match or {}).get("difficultyUuid")
    return next((d for d in ((story or {}).get("difficulties") or [])
                 if d.get("uuid") == wanted), None)


def pricing_for(match, story):
    """The price list of a match: its difficulty row, or its own expCost copy when the row is gone."""
    difficulty = difficulty_of(match, story)
    if difficulty is None:
        return Pricing((match or {}).get("expCost"), 0, 0)
    return Pricing(difficulty.get("expCost"), difficulty.get("expCostBase"), difficulty.get("maxStatValue"))


def normalize_stat(stat):
    """``dex``/``int``/``cos`` (trimmed, case-folded) or None."""
    token = (stat or "").strip().lower() if isinstance(stat, str) else ""
    return token if token in STATS else None


def check(match, char, location, stat, pricing):
    """The refusal, in the order the other gameplay engines use; None when the point may be bought."""
    if (match or {}).get("status") != _RUNNING:
        return "MATCH_NOT_RUNNING"
    active = (match or {}).get("activeCharacterUuid")
    if active and active != char.get("uuid"):
        return "NOT_YOUR_TURN"
    if _nz(char.get("isComa")):
        return "COMA"
    if _nz(char.get("isSleeping")):
        return "SLEEPING"
    if normalize_stat(stat) is None:
        return "INVALID_STAT"
    if _nz((location or {}).get("secureParam")) <= 0:
        return "LOCATION_NOT_SAFE"
    current = _nz(char.get(STAT_FIELD[normalize_stat(stat)]))
    if pricing.at_cap(current):
        return "MAX_STAT_VALUE"
    if _nz(char.get("exp")) < pricing.cost(current):
        return "NOT_ENOUGH_EXP"
    return None


def apply(char, stat, pricing):
    """Buys the point in place: returns the payload the endpoint answers with."""
    token = normalize_stat(stat)
    field = STAT_FIELD[token]
    before = _nz(char.get(field))
    exp_before = _nz(char.get("exp"))
    cost = pricing.cost(before)
    char[field] = before + 1
    char["exp"] = exp_before - cost
    return {
        "characterUuid": char.get("uuid"),
        "stat": token,
        "statBefore": before,
        "statAfter": before + 1,
        "expBefore": exp_before,
        "expAfter": exp_before - cost,
        "expCost": cost,
        "expCosts": pricing.costs(char),
        "statChanges": [
            {"characterUuid": char.get("uuid"), "statistic": token,
             "before": before, "after": before + 1, "delta": 1},
            {"characterUuid": char.get("uuid"), "statistic": "exp",
             "before": exp_before, "after": exp_before - cost, "delta": -cost},
        ],
    }
