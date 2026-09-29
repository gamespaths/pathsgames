"""v0.41.1 Step 41 B — match snapshots: the service (write, prune, every check code, restore), the
SQLAlchemy store on SQLite, the time-end hook, decision 19 and the admin routes. Mirrors the Java tests."""
import logging
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

import app.adapters.persistence.story.models  # noqa: F401  registers the list_* tables
from app.adapters.persistence.auth.models import Base, User
from app.adapters.persistence.database import align_schema
from app.adapters.persistence.match.match_persistence_adapter import MatchPersistenceAdapter
from app.adapters.persistence.match.models import (
    GamingBackpackResourcesEntity, GamingCharacterInstanceEntity, GamingMatchEntity,
    GamingStateLocationEntity, GamingStateRegistryEntity, GamingTurnQueueEntity, LogEventsEntity,
    LogMovementEntity, SystemSnapshotEntity,
)
from app.adapters.persistence.match import snapshot_store_adapter as ssa
from app.adapters.persistence.match.snapshot_store_adapter import SnapshotStoreAdapter
from app.adapters.persistence.story.models import LocationEntity, TraitEntity
from app.adapters.rest.match.match_admin_controller import MatchAdminController
from app.core.models.match.event_models import EdgeStateOutcome
from app.core.models.match.time_models import TimeEndOutcome
from app.core.ports.match import snapshot_ports as sp
from app.core.ports.match.snapshot_ports import (
    CheckError, RestoreResult, SnapshotCheck, SnapshotError, SnapshotSummary,
)
from app.core.services.match import snapshot_service as ss
from app.core.services.match.snapshot_service import SnapshotService
from app.core.services.match.time_advancement_service import TimeAdvancementService

MATCH_ID, MATCH_UUID, STORY_ID, USER_ID, NOW = 5, "match-uuid", 9, 42, "2026-09-28T10:00:00"
MATCH = {"id": MATCH_ID, "uuid": MATCH_UUID, "id_story": STORY_ID, "status": "RUNNING",
         "current_clock": 3}


# ── service, on a fake store ─────────────────────────────────────────────────

def _state():
    return {
        "gaming_match": [{"id": MATCH_ID, "uuid": MATCH_UUID, "status": "RUNNING", "current_clock": 3,
                          "id_current_weather": 1, "id_user_creator": USER_ID}],
        "gaming_character_instance": [{"id": 1, "id_user": USER_ID, "id_location": 2, "id_class": 1,
                                       "id_character_template": 1, "is_sleeping": 1}],
        "gaming_character_traits": [{"id": 1, "id_traits": 7, "id_event": 0}],
        "gaming_state_registry": [{"key": "quest", "id_event": 14, "id_choice": None,
                                   "id_mission": 1}],
    }


def _payload(v=1, match_uuid=MATCH_UUID, id_story=STORY_ID, state=None):
    return {"v": v, "matchUuid": match_uuid, "idStory": id_story, "clock": 3,
            "state": _state() if state is None else state, "logMarks": {"log_events": 12}}


def _stored(payload_text, checksum):
    return {"id": 70, "uuid": "snap-uuid", "clock": 3, "type": "LIGHT", "timestamp": NOW,
            "description": "Time-end of clock 3", "size_bytes": len(payload_text),
            "payload": payload_text, "checksum": checksum}


@pytest.fixture()
def store():
    s = MagicMock()
    s.find_match_by_uuid.side_effect = lambda u: dict(MATCH) if u == MATCH_UUID else None
    s.find_match_by_id.return_value = dict(MATCH)
    s.existing_story_ids.side_effect = lambda table, column, id_story, ids: set(ids)
    s.existing_user_ids.side_effect = lambda ids: set(ids)
    s.restore.return_value = 6
    return s


def _given(store, payload, checksum=None):
    text_ = payload if isinstance(payload, str) else ss.canonical(payload)
    store.find.side_effect = lambda id_match, uuid: _stored(
        text_, ss.sha256(text_) if checksum is None else checksum) if uuid == "snap-uuid" else None


def _codes(check):
    return [e.code for e in check.errors]


def test_write_takes_one_light_snapshot_of_the_ending_clock_then_prunes(store):
    store.read_state.return_value = _state()
    store.log_marks.return_value = {"log_events": 12}
    SnapshotService(store, 10).write_at_time_end(MATCH_ID)

    args = store.insert.call_args.args
    assert args[:4] == (MATCH_ID, STORY_ID, 3, "LIGHT")
    assert args[5] == ss.sha256(args[4]) and len(args[5]) == 64
    assert args[6] == "Time-end of clock 3"
    assert args[4].startswith('{"clock":3,"idStory":9,"logMarks":')
    assert ss.parse(args[4])["v"] == 1
    store.prune.assert_called_once_with(MATCH_ID, 10)


