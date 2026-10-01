"""v0.41.4 Step 41 H — the export sequence (decisions 45, 58) and the import check/write (H.5) on fakes:
every status, every error and warning code, story modes, time-start failure; plus the admin routes."""
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.rest.match.match_export_admin_controller import MatchExportAdminController
from app.core.ports.match.match_export_ports import ExportResult, Issue, MatchExportError
from app.core.ports.match.snapshot_ports import CheckError, SnapshotCheck
from app.core.ports.story.story_validator_port import StoryValidationReport
from app.core.services.match import match_export_service as mes
from app.core.services.match import match_import_service as mis
from app.core.services.match.match_export_service import MatchExportService
from app.core.services.match.match_import_service import MatchImportService
from match_export_samples import document, with_checksum

STORY = "51515151-0000-4000-8000-000000000001"
MATCH = "0a0a0a0a-0000-4000-8000-000000000001"
PAYLOAD = ('{"v":1,"matchUuid":"' + MATCH + '","idStory":9,"clock":3,"state":{"gaming_match":[{"uuid":"' + MATCH
           + '","id_difficulty":1,"id_user_creator":42,"current_clock":3}],"gaming_character_instance":[]},'
           '"logMarks":{}}')


# ── export ────────────────────────────────────────────────────────────────────

@pytest.fixture()
def ex():
    snapshots, snapshot_service, store = MagicMock(), MagicMock(), MagicMock()
    store.story_uuid_by_id.return_value = "s-1"
    store.users_by_ids.return_value = {42: {"uuid": "u-42", "username": "a", "state": 6}}
    store.log_rows.return_value = []
    store.dialect.return_value = "sqlite"
    snapshot_service.check.return_value = SnapshotCheck(True, [])
    story_export = MagicMock()
    story_export.export_story.return_value = {}
    service = MatchExportService(snapshots, snapshot_service, store, story_export, MagicMock(), "0.41.4", "test",
                                 5_000_000)
    service.log_writer, service.match_commands = MagicMock(), MagicMock()

    def match(status, with_snapshot=True):
        snapshots.find_match_by_uuid.return_value = {"id": 1, "uuid": MATCH, "id_story": 9, "status": status,
                                                     "current_clock": 3}
        snapshots.find_match_by_id.return_value = {"id": 1, "current_clock": 4}
        snapshots.list.return_value = [{"uuid": "snap-1", "clock": 3}] if with_snapshot else []
        snapshots.find.return_value = {"uuid": "snap-1", "clock": 3, "payload": PAYLOAD}

    service.given = match
    return service


def test_a_running_match_is_paused_restored_logged_and_resumed(ex):
    ex.given("RUNNING")
    result = ex.export_match(MATCH)
    assert result.file_name == "match-0a0a0a0a-clock-3.json" and '"snapshotClock":3' in result.canonical
    ex.snapshots.set_status.assert_called_once_with(1, "PAUSED")
    ex.snapshot_service.restore.assert_called_once_with(MATCH, "snap-1")
    ex.log_writer.write.assert_called_once_with(1, None, None, 4, "ADMIN_EXPORTED clock=3")
    ex.match_commands.update_match.assert_called_once_with(MATCH, "RUNNING", None, "RESUME")


def test_paused_stays_paused_and_terminal_is_untouched(ex):
    ex.given("PAUSED")
    ex.export_match(MATCH)
    ex.snapshots.set_status.assert_not_called()
    ex.match_commands.update_match.assert_not_called()
    ex.snapshot_service.restore.reset_mock()
    ex.log_writer.write.reset_mock()
    ex.given("ENDED")
    ex.export_match(MATCH)
    ex.snapshot_service.restore.assert_not_called()
    ex.log_writer.write.assert_not_called()


def test_export_refusals(ex):
    ex.snapshots.find_match_by_uuid.return_value = None
    with pytest.raises(MatchExportError) as e:
        ex.export_match(MATCH)
    assert e.value.code == "MATCH_NOT_FOUND" and e.value.status == 404
    for status, has in (("CREATED", True), ("RUNNING", False)):
        ex.given(status, has)
        with pytest.raises(MatchExportError) as e:
            ex.export_match(MATCH)
        assert e.value.code == "NO_SNAPSHOT"


