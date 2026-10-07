"""v0.41.6 — admin User tab and match owner move: the service (resolution, refusals, UNCHANGED, repair),
the user directory and persistence on SQLite, the routes, and the current owner on snapshot and export."""
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.adapters.persistence.story.models  # noqa: F401  registers the list_* tables
from app.adapters.persistence.story.models import CharacterTemplateEntity, LocationEntity
from app.adapters.persistence.auth.models import Base, User
from app.adapters.persistence.auth.user_directory_adapter import UserDirectoryAdapter
from app.adapters.persistence.match.match_persistence_adapter import MatchPersistenceAdapter
from app.adapters.persistence.match.models import GamingCharacterInstanceEntity, GamingMatchEntity
from app.adapters.persistence.match.snapshot_store_adapter import SnapshotStoreAdapter
from app.adapters.rest.auth.user_admin_controller import UserAdminController
from app.adapters.rest.match.match_owner_admin_controller import MatchOwnerAdminController
from app.core.models.auth.admin_user import AdminUserView
from app.core.models.match import match_owner as mo
from app.core.ports.match import log_writer_ports as lw
from app.core.ports.match import match_owner_ports as op
from app.core.ports.match.match_owner_ports import MatchOwnerError
from app.core.ports.match.match_ports import MatchPersistencePort
from app.core.services.match.match_export_service import MatchExportService
from app.core.services.match.match_owner_service import MatchOwnerService
from app.core.services.match.snapshot_service import SnapshotService, apply_owner
from app.core.ports.match.snapshot_ports import SnapshotCheck

NOW = datetime(2026, 10, 3, 10, 0, tzinfo=timezone.utc)
NEW_UUID = "11111111-2222-3333-4444-555555555555"
TS = "2026-09-28T10:00:00"


def _user(id_, uuid, username, role="PLAYER", state=6, expires=None):
    return AdminUserView(id=id_, uuid=uuid, username=username, email=f"{username}@x.it", role=role, state=state,
                         guest_expires_at=expires)


OLD = _user(1, "old-uuid", "alice")
TARGET = _user(2, NEW_UUID, "bob", expires="2027-01-01T00:00:00Z")


# ── model ─────────────────────────────────────────────────────────────────────

def test_admin_user_view_expiry_and_eligibility():
    assert not _user(1, "u", "a", expires=None).is_expired(NOW)
    assert not _user(1, "u", "a", expires=" ").is_expired(NOW)
    assert not _user(1, "u", "a", expires="garbage").is_expired(NOW)
    assert not _user(1, "u", "a", expires="2027-01-01T00:00:00").is_expired(NOW)
    assert _user(1, "u", "a", expires="2026-01-01T00:00:00Z").is_expired(NOW)
    assert not _user(1, "u", "a", state=2, expires="2026-01-01T00:00:00Z").is_expired(NOW)
    assert _user(1, "u", "a", state=2).reason(NOW) is None
    assert _user(1, "u", "a", role="admin", state=2).reason(NOW) == "USER_NOT_ALLOWED"
    assert _user(1, "u", "a", state=None).reason(NOW) == "USER_NOT_ALLOWED"
    assert _user(1, "u", "a", expires="2026-01-01T00:00:00Z").reason(NOW) == "USER_EXPIRED"
    body = _user(1, "u", "a", state=4).with_match_count(3).to_response(NOW)
    assert body["matchCount"] == 3 and body["eligible"] is False and body["reason"] == "USER_NOT_ALLOWED"
    assert body["guest"] is False and body["expired"] is False


def test_log_line_and_error_status():
    assert lw.owner_changed("a/1", "b/2") == "ADMIN_OWNER_CHANGED from=a/1 to=b/2"
    assert MatchOwnerError(op.INVALID_INPUT, "x").http_status == 400
    assert MatchOwnerError(op.USER_NOT_FOUND, "x").http_status == 404
    assert MatchOwnerError(op.USER_EXPIRED, "x").http_status == 409


