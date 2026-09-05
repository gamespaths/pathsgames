"""Tests for StoryValidatorService (Step 22)."""
from unittest.mock import MagicMock

import pytest

from app.core.services.story.story_validator_service import StoryValidatorService


def validator():
    return StoryValidatorService(MagicMock())


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


def rules(report):
    return {e.rule for e in report.errors}


def test_valid_story_passes():
    assert validator().validate_import_data(valid_story()).is_valid()


def test_empty_reported():
    assert not validator().validate_import_data(None).is_valid()
    assert not validator().validate_import_data({}).is_valid()


def test_dangling_location_start():
    s = valid_story()
    s["idLocationStart"] = 99
    assert not validator().validate_import_data(s).is_valid()


def test_zero_reference_is_none():
    s = valid_story()
    s["idLocationAllPlayerComa"] = 0
    s["idEventAllPlayerComa"] = -1
    assert validator().validate_import_data(s).is_valid()


def test_neighbor_missing_location():
    s = valid_story()
    s["locationNeighbors"] = [{"id": 1, "idLocationFrom": 1, "idLocationTo": 77, "direction": "N"}]
    assert not validator().validate_import_data(s).is_valid()


def test_neighbor_self_loop():
    s = valid_story()
    s["locationNeighbors"] = [{"id": 1, "idLocationFrom": 1, "idLocationTo": 1, "direction": "N"}]
    assert "R2_NEIGHBOR_SELF" in rules(validator().validate_import_data(s))


def test_neighbor_blank_direction():
    s = valid_story()
    s["locationNeighbors"] = [{"id": 1, "idLocationFrom": 1, "idLocationTo": 2, "direction": ""}]
    assert "R2_NEIGHBOR_DIR" in rules(validator().validate_import_data(s))


def test_neighbor_duplicate_direction():
    s = valid_story()
    s["locationNeighbors"] = [
        {"id": 1, "idLocationFrom": 1, "idLocationTo": 2, "direction": "N"},
        {"id": 2, "idLocationFrom": 1, "idLocationTo": 1, "direction": "N"},
    ]
    assert "R2_NEIGHBOR_DUP" in rules(validator().validate_import_data(s))


def test_event_refers_missing_location():
    s = valid_story()
    s["events"] = [{"id": 1, "idSpecificLocation": 50}]
    assert not validator().validate_import_data(s).is_valid()


def test_event_chain_cycle():
    s = valid_story()
    s["events"] = [{"id": 1, "idEventNext": 2}, {"id": 2, "idEventNext": 1}]
    assert "R3_EVENT_CYCLE" in rules(validator().validate_import_data(s))


def test_event_self_cycle():
    s = valid_story()
    s["events"] = [{"id": 1, "idEventNext": 1}]
    assert "R3_EVENT_CYCLE" in rules(validator().validate_import_data(s))


def test_long_acyclic_chain_passes():
    s = valid_story()
    s["events"] = [{"id": 1, "idEventNext": 2}, {"id": 2, "idEventNext": 3}, {"id": 3}]
    assert validator().validate_import_data(s).is_valid()


def test_choice_without_option_or_otherwise():
    s = valid_story()
    s["choices"] = [{"id": 1, "idEvent": 1, "otherwiseFlag": 0}]
    assert "R4_CHOICE_EMPTY" in rules(validator().validate_import_data(s))


def test_choice_with_effect_passes():
    s = valid_story()
    s["choices"] = [{"id": 1, "idEvent": 1, "otherwiseFlag": 0}]
    s["choiceEffects"] = [{"id": 1, "idChoices": 1}]
    assert validator().validate_import_data(s).is_valid()


def test_choice_refers_missing_event():
    s = valid_story()
    s["choices"] = [{"id": 1, "idEvent": 88, "otherwiseFlag": 1}]
    assert not validator().validate_import_data(s).is_valid()


def test_condition_unknown_key():
    s = valid_story()
    s["choiceConditions"] = [{"id": 1, "idChoices": 1, "type": "KEYS", "key": "MISSING"}]
    assert "R4_CONDITION_KEY" in rules(validator().validate_import_data(s))


