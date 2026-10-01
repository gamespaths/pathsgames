"""v0.41.4 Step 41 H — export then import on a real SQLite schema: snapshot, pause, file, restore, EXPORTED
row; dry-run, copy, MATCH_EXISTS, replace, CHARACTER_EXISTS, renamed user, one session rolled back on error."""
import json
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.adapters.persistence.story.models  # noqa: F401  registers the list_* tables
from app.adapters.persistence.auth.models import Base
from app.adapters.persistence.match.match_export_store_adapter import MatchExportStoreAdapter, safe_user
from app.adapters.persistence.match.match_log_writer_adapter import MatchLogWriterAdapter
from app.adapters.persistence.match.snapshot_store_adapter import SnapshotStoreAdapter
from app.core.ports.match.match_export_ports import MatchExportError
from app.core.services.match import canonical_json
from app.core.services.match.match_export_service import MatchExportService
from app.core.services.match.match_import_service import MatchImportService
from app.core.services.match.schema_validator import SchemaValidator
from app.core.services.match.snapshot_service import SnapshotService
from match_export_samples import with_checksum

STORY = "51515151-0000-4000-8000-000000000009"
MATCH = "0a0a0a0a-0000-4000-8000-000000000009"
C1 = "c4c4c4c4-0000-4000-8000-000000000091"
C2 = "c4c4c4c4-0000-4000-8000-000000000092"
U42 = "00000000-0000-4000-8000-000000000042"
U43 = "00000000-0000-4000-8000-000000000043"
NOW = "2026-10-01T08:00:00+00:00"


def story():
    return {"uuid": STORY, "id": 9, "idTextTitle": 1, "idLocationStart": 1,
            "texts": [{"id": 1, "idText": 1, "lang": "en", "shortText": "Round trip"}],
            "difficulties": [{"id": 1, "uuid": "d-9"}],
            "locations": [{"id": 1, "uuid": "loc-1"}, {"id": 2, "uuid": "loc-2"}],
            "characterTemplates": [{"id": 1, "uuid": "tpl-9"}], "classes": [{"id": 1, "uuid": "cls-9"}],
            "traits": [{"id": 1, "uuid": "trt-9"}], "items": [{"id": 5, "uuid": "itm-5"}],
            "events": [{"id": 13, "uuid": "ev-13"}, {"id": 14, "uuid": "ev-14"}], "choices": [{"id": 7, "uuid": "ch-7"}],
            "missions": [{"id": 1, "uuid": "mi-1"}], "weatherRules": [{"id": 1, "uuid": "w-1"}]}