def test_port_defaults_are_not_implemented():
    class Bare(MatchPersistencePort):
        pass
    Bare.__abstractmethods__ = frozenset()
    with pytest.raises(NotImplementedError):
        Bare().change_owner(1, 2)
    with pytest.raises(NotImplementedError):
        Bare().count_matches_by_user_creator(1)


# ── service ───────────────────────────────────────────────────────────────────

@pytest.fixture()
def svc():
    persistence, characters, users, writer = MagicMock(), MagicMock(), MagicMock(), MagicMock()
    match = {"id": 10, "uuid": "m-1", "id_story": 7, "status": "RUNNING", "current_clock": 4, "id_user_creator": 1}
    persistence.find_match_by_uuid.side_effect = lambda u: match if u == "m-1" else None
    persistence.has_active_match_for_story.return_value = False
    persistence.change_owner.return_value = 1
    persistence.count_matches_by_user_creator.return_value = 3
    characters.find_characters_by_match_id.return_value = [{"id": 1, "id_user": 1}]
    users.find_by_id.side_effect = {1: OLD, 2: TARGET}.get
    users.find_by_uuid.side_effect = lambda u: TARGET if u == NEW_UUID else None
    users.find_by_email.return_value = []
    usernames = {"bob": [TARGET]}
    users.find_by_username.side_effect = lambda u: usernames.get(u, [])
    service = MatchOwnerService(persistence, characters, users, writer, clock=lambda: NOW)
    service.match, service.usernames = match, usernames
    return service


def _code(call):
    with pytest.raises(MatchOwnerError) as err:
        call()
    return err.value.code


def _nothing_written(s):
    s.persistence.change_owner.assert_not_called()
    s.log_writer.write.assert_not_called()


def test_owner_and_its_errors(svc):
    assert svc.owner("m-1").username == "alice" and svc.owner("m-1").match_count == 3
    assert _code(lambda: svc.owner(" ")) == op.INVALID_INPUT
    assert _code(lambda: svc.owner("nope")) == op.MATCH_NOT_FOUND
    svc.match["id_user_creator"] = None
    assert _code(lambda: svc.owner("m-1")) == op.USER_NOT_FOUND


def test_resolution_order(svc):
    assert svc.find_user(f" {NEW_UUID} ").username == "bob"
    svc.users.find_by_email.assert_not_called()
    other = "99999999-2222-3333-4444-555555555555"
    svc.usernames[other] = [OLD]
    assert svc.find_user(other).username == "alice"
    svc.users.find_by_email.side_effect = lambda e: [TARGET] if e == "bob@x.it" else []
    assert svc.find_user("bob@x.it").username == "bob"
    assert svc.find_user("bob").username == "bob"
    fake = "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz"
    assert _code(lambda: svc.find_user(fake)) == op.USER_NOT_FOUND
    assert _code(lambda: svc.find_user("1-1-1-1-1")) == op.USER_NOT_FOUND
    assert [c.args[0] for c in svc.users.find_by_uuid.call_args_list] == [NEW_UUID, other]


def test_resolution_errors(svc):
    assert _code(lambda: svc.find_user("")) == op.INVALID_INPUT
    assert _code(lambda: svc.find_user("ghost")) == op.USER_NOT_FOUND
    svc.users.find_by_email.side_effect = lambda e: [OLD, TARGET] if e == "dup@x.it" else []
    assert _code(lambda: svc.find_user("dup@x.it")) == op.USER_AMBIGUOUS
    svc.usernames["twin"] = [OLD, TARGET]
    assert _code(lambda: svc.find_user("twin")) == op.USER_AMBIGUOUS


