"""v0.41.4 Step 41 H.2.6 — canonical JSON on the vectors shared with java/aws, the schema validator on the
bundled match-export-v1 schema, the log type mapper (H.2.3) and the story exporter and fingerprint."""
import json
from pathlib import Path
from unittest.mock import MagicMock

from app.core.services.match import canonical_json, log_type_mapper as ltm
from app.core.services.match.schema_validator import SCHEMA_FILE, SchemaValidator, has_type, is_integer
from app.core.services.story import story_fingerprint
from app.core.services.story.story_export_service import ENTITY_TYPES, StoryExportService, _as_int
from match_export_samples import document, vectors

OPENAPI = (Path(__file__).resolve().parents[2] / "java" / "adapter-rest" / "src" / "main" / "resources"
           / "openapi" / "match-export-v1.schema.json")


def test_shared_vectors_give_the_same_text_and_checksum():
    rows = vectors()
    assert len(rows) == 8
    for v in rows:
        value = json.loads(v["input"])
        assert canonical_json.write(value) == v["canonical"], v["name"]
        assert canonical_json.sha256(value) == v["sha256"], v["name"]


def test_canonical_helpers():
    from decimal import Decimal
    assert canonical_json.write({"a": None, "b": (1, Decimal("2"), Decimal("2.5"))}) == '{"b":[1,2,2.5]}'
    assert canonical_json.size({"é": 1}) == len('{"é":1}'.encode("utf-8"))
    assert canonical_json.parse(None) is None
    assert canonical_json.parse("{bad") is None
    assert canonical_json.parse("[1]") == [1]
    assert canonical_json.sha256_hex("") == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"


def test_the_bundled_schema_is_the_openapi_one():
    assert json.loads(SCHEMA_FILE.read_text()) == json.loads(OPENAPI.read_text())


def test_the_sample_is_valid_and_every_problem_is_reported():
    validator = SchemaValidator.match_export_v1()
    assert validator.validate(document()) == []
    doc = document()
    doc["format"] = "other"
    doc["extra"] = 1
    del doc["logs"]
    doc["match"].update({"uuid": "NOT-A-UUID", "difficultyId": 0, "status": "LOST", "singlePlayer": "yes"})
    doc["users"] = []
    doc["engine"]["visitedLocationIds"] = [1, 1]
    text = "\n".join(validator.validate(doc))
    for part in ("must be paths-games-match-export", "unknown property extra", "missing logs", "does not match",
                 "must be >= 1", "must be one of", "must be boolean", "needs at least 1 items",
                 "items are not unique"):
        assert part in text, part


def test_validator_edges():
    validator = SchemaValidator.match_export_v1()
    doc = document()
    doc["logs"] = [{"type": "NOPE"}] * 30
    assert len(validator.validate(doc)) == 20
    assert is_integer(1) and not is_integer(True) and not is_integer(1.0)
    assert has_type("number", 1.5) and not has_type("number", True) and has_type("null", None)
    const = SchemaValidator({"const": 1})
    assert const.validate(1) == [] and len(const.validate(1.0)) == 1 and len(const.validate("1")) == 1
    assert SchemaValidator({"$ref": "elsewhere"}).validate("x") == []


