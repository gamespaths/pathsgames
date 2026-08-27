"""Tests for story/story_validator.py (Step 22)."""
from story import story_validator as sv


def valid_story():
    return {
        "uuid": "story-valid",
        "idLocationStart": 1,
        "locations": [{"id": 1}, {"id": 2}],
        "events": [{"id": 1}, {"id": 2, "idEventNext": 1}],
        "items": [{"id": 1}],
        "classes": [{"id": 1}],
        "keys": [{"name": "CHAPTER", "value": "1"}],
        "choices": [{"id": 1, "idEvent": 1, "otherwiseFlag": 1}],
        "locationNeighbors": [{"id": 1, "idLocationFrom": 1, "idLocationTo": 2, "direction": "N"}],
    }


def rules(errors):
    return {e["rule"] for e in errors}


def test_valid_story_passes():
    assert sv.validate_story_dict(valid_story()) == []


def test_empty_reported():
    assert sv.validate_story_dict({})


def test_dangling_location_start():
    s = valid_story()
    s["idLocationStart"] = 99
    assert sv.validate_story_dict(s)


def test_zero_reference_is_none():
    s = valid_story()
    s["idLocationAllPlayerComa"] = 0
    s["idEventAllPlayerComa"] = -1
    assert sv.validate_story_dict(s) == []


def test_neighbor_missing_location():
    s = valid_story()
    s["locationNeighbors"] = [{"id": 1, "idLocationFrom": 1, "idLocationTo": 77, "direction": "N"}]
    assert sv.validate_story_dict(s)


def test_neighbor_self_loop():
    s = valid_story()
    s["locationNeighbors"] = [{"id": 1, "idLocationFrom": 1, "idLocationTo": 1, "direction": "N"}]
    assert "R2_NEIGHBOR_SELF" in rules(sv.validate_story_dict(s))


def test_event_chain_cycle():
    s = valid_story()
    s["events"] = [{"id": 1, "idEventNext": 2}, {"id": 2, "idEventNext": 1}]
    assert "R3_EVENT_CYCLE" in rules(sv.validate_story_dict(s))


def test_long_acyclic_chain_passes():
    s = valid_story()
    s["events"] = [{"id": 1, "idEventNext": 2}, {"id": 2, "idEventNext": 3}, {"id": 3}]
    assert sv.validate_story_dict(s) == []


def test_choice_without_option_or_otherwise():
    s = valid_story()
    s["choices"] = [{"id": 1, "idEvent": 1, "otherwiseFlag": 0}]
    assert "R4_CHOICE_EMPTY" in rules(sv.validate_story_dict(s))


def test_choice_with_effect_passes():
    s = valid_story()
    s["choices"] = [{"id": 1, "idEvent": 1, "otherwiseFlag": 0}]
    s["choiceEffects"] = [{"id": 1, "idChoices": 1}]
    assert sv.validate_story_dict(s) == []


def test_condition_unknown_key():
    s = valid_story()
    s["choiceConditions"] = [{"id": 1, "idChoices": 1, "type": "KEYS", "key": "MISSING"}]
    assert "R4_CONDITION_KEY" in rules(sv.validate_story_dict(s))


def test_condition_non_keys_type_is_not_a_registry_ref():
    # Step 31: on a statistics condition `key` names a STAT, not a registry key — the
    # pre-filter bug would have false-failed every story using the condition vocabulary.
    s = valid_story()
    s["choiceConditions"] = [
        {"id": 1, "idChoices": 1, "type": "statistics", "key": "int", "value": "3", "operator": ">"},
        {"id": 2, "idChoices": 1, "type": "traits", "key": "9"},
    ]
    assert sv.validate_story_dict(s) == []


def test_r8_choice_without_event_fails():
    s = valid_story()
    s["choices"] = [{"id": 1, "otherwiseFlag": 1}]
    errors = sv.validate_story_dict(s)
    assert any(e["rule"] == "R8_CHOICE_EVENT" and e["field"] == "idEvent" for e in errors)