def test_move_writes_owner_and_log(svc):
    r = svc.move("m-1", "bob")
    assert r.status == mo.MOVED and r.characters_moved == 1
    assert r.previous_owner == mo.Owner("old-uuid", "alice") and r.owner == mo.Owner(NEW_UUID, "bob")
    svc.persistence.change_owner.assert_called_once_with(10, 2)
    svc.log_writer.write.assert_called_once_with(10, None, None, 4,
                                                 f"ADMIN_OWNER_CHANGED from=alice/old-uuid to=bob/{NEW_UUID}")
    assert r.to_response()["previousOwner"] == {"uuid": "old-uuid", "username": "alice"}


def test_move_without_previous_owner_clock_or_writer(svc):
    svc.users.find_by_id.side_effect = lambda i: None
    svc.match["current_clock"] = None
    assert svc.move("m-1", "bob").previous_owner == mo.Owner(None, None)
    svc.log_writer.write.assert_called_once_with(10, None, None, 0, f"ADMIN_OWNER_CHANGED from=None/None to=bob/{NEW_UUID}")
    svc.log_writer = None
    svc.persistence.change_owner.return_value = None
    assert svc.move("m-1", "bob").characters_moved == 0
    assert MatchOwnerService(svc.persistence, svc.characters, svc.users).clock().tzinfo is not None


def test_unchanged_and_repair(svc):
    svc.match["id_user_creator"] = 2
    svc.characters.find_characters_by_match_id.return_value = [{"id": 1, "id_user": 2}]
    assert svc.move("m-1", "bob").status == mo.UNCHANGED
    _nothing_written(svc)
    svc.characters.find_characters_by_match_id.return_value = [{"id": 1, "id_user": 1}]
    svc.persistence.has_active_match_for_story.return_value = True
    assert svc.move("m-1", "bob").status == mo.MOVED
    svc.persistence.has_active_match_for_story.return_value = False
    svc.match["id_user_creator"] = 1
    svc.characters.find_characters_by_match_id.return_value = None
    assert svc.move("m-1", "bob").status == mo.MOVED


def test_move_refusals(svc):
    assert _code(lambda: svc.move("m-1", " ")) == op.INVALID_INPUT
    assert _code(lambda: svc.move("", "bob")) == op.INVALID_INPUT
    assert _code(lambda: svc.move("nope", "bob")) == op.MATCH_NOT_FOUND
    assert _code(lambda: svc.move("m-1", "ghost")) == op.USER_NOT_FOUND
    svc.characters.find_characters_by_match_id.return_value = [{"id": 1, "id_user": 1}, {"id": 2, "id_user": 2}]
    assert _code(lambda: svc.move("m-1", "bob")) == op.MATCH_MULTI_CHARACTER
    svc.characters.find_characters_by_match_id.return_value = [{"id": 1, "id_user": 1}]
    for state in (1, 3, 4, 5):
        svc.usernames["carl"] = [_user(3, "c", "carl", state=state)]
        assert _code(lambda: svc.move("m-1", "carl")) == op.USER_NOT_ALLOWED
    svc.usernames["root"] = [_user(3, "r", "root", role="ADMIN", state=2)]
    assert _code(lambda: svc.move("m-1", "root")) == op.USER_NOT_ALLOWED
    svc.usernames["old"] = [_user(3, "o", "old", expires="2026-01-01T00:00:00Z")]
    assert _code(lambda: svc.move("m-1", "old")) == op.USER_EXPIRED
    svc.persistence.has_active_match_for_story.return_value = True
    assert _code(lambda: svc.move("m-1", "bob")) == op.ACTIVE_MATCH_ALREADY_EXISTS
    for status in ("ENDED", "GAMEOVER"):
        svc.match["status"] = status
        assert _code(lambda: svc.move("m-1", "bob")) == op.MATCH_TERMINATED
    _nothing_written(svc)


def test_imported_guest_without_expiry_is_a_valid_target(svc):
    svc.usernames["imp"] = [_user(6, "i", "imp", expires=None)]
    assert svc.move("m-1", "imp").status == mo.MOVED


# ── SQLite: directory, persistence, snapshot and export ───────────────────────

