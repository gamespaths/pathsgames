"""V1 step 10 (1.7.0): admin user management — list rules, actions and refusals, intervention log, banned
hashes, suspension end and re-link at login and refresh, the persistence adapters and the REST controller."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

import app.adapters.persistence.match.models  # noqa: F401  registers gaming_* tables
import app.adapters.persistence.story.models  # noqa: F401  registers list_* tables
from app.adapters.persistence import database
from app.adapters.persistence.auth.admin_intervention_adapter import AdminInterventionAdapter
from app.adapters.persistence.auth.models import AdminInterventionLog, Base, User, UserIdentity as IdentityRow
from app.adapters.persistence.auth.token_persistence_adapter import TokenPersistenceAdapter
from app.adapters.persistence.auth.user_admin_persistence_adapter import UserAdminPersistenceAdapter, escape_like
from app.adapters.persistence.match.match_persistence_adapter import MatchPersistenceAdapter
from app.adapters.rest.auth.user_admin_controller import UserAdminController
from app.adapters.scheduler import account_jobs_scheduler
from app.config import DEV_BANNED_SUBJECT_PEPPER, DEV_JWT_SECRET, Settings, check_secrets
from app.core.models.auth import user_admin as ua
from app.core.models.auth.admin_user import AdminUserView
from app.core.models.auth.auth_error import AuthError
from app.core.models.auth.identity import GoogleIdentityClaims, UserIdentity, UserStatus
from app.core.models.auth.profile import UserStats
from app.core.models.auth.user_admin import AdminUserItem, UserAdminError
from app.core.models.match import match_statuses
from app.core.ports.auth.token_persistence_port import TokenPersistencePort
from app.core.ports.match.match_ports import MatchPersistencePort
from app.core.services.auth.account_guard_service import AUTO_UNBLOCK_REASON, AccountGuardService, iso, parse_instant
from app.core.services.auth.google_login_service import GoogleLoginService
from app.core.services.auth.session_service import SessionService
from app.core.services.auth.subject_hasher import DEFAULT_PEPPER, SubjectHasher
from app.core.services.auth.user_admin_service import (UserAdminService, _minus_months, check_reason, clamp,
                                                        decode_cursor, encode_cursor, parse_state)

NOW = datetime(2026, 10, 22, 10, 0, tzinfo=timezone.utc)
HASHER = SubjectHasher("pepper")


def item(state=2, role="PLAYER", uuid="u-7", nickname="Alice", access="2026-10-01", until=None):
    return AdminUserItem(7, uuid, nickname, state, role, "GOOGLE", "2026-01-01", access, until)


def google(user_id=7, sub="sub-7"):
    return UserIdentity(3, user_id, "GOOGLE", sub, "alice@gmail.com")


@pytest.fixture()
def deps():
    d = {k: MagicMock() for k in ("identities", "persistence", "tokens", "state", "log", "matches", "commands",
                                  "accounts")}
    d["identities"].find_identities_of_user.return_value = [google()]
    d["persistence"].find_email.return_value = None
    d["matches"].find_match_uuids_by_user_creator.return_value = []
    return d


def service(d, accounts=True):
    return UserAdminService(d["identities"], d["persistence"], d["tokens"], d["state"], d["log"], HASHER,
                            d["matches"], d["commands"], d["accounts"] if accounts else None, clock=lambda: NOW)


def code_of(call):
    with pytest.raises(UserAdminError) as e:
        call()
    return e.value.code


# ── helpers ──────────────────────────────────────────────────────────────────

def test_helpers():
    assert clamp(None) == 50 and clamp(0) == 1 and clamp(999) == 200
    assert parse_state(None) is None and parse_state(" ") is None and parse_state("3") == 3
    for bad in ("6", "0", "8", "x"):
        assert code_of(lambda: parse_state(bad)) == "INVALID_INPUT"
    assert decode_cursor(encode_cursor("alice", "u-1")) == ["alice", "u-1"]
    assert decode_cursor(None) is None and decode_cursor(" ") is None
    assert decode_cursor("@@@") is None
    assert decode_cursor(encode_cursor("nosep", "").rstrip("=")[:-2] + "fA") is None
    assert decode_cursor("bm9zZXA") is None
    assert code_of(lambda: check_reason(None)) == "INVALID_INPUT"
    assert code_of(lambda: check_reason("x" * 501)) == "INVALID_INPUT"
    assert check_reason(" ok ") == "ok"
    assert _minus_months(datetime(2026, 3, 31, tzinfo=timezone.utc), 1).day == 28
    assert _minus_months(datetime(2024, 3, 31, tzinfo=timezone.utc), 1).day == 29
    assert _minus_months(datetime(2026, 1, 15, tzinfo=timezone.utc), 24).year == 2024
    assert UserAdminError("X", "m").http_status == 400 and UserAdminError("USER_NOT_FOUND", "m").http_status == 404
    assert parse_instant(None) is None and parse_instant("bad") is None
    assert parse_instant("2026-11-01T00:00:00").tzinfo is not None
    assert iso(NOW) == "2026-10-22T10:00:00Z"


def test_hasher():
    assert HASHER.email(" A@Gmail.com ") == HASHER.email("a@gmail.com")
    assert len(HASHER.subject("s")) == 64
    assert HASHER.subject("s") != SubjectHasher("other").subject("s")
    assert SubjectHasher(None).subject("s") == SubjectHasher(DEFAULT_PEPPER).subject("s")
    assert HASHER.subject(None) is None and HASHER.subject(" ") is None and HASHER.email("") is None


# ── list and detail ──────────────────────────────────────────────────────────

def test_default_view_by_last_access_with_cursor(deps):
    a, b = item(), item(uuid="u-8", nickname="bob", access=None)
    deps["persistence"].list_by_last_access.return_value = [a, b]
    page = service(deps).list(limit=1)
    assert page.items == [a] and decode_cursor(page.next_cursor) == ["2026-10-01", "u-7"]
    deps["persistence"].list_by_last_access.assert_called_with(2, None, None, 2)
    service(deps).list(cursor=page.next_cursor, limit=1)
    deps["persistence"].list_by_last_access.assert_called_with(2, "2026-10-01", "u-7", 2)
    deps["persistence"].list_by_last_access.return_value = []
    body = service(deps).list().to_body()
    assert body == {"items": [], "nextCursor": None, "limit": 50}


def test_state_and_nickname_alphabetical(deps):
    deps["persistence"].list_by_nickname.return_value = [item(), item(uuid="u-8", nickname=None)]
    page = service(deps).list(nickname=" AL ", state="3", limit=1)
    deps["persistence"].list_by_nickname.assert_called_with(3, "al", None, None, 2)
    assert decode_cursor(page.next_cursor) == ["alice", "u-7"]
    deps["persistence"].list_by_nickname.return_value = [item(uuid="u-8", nickname=None), item()]
    assert decode_cursor(service(deps).list(state="4", limit=1).next_cursor) == ["", "u-8"]
    deps["persistence"].list_by_nickname.assert_called_with(4, "", None, None, 2)


def test_email_exact_honours_state(deps):
    deps["persistence"].find_by_email.return_value = item()
    assert len(service(deps).list(email=" Alice@Gmail.com ").items) == 1
    deps["persistence"].find_by_email.assert_called_with("alice@gmail.com")
    assert service(deps).list(email="alice@gmail.com", state="3").items == []
    deps["persistence"].find_by_email.return_value = None
    assert service(deps).list(email="x@gmail.com").items == []


def test_detail(deps):
    deps["persistence"].find_by_uuid.return_value = item(state=3, until="2026-11-01T00:00:00Z")
    deps["persistence"].is_relink_pending.return_value = True
    deps["persistence"].has_banned_hashes.return_value = False
    deps["tokens"].count_active_by_user_id.return_value = 2
    deps["accounts"].stats.return_value = UserStats(1, 1, 0, 5, 2)
    body = service(deps).detail("u-7").to_body()
    assert body["accountType"] == "GOOGLE" and body["sessions"] == 2 and body["relinkPending"] is True
    assert body["identities"][0]["subject"] == "sub-7" and body["stats"]["matchesCompleted"] == 1
    deps["persistence"].find_by_uuid.return_value = item(state=6)
    detail = service(deps, accounts=False).detail("u-7")
    assert detail.account_type == "GUEST" and detail.stats == UserStats()
    deps["persistence"].find_by_uuid.return_value = None
    assert service(deps).detail("x") is None


# ── actions ──────────────────────────────────────────────────────────────────

def test_ban_side_effects_and_log(deps):
    deps["persistence"].find_by_uuid.return_value = item()
    deps["matches"].find_match_uuids_by_user_creator.return_value = ["m-1", "m-2"]
    deps["commands"].update_match.side_effect = lambda uuid, *a: "UPDATED" if uuid == "m-1" else "NOT_FOUND"
    result = service(deps).ban("adm", "u-7", " spam ")
    assert result.to_body()["bannedMatchUuids"] == ["m-1"] and result.state == 4
    deps["persistence"].store_banned_hashes.assert_called_with("u-7", HASHER.subject("sub-7"),
                                                              HASHER.email("alice@gmail.com"))
    deps["persistence"].update_state_and_suspension.assert_called_with(7, 4, None)
    deps["tokens"].revoke_all_by_user_id.assert_called_with(7, "ADMIN")
    deps["tokens"].set_sessions_valid_after.assert_called_once()
    deps["state"].evict.assert_called_with("u-7")
    deps["commands"].update_match.assert_any_call("m-1", match_statuses.BANNED, None, ua.BAN)
    deps["matches"].find_match_uuids_by_user_creator.assert_called_with(7, match_statuses.ACTIVE)
    deps["log"].record.assert_called_with("adm", ua.BAN, "u-7", "spam")


def test_ban_of_a_deleting_user_keeps_state_7(deps):
    deps["persistence"].find_by_uuid.return_value = item(state=7)
    deps["identities"].find_identities_of_user.return_value = []
    deps["persistence"].find_email.return_value = "old@gmail.com"
    assert service(deps).ban("adm", "u-7", "fraud").state == 7
    deps["persistence"].store_banned_hashes.assert_called_with("u-7", None, HASHER.email("old@gmail.com"))


def test_ban_refusals_write_nothing(deps):
    s = service(deps)
    deps["persistence"].find_by_uuid.return_value = None
    assert code_of(lambda: s.ban("a", "u-7", " ")) == "INVALID_INPUT"
    assert code_of(lambda: s.ban("a", None, "r")) == "USER_NOT_FOUND"
    assert code_of(lambda: s.ban("a", "u-9", "r")) == "USER_NOT_FOUND"
    deps["persistence"].find_by_uuid.return_value = item(state=6)
    assert code_of(lambda: s.ban("a", "u-7", "r")) == "GUEST_NOT_BANNABLE"
    deps["persistence"].find_by_uuid.return_value = item(role="ADMIN")
    assert code_of(lambda: s.ban("a", "u-7", "r")) == "ADMIN_NOT_BANNABLE"
    deps["persistence"].find_by_uuid.return_value = item(state=4)
    assert code_of(lambda: s.ban("a", "u-7", "r")) == "INVALID_STATE_TRANSITION"
    deps["log"].record.assert_not_called()
    deps["tokens"].revoke_all_by_user_id.assert_not_called()


def test_suspend_limits(deps):
    s = service(deps)
    deps["persistence"].find_by_uuid.return_value = item()
    assert s.suspend("adm", "u-7", "2026-11-01T00:00:00Z", "rude").suspended_until == "2026-11-01T00:00:00Z"
    deps["persistence"].update_state_and_suspension.assert_called_with(7, 3, "2026-11-01T00:00:00Z")
    deps["log"].record.assert_called_with("adm", ua.SUSPEND, "u-7", "rude")
    assert s.suspend("adm", "u-7", "2026-12-01", "again").suspended_until == "2026-12-01T00:00:00Z"
    assert s.suspend("adm", "u-7", "2026-12-01T00:00:00", "naive").suspended_until == "2026-12-01T00:00:00Z"
    for bad in (None, "soon", "2026-10-21T00:00:00Z", "2027-02-01"):
        assert code_of(lambda: s.suspend("a", "u-7", bad, "r")) == "SUSPEND_UNTIL_INVALID"
    deps["persistence"].find_by_uuid.return_value = item(state=4)
    assert code_of(lambda: s.suspend("a", "u-7", "2026-11-01", "r")) == "INVALID_STATE_TRANSITION"


def test_v1_10_expire_suspension_moves_the_end_one_second_back_without_a_log_row(deps):
    s = service(deps)
    deps["persistence"].find_by_uuid.return_value = item(state=3, until="2026-11-01T00:00:00Z")
    r = s.expire_suspension("u-7")
    assert r.state == 3 and r.suspended_until == "2026-10-22T09:59:59Z"
    deps["persistence"].update_state_and_suspension.assert_called_with(7, 3, "2026-10-22T09:59:59Z")
    deps["state"].evict.assert_called_with("u-7")
    deps["log"].record.assert_not_called()
    deps["persistence"].find_by_uuid.return_value = item(state=2)
    assert code_of(lambda: s.expire_suspension("u-7")) == "INVALID_STATE_TRANSITION"
    deps["persistence"].find_by_uuid.return_value = None
    assert code_of(lambda: s.expire_suspension("nope")) == "USER_NOT_FOUND"


def test_unblock_relink_and_deletion(deps):
    s = service(deps)
    deps["persistence"].find_by_uuid.return_value = item(state=4)
    assert s.unblock("adm", "u-7", "appeal").state == 2
    deps["persistence"].delete_banned_hashes.assert_called_with("u-7")
    deps["log"].record.assert_called_with("adm", ua.UNBLOCK, "u-7", "appeal")
    deps["commands"].update_match.assert_not_called()
    deps["persistence"].find_by_uuid.return_value = item()
    assert code_of(lambda: s.unblock("a", "u-7", "r")) == "INVALID_STATE_TRANSITION"
    assert s.relink_subject("adm", "u-7", "new phone").relink_pending is True
    deps["persistence"].set_relink_pending.assert_called_with(7, True)
    deps["identities"].find_identities_of_user.return_value = [UserIdentity(3, 7, "OTHER", "s", "e")]
    assert code_of(lambda: s.relink_subject("a", "u-7", "r")) == "INVALID_STATE_TRANSITION"
    deps["persistence"].find_by_uuid.return_value = item(state=6)
    assert code_of(lambda: s.relink_subject("a", "u-7", "r")) == "INVALID_STATE_TRANSITION"
    deps["persistence"].find_by_uuid.return_value = item()
    assert s.delete_user("adm", "u-7", "old").state == 7
    deps["identities"].update_state.assert_called_with(7, 7)
    deps["log"].record.assert_called_with("adm", ua.DELETE_OLD_USER, "u-7", "old")
    deps["persistence"].find_by_uuid.return_value = item(state=7)
    assert code_of(lambda: s.delete_user("a", "u-7", "r")) == "INVALID_STATE_TRANSITION"


def test_actions_without_the_state_cache(deps):
    deps["persistence"].find_by_uuid.return_value = item(state=3)
    deps["state"] = None
    assert service(deps).unblock("adm", "u-7", "ok").state == 2


def test_purge_24_months(deps):
    deps["log"].delete_older_than.return_value = 3
    assert service(deps).purge_intervention_log() == 3
    deps["log"].delete_older_than.assert_called_with("2024-10-22T10:00:00Z")


# ── guard ────────────────────────────────────────────────────────────────────

def guard(persistence, log, state=None):
    return AccountGuardService(persistence, log, state, HASHER, clock=lambda: NOW)


def test_guard_banned_hashes():
    persistence = MagicMock()
    persistence.is_banned.side_effect = lambda s, e: s == HASHER.subject("bad")
    with pytest.raises(AuthError) as e:
        guard(persistence, MagicMock()).check_not_banned("bad", "x@gmail.com")
    assert e.value.code == "ACCOUNT_DISABLED"
    guard(persistence, MagicMock()).check_not_banned("good", "x@gmail.com")


def test_guard_suspension_end_and_refusals():
    persistence, log, state = MagicMock(), MagicMock(), MagicMock()
    user = UserStatus(7, "u-7", "g", "alice", "PLAYER", 3)
    persistence.find_by_uuid.return_value = item(state=3, until="2026-10-22T09:00:00Z")
    assert guard(persistence, log, state).admit(user).state == 2
    persistence.update_state_and_suspension.assert_called_with(7, 2, None)
    state.evict.assert_called_with("u-7")
    log.record.assert_called_with(ua.SYSTEM, ua.UNBLOCK, "u-7", AUTO_UNBLOCK_REASON)
    persistence.find_by_uuid.return_value = item(state=3, until="2026-10-22T09:00:00Z")
    assert guard(persistence, log).admit(user).state == 2
    persistence.find_by_uuid.return_value = item(state=3, until="2026-11-01T00:00:00Z")
    with pytest.raises(AuthError) as e:
        guard(persistence, log).admit(user)
    assert e.value.body()["suspendedUntil"] == "2026-11-01T00:00:00Z"
    persistence.find_by_uuid.return_value = None
    with pytest.raises(AuthError) as e:
        guard(persistence, log).admit(user)
    assert "suspendedUntil" not in e.value.body()
    with pytest.raises(AuthError):
        guard(persistence, log).admit(UserStatus(7, "u-7", "g", "a", "PLAYER", 4))
    assert guard(persistence, log).admit(UserStatus(7, "u-7", "g", "a", "PLAYER", 2)).state == 2


def test_guard_relink():
    persistence = MagicMock()
    persistence.is_relink_pending.return_value = False
    g = guard(persistence, MagicMock())
    assert g.relink(google(sub="old"), "new") is False
    persistence.is_relink_pending.return_value = True
    assert g.relink(google(sub="old"), "new") is True
    persistence.replace_identity_subject.assert_called_with(3, 7, "new")
    assert g.relink(None, "n") is False
    assert g.relink(UserIdentity(None, 7, "GOOGLE", "o", "e"), "n") is False


# ── login and refresh use the guard ──────────────────────────────────────────

def _claims(sub="sub-1"):
    return GoogleIdentityClaims(sub, "mario@gmail.com", True, "M R", "M", "R", "pic", "it-IT", "nonce",
                                "https://accounts.google.com", "client", int(NOW.timestamp()) + 600,
                                int(NOW.timestamp()))


@pytest.fixture()
def login_deps():
    d = {k: MagicMock() for k in ("verifier", "identities", "jwt", "tokens", "guests", "merge", "guard")}
    d["verifier"].client_id.return_value = "client"
    d["verifier"].verify.return_value = _claims()
    d["identities"].find_identity_by_email.return_value = None
    d["identities"].find_user_by_email.return_value = None
    d["identities"].mark_id_token_seen.return_value = True
    d["jwt"].generate_access_token.return_value = "a"
    d["jwt"].generate_refresh_token.return_value = "r"
    d["jwt"].get_refresh_token_expiration_ms.return_value = int(NOW.timestamp() * 1000) + 600000
    d["jwt"].validate_token.return_value = False
    return d


def login(d):
    return GoogleLoginService(d["verifier"], d["identities"], d["jwt"], d["tokens"], d["guests"], d["merge"],
                              True, 5, None, clock=lambda: NOW, account_guard=d["guard"]).login("t", "nonce")


def test_login_refuses_a_banned_subject_first(login_deps):
    login_deps["guard"].check_not_banned.side_effect = AuthError("ACCOUNT_DISABLED", "banned")
    with pytest.raises(AuthError):
        login(login_deps)
    login_deps["identities"].find_identity_by_email.assert_not_called()


def test_login_relinks_and_admits(login_deps):
    user = UserStatus(8, "u8", "g8", "m", "PLAYER", 3)
    login_deps["identities"].find_identity_by_email.return_value = google(user_id=8, sub="old")
    login_deps["identities"].find_user_by_id.return_value = user
    login_deps["guard"].relink.return_value = True
    login_deps["guard"].admit.return_value = UserStatus(8, "u8", "g8", "m", "PLAYER", 2)
    assert login(login_deps).new_user is False
    login_deps["guard"].relink.return_value = False
    with pytest.raises(AuthError) as e:
        login(login_deps)
    assert e.value.code == "IDENTITY_MISMATCH"


def test_login_admits_a_user_found_by_email(login_deps):
    user = UserStatus(8, "u8", "imported", "m", "PLAYER", 2)
    login_deps["identities"].find_user_by_email.return_value = user
    login_deps["guard"].admit.return_value = user
    login(login_deps)
    login_deps["guard"].admit.assert_called_with(user)


def test_refresh_uses_the_guard():
    jwt, tokens, g = MagicMock(), MagicMock(), MagicMock()
    jwt.validate_token.return_value = True
    jwt.parse_token.return_value = SimpleNamespace(is_refresh_token=lambda: True, user_uuid="u8", iat=0)
    jwt.get_refresh_token_expiration_ms.return_value = int(NOW.timestamp() * 1000) + 600000
    jwt.generate_refresh_token.return_value = "new-refresh"
    jwt.generate_access_token.return_value = "new-access"
    jwt.get_access_token_expiration_ms.return_value = 1
    tokens.find_refresh_token.return_value = SimpleNamespace(id=1, user_id=8, revoked=False, expires_at=None,
                                                             ts_rotated=None)
    tokens.find_user_by_id.return_value = UserStatus(8, "u8", "g8", "m", "PLAYER", 3)
    g.admit.return_value = UserStatus(8, "u8", "g8", "m", "PLAYER", 2)
    session = SessionService(jwt, tokens, 5, clock=lambda: NOW, account_guard=g).refresh_session("rt")
    assert session.user_uuid == "u8"
    g.admit.side_effect = AuthError("ACCOUNT_DISABLED", "x", suspended_until="2026-11-01T00:00:00Z")
    with pytest.raises(AuthError):
        SessionService(jwt, tokens, 5, clock=lambda: NOW, account_guard=g).refresh_session("rt")


# ── persistence adapters on SQLite ───────────────────────────────────────────

@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    with factory() as s:
        rows = [(1, "u-1", "Alice", 2, "PLAYER", "alice@gmail.com", "2026-10-03"),
                (2, "u-2", "alberto", 2, "PLAYER", "alberto@gmail.com", "2026-10-05"),
                (3, "u-3", "bob_x", 3, "PLAYER", None, "2026-10-01"),
                (4, "u-4", "guest_1", 6, "PLAYER", None, "2026-10-09"),
                (5, "u-5", "admin", 2, "ADMIN", None, None)]
        for i, uuid, nick, state, role, email, access in rows:
            s.add(User(id=i, uuid=uuid, username=f"user_{i}", nickname=nick, state=state, role=role,
                       email_address=email, last_access=access))
        s.add(IdentityRow(id=1, uuid="i-1", id_user=1, provider="GOOGLE", provider_subject="sub-1",
                          email="alice@gmail.com"))
        s.commit()
    yield factory
    engine.dispose()


def uuids(items):
    return [i.uuid for i in items]


def test_adapter_nickname_and_last_access(db):
    a = UserAdminPersistenceAdapter(db)
    al = a.list_by_nickname(None, "al", None, None, 10)
    assert uuids(al) == ["u-2", "u-1"] and al[1].account_type == "GOOGLE" and al[0].account_type == "INTERNAL"
    assert uuids(a.list_by_nickname(None, "al", "alberto", "u-2", 10)) == ["u-1"]
    assert uuids(a.list_by_nickname(None, "bob_", None, None, 10)) == ["u-3"]
    assert uuids(a.list_by_nickname(None, "bo%", None, None, 10)) == []
    assert uuids(a.list_by_nickname(2, "", None, None, 10)) == ["u-5", "u-2", "u-1"]
    assert uuids(a.list_by_last_access(2, None, None, 10)) == ["u-2", "u-1", "u-5"]
    assert uuids(a.list_by_last_access(2, "2026-10-05", "u-2", 10)) == ["u-1", "u-5"]
    assert a.list_by_nickname(9, "", None, None, 10) == []
    assert escape_like("a\\b%c_") == "a\\\\b\\%c\\_"


def test_adapter_fields_relink_and_hashes(db):
    a = UserAdminPersistenceAdapter(db)
    assert a.find_by_email("alice@gmail.com").uuid == "u-1" and a.find_by_email("x@gmail.com") is None
    assert a.find_by_uuid("missing") is None
    assert a.find_email(1) == "alice@gmail.com" and a.find_email(3) is None and a.find_email(99) is None
    a.update_state_and_suspension(3, 3, "2026-11-01T00:00:00Z")
    assert a.find_by_uuid("u-3").suspended_until == "2026-11-01T00:00:00Z"
    assert a.is_relink_pending(1) is False and a.is_relink_pending(99) is False
    a.set_relink_pending(1, True)
    assert a.is_relink_pending(1) is True
    a.replace_identity_subject(1, 1, "sub-new")
    assert a.is_relink_pending(1) is False
    with db() as s:
        assert s.get(IdentityRow, 1).provider_subject == "sub-new"
    a.store_banned_hashes("u-1", "hs1", "he1")
    assert a.is_banned("hs1", None) and a.is_banned(None, "he1") and not a.is_banned("x", "y")
    assert a.has_banned_hashes("u-1")
    a.store_banned_hashes("u-2", "hs1", "he2")
    a.store_banned_hashes("u-3", "hs1", "he1")
    assert not a.has_banned_hashes("u-3")
    assert a.delete_banned_hashes("u-1") == 1
    assert not a.is_banned("hs1", "he1") and a.is_banned(None, "he2")


def test_intervention_log_tokens_and_matches(db):
    log = AdminInterventionAdapter(db)
    log.record("adm", "BAN", "u-1", "spam")
    log.record(None, "UNBLOCK", "u-1", "ok")
    with db() as s:
        rows = s.query(AdminInterventionLog).order_by(AdminInterventionLog.id).all()
        assert [r.admin_uuid for r in rows] == ["adm", "UNKNOWN"]
        rows[0].ts_insert = "2020-01-01T00:00:00Z"
        s.commit()
    assert log.delete_older_than("2024-10-22T00:00:00Z") == 1
    tokens = TokenPersistenceAdapter(db)
    tokens.store_refresh_token(1, "h1", "2027-01-01")
    tokens.store_refresh_token(1, "h2", "2027-01-01")
    tokens.revoke_refresh_token("h2", None)
    assert tokens.count_active_by_user_id(1) == 1
    matches = MatchPersistenceAdapter(db)
    assert matches.find_match_uuids_by_user_creator(1, []) == []
    assert matches.find_match_uuids_by_user_creator(1, match_statuses.ACTIVE) == []


def test_port_defaults_are_not_implemented():
    class BareTokens(TokenPersistencePort):
        pass

    class BareMatch(MatchPersistencePort):
        pass

    for bare in (BareTokens, BareMatch):
        bare.__abstractmethods__ = frozenset()
    with pytest.raises(NotImplementedError):
        BareTokens().count_active_by_user_id(1)
    with pytest.raises(NotImplementedError):
        BareMatch().find_match_uuids_by_user_creator(1, ["RUNNING"])


def test_align_schema_adds_the_step10_columns():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as c:
        c.execute(text("CREATE TABLE users (id INTEGER, state INTEGER, last_access TEXT, nickname TEXT,"
                       " email_address TEXT, theme_selected TEXT)"))
        c.execute(text("INSERT INTO users (id, state) VALUES (1, 2)"))
    applied = database.align_schema(engine)
    assert "ALTER TABLE users ADD COLUMN suspended_until TEXT" in applied
    assert "ALTER TABLE users ADD COLUMN relink_pending INTEGER NOT NULL DEFAULT 0" in applied
    with engine.begin() as c:
        assert c.execute(text("SELECT relink_pending FROM users")).scalar() == 0


# ── config and jobs ──────────────────────────────────────────────────────────

def test_check_secrets_refuses_the_committed_pepper():
    private = "a-private-random-secret-of-32-chars!!"
    check_secrets(Settings(env="development", jwt_secret=DEV_JWT_SECRET))
    check_secrets(Settings(env="production", jwt_secret=private, banned_subject_pepper="private-pepper"))
    for pepper in (DEV_BANNED_SUBJECT_PEPPER, " "):
        with pytest.raises(RuntimeError, match="BANNED_SUBJECT_PEPPER"):
            check_secrets(Settings(env="alpha", jwt_secret=private, banned_subject_pepper=pepper))
    assert DEV_BANNED_SUBJECT_PEPPER == DEFAULT_PEPPER


def test_retention_job_purges_the_log():
    account, admin = MagicMock(), MagicMock()
    account.retire_inactive_users.return_value = 1
    assert account_jobs_scheduler.run_retention(account, admin) == 1
    admin.purge_intervention_log.assert_called_once()
    scheduler = MagicMock()
    account_jobs_scheduler.start_account_jobs(account, SimpleNamespace(account_jobs_enabled=True),
                                              lambda timezone: scheduler, user_admin_service=admin)
    assert scheduler.add_job.call_args_list[1].kwargs["args"] == [account, admin, None]


# ── REST ─────────────────────────────────────────────────────────────────────

@pytest.fixture()
def rest():
    owner, admin = MagicMock(), MagicMock()
    app = FastAPI()

    @app.middleware("http")
    async def as_admin(request: Request, call_next):
        request.state.user_uuid = "adm"
        return await call_next(request)

    app.include_router(UserAdminController(owner, admin).router)
    return TestClient(app), owner, admin


def test_rest_list_and_detail(rest):
    client, owner, admin = rest
    admin.list.return_value = ua.AdminUserPage([item()], "next", 10)
    body = client.get("/api/admin/users", params={"nickname": "al", "state": "2", "limit": 10}).json()
    assert body["items"][0]["nickname"] == "Alice" and "email" not in body["items"][0]
    assert body["nextCursor"] == "next"
    admin.list.assert_called_with(None, "al", "2", None, 10)
    admin.list.side_effect = UserAdminError("INVALID_INPUT", "no guests")
    response = client.get("/api/admin/users", params={"state": "6"})
    assert response.status_code == 400 and response.json()["error"] == "INVALID_INPUT"
    owner.find_user.return_value = AdminUserView(3, "u-3", "p1", None, "p1@test.local", "PLAYER", 2)
    admin.detail.return_value = ua.AdminUserDetail("GOOGLE", None, False, False, 2, UserStats(), [google()])
    detail = client.get("/api/admin/users/p1@test.local").json()
    assert detail["eligible"] is True and detail["sessions"] == 2 and detail["accountType"] == "GOOGLE"
    admin.detail.return_value = None
    assert "sessions" not in client.get("/api/admin/users/p1@test.local").json()
    from app.core.ports.match.match_owner_ports import MatchOwnerError
    owner.find_user.side_effect = MatchOwnerError("USER_NOT_FOUND", "none")
    assert client.get("/api/admin/users/ghost").status_code == 404


def test_rest_actions(rest):
    client, _, admin = rest
    done = ua.AdminUserActionResult("u-5", "BAN", 4, None, False, ["m-1"])
    for name in ("ban", "suspend", "unblock", "relink_subject", "delete_user"):
        getattr(admin, name).return_value = done
    assert client.post("/api/admin/users/u-5/ban", json={"reason": "spam"}).json()["bannedMatchUuids"] == ["m-1"]
    admin.ban.assert_called_with("adm", "u-5", "spam")
    client.post("/api/admin/users/u-5/suspend", json={"reason": "rude", "until": "2026-11-01"})
    admin.suspend.assert_called_with("adm", "u-5", "2026-11-01", "rude")
    client.post("/api/admin/users/u-5/unblock", json={"reason": "ok"})
    admin.unblock.assert_called_with("adm", "u-5", "ok")
    client.post("/api/admin/users/u-5/relink-subject", json={"reason": "sub"})
    admin.relink_subject.assert_called_with("adm", "u-5", "sub")
    client.post("/api/admin/users/u-5/deletion", json={"reason": "old"})
    admin.delete_user.assert_called_with("adm", "u-5", "old")
    admin.ban.side_effect = UserAdminError("ADMIN_NOT_BANNABLE", "admin")
    response = client.post("/api/admin/users/u-1/ban")
    assert response.status_code == 400 and response.json()["error"] == "ADMIN_NOT_BANNABLE"
    admin.ban.assert_called_with("adm", "u-1", None)


def test_auth_error_body_carries_the_suspension_end():
    assert "suspendedUntil" not in AuthError("ACCOUNT_DISABLED", "x").body()
    assert AuthError("ACCOUNT_DISABLED", "x", suspended_until="2026-11-01T00:00:00Z").body()["suspendedUntil"]
    assert item().to_body()["accountType"] == "GOOGLE" and item(role="ADMIN").is_admin
    assert timedelta(days=1)