def test_write_is_off_at_zero_and_quiet_on_an_unknown_match_or_a_failure(store, caplog):
    SnapshotService(store, 0).write_at_time_end(MATCH_ID)
    store.find_match_by_id.assert_not_called()
    store.find_match_by_id.return_value = None
    SnapshotService(store, 10).write_at_time_end(MATCH_ID)
    store.insert.assert_not_called()
    store.find_match_by_id.return_value = dict(MATCH)
    store.read_state.side_effect = RuntimeError("db down")
    with caplog.at_level(logging.WARNING):
        SnapshotService(store, 10).write_at_time_end(MATCH_ID)
    assert any("SNAPSHOT match 5 not written" in r.message for r in caplog.records)
    store.insert.assert_not_called()


def test_list_maps_the_rows(store):
    store.list.return_value = [{"uuid": "s2", "clock": 4, "type": "LIGHT", "timestamp": "t2",
                                "description": "d2", "size_bytes": 20}]
    assert SnapshotService(store).list(MATCH_UUID) == [SnapshotSummary("s2", 4, "LIGHT", "t2", "d2", 20)]


def test_unknown_match_and_snapshot(store):
    svc = SnapshotService(store)
    for call in (lambda: svc.list("nope"), lambda: svc.check("nope", "s"),
                 lambda: svc.restore("nope", "s")):
        with pytest.raises(SnapshotError) as err:
            call()
        assert err.value.code == sp.MATCH_NOT_FOUND
    store.find.return_value = None
    with pytest.raises(SnapshotError) as err:
        svc.check(MATCH_UUID, "zz")
    assert err.value.code == sp.SNAPSHOT_NOT_FOUND and err.value.errors == []


def test_a_fresh_snapshot_is_valid_and_the_check_writes_nothing(store):
    _given(store, _payload())
    assert SnapshotService(store).check(MATCH_UUID, "snap-uuid") == SnapshotCheck(True, [])
    store.restore.assert_not_called()
    store.insert.assert_not_called()
    store.set_status.assert_not_called()


def test_a_jsonb_dict_payload_is_read_as_it_is(store):
    text_ = ss.canonical(_payload())
    store.find.side_effect = lambda id_match, uuid: {**_stored(text_, ss.sha256(text_)),
                                                     "payload": _payload()}
    assert SnapshotService(store).check(MATCH_UUID, "snap-uuid").valid


def test_checksum_mismatch_and_unreadable(store):
    _given(store, _payload(), checksum="0" * 64)
    assert _codes(SnapshotService(store).check(MATCH_UUID, "snap-uuid")) == [sp.CHECKSUM_MISMATCH]
    _given(store, "{not json", checksum="x")
    assert _codes(SnapshotService(store).check(MATCH_UUID, "snap-uuid")) == [sp.CHECKSUM_MISMATCH]


def test_unknown_or_missing_version_stops_the_check(store):
    _given(store, _payload(v=2))
    assert _codes(SnapshotService(store).check(MATCH_UUID, "snap-uuid")) == [sp.VERSION_UNKNOWN]
    _given(store, _payload(v=None))
    assert _codes(SnapshotService(store).check(MATCH_UUID, "snap-uuid")) == [sp.VERSION_UNKNOWN]
    store.existing_story_ids.assert_not_called()


def test_match_mismatch(store):
    for payload in (_payload(match_uuid="other"), _payload(id_story=99), _payload(id_story=None)):
        _given(store, payload)
        assert _codes(SnapshotService(store).check(MATCH_UUID, "snap-uuid")) == [sp.MATCH_MISMATCH]


def test_story_entity_missing_names_the_entity(store):
    _given(store, _payload())
    store.existing_story_ids.side_effect = lambda table, column, id_story, ids: \
        set() if table == "list_traits" else set(ids)
    check = SnapshotService(store).check(MATCH_UUID, "snap-uuid")
    assert check.errors == [CheckError(sp.STORY_ENTITY_MISSING, "trait 7 is no longer in the story")]
    tables = {c.args[0]: (c.args[1], c.args[3]) for c in store.existing_story_ids.call_args_list}
    assert tables["list_character_templates"] == ("id_tipo", [1])
    assert tables["list_events"] == ("id", [14])
    assert "list_choices" not in tables