def test_integrity_failure_size_cap_and_vanished_snapshot_put_the_status_back(ex):
    ex.given("RUNNING")
    ex.snapshot_service.check.return_value = SnapshotCheck(False, [CheckError("USER_MISSING", "user 1")])
    with pytest.raises(MatchExportError) as e:
        ex.export_match(MATCH)
    assert e.value.code == "SNAPSHOT_INTEGRITY_FAILED" and e.value.errors[0].code == "USER_MISSING"
    ex.snapshots.set_status.assert_called_with(1, "RUNNING")
    ex.snapshot_service.check.return_value = SnapshotCheck(True, [])
    ex.max_bytes = 10
    with pytest.raises(MatchExportError) as e:
        ex.export_match(MATCH)
    assert e.value.code == "EXPORT_TOO_LARGE" and e.value.status == 413
    ex.max_bytes = 5_000_000
    ex.snapshots.find.return_value = None
    with pytest.raises(MatchExportError) as e:
        ex.export_match(MATCH)
    assert e.value.code == "NO_SNAPSHOT"


def test_export_helpers_and_facade(ex):
    assert mes.title({"idTextTitle": 1, "texts": [{"idText": 1, "lang": "it", "shortText": "Ciao"},
                                                  {"idText": 1, "lang": "en", "shortText": "Hi"}]}) == "Hi"
    assert mes.title({"idTextTitle": 1, "texts": [{"idText": 1, "lang": "it", "longText": "Lungo"},
                                                  {"idText": 1, "lang": "de", "shortText": "x"},
                                                  {"idText": 2, "lang": "en", "shortText": "no"}]}) == "Lungo"
    assert mes.title({}) is None
    assert mes.id_by_uuid({"x": [{"uuid": "a", "id": 1}, {"id": 2}, {"uuid": "b"}]}, "x") == {"a": 1}
    engine = mes.engine([{"id_location": 0}], {"log_events": [{"log_message": "EVENT_EXECUTED 1"}, {"id_event": 2},
                                                              {"log_message": "x", "id_event": 3}]})
    assert engine == {"eventMarkers": [], "visitedLocationIds": []}
    ex.importer.check.return_value = {"valid": True}
    ex.importer.import_match.return_value = {"status": "IMPORTED"}
    assert ex.check({})["valid"] is True and ex.import_match({})["status"] == "IMPORTED"
    ex.given("ENDED")
    ex.store.story_uuid_by_id.return_value = None
    assert '"data":{}' in ex.export_match(MATCH).canonical


# ── import ────────────────────────────────────────────────────────────────────

@pytest.fixture()
def im():
    store, snapshot_store, story_export, story_import, validator = (MagicMock(), MagicMock(), MagicMock(),
                                                                    MagicMock(), MagicMock())
    validator.validate_import_data.return_value = StoryValidationReport()
    store.story_id_by_uuid.return_value = None
    store.user_by_uuid.return_value = None
    store.username_taken.return_value = False
    store.user_by_email.return_value = None
    store.match_exists.return_value = False
    store.match_of_character.return_value = None
    store.active_matches_of.return_value = []
    store.story_location_ids.return_value = [1, 2, 3]
    store.insert_imported.return_value = 77
    snapshot_store.find_match_by_id.return_value = {"id": 77, "current_clock": 4}
    service = MatchImportService(store, snapshot_store, story_export, story_import, validator, "0.41.4", 5_000_000)
    snapshot_service, time_service, log_writer, commands = MagicMock(), MagicMock(), MagicMock(), MagicMock()
    snapshot_service.write_now.return_value = "snap-77"
    service.set_engine(snapshot_service, time_service, log_writer, commands)
    return service


def _codes(check, key="errors"):
    return [i["code"] for i in check[key]]