def test_condition_non_keys_type_is_not_a_registry_ref():
    # Step 31: on a statistics condition `key` names a STAT, not a registry key — the
    # pre-filter bug would have false-failed every story using the condition vocabulary.
    s = valid_story()
    s["choiceConditions"] = [
        {"id": 1, "idChoices": 1, "type": "statistics", "key": "int", "value": "3", "operator": ">"},
        {"id": 2, "idChoices": 1, "type": "traits", "key": "9"},
    ]
    assert validator().validate_import_data(s).is_valid()


def test_condition_known_key_passes():
    s = valid_story()
    s["choiceConditions"] = [{"id": 1, "idChoices": 1, "type": "KEYS", "key": "chapter"}]
    assert validator().validate_import_data(s).is_valid()


def test_item_refers_missing_class():
    s = valid_story()
    s["items"] = [{"id": 1, "idClassPermitted": 9}]
    assert not validator().validate_import_data(s).is_valid()


def test_template_negative_stat():
    s = valid_story()
    s["characterTemplates"] = [{"id": 1, "lifeMax": 10, "energyMax": 10, "dexterityStart": -3}]
    assert "R6_STAT_RANGE" in rules(validator().validate_import_data(s))


def test_template_permitted_equals_prohibited():
    s = valid_story()
    s["characterTemplates"] = [{"id": 1, "lifeMax": 10, "energyMax": 10,
                                "idClassPermitted": 1, "idClassProhibited": 1}]
    assert "R6_CLASS_CONFLICT" in rules(validator().validate_import_data(s))


def test_mission_step_missing_mission():
    s = valid_story()
    s["missionSteps"] = [{"id": 1, "idMission": 5}]
    assert not validator().validate_import_data(s).is_valid()


# ----- entity-local (lenient CRUD) -----

def test_forward_class_reference_allowed():
    assert validator().validate_entity("items", {"id": 1, "idClassPermitted": 999}).is_valid()


def test_bad_stat_range_rejected():
    assert not validator().validate_entity("character-templates", {"id": 1, "lifeMax": -5, "energyMax": 10}).is_valid()


def test_class_conflict_rejected():
    assert not validator().validate_entity("traits", {"id": 1, "idClassPermitted": 3, "idClassProhibited": 3}).is_valid()


def test_difficulty_range_rejected():
    assert not validator().validate_entity("difficulties", {"id": 1, "minCharacter": 4, "maxCharacter": 2}).is_valid()


def test_unknown_entity_type_is_valid():
    assert validator().validate_entity("locations", {"id": 1}).is_valid()
    assert validator().validate_entity(None, {"id": 1}).is_valid()


# ----- validate_story via read port (snake_case rows) -----

def test_r8_choice_without_event_fails():
    s = valid_story()
    s["choices"] = [{"id": 1, "otherwiseFlag": 1}]
    report = validator().validate_import_data(s)
    assert any(e.rule == "R8_CHOICE_EVENT" and e.field_name == "idEvent"
               for e in report.errors)


def test_r8_choice_with_location_fails():
    # Location 1 exists, so only R8 can complain — the binding itself is deprecated.
    s = valid_story()
    s["choices"] = [{"id": 1, "idEvent": 1, "idLocation": 1, "otherwiseFlag": 1}]
    report = validator().validate_import_data(s)
    assert any(e.rule == "R8_CHOICE_EVENT" and e.field_name == "idLocation"
               for e in report.errors)


def test_r8_non_positive_location_reads_as_none():
    s = valid_story()
    s["choices"] = [{"id": 1, "idEvent": 1, "idLocation": 0, "otherwiseFlag": 1}]
    assert validator().validate_import_data(s).is_valid()


def test_r8_crud_local_tolerates_a_draft_without_event():
    # The lenient CRUD path: {priority: 1} must stay creatable while authoring.
    assert validator().validate_entity("choices", {"priority": 1}).is_valid()