def _seed(conn):
    stamps = f"'{NOW}', '{NOW}'"
    statements = [
        f"INSERT INTO users (id, uuid, username, state, role, guest_cookie_token, email_address) VALUES (42, '{U42}', 'robottest_creator', 6, 'PLAYER', 'tok', 'c@x.org')",
        f"INSERT INTO users (id, uuid, username, state, role) VALUES (43, '{U43}', 'robottest_other', 2, 'ADMIN')",
        f"INSERT INTO list_stories (id, uuid) VALUES (9, '{STORY}')",
        "INSERT INTO list_locations (id, id_story, uuid) VALUES (1, 9, 'loc-1'), (2, 9, 'loc-2'), (3, 9, 'loc-3')",
        f"INSERT INTO gaming_match (id, uuid, id_story, id_difficulty, id_user_creator, status, current_clock,"
        f" id_current_weather, name, rng_seed, character_template_uuid, class_uuid, trait_uuids, exp_cost,"
        f" counter_consecutive_pass, single_player, id_character_current_turn, ts_insert, ts_update)"
        f" VALUES (1, '{MATCH}', 9, 1, 42, 'RUNNING', 3, 1, 'robottest_rt', 42, 'tpl-9', 'cls-9', 'trt-9', 5, 0, 1, 1, {stamps})",
    ]
    char_cols = ("id_character_template, dexterity, intelligence, constitution, sad, life_max, energy_max, sad_max,"
                 " weight_max, is_coma, counter_consecutive_pass, exp, ts_insert, ts_update")
    char_vals = f"1, 1, 1, 1, 0, 10, 20, 5, 30, 0, 0, 0, {stamps}"
    statements += [
        f"INSERT INTO gaming_character_instance (id, uuid, id_match, id_user, id_class, id_location, energy, life,"
        f" is_sleeping, characteristics, {char_cols}) VALUES (1, '{C1}', 1, 42, 1, 2, 20, 10, 1, 'brave', {char_vals})",
        f"INSERT INTO gaming_character_instance (id, uuid, id_match, id_user, id_class, id_location, energy, life,"
        f" is_sleeping, characteristics, {char_cols}) VALUES (2, '{C2}', 1, 43, NULL, 2, 5, 5, 0, NULL, {char_vals})",
        f"INSERT INTO gaming_backpack_resources (id, uuid, id_match, id_character_match, food, magic, coin, ts_insert, ts_update) VALUES (1, 'b1', 1, 1, 0, 0, 2, {stamps})",
        f"INSERT INTO gaming_character_traits (id, uuid, id_match, id_character_match, id_traits, id_event, ts_insert, ts_update) VALUES (1, 't1', 1, 1, 1, 13, {stamps})",
        f"INSERT INTO gaming_inventory_items (id, uuid, id_match, id_character_match, id_item, amount, ts_insert, ts_update) VALUES (1, 'i1', 1, 1, 5, 2, {stamps})",
        f"INSERT INTO gaming_state_registry (id, uuid, id_match, key, string_value, id_character, id_event, ts_insert, ts_update) VALUES (1, 'r1', 1, 'quest', 'done', 1, 14, {stamps})",
        f"INSERT INTO gaming_state_locations (id_match, id_location, uuid, flag_already_actived, flag_visited, ts_insert, ts_update) VALUES (1, 1, 'l1', 0, 1, {stamps}), (1, 2, 'l2', 0, 1, {stamps}), (1, 3, 'l3', 0, 0, {stamps})",
        f"INSERT INTO gaming_turn_queue (id_match, id_character_match, uuid, clock, status, priority, pass_counter, ts_insert, ts_update) VALUES (1, 1, 'q1', 3, 'ACTIVE', 2, 0, {stamps})",
        f"INSERT INTO gaming_story_progress (id, uuid, id_match, clock, id_event, id_choise, ts_insert, ts_update) VALUES (1, 'p1', 1, 2, 14, 7, {stamps})",
        f"INSERT INTO log_events (id, uuid, id_match, id_character_match, log_message, id_event, clock, timestamp, ts_insert, ts_update) VALUES"
        f" (1, 'e1', 1, 1, 'EVENT_EXECUTED 13', 13, 1, '2026-10-01T09:06:00Z', {stamps}),"
        f" (2, 'e2', 1, 1, 'EVENT_EXECUTED 14', 14, 2, '2026-10-01T09:10:00Z', {stamps}),"
        f" (3, 'e3', 1, 1, 'CHOICE_SELECTED 14', 14, 2, '2026-10-01T09:20:00Z', {stamps}),"
        f" (4, 'e4', 1, NULL, 'MATCH_CREATED', NULL, 0, '2026-10-01T08:59:00Z', {stamps})",
        f"INSERT INTO log_movements (id, uuid, id_match, id_character_match, id_location_from, id_location_to, energy_cost, timestamp_start, ts_insert, ts_update) VALUES (1, 'm1', 1, 1, 1, 2, 2, '2026-10-01T09:05:00Z', {stamps})",
        f"INSERT INTO log_item_usage (id, uuid, id_match, id_character_match, id_item, action, food, effects_json, timestamp, ts_insert, ts_update) VALUES (1, 'u1', 1, 1, 5, 'ADD', 1, '[]', '2026-10-01T09:21:00Z', {stamps})",
        f"INSERT INTO log_weather (id, uuid, id_match, clock, id_weather, timestamp_start, ts_insert, ts_update) VALUES (1, 'w1', 1, 1, 1, '2026-10-01T09:00:00Z', {stamps})",
        f"INSERT INTO log_clock_history (id, uuid, id_match, clock, timestamp_start, ts_insert, ts_update) VALUES (1, 'k1', 1, 2, '2026-10-01T09:25:00Z', {stamps})",
        f"INSERT INTO log_choices_executed (id, uuid, id_match, clock, id_event, id_choise, log_message, ts_insert, ts_update) VALUES (1, 'x1', 1, 2, 14, 7, 'CHOICE_SELECTED 7', {stamps})",
    ]
    for table, rows in (("list_weather_rules", "(1, 9)"), ("list_classes", "(1, 9)"), ("list_traits", "(1, 9)"),
                        ("list_missions", "(1, 9)"), ("list_items", "(5, 9)"), ("list_events", "(13, 9), (14, 9)"),
                        ("list_choices", "(7, 9)")):
        statements.append(f"INSERT INTO {table} (id, id_story) VALUES {rows}")
    statements.append("INSERT INTO list_character_templates (id_tipo, id_story) VALUES (1, 9)")
    for s in statements:
        conn.execute(text(s))