def test_user_missing_and_no_rows_no_user_query(store):
    _given(store, _payload())
    store.existing_user_ids.side_effect = lambda ids: set()
    assert SnapshotService(store).check(MATCH_UUID, "snap-uuid").errors == [
        CheckError(sp.USER_MISSING, "user 42 no longer exists")]
    store.existing_user_ids.reset_mock()
    _given(store, _payload(state={"gaming_match": "x", "gaming_state_locations": ["not a row"]}))
    assert SnapshotService(store).check(MATCH_UUID, "snap-uuid").valid
    store.existing_user_ids.assert_not_called()


def test_restore_order_admin_row_time_start_then_paused(store):
    _given(store, _payload())
    calls = MagicMock()
    store.restore.side_effect = lambda *a: (calls.restore(*a), 6)[1]
    time_service, writer = MagicMock(), MagicMock()
    time_service.start_time_after_restore.side_effect = lambda u: calls.time(u)
    writer.write.side_effect = lambda *a: calls.write(*a)
    store.set_status.side_effect = lambda *a: calls.status(*a)
    svc = SnapshotService(store)
    svc.set_time_service(time_service)
    svc.set_log_writer(writer)

    assert svc.restore(MATCH_UUID, "snap-uuid") == RestoreResult("RESTORED", "snap-uuid", 3, "PAUSED", 6)
    names = [c[0] for c in calls.mock_calls]
    assert names == ["restore", "write", "time", "status"]
    restore_args = calls.restore.call_args.args
    assert restore_args[0:2] == (MATCH_ID, 70)
    assert restore_args[3] == {"log_events": 12}
    calls.write.assert_called_once_with(MATCH_ID, None, None, 3, "ADMIN_SNAPSHOT_RESTORED clock=3")
    calls.status.assert_called_once_with(MATCH_ID, "PAUSED")


def test_restore_without_collaborators_and_a_refused_one(store):
    _given(store, _payload())
    assert SnapshotService(store).restore(MATCH_UUID, "snap-uuid").match_status == "PAUSED"
    store.reset_mock()
    _given(store, _payload(), checksum="bad")
    with pytest.raises(SnapshotError) as err:
        SnapshotService(store).restore(MATCH_UUID, "snap-uuid")
    assert err.value.code == sp.SNAPSHOT_INTEGRITY_FAILED
    assert err.value.errors[0].code == sp.CHECKSUM_MISMATCH
    store.restore.assert_not_called()
    store.set_status.assert_not_called()


def test_helpers():
    assert ss.as_int(4) == 4 and ss.as_int(4.0) == 4 and ss.as_int(" 4 ") == 4
    assert ss.as_int("x") is None and ss.as_int(" ") is None and ss.as_int(True) is None
    assert ss.as_int(None) is None
    assert ss.parse(None) is None and ss.parse(" ") is None and ss.parse("[1]") is None
    assert ss.state_of(None) == {} and ss.log_marks_of(None) == {}
    assert ss.state_of({"state": "x"}) == {} and ss.log_marks_of({"logMarks": {"a": "x"}}) == {}


# ── the SQLAlchemy store on SQLite ────────────────────────────────────────────

@pytest.fixture()
def factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    make = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    with make() as s:
        s.add(User(id=USER_ID, uuid="user-uuid", username="robottest", state=6))
        s.add(GamingMatchEntity(id=1, uuid="m-1", id_story=STORY_ID, id_difficulty=1, name="robottest",
                                status="RUNNING", current_clock=3, id_current_weather=1,
                                id_user_creator=USER_ID, ts_insert=NOW, ts_update=NOW))
        s.add(GamingCharacterInstanceEntity(id=1, id_match=1, uuid="c-1", id_user=USER_ID,
                                            id_character_template=1, energy=20, life=10,
                                            id_location=1, is_sleeping=1, ts_insert=NOW, ts_update=NOW))
        s.add(GamingBackpackResourcesEntity(id=1, id_match=1, uuid="b-1", id_character_match=1, coin=2,
                                            ts_insert=NOW, ts_update=NOW))
        s.add(GamingStateRegistryEntity(id=1, id_match=1, uuid="r-1", key="quest", string_value="done",
                                        ts_insert=NOW, ts_update=NOW))
        s.add(GamingStateLocationEntity(id_match=1, id_location=1, uuid="l-1", flag_visited=1,
                                        ts_insert=NOW, ts_update=NOW))
        s.add(GamingTurnQueueEntity(id_match=1, id_character_match=1, uuid="t-1", clock=3,
                                    status="ACTIVE", ts_insert=NOW, ts_update=NOW))
        s.add(LogEventsEntity(id=4, id_match=1, uuid="e-4", log_message="before", ts_insert=NOW,
                              ts_update=NOW))
        s.add(LogEventsEntity(id=5, id_match=2, uuid="e-5", log_message="other", ts_insert=NOW,
                              ts_update=NOW))
        s.commit()
    yield make
    engine.dispose()


