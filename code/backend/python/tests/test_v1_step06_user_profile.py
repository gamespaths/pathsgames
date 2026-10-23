"""V1 step 6 (1.7.0): the match stamp and play time, the profile statistics and preferences of /api/auth/me,
the echo choices, the schema alignment and the export of playMs / stopped statuses."""
import asyncio
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

import app.adapters.persistence.match.models  # noqa: F401  registers gaming_* tables
import app.adapters.persistence.story.models  # noqa: F401  registers list_* tables
from app.adapters.persistence import database
from app.adapters.persistence.auth.identity_persistence_adapter import IdentityPersistenceAdapter
from app.adapters.persistence.auth.models import Base
from app.adapters.persistence.match.match_export_store_adapter import MatchExportStoreAdapter
from app.adapters.persistence.match.match_persistence_adapter import MatchPersistenceAdapter
from app.adapters.persistence.match.match_stamp_store_adapter import MatchStampStoreAdapter
from app.adapters.rest.auth.session_controller import SessionController
from app.adapters.rest.echo_controller import EchoController
from app.adapters.rest.middleware.request_stamp_middleware import RequestStampMiddleware
from app.core.models.auth.auth_error import AuthError
from app.core.models.auth.identity import NewUser, UserStatus
from app.core.models.auth.profile import MatchStatusTotals, UserPreferences, UserStats, parse_list
from app.core.models.match import match_statuses
from app.core.ports.auth.identity_persistence_port import IdentityPersistencePort
from app.core.ports.echo_port import EchoPort
from app.core.ports.match.match_export_ports import MatchExportStorePort
from app.core.ports.match.match_ports import MatchPersistencePort
from app.core.services.auth.account_service import AccountService
from app.core.services.echo_service import EchoService
from app.core.services.match import match_stamp as ms
from app.core.services.match.character_command_service import CharacterCommandService
from app.core.services.match.event_service import EventService
from app.core.services.match.experience_service import ExperienceService
from app.core.services.match.inventory_service import InventoryService
from app.core.services.match.match_command_service import MatchCommandService
from app.core.services.match.movement_service import MovementService
from app.core.services.match.registry_service import RegistryService
from app.core.services.match.time_advancement_service import TimeAdvancementService
from app.core.services.match.turn_cycle_service import TurnCycleService
from app.core.services.security.csrf_token_service import CsrfTokenService

SECRET = "secret-secret-secret-secret-secret"


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    yield sessionmaker(bind=engine, autocommit=False, autoflush=False)
    engine.dispose()


# ── stamp ────────────────────────────────────────────────────────────────────

def test_parse_and_delta_read_every_stored_form():
    now = "2026-10-22T10:00:10+00:00"
    assert ms.play_delta("2026-10-22T10:00:00Z", now, 300_000) == 10_000
    assert ms.play_delta("2026-10-22 10:00:00", now, 300_000) == 10_000
    assert ms.play_delta("2026-10-22 10:00:00.000000+00", now, 300_000) == 10_000
    assert ms.play_delta("2026-10-22T09:00:00Z", now, 300_000) == 300_000
    assert ms.play_delta("2026-10-22T10:00:20Z", now, 300_000) == 0
    assert ms.play_delta("garbage", now, 300_000) == 0
    assert ms.play_delta(None, now, 300_000) == 0
    assert ms.parse_ts(" ") is None


def test_one_stamp_per_request_and_a_fresh_one_outside():
    token = ms.open_stamp()
    try:
        first = ms.request_now()
        time.sleep(0.002)
        assert ms.request_now() == first
    finally:
        ms.close_stamp(token)
    assert ms.request_now() != first


class _Store:
    def __init__(self, previous):
        self.previous, self.calls = previous, []

    def find_ts_update(self, match_uuid):
        return self.previous

    def stamp(self, match_uuid, ts_update, delta):
        self.calls.append((match_uuid, ts_update, delta))
        return True

    def claim(self, match_uuid, old, new, delta):
        self.calls.append((match_uuid, new, delta))
        return True