def test_log_type_mapper_classifies_strips_and_restores():
    cases = {None: None, "ACTION_SLEEP": "SLEEP", "EVENT_EXECUTED 13": "EVENT", "CHOICE_SELECTED 13": "CHOICE",
             "counter zero": "COUNTER_ZERO", "automatic event 4": "AUTOMATIC_EVENT", "random event 5": "RANDOM_EVENT",
             "REGISTRY_CHANGE k": "REGISTRY_CHANGE", "MISSION_CHANGE u": "MISSION_CHANGE", "EXP_USE dex": "EXP_USE",
             "recovery safe": "RECOVERY", "ACTION_PASS": "PASS", "COMA c 1": "EDGE_STATE",
             "TRAIT_ADD t": "TRAIT_CHANGE", "TRAIT_REMOVE t": "TRAIT_CHANGE", "MATCH_STARTED": "MATCH_LIFECYCLE",
             "ADMIN_PAUSE": "ADMIN_ACTION", "something": "OTHER"}
    for msg, expected in cases.items():
        assert ltm.event_type(msg) == expected, msg
    assert ltm.timeline_message("EVENT", None) is None and ltm.timeline_message(None, "x") is None
    assert ltm.timeline_message("SLEEP", "ACTION_SLEEP") is None
    assert ltm.timeline_message("EDGE_STATE", "COMA c 1") == "COMA"
    assert ltm.timeline_message("TRAIT_CHANGE", "TRAIT_ADD t") == "ADD t"
    assert ltm.timeline_message("MATCH_LIFECYCLE", "MATCH_STARTED") == "STARTED"
    assert ltm.timeline_message("ADMIN_ACTION", "ADMIN_PAUSE") == "PAUSE"
    assert ltm.timeline_message("EVENT", "EVENT_EXECUTED 1") == "EVENT_EXECUTED 1"
    assert ltm.stored_message("SLEEP", None) == "ACTION_SLEEP"
    assert ltm.stored_message("EVENT", "EVENT_EXECUTED 13") == "EVENT_EXECUTED 13"
    assert ltm.stored_message("EVENT", "13") == "EVENT_EXECUTED 13"
    assert ltm.stored_message("TRAIT_CHANGE", "ADD t") == "TRAIT_ADD t"
    assert ltm.stored_message("ADMIN_ACTION", "IMPORTED x clock=2") == "ADMIN_IMPORTED x clock=2"
    assert ltm.stored_message("EDGE_STATE", "COMA") == "COMA"
    assert ltm.stored_message("EDGE_STATE", " ") == "IMPORTED_UNCOUNTED"
    assert ltm.stored_message("OTHER", "free") == "free"
    assert ltm.stored_message("OTHER", None) == "IMPORTED_UNCOUNTED"
    assert ltm.stored_message("OTHER", "EVENT_EXECUTED 1") == "IMPORTED_UNCOUNTED EVENT_EXECUTED 1"
    assert ltm.is_event_row("OTHER") and ltm.is_event_row("PASS") and not ltm.is_event_row("MOVEMENT")
    assert not ltm.is_event_row(None)
    assert ltm.item_type(None) == "ITEM_USE" and ltm.item_type(" add ") == "ITEM_ADD"
    assert ltm.item_type("REMOVE") == "ITEM_DROP" and ltm.item_type("TRADE") is None


def test_story_export_is_the_react_admin_shape():
    crud = MagicMock()
    crud.get_story.side_effect = lambda u: {"uuid": "s1", "id": 9, "author": None, "tsInsert": "t"} if u == "s1" else None
    lists = {"texts": [{"idText": "10", "lang": "en", "shortText": "T", "tsInsert": "x", "idStory": 9,
                        "longText": None}],
             "character-templates": [{"idTipo": 1, "uuid": "tpl"}], "classes": None}
    crud.list_entities.side_effect = lambda u, t: lists.get(t, [])
    data = StoryExportService(crud).export_story("s1")
    assert len(ENTITY_TYPES) == 22
    assert "tsInsert" not in data and "author" not in data
    assert data["texts"] == [{"idText": 10, "lang": "en", "shortText": "T", "id": 10}]
    assert data["characterTemplates"] == [{"idTipo": 1, "uuid": "tpl", "id": 1}]
    assert data["classes"] == [] and "missionSteps" in data
    assert StoryExportService(crud).export_story("other") is None
    assert _as_int("x") is None


def test_fingerprint_ignores_uuids_stamps_order_and_the_server_id():
    a = {"uuid": "s1", "id": 9, "idStory": 9, "title": "x",
         "texts": [{"idText": 2, "lang": "it"}, {"idText": 2, "lang": "en"}, {"idText": 1, "lang": "en"}],
         "locations": [{"id": 2, "uuid": "b"}, {"id": 1, "uuid": "a", "tsInsert": "t"}],
         "events": [{"name": "b"}, {"name": "a"}], "tags": ["z", "a"]}
    b = {"title": "x", "id": 1, "uuid": "other",
         "texts": [{"idText": 1, "lang": "en"}, {"idText": 2, "lang": "en"}, {"idText": 2, "lang": "it"}],
         "locations": [{"id": 1, "uuid": "c"}, {"id": 2, "uuid": "d", "note": None}],
         "events": [{"name": "a"}, {"name": "b"}], "tags": ["z", "a"]}
    assert story_fingerprint.of(a) == story_fingerprint.of(b)
    b["title"] = "y"
    assert story_fingerprint.of(a) != story_fingerprint.of(b)
    assert "id" not in story_fingerprint.projection(a)
    assert len(story_fingerprint.of(None)) == 64
    rows = story_fingerprint.projection({"rows": [{"id": "b"}, {"id": 2}, {"id": "a"}, {}, {"id": True}]})["rows"]
    assert rows == [{}, {"id": 2}, {"id": "a"}, {"id": "b"}, {"id": True}]
