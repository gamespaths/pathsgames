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
    s["choiceConditions"] = [{"id": 1, "idChoices": 1, "type": "KEY", "key": "MISSING"}]
    assert "R4_CONDITION_KEY" in rules(sv.validate_story_dict(s))


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
