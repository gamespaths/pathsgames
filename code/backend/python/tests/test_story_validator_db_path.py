"""Coverage for the DB-backed validation path of StoryValidatorService (Step 22)
plus the small value-coercion helpers. The JSON path is covered separately in
test_story_validator_service.py; here we drive `validate_story` /
`validate_story_by_uuid` through a fake read port so `_build_from_db` and the
collectors run against the relational shape."""
from unittest.mock import MagicMock

from app.core.services.story.story_validator_service import (
    StoryValidatorService,
    _as_int,
    _truthy,
    _camel_to_snake,
)


# ── pure helpers ───────────────────────────────────────────────────────────────

def test_as_int_handles_all_types():
    assert _as_int(True) == 1
    assert _as_int(5) == 5
    assert _as_int(5.9) == 5
    assert _as_int("7") == 7
    assert _as_int(" 8 ") == 8
    assert _as_int("x") is None
    assert _as_int(None) is None
    assert _as_int([1]) is None


def test_truthy():
    assert _truthy(1) is True
    assert _truthy(0) is False
    assert _truthy("true") is True
    assert _truthy(True) is True
    assert _truthy("nope") is False


def test_camel_to_snake():
    assert _camel_to_snake("idEventNext") == "id_event_next"
    assert _camel_to_snake("idLocation") == "id_location"


# ── DB-backed validation path ───────────────────────────────────────────────────

class _FakeReadPort:
    """A read port returning the relational rows for one small, valid story."""

    def __init__(self, tables):
        self._tables = tables

    def find_story_by_uuid(self, uuid):
        return {"id": 1, "uuid": uuid} if uuid == "known" else None

    def find_locations_for_story(self, sid):
        return self._tables["list_locations"]

    def find_events_for_story(self, sid):
        return self._tables["list_events"]

    def find_items_for_story(self, sid):
        return self._tables["list_items"]

    def find_classes_for_story(self, sid):
        return self._tables["list_classes"]

    def find_class_bonuses_for_story(self, sid):
        return self._tables["list_class_bonuses"]

    def find_traits_for_story(self, sid):
        return self._tables["list_traits"]

    def find_character_templates_for_story(self, sid):
        return self._tables["list_character_templates"]

    def find_entities_for_story(self, sid, table_name):
        return self._tables.get(table_name, [])


def _tables():
    return {
        "list_locations": [{"id": 1}, {"id": 2}],
        "list_events": [{"id": 1}, {"id": 2, "idEventNext": 1}],
        "list_items": [{"id": 1, "idClassPermitted": None, "idClassProhibited": None}],
        "list_classes": [{"id": 1}],
        "list_class_bonuses": [{"id": 1, "idClass": 1}],
        "list_traits": [{"id": 1, "idClassPermitted": None, "idClassProhibited": None}],
        "list_character_templates": [{"idTipo": 1}],
        "list_choices": [{"id": 1, "idEvent": 1, "idLocation": 1, "otherwiseFlag": 1}],
        "list_missions": [{"id": 1}],
        "list_keys": [{"name": "CHAPTER", "value": "1"}],
        "list_choices_effects": [{"id": 1, "idChoices": 1}],
        "list_choices_conditions": [{"id": 1, "idChoices": 1, "type": "KEY", "key": "CHAPTER"}],
        "list_events_effects": [{"id": 1, "idEvent": 1}],
        "list_items_effects": [{"id": 1, "idItem": 1}],
        "list_missions_steps": [{"id": 1, "idMission": 1}],
        "list_weather_rules": [{"id": 1, "idEvent": 1}],
        "list_global_random_events": [{"id": 1, "idEvent": 1}],
        "list_locations_neighbors": [{"id": 1, "idLocationFrom": 1, "idLocationTo": 2, "direction": "N"}],
    }


def test_validate_story_db_path_runs_all_collectors():
    svc = StoryValidatorService(_FakeReadPort(_tables()))
    report = svc.validate_story(1)
    # all references resolve → a valid report
    assert report.is_valid() is True
    assert len(report.errors) == 0


def test_validate_story_db_path_flags_broken_reference():
    tables = _tables()
    tables["list_events"] = [{"id": 1, "idEventNext": 999}]  # dangling next-event ref
    svc = StoryValidatorService(_FakeReadPort(tables))
    report = svc.validate_story(1)
    assert report.is_valid() is False
    assert len(report.errors) >= 1


def test_validate_story_by_uuid_returns_none_when_missing():
    svc = StoryValidatorService(_FakeReadPort(_tables()))
    assert svc.validate_story_by_uuid("unknown") is None


def test_validate_story_by_uuid_validates_known_story():
    svc = StoryValidatorService(_FakeReadPort(_tables()))
    report = svc.validate_story_by_uuid("known")
    assert report is not None
