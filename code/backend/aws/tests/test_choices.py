"""Step 31 — match.choices: the pure per-option verdict and its story/match readers.

Mirrors test_choice_availability.py on the Python backend (and the Java checker test);
the full operator matrix lives there conceptually — here every branch of the AWS twin is
exercised, plus the AWS-only parts: the embedded-list readers, the marker counting and
the trait uuid→id translation of the context builder.
"""
from match import choices as ch

LOC = 1


def choice(**over):
    base = {"id": 1, "otherwiseFlag": 0, "logicOperator": "AND"}
    base.update(over)
    return base


def cond(ctype, key=None, value=None, operator=None):
    return {"type": ctype, "key": key, "value": value, "operator": operator}


def cctx(**over):
    base = {
        "actorStats": {"life": 10, "energy": 10, "sad": 2, "exp": 5,
                       "dex": 3, "int": 3, "cos": 3, "food": 1, "magic": 1, "coin": 10},
        "idClass": 50, "idLocation": LOC, "ownedItemIds": set(), "traitIds": set(),
        "registry": {}, "partyLocations": [LOC], "partyStatSums": {},
    }
    base.update(over)
    return base


def blocked(verdict, reason):
    available, actual = verdict
    assert available is False and actual == reason


# ── readers ─────────────────────────────────────────────────────────────────

def test_choices_for_event_filters_and_sorts():
    story = {"choices": [
        {"id": 3, "idEvent": 30, "priority": 2},
        {"id": 1, "idEvent": 30, "priority": 1},
        {"id": 2, "idEvent": 31, "priority": 1},
        {"id": 4, "idEvent": None},
        {"id": 5, "idEvent": 30, "priority": 2},
    ]}
    out = ch.choices_for_event(story, 30)
    assert [c["id"] for c in out] == [1, 3, 5]  # priority asc, then id
    assert ch.choices_for_event({}, 30) == []


def test_conditions_by_choice_groups_and_orders():
    story = {"choiceConditions": [
        {"id": 3, "idChoices": 7, "type": "KEYS"},
        {"id": 1, "idChoices": 7, "type": "statistics"},
        {"id": 2, "idChoices": 8, "type": "traits"},
        {"id": 4, "idChoices": None, "type": "KEYS"},
    ]}
    out = ch.conditions_by_choice(story)
    assert [c["type"] for c in out[7]] == ["statistics", "KEYS"]
    assert len(out[8]) == 1 and None not in out


def test_count_log_markers():
    match = {"eventLog": [
        {"idEvent": 30, "message": "EVENT_EXECUTED 30"},
        {"idEvent": 30, "message": "EVENT_EXECUTED 30"},
        {"idEvent": 30, "message": "CHOICE_SELECTED 30"},
        {"idEvent": 31, "message": "EVENT_EXECUTED 31"},
        {"idEvent": 30, "message": "WEATHER something"},
        {"idEvent": None, "message": "EVENT_EXECUTED ?"},
    ]}
    assert ch.count_log_markers(match, 30, "EVENT_EXECUTED") == 2
    assert ch.count_log_markers(match, 30, ch.MSG_CHOICE_SELECTED) == 1
    assert ch.count_log_markers(match, 32, "EVENT_EXECUTED") == 0
    assert ch.count_log_markers({}, 30, "EVENT_EXECUTED") == 0


# ── the context builder ─────────────────────────────────────────────────────

def test_build_choice_context_actor_stats_and_lazy_traits():
    caller = {"uuid": "c1", "idLocation": LOC, "life": 9, "energy": 8, "sad": 1, "exp": 2,
              "dexterity": 3, "intelligence": 4, "constitution": 5,
              "food": 6, "magic": 7, "coin": 11, "traitUuids": ["tr-brave"]}
    story = {"traits": [{"id": 9, "uuid": "tr-brave"}, {"id": 7, "uuid": "tr-quick"}]}
    ctx = {"idClass": 50, "ownedItemIds": {42}, "registry": {"gate": "OPEN"}}

    # No traits condition: the translation is skipped.
    out = ch.build_choice_context({}, story, caller, [caller], ctx, [choice()], {})
    assert out["actorStats"] == {"life": 9, "energy": 8, "sad": 1, "exp": 2,
                                 "dex": 3, "int": 4, "cos": 5,
                                 "food": 6, "magic": 7, "coin": 11}
    assert out["idClass"] == 50 and out["idLocation"] == LOC
    assert out["ownedItemIds"] == {42} and out["registry"] == {"gate": "OPEN"}
    assert out["traitIds"] == set() and out["partyLocations"] == []

    # A traits condition translates the held uuids into story-local ids.
    conditions = {1: [cond("traits", None, "9", "=")]}
    out = ch.build_choice_context({}, story, caller, [caller], ctx, [choice()], conditions)
    assert out["traitIds"] == {9}