def test_r8_choice_with_location_fails():
    # The location EXISTS, so only R8 can complain — the binding itself is deprecated.
    s = valid_story()
    s["choices"] = [{"id": 1, "idEvent": 1, "idLocation": 1, "otherwiseFlag": 1}]
    errors = sv.validate_story_dict(s)
    assert any(e["rule"] == "R8_CHOICE_EVENT" and e["field"] == "idLocation" for e in errors)


def test_r8_non_positive_location_reads_as_none():
    s = valid_story()
    s["choices"] = [{"id": 1, "idEvent": 1, "idLocation": 0, "otherwiseFlag": 1}]
    assert sv.validate_story_dict(s) == []


def test_r8_crud_local_tolerates_a_draft_without_event():
    # The lenient CRUD path: {priority: 1} must stay creatable while authoring.
    assert sv.validate_entity("choices", {"priority": 1}) == []


def test_r8_crud_local_rejects_a_location():
    errors = sv.validate_entity("choices", {"id": 1, "idEvent": 1, "idLocation": 5})
    assert any(e["rule"] == "R8_CHOICE_EVENT" and e["field"] == "idLocation" for e in errors)


# ── R9 automatic location events (Step 33) ───────────────────────────────────
# Both rules are about events a list_locations.id_event_* column names. The engine fires
# those without a player: nobody pays, nobody is asked anything, and the response they
# would answer does not exist.

def test_r9_trigger_pointing_at_a_choice_owning_event_fails():
    s = valid_story()
    # Event 1 owns choice 1 in the fixture; location 2 tries to fire it on entry.
    s["locations"] = [{"id": 1}, {"id": 2, "idEventIfFirstTime": 1}]
    errors = sv.validate_story_dict(s)
    assert any(e["rule"] == "R9_AUTOMATIC_EVENT_CHOICES"
               and e["field"] == "idEventIfFirstTime" for e in errors)


def test_r9_trigger_pointing_at_a_player_executable_event_fails():
    s = valid_story()
    s["events"] = [{"id": 1}, {"id": 2, "type": "NORMAL"}]
    s["choices"] = []
    s["locations"] = [{"id": 1}, {"id": 2, "idEventNotFirstTime": 2}]
    errors = sv.validate_story_dict(s)
    assert any(e["rule"] == "R9_AUTOMATIC_EVENT_TYPE"
               and e["field"] == "idEventNotFirstTime" for e in errors)


def test_r9_an_automatic_event_without_choices_is_valid():
    s = valid_story()
    s["events"] = [{"id": 1}, {"id": 2, "type": "AUTOMATIC"}]
    s["choices"] = []
    s["locations"] = [{"id": 1}, {"id": 2, "idEventIfFirstTime": 2,
                                  "idEventNotFirstTime": 2,
                                  "idEventIfCharacterEnterEmptyLocation": 2,
                                  "idEventIfCounterZero": 2,
                                  "idEventIfCharacterStartTime": 2}]
    assert sv.validate_story_dict(s) == []


def test_r9_a_dangling_trigger_is_a_broken_reference():
    s = valid_story()
    s["locations"] = [{"id": 1}, {"id": 2, "idEventIfCounterZero": 999}]
    errors = sv.validate_story_dict(s)
    assert errors
    assert any(e["field"] == "idEventIfCounterZero" for e in errors)


def test_r9_a_non_positive_trigger_is_no_trigger():
    s = valid_story()
    s["choices"] = []
    s["locations"] = [{"id": 1}, {"id": 2, "idEventIfFirstTime": 0,
                                  "idEventNotFirstTime": 0}]
    assert sv.validate_story_dict(s) == []


def test_item_refers_missing_class():
    s = valid_story()
    s["items"] = [{"id": 1, "idClassPermitted": 9}]
    assert sv.validate_story_dict(s)


def test_template_negative_stat():
    s = valid_story()
    s["characterTemplates"] = [{"id": 1, "lifeMax": 10, "energyMax": 10, "dexterityStart": -3}]
    assert "R6_STAT_RANGE" in rules(sv.validate_story_dict(s))


def test_template_permitted_equals_prohibited():
    s = valid_story()
    s["characterTemplates"] = [{"id": 1, "lifeMax": 10, "energyMax": 10, "idClassPermitted": 1, "idClassProhibited": 1}]
    assert "R6_CLASS_CONFLICT" in rules(sv.validate_story_dict(s))


