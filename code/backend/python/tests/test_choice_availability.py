"""Step 31 — choice_availability, the per-option verdict (mirrors the Java checker test).

Pure function, so every branch is reachable directly: one group per condition type, the
inline limits, the AND/OR combination, and the "authored noise locks, never unlocks"
doctrine.
"""
from app.core.models.match.event_models import ChoiceCheckContext
from app.core.services.match import choice_availability as ca


CLASS_ID = 50
LOC = 100


def choice(**over):
    """A bare AND choice: no limits, no otherwise — availability rides on the conditions."""
    base = {"id": 1, "otherwise_flag": 0, "logic_operator": "AND",
            "limit_sad": None, "limit_dex": None, "limit_int": None, "limit_cos": None}
    base.update(over)
    return base


def cond(ctype, key=None, value=None, operator=None):
    return {"type": ctype, "key": key, "value": value, "operator": operator}


def ctx(**over):
    """A healthy solo actor: life 10, energy 10, sad 2, exp 5, dex/int/cos 3,
    food 1, magic 1, coin 10 — standing alone at LOC with class 50."""
    base = dict(
        actor_stats={"life": 10, "energy": 10, "sad": 2, "exp": 5,
                     "dex": 3, "int": 3, "cos": 3, "food": 1, "magic": 1, "coin": 10},
        id_class=CLASS_ID, id_location=LOC, owned_item_ids=set(), trait_ids=set(),
        registry={}, party_locations=[LOC], party_stat_sums={},
    )
    base.update(over)
    return ChoiceCheckContext(**base)


def blocked(verdict, reason):
    assert verdict.available is False
    assert verdict.reason == reason


# ── the happy path ──────────────────────────────────────────────────────────

def test_bare_choice_is_available():
    v = ca.check(choice(), [], ctx())
    assert v.available is True and v.reason is None


def test_zero_conditions_available_under_or_too():
    assert ca.check(choice(logic_operator="OR"), [], ctx()).available


def test_none_conditions_reads_as_no_conditions():
    assert ca.check(choice(), None, ctx()).available


def test_null_inputs_can_never_be_selected():
    blocked(ca.check(None, [], ctx()), ca.CONDITIONS_NOT_MET)
    blocked(ca.check(choice(), [], None), ca.CONDITIONS_NOT_MET)


# ── otherwise (INV-29) ──────────────────────────────────────────────────────

def test_otherwise_beats_failing_limits_and_conditions():
    c = choice(otherwise_flag=1, limit_dex=99)
    v = ca.check(c, [cond("statistics", "int", "99", ">")], ctx())
    assert v.available is True and v.reason is None


# ── inline limits ───────────────────────────────────────────────────────────

def test_limit_sad_is_a_maximum():
    blocked(ca.check(choice(limit_sad=1), [], ctx()), ca.LIMIT_SAD_EXCEEDED)  # sad = 2
    assert ca.check(choice(limit_sad=2), [], ctx()).available  # <=, not <


def test_limit_dex_int_cos_are_minimums():
    blocked(ca.check(choice(limit_dex=4), [], ctx()), ca.LIMIT_DEX_NOT_MET)  # dex = 3
    assert ca.check(choice(limit_dex=3), [], ctx()).available  # >=, not >
    blocked(ca.check(choice(limit_int=4), [], ctx()), ca.LIMIT_INT_NOT_MET)
    blocked(ca.check(choice(limit_cos=4), [], ctx()), ca.LIMIT_COS_NOT_MET)


def test_limits_check_sad_dex_int_cos_first_failure_names_the_reason():
    blocked(ca.check(choice(limit_sad=0, limit_dex=99), [], ctx()), ca.LIMIT_SAD_EXCEEDED)


def test_limits_fail_before_any_condition_is_read():
    blocked(ca.check(choice(limit_dex=99), [cond("statistics", "life", "0", ">")], ctx()),
            ca.LIMIT_DEX_NOT_MET)


# ── KEYS ────────────────────────────────────────────────────────────────────

def test_keys_equals_matches_the_registry_value_textually():
    assert ca.check(choice(), [cond("KEYS", "gate", "OPEN", "=")],
                    ctx(registry={"gate": ["OPEN"]})).available
    blocked(ca.check(choice(), [cond("KEYS", "gate", "OPEN", "=")],
                     ctx(registry={"gate": ["SHUT"]})), ca.CONDITION_KEYS_NOT_MET)


def test_keys_absent_key_satisfies_only_not_equals():
    blocked(ca.check(choice(), [cond("KEYS", "gate", "OPEN", "=")], ctx()),
            ca.CONDITION_KEYS_NOT_MET)
    assert ca.check(choice(), [cond("KEYS", "gate", "OPEN", "!=")], ctx()).available