def _insert(adapter, clock):
    adapter.insert(1, STORY_ID, clock, "LIGHT", '{"clock":%d}' % clock, f"sum{clock}",
                   f"Time-end of clock {clock}")


def test_store_match_state_and_marks(factory):
    adapter = SnapshotStoreAdapter(factory)
    assert adapter.find_match_by_uuid("m-1") == {"id": 1, "uuid": "m-1", "id_story": STORY_ID,
                                                 "status": "RUNNING", "current_clock": 3}
    assert adapter.find_match_by_id(1)["uuid"] == "m-1"
    assert adapter.find_match_by_uuid("nope") is None
    state = adapter.read_state(1)
    assert list(state)[:2] == ["gaming_match", "gaming_character_instance"]
    assert state["gaming_match"][0]["name"] == "robottest"
    assert state["gaming_character_instance"][0]["energy"] == 20
    assert state["gaming_state_registry"][0]["string_value"] == "done"
    marks = adapter.log_marks(1)
    assert marks["log_events"] == 4 and marks["log_movements"] == 0 and len(marks) == 6


def test_store_insert_list_find_prune(factory):
    adapter = SnapshotStoreAdapter(factory)
    for clock in (1, 2, 3, 4):
        _insert(adapter, clock)
    rows = adapter.list(1)
    assert [r["clock"] for r in rows] == [4, 3, 2, 1]
    assert rows[0]["payload"] is None and rows[0]["size_bytes"] == len('{"clock":4}')
    found = adapter.find(1, rows[1]["uuid"])
    assert found["payload"] == '{"clock":3}' and found["checksum"] == "sum3"
    assert adapter.find(1, "nope") is None
    assert adapter.prune(1, 2) == 2
    assert [r["clock"] for r in adapter.list(1)] == [4, 3]


def test_store_existing_ids(factory):
    adapter = SnapshotStoreAdapter(factory)
    with factory() as s:
        s.add(TraitEntity(id=1, id_story=STORY_ID))
        s.add(TraitEntity(id=2, id_story=8))
        s.commit()
    assert adapter.existing_story_ids("list_traits", "id", STORY_ID, [1, 2]) == {1}
    assert adapter.existing_story_ids("list_traits", "id", STORY_ID, []) == set()
    assert adapter.existing_story_ids("list_nothing", "id", STORY_ID, [1]) == set()
    assert adapter.existing_story_ids("list_traits", "nope", STORY_ID, [1]) == set()
    with pytest.raises(ValueError):
        adapter.existing_story_ids("list_traits; DROP", "id", STORY_ID, [1])
    assert adapter.existing_user_ids([USER_ID, 43]) == {USER_ID}
    assert adapter.existing_user_ids([]) == set()


def test_store_restore_puts_every_row_back_and_cuts_the_logs(factory):
    adapter = SnapshotStoreAdapter(factory)
    state = adapter.read_state(1)
    _insert(adapter, 3)
    id_snapshot = adapter.list(1)[0]["id"]
    with factory() as s:
        s.add(LogEventsEntity(id=6, id_match=1, uuid="e-6", log_message="after", ts_insert=NOW,
                              ts_update=NOW))
        s.add(LogMovementEntity(id=1, id_match=1, uuid="mv-1", id_character_match=1, id_location_to=2, ts_insert=NOW,
                                ts_update=NOW))
        s.add(GamingCharacterInstanceEntity(id=2, id_match=1, uuid="c-2", id_user=USER_ID,
                                            id_character_template=1, ts_insert=NOW, ts_update=NOW))
        s.execute(text("UPDATE gaming_character_instance SET id_location = 2, energy = 5 WHERE id = 1"))
        s.execute(text("UPDATE gaming_match SET status='ENDED', current_clock=4, timestamp_end='x',"
                       " name='renamed' WHERE id = 1"))
        s.execute(text("DELETE FROM gaming_state_registry"))
        s.commit()
    _insert(adapter, 4)
    ghost = dict(state["gaming_character_instance"][0], id=3, uuid="c-3", id_match=99, unknown=1)
    state["gaming_character_instance"] = state["gaming_character_instance"] + [ghost, {"uuid": "no-id"}]

    assert adapter.restore(1, id_snapshot, state, {"log_events": 4}) == 2
    adapter.set_status(1, "PAUSED")

    with factory() as s:
        assert [r[0] for r in s.execute(text("SELECT id FROM log_events ORDER BY id"))] == [4, 5]
        assert s.execute(text("SELECT COUNT(*) FROM log_movements")).scalar() == 0
        c1 = s.execute(text("SELECT id_location, energy FROM gaming_character_instance WHERE id=1")).one()
        assert tuple(c1) == (1, 20)
        assert [r[0] for r in s.execute(text(
            "SELECT id FROM gaming_character_instance WHERE id_match=1 ORDER BY id"))] == [1, 3]
        assert s.execute(text("SELECT string_value FROM gaming_state_registry")).scalar() == "done"
        m = s.execute(text("SELECT status, current_clock, timestamp_end, name FROM gaming_match")).one()
        assert tuple(m) == ("PAUSED", 3, None, "renamed")
    assert [r["clock"] for r in adapter.list(1)] == [3]


