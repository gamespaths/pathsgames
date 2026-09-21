"""Step 38 — the pure experience engine: price list, guards, refusals and the purchase."""
import pytest

from match import experience


def test_formula_guards_and_cap():
    p = experience.Pricing(3, 2, 0)
    assert p.cost(12) == 38 and p.cost(0) == 2 and p.max_stat_value is None
    assert experience.Pricing(0, -3, -1).cost(12) == 12
    assert experience.Pricing(None, None, None).cost(None) == 1
    capped = experience.Pricing(1, 0, 10)
    assert capped.cost_or_none(9) == 9 and capped.cost_or_none(10) is None
    assert capped.at_cap(11) and not capped.at_cap(9)


def test_costs_renders_dex_int_cos_in_order_and_none_at_cap():
    m = experience.Pricing(2, 1, 6).costs({"dexterity": 1, "intelligence": 6, "constitution": 3})
    assert list(m.keys()) == ["dex", "int", "cos"]
    assert m == {"dex": 3, "int": None, "cos": 7}


def test_pricing_for_reads_the_difficulty_row_or_falls_back_to_the_match_exp_cost():
    story = {"difficulties": [{"uuid": "d1", "expCost": 5, "expCostBase": 4, "maxStatValue": 30},
                              {"uuid": "d2", "expCost": 1}]}
    p = experience.pricing_for({"difficultyUuid": "d1"}, story)
    assert p.cost(10) == 54 and p.max_stat_value == 30
    assert experience.difficulty_of({"difficultyUuid": "d2"}, story)["expCost"] == 1
    fb = experience.pricing_for({"difficultyUuid": "gone", "expCost": 3}, story)
    assert fb.cost(10) == 30 and fb.max_stat_value is None
    assert experience.pricing_for(None, None).cost(10) == 10


@pytest.mark.parametrize("raw, expected", [
    ("dex", "dex"), (" INT ", "int"), ("Cos", "cos"), ("life", None), ("", None), (None, None), (3, None),
])
def test_normalize_stat(raw, expected):
    assert experience.normalize_stat(raw) == expected


def _char(**over):
    c = {"uuid": "c1", "dexterity": 10, "intelligence": 12, "constitution": 4, "exp": 40}
    c.update(over)
    return c


def test_check_refuses_in_engine_order():
    pricing = experience.Pricing(2, 3, 12)
    safe, unsafe = {"secureParam": 1}, {"secureParam": 0}
    running = {"status": "RUNNING", "activeCharacterUuid": "c1"}
    assert experience.check({"status": "PAUSED"}, _char(), safe, "dex", pricing) == "MATCH_NOT_RUNNING"
    assert experience.check({"status": "RUNNING", "activeCharacterUuid": "other"}, _char(), safe, "dex", pricing) == "NOT_YOUR_TURN"
    assert experience.check(running, _char(isComa=1), safe, "dex", pricing) == "COMA"
    assert experience.check(running, _char(isSleeping=1), safe, "dex", pricing) == "SLEEPING"
    assert experience.check(running, _char(), safe, "life", pricing) == "INVALID_STAT"
    assert experience.check(running, _char(), unsafe, "dex", pricing) == "LOCATION_NOT_SAFE"
    assert experience.check(running, _char(), None, "dex", pricing) == "LOCATION_NOT_SAFE"
    assert experience.check(running, _char(), safe, "int", pricing) == "MAX_STAT_VALUE"
    assert experience.check(running, _char(exp=22), safe, "dex", pricing) == "NOT_ENOUGH_EXP"
    assert experience.check(running, _char(exp=23), safe, "dex", pricing) is None
    # a match with no active turn yet does not gate on the turn
    assert experience.check({"status": "RUNNING"}, _char(), safe, "cos", pricing) is None


def test_apply_buys_the_point_and_answers_the_purchase():
    pricing = experience.Pricing(2, 3, 12)
    char = _char()
    out = experience.apply(char, "DEX", pricing)
    assert char["dexterity"] == 11 and char["exp"] == 17
    assert out["stat"] == "dex" and out["statBefore"] == 10 and out["statAfter"] == 11
    assert out["expBefore"] == 40 and out["expAfter"] == 17 and out["expCost"] == 23
    assert out["expCosts"] == {"dex": 25, "int": None, "cos": 11}
    assert [c["statistic"] for c in out["statChanges"]] == ["dex", "exp"]
    assert out["statChanges"][1]["delta"] == -23


# ── v0.38.3 — the registry keys use-exp names ────────────────────────────────

def _story(*names):
    return {"keys": [{"keyName": n} for n in names]}


def _match(**values):
    return {"registry": [{"id": i, "key": k, "stringValue": None, "intValue": v, "multiValue": 0}
                         for i, (k, v) in enumerate(values.items(), 1)]}


def test_registry_writes_names_the_counter_then_the_stat_key_when_both_are_declared():
    story = _story("use-exp", "use-exp-DEX", "use-exp-COS")
    assert experience.registry_writes(story, _match(), "dex", 11) == [("use-exp", "1"), ("use-exp-DEX", "11")]
    # the counter grows from the highest value stored; the stat key follows the stat bought
    assert experience.registry_writes(story, {"registry": [
        {"id": 1, "key": "use-exp", "stringValue": None, "intValue": 2, "multiValue": 0}]}, "COS", 5) \
        == [("use-exp", "3"), ("use-exp-COS", "5")]
    assert experience.registry_writes(story, {"registry": [
        {"id": 1, "key": "use-exp", "stringValue": "abc", "intValue": None, "multiValue": 1},
        {"id": 2, "key": "use-exp", "stringValue": None, "intValue": 4, "multiValue": 1}]}, "int", 13) \
        == [("use-exp", "5")]


def test_registry_writes_skips_every_undeclared_key():
    assert experience.registry_writes({}, _match(), "dex", 11) == []
    assert experience.registry_writes(None, None, "dex", 11) == []
    assert experience.registry_writes(_story("use-exp-INT"), _match(), "dex", 11) == []
    assert experience.registry_writes(_story("use-exp-INT"), _match(), "int", 13) == [("use-exp-INT", "13")]