def test_keys_numeric_comparison():
    c = ctx(registry={"day": ["5"]})
    assert ca.check(choice(), [cond("KEYS", "day", "3", ">")], c).available
    blocked(ca.check(choice(), [cond("KEYS", "day", "5", ">")], c), ca.CONDITION_KEYS_NOT_MET)
    assert ca.check(choice(), [cond("KEYS", "day", "9", "<")], c).available
    blocked(ca.check(choice(), [cond("KEYS", "day", "3", ">")],
                     ctx(registry={"day": ["many"]})), ca.CONDITION_KEYS_NOT_MET)


def test_keys_malformed_can_never_be_satisfied():
    blocked(ca.check(choice(), [cond("KEYS", " ", "OPEN", "=")], ctx()),
            ca.CONDITION_KEYS_NOT_MET)
    blocked(ca.check(choice(), [cond("KEYS", "gate", None, "!=")],
                     ctx(registry={"gate": ["OPEN"]})), ca.CONDITION_KEYS_NOT_MET)
    blocked(ca.check(choice(), [cond("KEYS", "gate", "OPEN", ">=")],
                     ctx(registry={"gate": ["OPEN"]})), ca.CONDITION_KEYS_NOT_MET)


# ── ITEM / traits (membership) ──────────────────────────────────────────────

def test_item_ownership():
    assert ca.check(choice(), [cond("ITEM", None, "42", "=")],
                    ctx(owned_item_ids={42})).available
    blocked(ca.check(choice(), [cond("ITEM", None, "42", "=")], ctx()),
            ca.CONDITION_ITEM_NOT_MET)
    assert ca.check(choice(), [cond("ITEM", None, "42", "!=")], ctx()).available
    blocked(ca.check(choice(), [cond("ITEM", None, "42", "!=")],
                     ctx(owned_item_ids={42})), ca.CONDITION_ITEM_NOT_MET)


def test_item_id_falls_back_to_key_and_ordering_is_noise():
    assert ca.check(choice(), [cond("ITEM", "42", None, "=")],
                    ctx(owned_item_ids={42})).available
    blocked(ca.check(choice(), [cond("ITEM", None, "42", ">")],
                     ctx(owned_item_ids={42})), ca.CONDITION_ITEM_NOT_MET)
    blocked(ca.check(choice(), [cond("ITEM", None, "the-sword", "=")], ctx()),
            ca.CONDITION_ITEM_NOT_MET)


def test_traits_membership_case_blind_type():
    assert ca.check(choice(), [cond("traits", None, "9", "=")],
                    ctx(trait_ids={9})).available
    blocked(ca.check(choice(), [cond("TRAITS", None, "9", "=")], ctx()),
            ca.CONDITION_TRAITS_NOT_MET)


# ── CLASS / LOCATION (identity) ─────────────────────────────────────────────

def test_class_identity():
    assert ca.check(choice(), [cond("CLASS", None, "50", "=")], ctx()).available
    blocked(ca.check(choice(), [cond("CLASS", None, "51", "=")], ctx()),
            ca.CONDITION_CLASS_NOT_MET)
    assert ca.check(choice(), [cond("CLASS", None, "51", "!=")], ctx()).available
    # A classless actor fails = and passes !=.
    blocked(ca.check(choice(), [cond("CLASS", None, "50", "=")], ctx(id_class=None)),
            ca.CONDITION_CLASS_NOT_MET)
    assert ca.check(choice(), [cond("CLASS", None, "50", "!=")],
                    ctx(id_class=None)).available


def test_location_identity():
    assert ca.check(choice(), [cond("LOCATION", None, "100", "=")], ctx()).available
    blocked(ca.check(choice(), [cond("LOCATION", None, "101", "=")], ctx()),
            ca.CONDITION_LOCATION_NOT_MET)


# ── ALL_IN_SAME_LOC ─────────────────────────────────────────────────────────

def test_all_in_same_loc():
    row = cond("ALL_IN_SAME_LOC")
    assert ca.check(choice(), [row], ctx(party_locations=[LOC, LOC, LOC])).available
    assert ca.check(choice(), [row], ctx()).available  # solo party trivially gathered
    blocked(ca.check(choice(), [row], ctx(party_locations=[LOC, 999])),
            ca.CONDITION_ALL_IN_SAME_LOC_NOT_MET)
    blocked(ca.check(choice(), [row], ctx(party_locations=[LOC, None])),
            ca.CONDITION_ALL_IN_SAME_LOC_NOT_MET)
    blocked(ca.check(choice(), [row], ctx(id_location=None)),
            ca.CONDITION_ALL_IN_SAME_LOC_NOT_MET)


# ── statistics / statistics_SUM ─────────────────────────────────────────────

def test_statistics_operators():
    assert ca.check(choice(), [cond("statistics", "int", "3", "=")], ctx()).available
    assert ca.check(choice(), [cond("statistics", "int", "4", "!=")], ctx()).available
    assert ca.check(choice(), [cond("statistics", "int", "2", ">")], ctx()).available
    assert ca.check(choice(), [cond("statistics", "int", "4", "<")], ctx()).available
    blocked(ca.check(choice(), [cond("statistics", "int", "99", ">")], ctx()),
            ca.CONDITION_STATISTICS_NOT_MET)
    # Case-blind stat name and type; backpack stats are part of the vocabulary.
    assert ca.check(choice(), [cond("STATISTICS", "INT", "2", ">")], ctx()).available
    assert ca.check(choice(), [cond("statistics", "coin", "9", ">")], ctx()).available