@pytest.fixture()
def factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    make = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    with make() as s:
        s.add(User(id=1, uuid="old-uuid", username="alice", state=6, email_address="Alice@X.it",
                   last_access=TS, ts_registration=TS))
        s.add(User(id=2, uuid=NEW_UUID, username="bob", state=6, email_address="dup@x.it"))
        s.add(User(id=3, uuid="u-3", username="carl", state=2, email_address="DUP@x.it"))
        s.add(GamingMatchEntity(id=1, uuid="m-1", id_story=9, id_difficulty=1, name="robottest", status="RUNNING",
                                current_clock=3, id_user_creator=1, ts_insert=TS, ts_update=TS))
        s.add(LocationEntity(id=1, id_story=9))
        s.add(CharacterTemplateEntity(id_tipo=1, id_story=9))
        s.add(GamingCharacterInstanceEntity(id=1, id_match=1, uuid="c-1", id_user=1, id_character_template=1,
                                            energy=20, life=10, id_location=1, ts_insert=TS, ts_update=TS))
        s.commit()
    yield make
    engine.dispose()


def test_user_directory_adapter(factory):
    d = UserDirectoryAdapter(factory)
    alice = d.find_by_id(1)
    assert alice.username == "alice" and alice.ts_last_access == TS and alice.email == "Alice@X.it"
    assert d.find_by_id(99) is None
    assert d.find_by_uuid(NEW_UUID).username == "bob"
    assert d.find_by_uuid(" ") is None and d.find_by_uuid("nope") is None
    assert [u.username for u in d.find_by_email(" alice@x.IT ")] == ["alice"]
    assert [u.id for u in d.find_by_email("dup@x.it")] == [2, 3]
    assert d.find_by_email("") == [] and d.find_by_username(None) == []
    assert d.find_by_username("carl ")[0].uuid == "u-3"


def test_persistence_change_owner_and_count(factory):
    p = MatchPersistenceAdapter(factory)
    assert p.count_matches_by_user_creator(1) == 1
    assert p.change_owner(1, 2) == 1
    assert p.find_match_by_uuid("m-1")["id_user_creator"] == 2
    assert p.count_matches_by_user_creator(1) == 0 and p.count_matches_by_user_creator(2) == 1
    with factory() as s:
        assert s.get(GamingCharacterInstanceEntity, (1, 1)).id_user == 2
    assert SnapshotStoreAdapter(factory).character_users(1) == {1: 2}


def test_snapshot_restore_and_check_keep_the_current_owner(factory):
    store = SnapshotStoreAdapter(factory)
    snaps = SnapshotService(store, 5)
    snaps.write_at_time_end(1)
    uuid = snaps.list("m-1")[0].uuid
    MatchPersistenceAdapter(factory).change_owner(1, 2)
    with factory() as s:
        s.query(User).filter(User.id == 1).delete()
        s.commit()
    assert snaps.check("m-1", uuid).valid
    snaps.restore("m-1", uuid)
    assert store.find_match_by_uuid("m-1")["id_user_creator"] == 2
    assert store.character_users(1) == {1: 2}


def test_apply_owner():
    state = {"gaming_match": [{"id_user_creator": 1}], "gaming_character_instance": [{"id": 1, "id_user": 1},
                                                                                       {"id": 2, "id_user": 1}]}
    out = apply_owner(state, 2, {1: 3})
    assert out["gaming_match"][0]["id_user_creator"] == 2
    assert [c["id_user"] for c in out["gaming_character_instance"]] == [3, 2]
    assert state["gaming_match"][0]["id_user_creator"] == 1
    assert apply_owner(state, None, {}) is state
    assert apply_owner({"other": []}, 2, {}) == {"other": []}


