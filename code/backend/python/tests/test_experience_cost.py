"""Step 38 — the use-exp price list and its guards (mirror of the Java calculator test)."""
from app.core.services.match.experience_cost import STATS, STAT_FIELD, ExperienceCost


def test_formula_is_exp_cost_times_current_plus_base():
    c = ExperienceCost(3, 2, 0)
    assert c.cost(12) == 38
    assert c.cost(0) == 2
    assert (c.exp_cost, c.exp_cost_base, c.max_stat_value) == (3, 2, None)


def test_guards_exp_cost_base_and_floor():
    assert ExperienceCost(0, 0, 0).cost(12) == 12
    assert ExperienceCost(None, None, None).cost(12) == 12
    assert ExperienceCost(-4, -9, -1).cost(12) == 12
    assert ExperienceCost(1, 0, 0).cost(0) == 1
    assert ExperienceCost(1, 0, 0).cost(None) == 1


def test_cap_makes_the_next_point_cost_none():
    c = ExperienceCost(1, 0, 10)
    assert c.max_stat_value == 10
    assert not c.at_cap(9)
    assert c.at_cap(10) and c.at_cap(11)
    assert c.cost_or_none(9) == 9
    assert c.cost_or_none(10) is None
    assert ExperienceCost(1, 0, 0).max_stat_value is None
    assert ExperienceCost(1, 0, -5).max_stat_value is None


def test_costs_renders_dex_int_cos_in_order():
    m = ExperienceCost(2, 1, 6).costs(1, 6, 3)
    assert list(m.keys()) == ["dex", "int", "cos"] == list(STATS)
    assert m == {"dex": 3, "int": None, "cos": 7}
    assert STAT_FIELD["cos"] == "constitution"


def test_of_reads_the_difficulty_row_or_falls_back():
    c = ExperienceCost.of({"exp_cost": 5, "exp_cost_base": 4, "max_stat_value": 30}, 99)
    assert c.cost(10) == 54 and c.max_stat_value == 30
    fb = ExperienceCost.of(None, 3)
    assert fb.cost(10) == 30 and fb.max_stat_value is None
    assert ExperienceCost.of("not-a-row", None).cost(10) == 10