def test_r8_crud_local_rejects_a_location():
    report = validator().validate_entity("choices", {"id": 1, "idEvent": 1, "idLocation": 5})
    assert any(e.rule == "R8_CHOICE_EVENT" and e.field_name == "idLocation"
               for e in report.errors)


# ----- R9 automatic location events (Step 33) -----
# Both rules are about events a list_locations.id_event_* column names. The engine fires
# those without a player: nobody pays for them, nobody is asked anything, and the response
# they would answer does not exist.

def test_r9_trigger_pointing_at_a_choice_owning_event_fails():
    s = valid_story()
    # Event 1 owns choice 1 in the fixture; location 2 tries to fire it on entry.
    s["locations"] = [{"id": 1}, {"id": 2, "idEventIfFirstTime": 1}]
    report = validator().validate_import_data(s)
    assert any(e.rule == "R9_AUTOMATIC_EVENT_CHOICES" and e.field_name == "idEventIfFirstTime"
               for e in report.errors), \
        "an automatic event has no one to ask and no response to ask in"


def test_r9_trigger_pointing_at_a_player_executable_event_fails():
    s = valid_story()
    s["events"] = [{"id": 1}, {"id": 2, "type": "NORMAL"}]
    s["choices"] = []
    s["locations"] = [{"id": 1}, {"id": 2, "idEventNotFirstTime": 2}]
    report = validator().validate_import_data(s)
    assert any(e.rule == "R9_AUTOMATIC_EVENT_TYPE" and e.field_name == "idEventNotFirstTime"
               for e in report.errors), \
        "the event would be offered as an action AND fire by itself"


def test_r9_an_automatic_event_without_choices_is_valid():
    s = valid_story()
    s["events"] = [{"id": 1}, {"id": 2, "type": "AUTOMATIC"}]
    s["choices"] = []
    s["locations"] = [{"id": 1}, {"id": 2, "idEventIfFirstTime": 2,
                                  "idEventNotFirstTime": 2,
                                  "idEventIfCharacterEnterEmptyLocation": 2,
                                  "idEventIfCounterZero": 2,
                                  "idEventIfCharacterStartTime": 2}]
    assert validator().validate_import_data(s).is_valid()


def test_r9_a_dangling_trigger_is_a_broken_reference():
    s = valid_story()
    s["locations"] = [{"id": 1}, {"id": 2, "idEventIfCounterZero": 999}]
    report = validator().validate_import_data(s)
    assert not report.is_valid()
    assert any(e.field_name == "idEventIfCounterZero" for e in report.errors)


def test_r9_a_non_positive_trigger_is_no_trigger():
    s = valid_story()
    s["choices"] = []
    s["locations"] = [{"id": 1}, {"id": 2, "idEventIfFirstTime": 0,
                                  "idEventNotFirstTime": 0}]
    assert validator().validate_import_data(s).is_valid()


def test_validate_story_null_id():
    assert not validator().validate_story(None).is_valid()


def test_validate_story_broken_choice_event_from_db():
    rp = MagicMock()
    rp.find_locations_for_story.return_value = [{"id": 1}]
    rp.find_events_for_story.return_value = [{"id": 1}]
    rp.find_items_for_story.return_value = []
    rp.find_classes_for_story.return_value = []
    rp.find_class_bonuses_for_story.return_value = []
    rp.find_traits_for_story.return_value = []
    rp.find_character_templates_for_story.return_value = []

    def entities(_sid, table):
        if table == "list_choices":
            return [{"id": 1, "id_event": 55, "otherwise_flag": 1}]  # snake_case + dangling event
        return []

    rp.find_entities_for_story.side_effect = entities
    report = StoryValidatorService(rp).validate_story(7)
    assert not report.is_valid()
    assert any(e.field_name == "idEvent" for e in report.errors)


def test_validate_story_by_uuid_not_found():
    rp = MagicMock()
    rp.find_story_by_uuid.return_value = None
    assert StoryValidatorService(rp).validate_story_by_uuid("ghost") is None


# ── choice-effect references (v0.32.0 resolution targets) ───────────────────