def test_build_choice_context_party_reads():
    caller = {"uuid": "c1", "idLocation": LOC, "intelligence": 10}
    mate = {"uuid": "c2", "idLocation": 999, "intelligence": 7}
    conditions = {1: [cond("statistics_SUM", "int", "16", ">"),
                      cond("ALL_IN_SAME_LOC")]}
    out = ch.build_choice_context({}, {}, caller, [caller, mate], {}, [choice()], conditions)
    assert out["partyLocations"] == [LOC, 999]
    assert out["partyStatSums"] == {"int": 17}


# ── the verdict ─────────────────────────────────────────────────────────────

def test_bare_choice_available_and_null_inputs_blocked():
    assert ch.check_choice(choice(), [], cctx()) == (True, None)
    assert ch.check_choice(choice(logicOperator="OR"), [], cctx()) == (True, None)
    blocked(ch.check_choice(None, [], cctx()), ch.CONDITIONS_NOT_MET)
    blocked(ch.check_choice(choice(), [], None), ch.CONDITIONS_NOT_MET)


def test_otherwise_beats_everything():
    c = choice(otherwiseFlag=1, limitDex=99)
    assert ch.check_choice(c, [cond("statistics", "int", "99", ">")], cctx()) == (True, None)


def test_limits():
    blocked(ch.check_choice(choice(limitSad=1), [], cctx()), ch.LIMIT_SAD_EXCEEDED)
    assert ch.check_choice(choice(limitSad=2), [], cctx()) == (True, None)  # <=, not <
    blocked(ch.check_choice(choice(limitDex=4), [], cctx()), ch.LIMIT_DEX_NOT_MET)
    assert ch.check_choice(choice(limitDex=3), [], cctx()) == (True, None)  # >=, not >
    blocked(ch.check_choice(choice(limitInt=4), [], cctx()), ch.LIMIT_INT_NOT_MET)
    blocked(ch.check_choice(choice(limitCos=4), [], cctx()), ch.LIMIT_COS_NOT_MET)
    # sad first, and limits fail before any condition is read.
    blocked(ch.check_choice(choice(limitSad=0, limitDex=99), [], cctx()),
            ch.LIMIT_SAD_EXCEEDED)
    blocked(ch.check_choice(choice(limitDex=99),
                            [cond("statistics", "life", "0", ">")], cctx()),
            ch.LIMIT_DEX_NOT_MET)


def test_keys_conditions():
    assert ch.check_choice(choice(), [cond("KEYS", "gate", "OPEN", "=")],
                           cctx(registry={"gate": "OPEN"})) == (True, None)
    blocked(ch.check_choice(choice(), [cond("KEYS", "gate", "OPEN", "=")],
                            cctx(registry={"gate": "SHUT"})), ch.CONDITION_KEYS_NOT_MET)
    # An absent key satisfies only != — never having set the flag IS different.
    blocked(ch.check_choice(choice(), [cond("KEYS", "gate", "OPEN", "=")], cctx()),
            ch.CONDITION_KEYS_NOT_MET)
    assert ch.check_choice(choice(), [cond("KEYS", "gate", "OPEN", "!=")], cctx()) == (True, None)
    # Numeric > / < when both sides parse; anything else is never met.
    reg = cctx(registry={"day": "5"})
    assert ch.check_choice(choice(), [cond("KEYS", "day", "3", ">")], reg) == (True, None)
    blocked(ch.check_choice(choice(), [cond("KEYS", "day", "3", ">")],
                            cctx(registry={"day": "many"})), ch.CONDITION_KEYS_NOT_MET)
    blocked(ch.check_choice(choice(), [cond("KEYS", " ", "OPEN", "=")], cctx()),
            ch.CONDITION_KEYS_NOT_MET)
    blocked(ch.check_choice(choice(), [cond("KEYS", "gate", None, "!=")], reg),
            ch.CONDITION_KEYS_NOT_MET)
    blocked(ch.check_choice(choice(), [cond("KEYS", "day", "3", ">=")], reg),
            ch.CONDITION_KEYS_NOT_MET)