def test_store_restore_without_match_row(factory):
    adapter = SnapshotStoreAdapter(factory)
    adapter.restore(1, 0, {}, {})
    with factory() as s:
        assert s.execute(text("SELECT status FROM gaming_match")).scalar() == "RUNNING"


def test_store_plain_values():
    assert ssa.plain(1) == 1 and ssa.plain("a") == "a" and ssa.plain(None) is None
    assert ssa.plain(True) is True and ssa.plain(1.5) == 1.5
    assert ssa.plain(b"x") == "b'x'"


def test_service_end_to_end_on_sqlite_with_a_deleted_trait(factory):
    with factory() as s:
        s.add(LocationEntity(id=1, id_story=STORY_ID))
        s.add(TraitEntity(id=7, id_story=STORY_ID))
        s.execute(text("INSERT INTO gaming_character_traits (id, id_match, uuid, id_character_match,"
                       " id_traits, ts_insert, ts_update) VALUES (1, 1, 'tr-1', 1, 7, :n, :n)"), {"n": NOW})
        s.commit()
    svc = SnapshotService(SnapshotStoreAdapter(factory), 2)
    svc.write_at_time_end(1)
    uuid = svc.list("m-1")[0].uuid
    with factory() as s:
        s.execute(text("DELETE FROM list_traits"))
        s.commit()
    codes = [e.code for e in svc.check("m-1", uuid).errors]
    assert sp.STORY_ENTITY_MISSING in codes
    with pytest.raises(SnapshotError) as err:
        svc.restore("m-1", uuid)
    assert err.value.code == sp.SNAPSHOT_INTEGRITY_FAILED


def test_match_delete_takes_the_snapshots_away(factory):
    _insert(SnapshotStoreAdapter(factory), 1)
    with factory() as s:
        s.execute(text("UPDATE gaming_match SET status='ENDED'"))
        s.commit()
    assert MatchPersistenceAdapter(factory).delete_match_by_uuid("m-1") is True
    with factory() as s:
        assert s.query(SystemSnapshotEntity).count() == 0


def test_align_schema_adds_clock_checksum_and_index_to_an_old_table():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as c:
        c.execute(text("CREATE TABLE system_snapshot (id INTEGER PRIMARY KEY, id_match INTEGER)"))
    statements = align_schema(engine)
    assert "ALTER TABLE system_snapshot ADD COLUMN clock INTEGER" in statements
    assert "ALTER TABLE system_snapshot ADD COLUMN checksum TEXT" in statements
    columns = {c["name"] for c in inspect(engine).get_columns("system_snapshot")}
    assert {"clock", "checksum"} <= columns
    assert "idx_snapshot_match_clock" in {i["name"] for i in inspect(engine).get_indexes("system_snapshot")}


# ── the time-end hook and decision 19 ─────────────────────────────────────────