@pytest.mark.parametrize("field", ["idEvent", "idLocation", "idItemTarget"])
def test_dangling_choice_effect_target_is_reported(field):
    """Every new target is checked against the story it names.

    idWeather is deliberately absent: this validator has no weather target, exactly as
    for the event effects.
    """
    s = valid_story()
    s["choiceEffects"] = [{"id": 1, "idChoices": 1, field: 99}]
    report = validator().validate_import_data(s)
    assert not report.is_valid(), f"{field} should not validate"
    assert any(e.field_name == field for e in report.errors), \
        f"{field} missing from: {[e.field_name for e in report.errors]}"


def test_real_choice_effect_targets_pass():
    s = valid_story()
    s["choiceEffects"] = [{"id": 1, "idChoices": 1, "idEvent": 2, "idLocation": 2,
                           "idWeather": 1, "idItemTarget": 1, "itemAction": "ADD"}]
    report = validator().validate_import_data(s)
    assert report.is_valid(), f"expected valid, got: {[e.field_name for e in report.errors]}"


# ── the collections only the richer payloads carry ───────────────────────────

def test_item_effects_class_bonuses_missions_and_weather_are_checked():
    s = valid_story()
    s["missions"] = [{"id": 1}]
    s["traits"] = [{"id": 1}]
    s["itemEffects"] = [{"id": 1, "idItem": 1, "traitsToAdd": "1", "traitsToRemove": " 1 , "}]
    s["classBonuses"] = [{"id": 1, "idClass": 1}]
    s["missionSteps"] = [{"id": 1, "idMission": 1}]
    s["weatherRules"] = [{"id": 1, "idEvent": 1}]
    s["globalRandomEvents"] = [{"id": 1, "idEvent": 1}]
    assert validator().validate_import_data(s).is_valid()


def test_dangling_refs_in_those_collections_are_reported():
    s = valid_story()
    s["missions"] = [{"id": 1}]
    s["traits"] = [{"id": 1}]
    s["itemEffects"] = [{"id": 1, "idItem": 99, "traitsToAdd": "99"}]
    s["classBonuses"] = [{"id": 1, "idClass": 99}]
    s["missionSteps"] = [{"id": 1, "idMission": 99}]
    s["weatherRules"] = [{"id": 1, "idEvent": 99}]
    s["globalRandomEvents"] = [{"id": 1, "idEvent": 99}]
    report = validator().validate_import_data(s)
    assert not report.is_valid()
    fields = {e.field_name for e in report.errors}
    assert {"idItem", "traitsToAdd", "idClass", "idMission", "idEvent"} <= fields


def test_trait_csv_skips_blank_and_non_numeric_entries():
    s = valid_story()
    s["traits"] = [{"id": 1}]
    s["itemEffects"] = [{"id": 1, "idItem": 1, "traitsToAdd": " , 1 ,,", "traitsToRemove": "ALL"}]
    assert validator().validate_import_data(s).is_valid()


def test_trait_csv_absent_or_blank_is_not_a_reference():
    s = valid_story()
    s["itemEffects"] = [{"id": 1, "idItem": 1, "traitsToAdd": None, "traitsToRemove": "   "}]
    assert validator().validate_import_data(s).is_valid()


def test_traits_and_items_carry_class_restrictions():
    s = valid_story()
    s["traits"] = [{"id": 1, "idClassPermitted": 1, "idClassProhibited": 1}]
    s["items"] = [{"id": 1, "idClassPermitted": 99}]
    report = validator().validate_import_data(s)
    assert not report.is_valid()


def test_event_effects_are_checked_on_the_import_payload():
    s = valid_story()
    s["traits"] = [{"id": 1}]
    s["eventEffects"] = [{"id": 1, "idEvent": 1, "traitsToAdd": "1"}]
    assert validator().validate_import_data(s).is_valid()

    s["eventEffects"] = [{"id": 1, "idEvent": 99, "traitsToAdd": "99"}]
    report = validator().validate_import_data(s)
    assert not report.is_valid()