@pytest.fixture()
def env():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    make = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    with engine.begin() as conn:
        _seed(conn)
    snapshot_store = SnapshotStoreAdapter(make)
    store = MatchExportStoreAdapter(make)
    log_writer = MatchLogWriterAdapter(make)
    snapshots = SnapshotService(snapshot_store, 10)
    snapshots.set_log_writer(log_writer)
    story_export = MagicMock()
    story_export.export_story.side_effect = lambda u: story() if u == STORY else None
    story_import, commands = MagicMock(), MagicMock()
    importer = MatchImportService(store, snapshot_store, story_export, story_import, None, "0.41.4", 5_000_000)
    importer.set_engine(snapshots, None, log_writer, commands)
    exporter = MatchExportService(snapshot_store, snapshots, store, story_export, importer, "0.41.4", "test", 5_000_000)
    exporter.log_writer = log_writer
    exporter.match_commands = commands

    class Env:
        pass

    e = Env()
    e.engine, e.store, e.snapshots, e.exporter, e.importer, e.commands, e.story_import = (
        engine, store, snapshots, exporter, importer, commands, story_import)
    e.q = lambda sql: engine.connect().execute(text(sql)).fetchall()
    return e


def _export(env):
    env.snapshots.write_at_time_end(1)
    with env.engine.begin() as conn:
        conn.execute(text(f"INSERT INTO log_events (id, uuid, id_match, log_message, timestamp, ts_insert, ts_update)"
                          f" VALUES (50, 'late', 1, 'ACTION_SLEEP', '2026-10-01T10:00:00Z', '{NOW}', '{NOW}')"))
        conn.execute(text("UPDATE gaming_character_instance SET energy = 1 WHERE id = 1"))
    result = env.exporter.export_match(MATCH)
    assert result.file_name.startswith("match-0a0a0a0a-clock-3")
    return json.loads(result.canonical)


def _copy(doc, match_uuid, c1, c2, extra=()):
    text_ = canonical_json.write(doc).replace(MATCH, match_uuid).replace(C1, c1).replace(C2, c2)
    for old, new in extra:
        text_ = text_.replace(old, new)
    return with_checksum(json.loads(text_))


def test_export_is_valid_restores_the_source_and_logs_it(env):
    doc = _export(env)
    assert SchemaValidator.match_export_v1().validate(doc) == []
    assert doc["checksum"] == canonical_json.sha256({k: v for k, v in doc.items() if k != "checksum"})
    assert doc["source"]["backend"] == "python" and doc["source"]["dialect"] == "sqlite"
    assert len(doc["logs"]) == 8
    assert "tok" not in canonical_json.write(doc)
    assert doc["engine"]["eventMarkers"] == [{"eventId": 13, "executed": 1, "selected": 0},
                                             {"eventId": 14, "executed": 1, "selected": 1}]
    assert doc["engine"]["visitedLocationIds"] == [2, 1]
    assert doc["characters"][0]["energy"] == 20 and doc["characters"][0]["isSleeping"] is True
    assert len(doc["state"]["locations"]) == 2
    assert env.q("SELECT energy FROM gaming_character_instance WHERE id = 1")[0][0] == 20
    assert env.q("SELECT COUNT(*) FROM log_events WHERE log_message = 'ACTION_SLEEP'")[0][0] == 0
    assert env.q("SELECT COUNT(*) FROM log_events WHERE log_message = 'ADMIN_EXPORTED clock=3'")[0][0] == 1
    env.commands.update_match.assert_called_once_with(MATCH, "RUNNING", None, "RESUME")