def test_gameplay_stamp_normal_capped_and_first_write():
    for gap, expected in ((42, 42_000), (3600, 300_000), (5, 5_000)):
        token = ms.open_stamp()
        try:
            now = datetime.fromisoformat(ms.request_now())
            store = _Store((now - timedelta(seconds=gap)).isoformat())
            ms.MatchStampService(store, 300).claim_gameplay("m")
            assert store.calls == [("m", ms.request_now(), expected)]
        finally:
            ms.close_stamp(token)


def test_admin_stamp_unknown_and_blank_matches():
    store = _Store(None)
    service = ms.MatchStampService(store, 0)
    assert service.cap_ms == ms.DEFAULT_CAP_SECONDS * 1000
    assert service.claim_gameplay("gone") is None
    assert service.claim_gameplay(None) is None
    service.touch_admin("")
    assert store.calls == []
    service.touch_admin("m")
    assert store.calls[0][0] == "m" and store.calls[0][2] == 0


class _Svc:
    def __init__(self):
        self.match_stamp = MagicMock()

    @ms.stamped(ms.ADMIN, ok=lambda r: r == "UPDATED")
    def edit(self, uuid_match, outcome):
        return outcome

    @ms.stamped(uuid_of=lambda a, k: k.get("cmd"))
    def fix(self, cmd=None):
        return cmd

    @ms.stamped()
    def plain(self, match_uuid, fail=False):
        if fail:
            raise ValueError("refused")
        return "ok"


def test_the_admin_decorator_stamps_only_successes():
    s = _Svc()
    s.edit("m4", "NOT_FOUND")
    s.match_stamp.touch_admin.assert_not_called()
    s.edit("m4", "UPDATED")
    s.match_stamp.touch_admin.assert_called_once_with("m4")
    s.fix(cmd="m5")
    s.match_stamp.touch_admin.assert_called_with("m5")
    with pytest.raises(ValueError):
        s.plain("m2", fail=True)
    s.plain(match_uuid="m3")
    s.match_stamp.touch_admin.assert_called_with("m3")
    s.match_stamp.claim_gameplay.assert_not_called()
    s.match_stamp = None
    assert s.plain("m6") == "ok"


@pytest.mark.parametrize("cls, method", [
    (MatchCommandService, "update_match"), (CharacterCommandService, "change_statistics"),
    (RegistryService, "upsert_by_match_uuid"), (RegistryService, "remove_by_match_uuid")])
def test_every_admin_write_is_stamped(cls, method):
    func = getattr(cls, method)
    assert hasattr(func, "__wrapped__"), f"{cls.__name__}.{method} is not stamped"


@pytest.mark.parametrize("cls, method", [
    (TurnCycleService, "start_match"), (TurnCycleService, "pass_turn"), (CharacterCommandService, "join"),
    (TimeAdvancementService, "sleep"), (ExperienceService, "use_exp"), (EventService, "_execute_event"),
    (EventService, "_execute_choice_event"), (EventService, "_select_choice"), (InventoryService, "use_item"),
    (InventoryService, "drop_item"), (MovementService, "start_movement"), (MatchCommandService, "end_match")])
def test_every_gameplay_write_claims(cls, method):
    import inspect
    assert "stamp_claim(self" in inspect.getsource(getattr(cls, method)), f"{cls.__name__}.{method} never claims"