def test_statistics_malformed_is_never_met():
    blocked(ca.check(choice(), [cond("statistics", "charisma", "1", ">")], ctx()),
            ca.CONDITION_STATISTICS_NOT_MET)
    blocked(ca.check(choice(), [cond("statistics", "int", "lots", ">")], ctx()),
            ca.CONDITION_STATISTICS_NOT_MET)


def test_statistics_sum_reads_the_party_pool():
    c = ctx(party_stat_sums={"int": 12})
    assert ca.check(choice(), [cond("statistics_SUM", "int", "10", ">")], c).available
    blocked(ca.check(choice(), [cond("statistics_SUM", "int", "12", ">")], c),
            ca.CONDITION_STATISTICS_SUM_NOT_MET)
    blocked(ca.check(choice(), [cond("statistics_SUM", "int", "1", ">")], ctx()),
            ca.CONDITION_STATISTICS_SUM_NOT_MET)


# ── logic operator (INV-31) ─────────────────────────────────────────────────

def test_and_first_failing_row_names_the_reason():
    blocked(ca.check(choice(), [cond("KEYS", "gate", "OPEN", "="),
                                cond("statistics", "int", "99", ">")], ctx()),
            ca.CONDITION_KEYS_NOT_MET)


def test_and_every_row_must_pass():
    assert ca.check(choice(), [cond("KEYS", "gate", "OPEN", "="),
                               cond("statistics", "int", "2", ">")],
                    ctx(registry={"gate": ["OPEN"]})).available


def test_or_one_passing_row_is_enough():
    c = choice(logic_operator="OR")
    assert ca.check(c, [cond("KEYS", "gate", "OPEN", "="),
                        cond("statistics", "life", "0", ">")], ctx()).available


def test_or_all_failing_reports_the_aggregate():
    c = choice(logic_operator="OR")
    blocked(ca.check(c, [cond("KEYS", "gate", "OPEN", "="),
                         cond("statistics", "int", "99", ">")], ctx()),
            ca.CONDITIONS_NOT_MET)


def test_combiner_normalization():
    assert ca.check(choice(logic_operator="or"),
                    [cond("KEYS", "gate", "OPEN", "="),
                     cond("statistics", "life", "0", ">")], ctx()).available
    # Anything not OR reads as AND; None too.
    blocked(ca.check(choice(logic_operator="XOR"),
                     [cond("KEYS", "gate", "OPEN", "="),
                      cond("statistics", "life", "0", ">")], ctx()),
            ca.CONDITION_KEYS_NOT_MET)
    blocked(ca.check(choice(logic_operator=None), [cond("KEYS", "gate", "OPEN", "=")], ctx()),
            ca.CONDITION_KEYS_NOT_MET)


# ── unknown types & defaults ────────────────────────────────────────────────

def test_unknown_type_locks_never_unlocks():
    blocked(ca.check(choice(), [cond("KEYZ", "gate", "OPEN", "=")], ctx()),
            ca.CONDITIONS_NOT_MET)
    blocked(ca.check(choice(), [cond(None, "gate", "OPEN", "=")], ctx()),
            ca.CONDITIONS_NOT_MET)
    # Under OR an unknown row does not pass, but a later valid row can.
    assert ca.check(choice(logic_operator="OR"),
                    [cond("KEYZ", "gate", "OPEN", "="),
                     cond("statistics", "life", "0", ">")], ctx()).available


def test_missing_operator_defaults_to_equals():
    assert ca.check(choice(), [cond("KEYS", "gate", "OPEN", None)],
                    ctx(registry={"gate": ["OPEN"]})).available


# ── the user's scenario: CLASS = 1 OR CLASS = 2 ─────────────────────────────

def test_or_over_two_class_rows_is_the_way_to_say_one_class_or_the_other():
    c = choice(logic_operator="OR")
    rows = [cond("CLASS", None, "1", "="), cond("CLASS", None, "2", "=")]
    assert ca.check(c, rows, ctx(id_class=1)).available, "class 1 satisfies the first row"
    assert ca.check(c, rows, ctx(id_class=2)).available, "class 2 satisfies the second row"
    blocked(ca.check(c, rows, ctx(id_class=3)), ca.CONDITIONS_NOT_MET)


def test_and_over_two_class_rows_can_never_pass():
    # A character has one class, so class=1 AND class=2 is unsatisfiable.
    c = choice()  # AND by default
    rows = [cond("CLASS", None, "1", "="), cond("CLASS", None, "2", "=")]
    blocked(ca.check(c, rows, ctx(id_class=1)), ca.CONDITION_CLASS_NOT_MET)
    blocked(ca.check(c, rows, ctx(id_class=2)), ca.CONDITION_CLASS_NOT_MET)