def test_a_copy_is_imported_in_one_go_and_the_original_needs_replace(env):
    doc = _export(env)
    copy_uuid = "0a0a0a0a-0000-4000-8000-0000000000c1"
    copy = _copy(doc, copy_uuid, "c4c4c4c4-0000-4000-8000-0000000000c1", "c4c4c4c4-0000-4000-8000-0000000000c2")
    with env.engine.begin() as conn:
        conn.execute(text("UPDATE gaming_match SET status = 'RUNNING' WHERE id = 1"))
    check = env.importer.check({"export": copy, "dryRun": True})
    assert check["valid"] is True, check
    assert check["story"]["status"] == "SAME" and check["story"]["action"] == "USE_EXISTING"
    assert [u["status"] for u in check["users"]] == ["EXISTING", "EXISTING"]
    assert "USER_HAS_ACTIVE_MATCH" in [w["code"] for w in check["warnings"]]

    result = env.importer.import_match({"export": copy, "startPaused": True})
    assert result["status"] == "IMPORTED" and result["matchStatus"] == "PAUSED" and result["snapshotClock"] == 3
    env.commands.update_match.assert_any_call(MATCH, "PAUSED", None, "PAUSE")
    env.story_import.import_story.assert_not_called()
    id_ = env.q(f"SELECT id FROM gaming_match WHERE uuid = '{copy_uuid}'")[0][0]
    row = env.q(f"SELECT status, trait_uuids, id_character_current_turn FROM gaming_match WHERE id = {id_}")[0]
    assert tuple(row) == ("PAUSED", "trt-9", 1)
    assert env.q(f"SELECT is_sleeping FROM gaming_character_instance WHERE id_match = {id_} AND id = 1")[0][0] == 1
    assert env.q(f"SELECT COUNT(*) FROM gaming_state_locations WHERE id_match = {id_}")[0][0] == 3
    assert env.q(f"SELECT COUNT(*) FROM log_events WHERE id_match = {id_} AND log_message = 'ADMIN_IMPORTED test clock=3'")[0][0] == 1
    assert env.q(f"SELECT COUNT(*) FROM log_events WHERE id_match = {id_} AND log_message LIKE 'EVENT_EXECUTED 13%'")[0][0] == 1
    assert env.q(f"SELECT COUNT(*) FROM log_choices_executed WHERE id_match = {id_}")[0][0] == 1
    assert env.q(f"SELECT description, uuid FROM system_snapshot WHERE id_match = {id_}")[0][0] == "Imported at clock 3"

    with pytest.raises(MatchExportError) as exists:
        env.importer.import_match({"export": copy})
    assert exists.value.code == "MATCH_EXISTS" and exists.value.status == 409
    replaced = env.importer.import_match({"export": copy, "replace": True})
    assert replaced["matchStatus"] == "RUNNING"
    assert env.q(f"SELECT COUNT(*) FROM gaming_match WHERE uuid = '{copy_uuid}'")[0][0] == 1
    # SQLite may hand the freed id out again: the old rows must be gone, not duplicated.
    assert env.q("SELECT COUNT(*) FROM gaming_character_instance WHERE uuid LIKE 'c4c4c4c4-%-0000000000c%'")[0][0] == 2
    new_id = env.q(f"SELECT id FROM gaming_match WHERE uuid = '{copy_uuid}'")[0][0]
    assert env.q(f"SELECT COUNT(*) FROM log_events WHERE id_match = {new_id} AND log_message LIKE 'ADMIN_IMPORTED%'")[0][0] == 1

    clash = _copy(doc, "0a0a0a0a-0000-4000-8000-0000000000c3", "c4c4c4c4-0000-4000-8000-0000000000c1",
                  "c4c4c4c4-0000-4000-8000-0000000000c4")
    with pytest.raises(MatchExportError) as ce:
        env.importer.import_match({"export": clash})
    assert ce.value.code == "CHARACTER_EXISTS"