# entity-local (lenient CRUD)

def test_forward_class_reference_allowed():
    assert sv.validate_entity("items", {"id": 1, "idClassPermitted": 999}) == []


def test_bad_stat_range_rejected():
    assert sv.validate_entity("character-templates", {"id": 1, "lifeMax": -5, "energyMax": 10})


def test_class_conflict_rejected():
    assert sv.validate_entity("traits", {"id": 1, "idClassPermitted": 3, "idClassProhibited": 3})


def test_difficulty_range_rejected():
    assert sv.validate_entity("difficulties", {"id": 1, "minCharacter": 4, "maxCharacter": 2})


def test_unknown_entity_type_is_valid():
    assert sv.validate_entity("locations", {"id": 1}) == []


def test_summary_compact():
    errs = sv.validate_story_dict({"idLocationStart": 5, "events": [], "locations": []})
    assert "non-existent" in sv.summary(errs)


# ── extra coverage: helpers, collectors and entity-local rules ─────────────────

def test_helpers_field_asint_truthy_summary():
    assert sv._field("not-a-dict", "id") is None
    # snake_case fallback when camelCase key is absent
    assert sv._field({"id_event_next": 5}, "idEventNext") == 5
    assert sv._as_int(True) == 1 and sv._as_int(2.9) == 2
    assert sv._as_int("7") == 7 and sv._as_int("x") is None and sv._as_int([1]) is None
    assert sv._truthy("true") is True and sv._truthy("no") is False
    assert sv.summary([]) == "story is valid"
    many = [{"message": f"m{i}"} for i in range(7)]
    assert "(+2 more)" in sv.summary(many)


def test_all_collectors_flag_broken_references():
    s = valid_story()
    s.update({
        "choiceConditions": [{"id": 1, "idChoices": 999, "key": "K"}],
        "eventEffects": [{"id": 1, "idEvent": 999, "idItemTarget": 999, "targetClass": 999}],
        "itemEffects": [{"id": 1, "idItem": 999}],
        "classBonuses": [{"id": 1, "idClass": 999}],
        "missions": [{"id": 1}],
        "missionSteps": [{"id": 1, "idMission": 999}],
        "weatherRules": [{"id": 1, "idEvent": 999}],
        "globalRandomEvents": [{"id": 1, "idEvent": 999}],
        "items": [{"id": 1, "idClassPermitted": 1, "idClassProhibited": 1}],
        "traits": [{"id": 1, "idClassPermitted": 999}],
        "characterTemplates": [{"idTipo": 1, "lifeMax": 5, "idClassPermitted": 999}],
    })
    errors = sv.validate_story_dict(s)
    assert len(errors) >= 5  # several dangling references reported


def test_validate_entity_local_rules():
    # negative/zero stats on a character template are flagged
    bad = sv.validate_entity("character-templates",
                             {"id": 1, "lifeMax": 0, "dexterityStart": -1})
    assert any(e["rule"] == "R6_STAT_RANGE" for e in bad)
    # empty inputs are lenient
    assert sv.validate_entity("", {}) == []
    assert sv.validate_entity("items", None) == []


# ── choice-effect references (v0.32.0 resolution targets) ───────────────────

def test_dangling_choice_effect_targets_are_reported():
    """Every new target is checked against the story it names.

    idWeather is deliberately absent: this validator has no weather target, exactly as
    for the event effects.
    """
    for field in ("idEvent", "idLocation", "idItemTarget"):
        s = valid_story()
        s["choiceEffects"] = [{"id": 1, "idChoices": 1, field: 99}]
        errors = sv.validate_story_dict(s)
        assert errors, f"{field} should not validate"
        assert any(e["field"] == field for e in errors), \
            f"{field} missing from: {[e['field'] for e in errors]}"


def test_real_choice_effect_targets_pass():
    s = valid_story()
    s["choiceEffects"] = [{"id": 1, "idChoices": 1, "idEvent": 2, "idLocation": 2,
                           "idWeather": 1, "idItemTarget": 1, "itemAction": "ADD"}]
    assert sv.validate_story_dict(s) == []