def test_a_story_absent_from_the_target_is_imported_and_the_users_created(im):
    doc = document()
    check = im.check({"export": doc})
    assert check["valid"] is True, check
    assert check["story"]["status"] == "ABSENT" and check["story"]["action"] == "IMPORT"
    assert _codes(check, "warnings") == ["CROSS_FAMILY", "ROLE_DOWNGRADED"]
    im.store.story_id_by_uuid.side_effect = [None, 9]
    im.story_export.export_story.return_value = doc["story"]["data"]
    result = im.import_match({"export": doc})
    assert result["status"] == "IMPORTED" and result["matchStatus"] == "RUNNING" and result["clock"] == 4
    assert result["usersCreated"] == 2 and result["uuidSnapshot"] == "snap-77"
    assert "id" not in im.story_import.import_story.call_args[0][0]
    rows = im.store.insert_imported.call_args[0][0]
    assert rows.replace_uuid is None and len(rows.new_users) == 2
    assert rows.match["id_user_creator"] == "00000000-0000-4000-8000-0000000000a1"
    assert rows.match["trait_uuids"] == "7a117a11-0000-4000-8000-000000000001"
    assert rows.active_ordinal == 1 and len(rows.child_rows["gaming_state_locations"]) == 3
    assert len(rows.logs) == 11
    im.log_writer.write.assert_called_once_with(77, None, None, 3, "ADMIN_IMPORTED test clock=3")
    im.time_service.start_time_after_restore.assert_called_once_with(MATCH)
    im.snapshot_store.set_status.assert_called_once_with(77, "RUNNING")


def test_unreadable_files_are_refused(im):
    assert _codes(im.check({"export": "x"})) == ["SCHEMA_INVALID"]
    assert _codes(im.check(None)) == ["SCHEMA_INVALID"]
    doc = document()
    doc["formatVersion"] = 2
    assert _codes(im.check({"export": doc})) == ["FORMAT_UNKNOWN"]
    doc["formatVersion"] = True
    assert _codes(im.check({"export": doc})) == ["FORMAT_UNKNOWN"]
    doc = document()
    doc["extra"] = True
    assert "SCHEMA_INVALID" in _codes(im.check({"export": doc}))
    doc = document()
    doc["checksum"] = "0" * 64
    assert _codes(im.check({"export": doc})) == ["CHECKSUM_MISMATCH"]
    assert _codes(im.check({"export": document(), "storyMode": "MERGE"})) == ["SCHEMA_INVALID"]
    im.max_bytes = 10
    with pytest.raises(MatchExportError) as e:
        im.check({"export": document()})
    assert e.value.code == "IMPORT_TOO_LARGE"


def test_references_are_checked(im):
    doc = document()
    c2 = doc["characters"][1]
    c2.update({"ordinal": 1, "uuid": "c4c4c4c4-0000-4000-8000-000000000001",
               "userUuid": "00000000-0000-4000-8000-0000000000ff"})
    doc["match"]["creatorUserUuid"] = "00000000-0000-4000-8000-0000000000fe"
    doc["match"]["activeCharacterUuid"] = "c4c4c4c4-0000-4000-8000-0000000000ff"
    doc["state"]["turns"].append(doc["state"]["turns"][0])
    check = im.check({"export": with_checksum(doc)})
    assert check["valid"] is False and set(_codes(check)) == {"REFERENCE_INVALID"}
    text = str(check["errors"])
    for part in ("listed twice", "used twice", "is not in users", "unknown character", "has two turns"):
        assert part in text


def test_story_modes_on_a_different_story(im):
    doc = document()
    target = dict(doc["story"]["data"], title="changed on the target")
    im.store.story_id_by_uuid.return_value = 9
    im.story_export.export_story.return_value = target
    im.store.count_matches_of_story.return_value = 4
    assert _codes(im.check({"export": doc})) == ["STORY_DIFFERS"]
    with pytest.raises(MatchExportError) as e:
        im.import_match({"export": doc})
    assert e.value.code == "STORY_DIFFERS" and e.value.status == 409
    keep = im.check({"export": doc, "storyMode": "keep"})
    assert keep["valid"] and keep["story"]["action"] == "KEEP"
    replace = im.check({"export": doc, "storyMode": "REPLACE"})
    assert replace["story"]["matchesDeleted"] == 4 and "STORY_MATCHES_DELETED" in _codes(replace, "warnings")
    im.import_match({"export": doc, "storyMode": "REPLACE", "startPaused": True})
    im.story_import.import_story.assert_called_once()
    im.snapshot_store.set_status.assert_called_once_with(77, "PAUSED")
    bad = StoryValidationReport()
    bad.add("R_01", "event", "1", "id", "broken")
    im.story_validator.validate_import_data.return_value = bad
    invalid = im.check({"export": doc, "storyMode": "REPLACE"})
    assert _codes(invalid) == ["STORY_INVALID"] and "R_01" in invalid["errors"][0]["message"]