def _time_service(calls):
    store = MagicMock()
    store.find_match_by_uuid.return_value = {"id": MATCH_ID, "uuid": MATCH_UUID, "status": "RUNNING",
                                             "current_clock": 3, "id_user_creator": USER_ID}
    store.find_user_id_by_uuid.return_value = USER_ID
    store.find_character_by_match_and_user.return_value = {"id": 10, "uuid": "c", "id_user": USER_ID}
    store.find_characters_by_match_id.return_value = [
        {"id": 10, "uuid": "c", "id_user": USER_ID, "dexterity": 1, "intelligence": 1,
         "constitution": 1, "life": 5, "energy": 5, "is_sleeping": True}]
    store.increment_match_clock.side_effect = lambda i: (calls.clock(i), 4)[1]
    store.set_all_characters_sleeping.side_effect = lambda i: calls.sleep_all(i)
    recovery = MagicMock()
    recovery.apply_at_time_start.return_value = MagicMock(pending=[], recovery=[],
                                                          edge_state=EdgeStateOutcome.none())
    service = TimeAdvancementService(store, MagicMock(), recovery_service=recovery)
    writer = MagicMock()
    writer.write_at_time_end.side_effect = lambda i: calls.snapshot(i)
    service.set_snapshot_writer(writer)
    return service, store, writer


def test_sleep_and_forced_time_end_snapshot_before_the_clock_moves():
    calls = MagicMock()
    service, _store, _writer = _time_service(calls)
    service.sleep(MATCH_UUID, "user-uuid")
    assert [c[0] for c in calls.mock_calls] == ["snapshot", "clock"]
    calls.reset_mock()
    service.force_time_end(MATCH_UUID)
    assert [c[0] for c in calls.mock_calls] == ["sleep_all", "snapshot", "clock"]


def test_the_restore_time_start_writes_no_snapshot():
    calls = MagicMock()
    service, store, writer = _time_service(calls)
    assert service.start_time_after_restore(MATCH_UUID) == 4
    writer.write_at_time_end.assert_not_called()
    store.replace_queue.assert_called_once()


# ── admin routes ─────────────────────────────────────────────────────────────

@pytest.fixture()
def client():
    service = MagicMock()
    controller = MatchAdminController(MagicMock(), MagicMock(), snapshot_service=service)
    app = FastAPI()
    app.include_router(controller.router)
    return TestClient(app), service


def test_routes_list_check_restore(client):
    http, service = client
    service.list.return_value = [SnapshotSummary("s1", 3, "LIGHT", NOW, "Time-end of clock 3", 99)]
    assert http.get("/api/admin/matches/m1/snapshots").json() == [{
        "uuid": "s1", "clock": 3, "type": "LIGHT", "timestamp": NOW,
        "description": "Time-end of clock 3", "sizeBytes": 99}]
    service.check.return_value = SnapshotCheck(False, [CheckError("USER_MISSING", "user 4")])
    assert http.get("/api/admin/matches/m1/snapshots/s1/check").json() == {
        "valid": False, "errors": [{"code": "USER_MISSING", "message": "user 4"}]}
    service.restore.return_value = RestoreResult("RESTORED", "s1", 3, "PAUSED", 7)
    assert http.post("/api/admin/matches/m1/snapshots/s1/restore").json() == {
        "status": "RESTORED", "uuidSnapshot": "s1", "clock": 3, "matchStatus": "PAUSED",
        "logsRemoved": 7}


def test_routes_errors(client):
    http, service = client
    service.list.side_effect = SnapshotError(sp.MATCH_NOT_FOUND, "Match not found: m1")
    resp = http.get("/api/admin/matches/m1/snapshots")
    assert resp.status_code == 404 and resp.json()["error"] == "MATCH_NOT_FOUND"
    service.check.side_effect = SnapshotError(sp.SNAPSHOT_NOT_FOUND, "Snapshot not found: zz")
    resp = http.get("/api/admin/matches/m1/snapshots/zz/check")
    assert resp.status_code == 404 and resp.json()["error"] == "SNAPSHOT_NOT_FOUND"
    service.restore.side_effect = SnapshotError(sp.SNAPSHOT_INTEGRITY_FAILED, "failed",
                                                [CheckError("STORY_ENTITY_MISSING", "trait 1")])
    resp = http.post("/api/admin/matches/m1/snapshots/s1/restore")
    assert resp.status_code == 409
    assert resp.json()["errors"] == [{"code": "STORY_ENTITY_MISSING", "message": "trait 1"}]


def test_routes_answer_501_when_not_wired():
    controller = MatchAdminController(MagicMock(), MagicMock())
    app = FastAPI()
    app.include_router(controller.router)
    http = TestClient(app)
    assert http.get("/api/admin/matches/m1/snapshots").status_code == 501
    assert http.get("/api/admin/matches/m1/snapshots/s/check").status_code == 501
    assert http.post("/api/admin/matches/m1/snapshots/s/restore").status_code == 501