def test_membership_conditions():
    assert ch.check_choice(choice(), [cond("ITEM", None, "42", "=")],
                           cctx(ownedItemIds={42})) == (True, None)
    blocked(ch.check_choice(choice(), [cond("ITEM", None, "42", "=")], cctx()),
            ch.CONDITION_ITEM_NOT_MET)
    assert ch.check_choice(choice(), [cond("ITEM", None, "42", "!=")], cctx()) == (True, None)
    # The id falls back to `key`; ordering an item is authored noise; so is a non-id.
    assert ch.check_choice(choice(), [cond("ITEM", "42", None, "=")],
                           cctx(ownedItemIds={42})) == (True, None)
    blocked(ch.check_choice(choice(), [cond("ITEM", None, "42", ">")],
                            cctx(ownedItemIds={42})), ch.CONDITION_ITEM_NOT_MET)
    blocked(ch.check_choice(choice(), [cond("ITEM", None, "the-sword", "=")], cctx()),
            ch.CONDITION_ITEM_NOT_MET)
    assert ch.check_choice(choice(), [cond("traits", None, "9", "=")],
                           cctx(traitIds={9})) == (True, None)
    blocked(ch.check_choice(choice(), [cond("TRAITS", None, "9", "=")], cctx()),
            ch.CONDITION_TRAITS_NOT_MET)


def test_identity_conditions():
    assert ch.check_choice(choice(), [cond("CLASS", None, "50", "=")], cctx()) == (True, None)
    blocked(ch.check_choice(choice(), [cond("CLASS", None, "51", "=")], cctx()),
            ch.CONDITION_CLASS_NOT_MET)
    assert ch.check_choice(choice(), [cond("CLASS", None, "51", "!=")], cctx()) == (True, None)
    blocked(ch.check_choice(choice(), [cond("CLASS", None, "50", "=")],
                            cctx(idClass=None)), ch.CONDITION_CLASS_NOT_MET)
    assert ch.check_choice(choice(), [cond("LOCATION", None, "1", "=")], cctx()) == (True, None)
    blocked(ch.check_choice(choice(), [cond("LOCATION", None, "2", "=")], cctx()),
            ch.CONDITION_LOCATION_NOT_MET)


def test_all_in_same_loc():
    row = cond("ALL_IN_SAME_LOC")
    assert ch.check_choice(choice(), [row],
                           cctx(partyLocations=[LOC, LOC, LOC])) == (True, None)
    assert ch.check_choice(choice(), [row], cctx(partyLocations=[])) == (True, None)
    blocked(ch.check_choice(choice(), [row], cctx(partyLocations=[LOC, 999])),
            ch.CONDITION_ALL_IN_SAME_LOC_NOT_MET)
    blocked(ch.check_choice(choice(), [row], cctx(partyLocations=[LOC, None])),
            ch.CONDITION_ALL_IN_SAME_LOC_NOT_MET)
    blocked(ch.check_choice(choice(), [row], cctx(idLocation=None)),
            ch.CONDITION_ALL_IN_SAME_LOC_NOT_MET)


def test_statistics_conditions():
    assert ch.check_choice(choice(), [cond("statistics", "int", "3", "=")], cctx()) == (True, None)
    assert ch.check_choice(choice(), [cond("statistics", "int", "4", "!=")], cctx()) == (True, None)
    assert ch.check_choice(choice(), [cond("statistics", "int", "2", ">")], cctx()) == (True, None)
    assert ch.check_choice(choice(), [cond("statistics", "int", "4", "<")], cctx()) == (True, None)
    assert ch.check_choice(choice(), [cond("STATISTICS", "INT", "2", ">")], cctx()) == (True, None)
    assert ch.check_choice(choice(), [cond("statistics", "coin", "9", ">")], cctx()) == (True, None)
    blocked(ch.check_choice(choice(), [cond("statistics", "int", "99", ">")], cctx()),
            ch.CONDITION_STATISTICS_NOT_MET)
    blocked(ch.check_choice(choice(), [cond("statistics", "charisma", "1", ">")], cctx()),
            ch.CONDITION_STATISTICS_NOT_MET)
    blocked(ch.check_choice(choice(), [cond("statistics", "int", "lots", ">")], cctx()),
            ch.CONDITION_STATISTICS_NOT_MET)


def test_statistics_sum_conditions():
    pooled = cctx(partyStatSums={"int": 12})
    assert ch.check_choice(choice(), [cond("statistics_SUM", "int", "10", ">")],
                           pooled) == (True, None)
    blocked(ch.check_choice(choice(), [cond("statistics_SUM", "int", "12", ">")], pooled),
            ch.CONDITION_STATISTICS_SUM_NOT_MET)
    blocked(ch.check_choice(choice(), [cond("statistics_SUM", "int", "1", ">")], cctx()),
            ch.CONDITION_STATISTICS_SUM_NOT_MET)