def test_the_same_story_is_used_and_its_missing_entities_reported(im):
    doc = document()
    target = doc["story"]["data"]
    im.store.story_id_by_uuid.return_value = 9
    im.story_export.export_story.return_value = target
    assert im.check({"export": doc})["story"]["action"] == "USE_EXISTING"
    smaller = dict(target, locations=[{"id": 1}], missionSteps=[], characterTemplates=[{"idTipo": 1}])
    im.story_export.export_story.return_value = smaller
    keep = im.check({"export": doc, "storyMode": "KEEP"})
    assert _codes(keep) == ["STORY_ENTITY_MISSING", "STORY_ENTITY_MISSING"]
    assert "location 2" in str(keep["errors"]) and "mission step 1" in str(keep["errors"])
    with pytest.raises(MatchExportError) as e:
        im.import_match({"export": doc, "storyMode": "KEEP"})
    assert e.value.code == "IMPORT_INVALID" and e.value.status == 422


def test_users_existing_renamed_and_their_active_matches_paused(im):
    doc = document()
    im.store.user_by_uuid.side_effect = lambda u: {"id": 42} if u.endswith("a1") else None
    im.store.username_taken.side_effect = lambda n: n == "admin_a2"
    im.store.story_id_by_uuid.return_value = 9
    im.story_export.export_story.return_value = doc["story"]["data"]
    im.store.active_matches_of.return_value = [{"uuid": "other-1", "status": "RUNNING"}]
    check = im.check({"export": doc})
    assert [u["status"] for u in check["users"]] == ["EXISTING", "RENAMED"]
    assert check["users"][1]["targetUsername"] == "admin_a2_000000"
    assert {"USERNAME_RENAMED", "USER_HAS_ACTIVE_MATCH"} <= set(_codes(check, "warnings"))
    im.import_match({"export": doc})
    im.match_commands.update_match.assert_called_once_with("other-1", "PAUSED", None, "PAUSE")


def test_a_user_with_a_known_email_is_mapped_onto_the_existing_one(im):
    doc = document()
    target = "99999999-0000-4000-8000-000000000099"
    im.store.user_by_email.side_effect = lambda e: ({"id": 9, "uuid": target, "username": "boss_here"}
                                                    if e == "boss@example.org" else None)
    im.store.story_id_by_uuid.return_value = 9
    im.story_export.export_story.return_value = doc["story"]["data"]
    check = im.check({"export": doc})
    mapped = check["users"][1]
    assert (mapped["status"], mapped["targetUuid"], mapped["targetUsername"]) == ("MAPPED_BY_EMAIL", target, "boss_here")
    assert "USER_MAPPED_BY_EMAIL" in _codes(check, "warnings") and "ROLE_DOWNGRADED" not in _codes(check, "warnings")
    im.store.active_matches_of.assert_called_with([target], 9, MATCH)
    result = im.import_match({"export": doc})
    assert result["usersCreated"] == 1
    rows = im.store.insert_imported.call_args[0][0]
    assert len(rows.new_users) == 1 and rows.characters[1]["id_user"] == target
    assert rows.match["id_user_creator"] == "00000000-0000-4000-8000-0000000000a1"


def test_two_new_users_with_the_same_name(im):
    doc = document()
    doc["users"][1].update({"username": "guest_a1", "role": "PLAYER"})
    assert im.check({"export": with_checksum(doc)})["users"][1]["status"] == "RENAMED"


def test_conflicts_on_match_and_characters(im):
    doc = document()
    im.store.match_exists.return_value = True
    owners = {"c4c4c4c4-0000-4000-8000-000000000001": MATCH, "c4c4c4c4-0000-4000-8000-000000000002": "other"}
    im.store.match_of_character.side_effect = owners.get
    assert _codes(im.check({"export": doc})) == ["MATCH_EXISTS", "CHARACTER_EXISTS", "CHARACTER_EXISTS"]
    assert _codes(im.check({"export": doc, "replace": True})) == ["CHARACTER_EXISTS"]
    with pytest.raises(MatchExportError) as e:
        im.import_match({"export": doc})
    assert e.value.code == "MATCH_EXISTS"
    owners["c4c4c4c4-0000-4000-8000-000000000002"] = None
    im.store.story_id_by_uuid.return_value = 9
    im.story_export.export_story.return_value = doc["story"]["data"]
    im.import_match({"export": doc, "replace": True})
    assert im.store.insert_imported.call_args[0][0].replace_uuid == MATCH