def test_stamp_store_adapter_and_totals(db):
    persistence = MatchPersistenceAdapter(db)
    saved = persistence.save_match({"id_story": 1, "id_difficulty": 2, "id_user_creator": 7, "name": "a",
                                    "status": "RUNNING", "current_clock": 3})
    persistence.save_match({"id_story": 1, "id_difficulty": 2, "id_user_creator": 7, "name": "b",
                            "status": "CANCELLED", "current_clock": 9})
    store = MatchStampStoreAdapter(db)
    assert store.find_ts_update(saved["uuid"]) == saved["ts_update"]
    assert store.find_ts_update("none") is None
    assert store.stamp(saved["uuid"], "2026-10-22T10:00:00+00:00", 1500) is True
    assert store.stamp("none", "x", 1) is False
    assert store.find_ts_update(saved["uuid"]) == "2026-10-22T10:00:00+00:00"
    totals = persistence.totals_by_status(7, match_statuses.PLAYED)
    assert totals == [MatchStatusTotals("RUNNING", 1, 1500, 3)]
    assert persistence.totals_by_status(7, []) == []
    assert MatchExportStoreAdapter(db).play_ms(saved["uuid"]) == 1500
    assert MatchExportStoreAdapter(db).play_ms("none") == 0


def test_port_defaults_are_not_implemented():
    class BareMatch(MatchPersistencePort):
        pass

    class BareIdentity(IdentityPersistencePort):
        pass

    class BareExport(MatchExportStorePort):
        pass

    for bare in (BareMatch, BareIdentity, BareExport):
        bare.__abstractmethods__ = frozenset()
    with pytest.raises(NotImplementedError):
        BareMatch().totals_by_status(1, ["RUNNING"])
    with pytest.raises(NotImplementedError):
        BareIdentity().find_theme_selected(1)
    with pytest.raises(NotImplementedError):
        BareIdentity().update_preferences(1, "en", None)
    with pytest.raises(NotImplementedError):
        BareExport().play_ms("m")


# ── profile model and service ────────────────────────────────────────────────

def test_stats_fold_and_lists():
    stats = UserStats.of([MatchStatusTotals("RUNNING", 1, 10, 1), MatchStatusTotals("PAUSED", 1, 20, 2),
                          MatchStatusTotals("ENDED", 2, 30, 3), MatchStatusTotals("GAMEOVER", 1, 40, 4),
                          MatchStatusTotals("CREATED", 5, 0, 0), MatchStatusTotals("BANNED", 1, 50, 5)])
    assert stats == UserStats(5, 2, 1, 100, 10)
    assert UserStats.of(None) == UserStats()
    assert stats.to_body()["playTimeMs"] == 100
    assert parse_list(" EN, it ,,fr,en", ["x"]) == ["en", "it", "fr"]
    assert parse_list(None, ["x"]) == ["x"]
    assert UserPreferences("it", "high-contrast").to_body() == {"language": "it", "theme": "high-contrast",
                                                                "highContrast": True}


@pytest.fixture()
def account():
    identities, matches, user_state = MagicMock(), MagicMock(), MagicMock()
    users = {"u8": UserStatus(8, "u8", "google_8", "mario", "PLAYER", 2, "it"),
             "g9": UserStatus(9, "g9", "guest_9", "guest_9", "PLAYER", 6, "en")}
    identities.find_user_by_uuid.side_effect = users.get
    identities.find_theme_selected.return_value = None
    service = AccountService(identities, MagicMock(), MagicMock(), matches, user_state)
    return service


def test_account_stats_and_preferences(account):
    account.matches.totals_by_status.return_value = [MatchStatusTotals("ENDED", 1, 500, 7),
                                                     MatchStatusTotals("CANCELLED", 3, 9, 9)]
    assert account.stats("u8") == UserStats(1, 1, 0, 500, 7)
    account.matches.totals_by_status.assert_called_with(8, match_statuses.PLAYED)
    assert account.stats("x") == UserStats()
    assert account.preferences("u8") == UserPreferences("it", "default")
    assert account.preferences("x") is None