def test_logic_operator():
    # AND: the FIRST failing row names the reason; every row must pass.
    blocked(ch.check_choice(choice(), [cond("KEYS", "gate", "OPEN", "="),
                                       cond("statistics", "int", "99", ">")], cctx()),
            ch.CONDITION_KEYS_NOT_MET)
    assert ch.check_choice(choice(), [cond("KEYS", "gate", "OPEN", "="),
                                      cond("statistics", "int", "2", ">")],
                           cctx(registry={"gate": "OPEN"})) == (True, None)
    # OR: one passing row is enough; all failing reports the aggregate.
    c = choice(logicOperator="OR")
    assert ch.check_choice(c, [cond("KEYS", "gate", "OPEN", "="),
                               cond("statistics", "life", "0", ">")], cctx()) == (True, None)
    blocked(ch.check_choice(c, [cond("KEYS", "gate", "OPEN", "="),
                                cond("statistics", "int", "99", ">")], cctx()),
            ch.CONDITIONS_NOT_MET)
    # Case-blind combiner; anything not OR (None included) reads as AND.
    assert ch.check_choice(choice(logicOperator="or"),
                           [cond("KEYS", "gate", "OPEN", "="),
                            cond("statistics", "life", "0", ">")], cctx()) == (True, None)
    blocked(ch.check_choice(choice(logicOperator="XOR"),
                            [cond("KEYS", "gate", "OPEN", "="),
                             cond("statistics", "life", "0", ">")], cctx()),
            ch.CONDITION_KEYS_NOT_MET)
    blocked(ch.check_choice(choice(logicOperator=None),
                            [cond("KEYS", "gate", "OPEN", "=")], cctx()),
            ch.CONDITION_KEYS_NOT_MET)


def test_unknown_types_and_operator_default():
    blocked(ch.check_choice(choice(), [cond("KEYZ", "gate", "OPEN", "=")], cctx()),
            ch.CONDITIONS_NOT_MET)
    blocked(ch.check_choice(choice(), [cond(None, "gate", "OPEN", "=")], cctx()),
            ch.CONDITIONS_NOT_MET)
    # Under OR an unknown row does not pass, but a later valid row can.
    assert ch.check_choice(choice(logicOperator="OR"),
                           [cond("KEYZ", "gate", "OPEN", "="),
                            cond("statistics", "life", "0", ">")], cctx()) == (True, None)
    # A missing operator defaults to =.
    assert ch.check_choice(choice(), [cond("KEYS", "gate", "OPEN", None)],
                           cctx(registry={"gate": "OPEN"})) == (True, None)


# ── Step 32 lookups ─────────────────────────────────────────────────────────

def test_choice_by_uuid_finds_the_option_and_tolerates_a_blank():
    story = {"choices": [{"id": 1, "uuid": "ch-1"}, {"id": 2, "uuid": "ch-2"}]}

    assert ch.choice_by_uuid(story, "ch-2")["id"] == 2
    assert ch.choice_by_uuid(story, "nope") is None
    assert ch.choice_by_uuid(story, None) is None
    assert ch.choice_by_uuid(story, "  ") is None


def test_effects_for_choice_keeps_the_options_rows_in_authored_order():
    story = {"choiceEffects": [
        {"id": 9, "idChoices": 20}, {"id": 2, "idChoices": 20},
        {"id": 5, "idChoices": 21}, {"id": 7, "idChoices": None},
    ]}

    rows = ch.effects_for_choice(story, 20)

    # Authored order, so a later row builds on what an earlier one wrote.
    assert [r["id"] for r in rows] == [2, 9]


def test_choice_recipients_is_location_scoped_under_flag_group():
    """INV-46: the group is who stands where the actor stands, not the whole match."""
    actor = {"uuid": "a", "idLocation": 1}
    here = {"uuid": "b", "idLocation": 1}
    away = {"uuid": "c", "idLocation": 2}
    party = [actor, here, away]

    assert ch.choice_recipients({"flagGroup": 1}, actor, party) == [actor, here]
    assert ch.choice_recipients({"flagGroup": 0}, actor, party) == [actor]
    assert ch.choice_recipients({}, actor, party) == [actor]
    # An unplaced actor has no location to share: the row lands on them alone.
    unplaced = {"uuid": "a", "idLocation": None}
    assert ch.choice_recipients({"flagGroup": 1}, unplaced, party) == [unplaced]