def test_markers_are_reconciled_and_the_visited_set_compared(im):
    doc = document()
    doc["engine"]["eventMarkers"] = [{"eventId": 13, "executed": 2, "selected": 0},
                                     {"eventId": 14, "executed": 1, "selected": 0}]
    doc["engine"]["visitedLocationIds"] = [1]
    doc = with_checksum(doc)
    check = im.check({"export": doc})
    assert {"MARKERS_RECONCILED", "VISITED_LOCATIONS_DIFFER"} <= set(_codes(check, "warnings"))
    im.store.story_id_by_uuid.return_value = 9
    im.story_export.export_story.return_value = None
    im.import_match({"export": doc, "storyMode": "KEEP"})
    messages = [c.get("log_message") for _t, c in im.store.insert_imported.call_args[0][0].logs]
    assert "EVENT_EXECUTED 13 imported" in messages and "IMPORTED_UNCOUNTED CHOICE_SELECTED 14" in messages


def test_a_failing_time_start_leaves_the_match_paused(im):
    doc = document()
    im.store.story_id_by_uuid.return_value = 9
    im.story_export.export_story.return_value = doc["story"]["data"]
    im.time_service.start_time_after_restore.side_effect = RuntimeError("boom")
    with pytest.raises(MatchExportError) as e:
        im.import_match({"export": doc})
    assert e.value.code == "IMPORT_TIME_START_FAILED" and e.value.status == 500
    im.snapshot_store.set_status.assert_called_once_with(77, "PAUSED")


def test_the_story_must_be_there_after_its_import_and_bare_wiring_works(im):
    with pytest.raises(RuntimeError):
        im.import_match({"export": document()})
    bare = MatchImportService(im.store, im.snapshot_store, im.story_export, im.story_import, None, "0.41.4", 5_000_000)
    im.store.story_id_by_uuid.side_effect = [None, 9]
    assert bare.import_match({"export": document()})["uuidSnapshot"] is None


def test_refusal_and_helpers():
    assert mis.refusal([Issue("STORY_DIFFERS", "x")]).code == "STORY_DIFFERS"
    mixed = mis.refusal([Issue("MATCH_EXISTS", "x"), Issue("SCHEMA_INVALID", "y")])
    assert mixed.code == "IMPORT_INVALID" and len(mixed.errors) == 2
    assert MatchExportError("UNKNOWN", "m").status == 500
    assert mis.uuid_by_id({"x": [{"id": 1, "uuid": "a"}, {"id": 2}]}, "x") == {1: "a"}


# ── admin routes ──────────────────────────────────────────────────────────────

def test_admin_routes():
    service = MagicMock()
    service.export_match.return_value = ExportResult({}, '{"a":1}', "match-m-clock-3.json")
    service.check.return_value = {"valid": True}
    service.import_match.return_value = {"status": "IMPORTED"}
    app = FastAPI()
    app.include_router(MatchExportAdminController(service, 100).router)
    client = TestClient(app)
    r = client.post("/api/admin/matches/m/export")
    assert r.status_code == 200 and r.json() == {"a": 1}
    assert r.headers["content-disposition"] == "attachment; filename=match-m-clock-3.json"
    assert client.post("/api/admin/matches/import", json={"dryRun": True, "export": {}}).status_code == 200
    assert client.post("/api/admin/matches/import", json={"export": {}}).status_code == 201
    assert client.post("/api/admin/matches/import", content=b"").status_code == 400
    assert client.post("/api/admin/matches/import", content=b"[1]").status_code == 400
    assert client.post("/api/admin/matches/import", content=b"{bad").status_code == 400
    assert client.post("/api/admin/matches/import", content=b'{"x":"' + b"y" * 5000 + b'"}').status_code == 413
    service.import_match.side_effect = MatchExportError("IMPORT_INVALID", "no", [Issue("CHECKSUM_MISMATCH", "x")])
    invalid = client.post("/api/admin/matches/import", json={"export": {}})
    assert invalid.status_code == 422 and invalid.json()["errors"][0]["code"] == "CHECKSUM_MISMATCH"
    service.export_match.side_effect = MatchExportError("MATCH_NOT_FOUND", "no")
    missing = client.post("/api/admin/matches/x/export")
    assert missing.status_code == 404 and "errors" not in missing.json()