def test_export_uses_the_current_owner():
    snapshots, snapshot_service, store = MagicMock(), MagicMock(), MagicMock()
    store.story_uuid_by_id.return_value = None
    store.users_by_ids.return_value = {77: {"uuid": "u-77", "username": "b", "state": 6}}
    store.log_rows.return_value = []
    store.dialect.return_value = "sqlite"
    snapshot_service.check.return_value = SnapshotCheck(True, [])
    snapshots.character_users.return_value = {}
    payload = ('{"v":1,"matchUuid":"m","idStory":9,"clock":3,"state":{"gaming_match":[{"uuid":"m",'
               '"id_user_creator":42}],"gaming_character_instance":[]},"logMarks":{}}')
    snapshots.find_match_by_uuid.return_value = {"id": 1, "uuid": "m", "id_story": 9, "status": "ENDED",
                                                 "current_clock": 3, "id_user_creator": 77}
    snapshots.list.return_value = [{"uuid": "snap-1", "clock": 3}]
    snapshots.find.return_value = {"uuid": "snap-1", "clock": 3, "payload": payload}
    service = MatchExportService(snapshots, snapshot_service, store, MagicMock(), MagicMock(), "0.41.6", "test",
                                 5_000_000)
    result = service.export_match("m")
    store.users_by_ids.assert_called_once_with([77])
    assert '"creatorUserUuid":"u-77"' in result.canonical


# ── routes ────────────────────────────────────────────────────────────────────

@pytest.fixture()
def client():
    port = MagicMock()
    app = FastAPI()
    app.include_router(MatchOwnerAdminController(port).router)
    app.include_router(UserAdminController(port).router)
    c = TestClient(app)
    c.port = port
    return c


def test_owner_routes(client):
    client.port.owner.return_value = _user(1, "u-1", "alice", expires="2000-01-01T00:00:00Z").with_match_count(2)
    body = client.get("/api/admin/matches/m-1/owner").json()
    assert body["uuid"] == "u-1" and body["expired"] is True and body["reason"] == "USER_EXPIRED"
    assert body["matchCount"] == 2
    client.port.move.return_value = mo.MatchOwnerMoveResult("MOVED", "m-1", mo.Owner("u-1", "alice"),
                                                            mo.Owner("u-2", "bob"), 1)
    r = client.put("/api/admin/matches/m-1/owner", json={"user": "bob"})
    assert r.status_code == 200 and r.json()["owner"]["username"] == "bob" and r.json()["charactersMoved"] == 1
    client.port.move.assert_called_once_with("m-1", "bob")


def test_owner_route_errors(client):
    for body in ({}, {"user": " "}, {"user": 5}, [1]):
        r = client.put("/api/admin/matches/m-1/owner", json=body)
        assert r.status_code == 400 and r.json()["error"] == "INVALID_INPUT"
    assert client.put("/api/admin/matches/m-1/owner").status_code == 400
    for code, http in ((op.MATCH_NOT_FOUND, 404), (op.USER_AMBIGUOUS, 409), (op.MATCH_TERMINATED, 409),
                       (op.ACTIVE_MATCH_ALREADY_EXISTS, 409), (op.INVALID_INPUT, 400)):
        client.port.move.side_effect = MatchOwnerError(code, "msg")
        r = client.put("/api/admin/matches/m-1/owner", json={"user": "x"})
        assert r.status_code == http and r.json()["error"] == code
    client.port.owner.side_effect = MatchOwnerError(op.MATCH_NOT_FOUND, "nope")
    assert client.get("/api/admin/matches/nope/owner").status_code == 404


def test_user_route(client):
    client.port.find_user.return_value = _user(3, "u-3", "test_player1", state=2)
    body = client.get("/api/admin/users/player1@test.local").json()
    assert body["username"] == "test_player1" and body["eligible"] is True and body["reason"] is None
    client.port.find_user.assert_called_once_with("player1@test.local")
    client.port.find_user.side_effect = MatchOwnerError(op.USER_AMBIGUOUS, "two")
    assert client.get("/api/admin/users/dup").status_code == 409