def test_account_update_preferences(account):
    account.identities.find_theme_selected.return_value = "high-contrast"
    assert account.update_preferences("u8", "en", None) == UserPreferences("en", "high-contrast")
    account.identities.update_preferences.assert_called_once_with(8, "en", None)
    account.user_state.evict.assert_called_once_with("u8")
    assert account.update_preferences("u8", None, "default").language == "it"
    for user, lang, theme, code in (("g9", "en", None, "GOOGLE_ACCOUNT_REQUIRED"), ("x", "en", None, "INVALID_TOKEN"),
                                    ("u8", None, None, "INVALID_REQUEST"), ("u8", "fr", None, "INVALID_REQUEST"),
                                    ("u8", None, "neon", "INVALID_REQUEST")):
        with pytest.raises(AuthError) as e:
            account.update_preferences(user, lang, theme)
        assert e.value.code == code
    account.configure_preferences(["en", "fr"], None)
    assert account.update_preferences("u8", "fr", None).language == "fr"
    assert account.themes == ["default", "high-contrast"]


def test_identity_preferences_persistence(db):
    adapter = IdentityPersistenceAdapter(db)
    uid = adapter.create_user(NewUser("u-1", "google_u-1", "anna", "anna@gmail.com", "PLAYER", 2, "en"), None)
    assert adapter.find_theme_selected(uid) == "default"
    adapter.update_preferences(uid, "it", None)
    adapter.update_preferences(uid, None, "high-contrast")
    adapter.update_preferences(uid, None, None)
    assert adapter.find_user_by_id(uid).language == "it"
    assert adapter.find_theme_selected(uid) == "high-contrast"
    assert adapter.find_theme_selected(-1) is None


# ── REST ─────────────────────────────────────────────────────────────────────

@pytest.fixture()
def rest():
    account_service = MagicMock()
    account_service.profile.return_value = None
    account_service.preferences.return_value = UserPreferences("it", "high-contrast")
    account_service.stats.return_value = UserStats(3, 1, 1, 90_000, 12)
    csrf = CsrfTokenService(SECRET, True)
    app = FastAPI()

    @app.middleware("http")
    async def auth(request: Request, call_next):
        if request.headers.get("X-Test-Auth") == "true":
            request.state.user_uuid = "u-1"
        return await call_next(request)

    app.include_router(SessionController(MagicMock(), csrf, account_service).router)
    client = TestClient(app)
    client.account, client.csrf = account_service, csrf
    return client


def _headers(rest, csrf=True):
    h = {"X-Test-Auth": "true", "Authorization": "Bearer access"}
    if csrf:
        h["X-CSRF-TOKEN"] = rest.csrf.token_for("access")
    return h


def test_get_me_carries_preferences_and_stats(rest):
    body = rest.get("/me", headers=_headers(rest)).json()
    assert body["preferences"]["highContrast"] is True and body["stats"]["clocksPlayed"] == 12
    rest.account.preferences.return_value = None
    assert "preferences" not in rest.get("/me", headers=_headers(rest)).json()


def test_patch_me(rest):
    assert rest.patch("/me", json={"language": "en", "highContrast": True}, headers=_headers(rest)).status_code == 200
    rest.account.update_preferences.assert_called_with("u-1", "en", "high-contrast")
    rest.patch("/me", json={"highContrast": False}, headers=_headers(rest))
    rest.account.update_preferences.assert_called_with("u-1", None, "default")
    rest.patch("/me", json={"theme": "high-contrast", "highContrast": False}, headers=_headers(rest))
    rest.account.update_preferences.assert_called_with("u-1", None, "high-contrast")
    for body in ({"language": 5}, {"theme": True}, {"highContrast": "yes"}):
        r = rest.patch("/me", json=body, headers=_headers(rest))
        assert r.status_code == 400 and r.json()["error"] == "INVALID_REQUEST"
    rest.account.update_preferences.side_effect = AuthError("GOOGLE_ACCOUNT_REQUIRED", "guest")
    r = rest.patch("/me", json={"language": "en"}, headers=_headers(rest))
    assert r.status_code == 403 and r.json()["error"] == "GOOGLE_ACCOUNT_REQUIRED"