def test_new_users_are_copied_without_secrets_and_renamed_on_a_clash(env):
    doc = _export(env)
    copy = _copy(doc, "0a0a0a0a-0000-4000-8000-0000000000d1", "c4c4c4c4-0000-4000-8000-0000000000d1",
                 "c4c4c4c4-0000-4000-8000-0000000000d2",
                 ((U42, "abcdef12-0000-4000-8000-000000000042"), (U43, "fedcba98-0000-4000-8000-000000000043"),
                  ("c@x.org", "new@x.org")))
    result = env.importer.import_match({"export": copy})
    assert result["usersCreated"] == 2
    row = env.q("SELECT username, role, state, guest_cookie_token, email_address FROM users"
                " WHERE uuid = 'abcdef12-0000-4000-8000-000000000042'")[0]
    assert tuple(row) == ("robottest_creator_abcdef", "PLAYER", 6, None, "new@x.org")
    assert env.q("SELECT role FROM users WHERE uuid = 'fedcba98-0000-4000-8000-000000000043'")[0][0] == "PLAYER"


def test_a_new_user_with_the_email_of_an_existing_one_is_mapped_onto_it(env):
    doc = _export(env)
    assert doc["users"][0]["emailAddress"] == "c@x.org"
    copy = _copy(doc, "0a0a0a0a-0000-4000-8000-0000000000b1", "c4c4c4c4-0000-4000-8000-0000000000b1",
                 "c4c4c4c4-0000-4000-8000-0000000000b2",
                 ((U42, "abcdef12-0000-4000-8000-0000000000b4"), ("c@x.org", "C@X.ORG")))
    result = env.importer.import_match({"export": copy})
    assert result["usersCreated"] == 0
    assert env.q("SELECT COUNT(*) FROM users WHERE uuid = 'abcdef12-0000-4000-8000-0000000000b4'")[0][0] == 0
    assert env.q("SELECT id_user_creator FROM gaming_match WHERE uuid = '0a0a0a0a-0000-4000-8000-0000000000b1'")[0][0] == 42
    assert env.q("SELECT id_user FROM gaming_character_instance"
                 " WHERE uuid = 'c4c4c4c4-0000-4000-8000-0000000000b1'")[0][0] == 42
    assert env.store.user_by_email(" ") is None and env.store.user_by_email("none@x.org") is None


def test_a_failing_insert_rolls_the_whole_import_back(env):
    doc = _export(env)
    copy = _copy(doc, "0a0a0a0a-0000-4000-8000-0000000000e1", "c4c4c4c4-0000-4000-8000-0000000000e1",
                 "c4c4c4c4-0000-4000-8000-0000000000e2", ((U43, "fedcba98-0000-4000-8000-0000000000e3"),))
    with env.engine.begin() as conn:
        conn.execute(text("DROP TABLE log_clock_history"))
    matches = env.q("SELECT COUNT(*) FROM gaming_match")[0][0]
    with pytest.raises(Exception):
        env.importer.import_match({"export": copy})
    assert env.q("SELECT COUNT(*) FROM gaming_match")[0][0] == matches
    assert env.q("SELECT COUNT(*) FROM users WHERE uuid = 'fedcba98-0000-4000-8000-0000000000e3'")[0][0] == 0
    assert env.q("SELECT COUNT(*) FROM system_snapshot WHERE description LIKE 'Imported%'")[0][0] == 0


def test_store_edges(env):
    assert env.store.users_by_ids([]) == {} and env.store.users_by_ids(None) == {}
    assert env.store.active_matches_of([], 9, "m") == []
    assert env.store.match_exists("nope") is False
    assert env.store.match_of_character("nope") is None
    assert env.store.story_uuid_by_id(9) == STORY and env.store.story_id_by_uuid("nope") is None
    assert env.store.count_matches_of_story(9) == 1
    assert env.store.username_taken("robottest_other") is True
    assert safe_user({"id": 1, "uuid": "u", "guest_cookie_token": "t"}) == {"id": 1, "uuid": "u"}