def test_patch_me_refusals(rest):
    assert rest.patch("/me", json={"language": "en"}).status_code == 401
    r = rest.patch("/me", json={"language": "en"}, headers=_headers(rest, csrf=False))
    assert r.status_code == 403 and r.json()["error"] == "CSRF_TOKEN_MISSING"
    h = _headers(rest, csrf=False)
    h["X-CSRF-TOKEN"] = "forged"
    assert rest.patch("/me", json={"language": "en"}, headers=h).json()["error"] == "CSRF_TOKEN_INVALID"
    rest.account.update_preferences.assert_not_called()


def test_echo_supported_choices():
    service = EchoService("OK", {}, ["en", "it", "fr"], None)
    assert service.get_supported_themes() == ["default", "high-contrast"]
    app = FastAPI()
    app.include_router(EchoController(service).router)
    body = TestClient(app).get("/api/echo/status").json()
    assert body["supportedLanguages"] == ["en", "it", "fr"] and body["supportedThemes"][1] == "high-contrast"

    class Bare(EchoPort):
        def get_server_status(self):
            return "OK"

        def get_timestamp(self):
            return 0

        def get_server_properties(self):
            return {}

    assert Bare().get_supported_languages() == [] and Bare().get_supported_themes() == []


def test_request_stamp_middleware_reaches_sync_endpoints():
    app = FastAPI()

    @app.get("/stamp")
    def stamp():
        first = ms.request_now()
        time.sleep(0.002)
        return {"a": first, "b": ms.request_now()}

    app.add_middleware(RequestStampMiddleware)
    body = TestClient(app).get("/stamp").json()
    assert body["a"] == body["b"]


def test_request_stamp_middleware_passes_other_scopes():
    seen = []

    async def inner(scope, receive, send):
        seen.append(scope["type"])

    asyncio.run(RequestStampMiddleware(inner)({"type": "lifespan"}, None, None))
    assert seen == ["lifespan"]


# ── schema and export ────────────────────────────────────────────────────────

def test_align_schema_adds_play_ms_and_theme_with_defaults():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as c:
        c.execute(text("CREATE TABLE gaming_match (id INTEGER, uuid TEXT)"))
        c.execute(text("INSERT INTO gaming_match (id, uuid) VALUES (1, 'm')"))
        c.execute(text("CREATE TABLE users (id INTEGER, state INTEGER, last_access TEXT, nickname TEXT,"
                       " email_address TEXT)"))
    applied = database.align_schema(engine)
    assert "ALTER TABLE gaming_match ADD COLUMN play_ms INTEGER NOT NULL DEFAULT 0" in applied
    assert "ALTER TABLE users ADD COLUMN theme_selected TEXT DEFAULT 'default'" in applied
    with engine.begin() as c:
        assert c.execute(text("SELECT play_ms FROM gaming_match")).scalar() == 0
    assert "play_ms" in {c["name"] for c in inspect(engine).get_columns("gaming_match")}


def test_neutral_match_carries_live_play_time_and_stopped_status():
    from app.core.services.match.match_export_service import MatchExportService
    from app.core.services.match import neutral_codec as nc
    lookup = nc.Lookup({}, {}, {}, {}, {})
    row = {"uuid": "m", "status": "RUNNING", "current_clock": 3, "play_ms": 10}
    out = MatchExportService._neutral_match({"id_story": 9, "status": "BANNED"}, row, lookup, None, 4200)
    assert out["status"] == "BANNED" and out["playMs"] == 4200
    out = MatchExportService._neutral_match({"id_story": 9, "status": "RUNNING"}, row, lookup, None, None)
    assert out["status"] == "RUNNING" and out["playMs"] == 0
    assert nc.match_row({"playMs": 77, "loadout": {}}, 9, {}, {}, {}, {}, "now")["play_ms"] == 77
    assert nc.match_row({"loadout": {}}, 9, {}, {}, {}, {}, "now")["play_ms"] == 0
