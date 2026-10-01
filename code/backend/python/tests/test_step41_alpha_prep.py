"""v0.41.0 — Step 41 alpha preparation (patch 0.41.0): env rule, secrets, security headers,
docs, guest cleanup (expired fix and idle job), the per-guest bucket and the aged-guest header."""
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import config as config_module
from app.adapters.persistence import database
from app.adapters.persistence.auth import guest_persistence_adapter as gpa
from app.adapters.persistence.auth.guest_persistence_adapter import GuestPersistenceAdapter
from app.adapters.persistence.auth.models import Base, User, UserToken
from app.adapters.persistence.match.models import GamingCharacterInstanceEntity, GamingMatchEntity
from app.adapters.rest.auth.guest_admin_controller import GuestAdminController
from app.adapters.rest.auth.guest_auth_controller import GuestAuthController, _parse_age
from app.adapters.rest.match.match_controller import MatchController
from app.adapters.rest.middleware import security_headers_middleware as shm
from app.adapters.scheduler import guest_cleanup_scheduler as gcs
from app.adapters.turnstile.turnstile_adapter import TurnstileVerificationAdapter
from app.config import DEV_CORS_ORIGINS, DEV_JWT_SECRET, Settings, check_secrets
from app.core.models.auth.guest_session import GuestSession
from app.core.models.auth.token_info import TokenInfo
from app.core.models.match.match_models import MatchSummary
from app.core.ports.auth.guest_admin_persistence_port import GuestAdminPersistencePort
from app.core.ports.auth.guest_persistence_port import GuestPersistencePort
from app.core.services.auth.guest_admin_service import DEFAULT_MAX_PER_RUN, GuestAdminService
from app.core.services.auth.guest_auth_service import GuestAuthService
from app.core.services.security.env_rule import is_dev_or_test
from app.core.services.security.rate_limit_service import RateLimitService

PAST = "2020-01-01T00:00:00+00:00"
FUTURE = "2999-01-01T00:00:00+00:00"


# ── env rule and settings ─────────────────────────────────────────────────────

@pytest.mark.parametrize("env", ["dev", "development", "test", " TEST ", "Development"])
def test_env_rule_dev_and_test(env):
    assert is_dev_or_test(env)


@pytest.mark.parametrize("env", ["prod", "production", "alpha", "beta", "", "  ", "testing", None])
def test_env_rule_everything_else_is_production(env):
    assert not is_dev_or_test(env)


def test_dev_test_endpoints_follow_the_env_unless_set(monkeypatch):
    monkeypatch.delenv("DEV_TEST_ENDPOINTS_ENABLED", raising=False)
    assert Settings(env="development").dev_test_endpoints_enabled is True
    assert Settings(env="production").dev_test_endpoints_enabled is False
    assert Settings(env="alpha", dev_test_endpoints_enabled=True).dev_test_endpoints_enabled is True
    monkeypatch.setenv("DEV_TEST_ENDPOINTS_ENABLED", "false")
    assert Settings(env="test").dev_test_endpoints_enabled is False


def test_new_defaults(monkeypatch):
    for key in ("CORS_ALLOWED_ORIGINS", "RATE_LIMIT_GUEST_PER_IP", "RATE_LIMIT_MATCH_PER_IP",
                "RATE_LIMIT_MATCH_PER_GUEST", "RATE_LIMIT_MATCH_PER_GUEST_WINDOW_SECONDS",
                "GUEST_CLEANUP_ENABLED", "GUEST_CLEANUP_AGE_DAYS", "GUEST_CLEANUP_MAX_PER_RUN",
                "GUEST_CLEANUP_HOUR", "GUEST_CLEANUP_MINUTE"):
        monkeypatch.delenv(key, raising=False)
    s = Settings(_env_file=None)
    assert s.cors_allowed_origins == DEV_CORS_ORIGINS and "*" not in s.cors_origins_list
    assert "http://localhost:5174" in s.cors_origins_list
    assert (s.rate_limit_guest_per_ip, s.rate_limit_match_per_ip, s.rate_limit_match_per_guest) == (20, 20, 10)
    assert s.rate_limit_match_per_guest_window_seconds == 86400
    assert (s.guest_cleanup_enabled, s.guest_cleanup_age_days, s.guest_cleanup_max_per_run) == (True, 60, 500)
    assert (s.guest_cleanup_hour, s.guest_cleanup_minute) == (0, 42)


def test_check_secrets_refuses_the_committed_secret_outside_dev_test():
    check_secrets(Settings(env="development", jwt_secret=DEV_JWT_SECRET))
    check_secrets(Settings(env="production", jwt_secret="a-private-random-secret-of-32-chars!!"))
    for env in ("production", "alpha", "beta"):
        with pytest.raises(RuntimeError, match="JWT_SECRET"):
            check_secrets(Settings(env=env, jwt_secret=DEV_JWT_SECRET))
    with pytest.raises(RuntimeError):
        check_secrets(Settings(env="production", jwt_secret="  "))


def test_check_secrets_defaults_to_the_module_settings(monkeypatch):
    monkeypatch.setattr(config_module, "settings", Settings(env="production", jwt_secret=DEV_JWT_SECRET))
    with pytest.raises(RuntimeError):
        check_secrets()


def test_turnstile_bypass_only_on_dev_test(monkeypatch):
    calls = []

    class _Resp:
        def json(self):
            return {"success": False}

    monkeypatch.setattr("app.adapters.turnstile.turnstile_adapter.httpx.post",
                        lambda *a, **k: calls.append(1) or _Resp())
    for env in ("alpha", "beta", "production", "prod", None):
        assert not TurnstileVerificationAdapter("secret", "0xROBOT", env).verify("0xROBOT", None)
    assert len(calls) == 5
    assert TurnstileVerificationAdapter("secret", "0xROBOT", "development").verify("0xROBOT", None)


# ── rate limiter: per-counter window ──────────────────────────────────────────

class _Clock:
    def __init__(self):
        self.now = 1_000_000.0

    def __call__(self):
        return self.now


def test_rate_limit_counter_keeps_its_own_window_through_the_sweep():
    clock = _Clock()
    svc = RateLimitService(3600, clock)
    assert svc.try_acquire("match-guest", "user-1", 1, 86400).allowed
    refused = svc.try_acquire("match-guest", "user-1", 1, 86400)
    assert not refused.allowed and refused.retry_after_seconds == 86400
    clock.now += 7200
    for i in range(2100):
        svc.try_acquire("match", f"ip-{i}", 1)
    still = svc.try_acquire("match-guest", "user-1", 1, 86400)
    assert not still.allowed and still.retry_after_seconds == 79200
    clock.now += 79200
    assert svc.try_acquire("match-guest", "user-1", 1, 86400).allowed
    assert svc.try_acquire("match-guest", "u", 1, 0).allowed and not svc.try_acquire("match-guest", "u", 1, 0).allowed


# ── persistence: the expired-guest fix and the stale query ────────────────────

@pytest.fixture
def db():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return engine, sessionmaker(bind=engine)


def _guest(factory, name, expires_at, seen=None):
    with factory() as s:
        u = User(uuid=name, username=name, state=6, role="PLAYER", guest_expires_at=expires_at,
                 ts_registration=seen or "2026-09-01T00:00:00+00:00",
                 last_access=seen or "2026-09-01T00:00:00+00:00")
        s.add(u)
        s.commit()
        s.add(UserToken(id_user=u.id, refresh_token="rt-" + name, expires_at=FUTURE))
        s.commit()
        return u.id


def _match(factory, match_id, creator):
    with factory() as s:
        s.add(GamingMatchEntity(id=match_id, uuid=f"m-{match_id}", id_story=1, id_difficulty=1,
                                id_user_creator=creator, ts_insert="t", ts_update="t"))
        s.commit()


def _character(factory, match_id, user):
    with factory() as s:
        s.add(GamingCharacterInstanceEntity(id=match_id * 10, id_match=match_id, uuid=f"c-{user}",
                                            id_user=user, id_character_template=1,
                                            ts_insert="t", ts_update="t"))
        s.commit()


def _ids(factory, column):
    with factory() as s:
        return sorted(r[0] for r in s.query(column).all())


def test_expired_cleanup_keeps_referenced_guests_with_foreign_keys_on(db):
    engine, factory = db
    free = _guest(factory, "free", PAST)
    creator = _guest(factory, "creator", PAST)
    player = _guest(factory, "player", PAST)
    alive = _guest(factory, "alive", FUTURE)
    _match(factory, 1, creator)
    _character(factory, 1, player)
    with engine.connect() as c:
        c.exec_driver_sql("PRAGMA foreign_keys=ON")
        assert c.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1

    assert GuestPersistenceAdapter(factory).delete_expired_guests() == 1

    assert _ids(factory, User.id) == sorted([creator, player, alive])
    assert free not in _ids(factory, UserToken.id_user)
    # the unguarded delete of a referenced guest is exactly what the database refuses
    with pytest.raises(IntegrityError):
        with factory() as s:
            s.execute(text("DELETE FROM users_tokens WHERE id_user = :i"), {"i": creator})
            s.execute(text("DELETE FROM users WHERE id = :i"), {"i": creator})
            s.commit()


def test_stale_ids_without_references_backdate_and_chunked_delete(db, monkeypatch):
    _, factory = db
    adapter = GuestPersistenceAdapter(factory)
    one = _guest(factory, "one", FUTURE)
    two = _guest(factory, "two", FUTURE)
    owner = _guest(factory, "owner", FUTURE)
    _match(factory, 2, owner)
    bound = "2021-01-01T00:00:00+00:00"
    assert adapter.find_stale_guest_ids_without_references(bound, 10) == []

    for uid in (one, two, owner):
        adapter.backdate_guest(uid, PAST)
    adapter.backdate_guest(999, PAST)

    assert adapter.find_stale_guest_ids_without_references(bound, 10) == [one, two]
    assert adapter.find_stale_guest_ids_without_references(bound, 1) == [one]
    assert adapter.find_stale_guest_ids_without_references(None, 10) == []
    assert adapter.find_stale_guest_ids_without_references(bound, 0) == []
    assert adapter.find_guest_by_uuid("one")["ts_registration"] == PAST
    monkeypatch.setattr(gpa, "DELETE_CHUNK", 1)
    assert adapter.delete_guests_by_ids([]) == 0
    assert adapter.delete_guests_by_ids([one, two]) == 2
    assert _ids(factory, User.id) == [owner]
    assert _ids(factory, UserToken.id_user) == [owner]


def test_port_defaults_are_harmless():
    class _Guests(GuestPersistencePort):
        create_guest_user = find_guest_by_cookie_token = store_refresh_token = None
        update_last_access = delete_expired_guests = None

    class _Admin(GuestAdminPersistencePort):
        find_all_guests = find_guest_by_uuid = delete_guest_by_uuid = None
        delete_expired_guests = delete_guests_by_username_like = find_guests_page = None
        find_guest_ids_with_last_access_before = delete_guests_by_ids = None
        count_all_guests = count_active_guests = count_expired_guests = None

    assert _Guests().backdate_guest(1, PAST) is None
    assert _Admin().find_stale_guest_ids_without_references(PAST, 5) == []


def test_align_schema_adds_the_cleanup_index_once():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as c:
        c.execute(text("CREATE TABLE users (id INTEGER, state INTEGER, last_access TEXT, email_address TEXT)"))
        c.execute(text("CREATE INDEX idx_users_email ON users (email_address)"))
    applied = database.align_schema(engine)
    assert applied == ["CREATE INDEX IF NOT EXISTS idx_users_state_last_access ON users (state, last_access)"]
    assert "idx_users_state_last_access" in {i["name"] for i in inspect(engine).get_indexes("users")}
    assert database.align_schema(engine) == []


def test_align_schema_adds_the_email_column_and_index_once():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as c:
        c.execute(text("CREATE TABLE users (id INTEGER, state INTEGER, last_access TEXT)"))
    applied = database.align_schema(engine)
    assert "ALTER TABLE users ADD COLUMN email_address TEXT" in applied
    assert "CREATE INDEX IF NOT EXISTS idx_users_email ON users (email_address)" in applied
    assert "email_address" in {c["name"] for c in inspect(engine).get_columns("users")}
    assert "idx_users_email" in {i["name"] for i in inspect(engine).get_indexes("users")}
    assert database.align_schema(engine) == []


def test_new_databases_get_the_index_from_the_model(db):
    engine, _ = db
    assert "idx_users_state_last_access" in {i["name"] for i in inspect(engine).get_indexes("users")}


# ── core: the match-less purge and the aged guest ─────────────────────────────

def test_admin_service_without_matches_counts_and_deletes_only_unreferenced():
    port, matches = MagicMock(), MagicMock()
    port.find_stale_guest_ids_without_references.return_value = [1, 2]
    port.delete_guests_by_ids.return_value = 2
    svc = GuestAdminService(port, matches, 2)
    assert svc.preview_stale_guests(60, True) == {"guests": 2, "matches": 0}
    assert svc.delete_stale_guests(60, True) == {"guests": 2, "matches": 0}
    assert port.find_stale_guest_ids_without_references.call_args[0][1] == 2
    matches.assert_not_called()
    assert not matches.method_calls
    port.find_guest_ids_with_last_access_before.assert_not_called()


def test_admin_service_without_matches_edge_cases():
    port = MagicMock()
    port.find_stale_guest_ids_without_references.return_value = None
    svc = GuestAdminService(port, MagicMock(), 0)
    assert svc.max_per_run == DEFAULT_MAX_PER_RUN
    assert svc.delete_stale_guests(1, True) == {"guests": 0, "matches": 0}
    assert svc.preview_stale_guests(-1, True) == {"guests": 0, "matches": 0}
    port.delete_guests_by_ids.assert_not_called()


def test_admin_service_without_matches_false_is_todays_purge():
    port, matches = MagicMock(), MagicMock()
    port.find_guest_ids_with_last_access_before.return_value = [1]
    matches.count_matches_by_user_creator_ids.return_value = 3
    matches.delete_matches_by_user_creator_ids.return_value = 3
    port.delete_guests_by_ids.return_value = 1
    svc = GuestAdminService(port, matches)
    assert svc.preview_stale_guests(90, False) == {"guests": 1, "matches": 3}
    assert svc.delete_stale_guests(90) == {"guests": 1, "matches": 3}


def _auth_service():
    persistence, jwt = MagicMock(), MagicMock()
    persistence.create_guest_user.return_value = 7
    jwt.generate_access_token.return_value = "a"
    jwt.generate_refresh_token.return_value = "r"
    jwt.get_refresh_token_expiration_ms.return_value = 2_000_000_000_000
    jwt.get_access_token_expiration_ms.return_value = 1
    return GuestAuthService(jwt, persistence), persistence


def test_aged_guest_is_backdated_and_expires_180_days_later():
    svc, persistence = _auth_service()
    before = datetime.now(timezone.utc)
    session = svc.create_guest_session("robottest", 400)
    born = datetime.fromisoformat(persistence.backdate_guest.call_args[0][1])
    expires = datetime.fromisoformat(persistence.create_guest_user.call_args[0][3])
    assert persistence.backdate_guest.call_args[0][0] == 7
    assert born < before - timedelta(days=399)
    assert expires == born + timedelta(days=180)
    assert session.username.startswith("robottest_")


def test_age_is_ignored_without_marker_or_out_of_range():
    svc, persistence = _auth_service()
    for marker, age in ((None, 400), ("!!!", 400), ("robottest", 0), ("robottest", 3651),
                        ("robottest", None)):
        svc.create_guest_session(marker, age)
    persistence.backdate_guest.assert_not_called()
    svc.create_guest_session("robottest", 3650)
    assert persistence.backdate_guest.call_count == 1


# ── REST ───────────────────────────────────────────────────────────────────────

def _admin_client(port):
    app = FastAPI()
    app.include_router(GuestAdminController(port).router)
    return TestClient(app)


def test_admin_stale_without_matches_flag():
    port = MagicMock()
    port.preview_stale_guests.return_value = {"guests": 3, "matches": 0}
    port.delete_stale_guests.return_value = {"guests": 2, "matches": 0}
    client = _admin_client(port)
    res = client.get("/api/admin/guests/stale?olderThanDays=365&withoutMatches=true")
    assert res.status_code == 200 and res.json() == {"guests": 3, "matches": 0}
    port.preview_stale_guests.assert_called_with(365, True)
    res = client.delete("/api/admin/guests/stale?olderThanDays=60&withoutMatches=true")
    assert res.json() == {"guests": 2, "matches": 0, "status": "CLEANUP_COMPLETE"}
    port.delete_stale_guests.assert_called_with(60, True)
    client.get("/api/admin/guests/stale?olderThanDays=5&withoutMatches=false")
    port.preview_stale_guests.assert_called_with(5, False)
    client.delete("/api/admin/guests/stale?olderThanDays=5&withoutMatches=false")
    port.delete_stale_guests.assert_called_with(5, False)
    client.get("/api/admin/guests/stale?olderThanDays=5")
    port.preview_stale_guests.assert_called_with(5)


def test_admin_stale_refuses_any_other_flag_value():
    port = MagicMock()
    client = _admin_client(port)
    for method, url in (("get", "/api/admin/guests/stale?olderThanDays=1&withoutMatches=maybe"),
                        ("delete", "/api/admin/guests/stale?olderThanDays=1&withoutMatches=TRUE")):
        res = getattr(client, method)(url)
        assert res.status_code == 400
        assert res.json() == {"error": "INVALID_INPUT", "message": "withoutMatches must be true or false"}
    assert not port.method_calls


def _guest_client(test_endpoints):
    port, jwt, tokens = MagicMock(), MagicMock(), MagicMock()
    port.create_guest_session.return_value = GuestSession(
        user_uuid="u1", username="robottest_1", access_token="a", refresh_token="r",
        access_token_expires_at=1, refresh_token_expires_at=2, guest_cookie_token="c")
    jwt.generate_access_token.return_value = "a"
    jwt.generate_refresh_token.return_value = "r"
    jwt.get_access_token_expiration_ms.return_value = 1
    jwt.get_refresh_token_expiration_ms.return_value = 2
    jwt.parse_token.return_value = TokenInfo(sub="u1", iss="i", aud="a", exp=1, nbf=0, iat=0,
                                             jti="j", roles=[], username="u", type="refresh")
    app = FastAPI()
    app.include_router(GuestAuthController(port, jwt, tokens, test_endpoints).router)
    return TestClient(app), port


def test_aged_guest_header_only_with_test_endpoints():
    client, port = _guest_client(True)
    h = {"X-Test-Marker": "robottest", "X-Test-Guest-Age-Days": " 400 "}
    assert client.post("/api/auth/guest", headers=h).status_code == 201
    port.create_guest_session.assert_called_with("robottest", 400)
    client.post("/api/auth/guest", headers={"X-Test-Marker": "robottest", "X-Test-Guest-Age-Days": "old"})
    port.create_guest_session.assert_called_with("robottest")
    off, off_port = _guest_client(False)
    off.post("/api/auth/guest", headers=h)
    off_port.create_guest_session.assert_called_with(None)
    assert _parse_age(None) is None and _parse_age("  ") is None and _parse_age("12") == 12


def _match_client(per_ip, per_guest, limiter):
    command = MagicMock()
    command.create_match.return_value = MatchSummary(
        uuid="m-1", story_uuid="s", difficulty_uuid="d", status="CREATED", current_clock=0,
        exp_cost=0, user_creator_uuid="u", name="n", ts_insert="ts")
    app = FastAPI()
    app.include_router(MatchController(command, MagicMock(), None, limiter, per_ip, None,
                                       per_guest, 86400).router)

    @app.middleware("http")
    async def inject_user(request, call_next):
        request.state.user_uuid = request.headers["x-user"]
        return await call_next(request)

    return TestClient(app), command


def _create(client, user, ip):
    return client.post("/api/matches", headers={"x-user": user, "X-Forwarded-For": ip},
                       json={"storyUuid": "s", "difficultyUuid": "d"})


def test_match_per_guest_bucket():
    client, command = _match_client(0, 2, RateLimitService(3600))
    assert _create(client, "u1", "1.1.1.1").status_code == 201
    assert _create(client, "u1", "2.2.2.2").status_code == 201
    refused = _create(client, "u1", "3.3.3.3")
    assert refused.status_code == 429 and refused.headers["Retry-After"] == "86400"
    body = refused.json()
    assert body["error"] == "RATE_LIMITED" and body["retryAfterSeconds"] == 86400
    assert body["message"].startswith("Too many matches created by this player")
    assert _create(client, "u2", "3.3.3.3").status_code == 201
    assert command.create_match.call_count == 3
    ip_first, _ = _match_client(1, 5, RateLimitService(3600))
    assert _create(ip_first, "u3", "4.4.4.4").status_code == 201
    assert _create(ip_first, "u3", "4.4.4.4").json()["message"].startswith("Too many matches created from")
    off, _ = _match_client(0, 0, RateLimitService(3600))
    for _ in range(12):
        assert _create(off, "u9", "9.9.9.9").status_code == 201


# ── security headers, docs, CORS ──────────────────────────────────────────────

def test_security_headers_on_both_apps_and_no_store_rule():
    from app.launcher import app, app_admin
    public = TestClient(app).get("/api/echo/status")
    assert public.headers["x-content-type-options"] == "nosniff"
    assert public.headers["x-frame-options"] == "DENY"
    assert public.headers["referrer-policy"] == "no-referrer"
    assert public.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'"
    assert public.headers["strict-transport-security"] == "max-age=31536000"
    assert "cache-control" not in public.headers
    admin = TestClient(app_admin).get("/api/echo/status")
    assert admin.headers["x-frame-options"] == "DENY"
    refused = TestClient(app_admin).get("/api/admin/guests")
    assert refused.status_code == 401 and refused.headers["cache-control"] == "no-store"
    assert shm.is_no_store_path("/api/auth") and shm.is_no_store_path("/api/auth/guest")
    assert not shm.is_no_store_path("/api/authors") and not shm.is_no_store_path("/api/stories")


def test_docs_are_skipped_by_the_headers_middleware():
    from app.launcher import app
    res = TestClient(app).get("/openapi.json")
    assert res.status_code == 200
    assert "content-security-policy" not in res.headers
    assert shm.is_docs_path("/docs/oauth2-redirect") and not shm.is_docs_path("/docsx")


def test_headers_middleware_passes_non_http_scopes_through():
    seen = []

    async def inner(scope, receive, send):
        seen.append(scope["type"])

    asyncio.run(shm.SecurityHeadersMiddleware(inner)({"type": "lifespan"}, None, None))
    assert seen == ["lifespan"]


def test_docs_and_cors_params(monkeypatch):
    from app import launcher
    assert launcher._docs_params() == {}
    assert launcher._cors_params()["expose_headers"] == ["Retry-After"]
    monkeypatch.setattr(launcher, "settings", Settings(env="production", cors_allowed_origins="*"))
    assert launcher._docs_params() == {"docs_url": None, "redoc_url": None, "openapi_url": None}
    assert launcher._cors_params()["expose_headers"] == ["Retry-After"]


# ── the scheduler and _serve ──────────────────────────────────────────────────

class _FakeScheduler:
    instances = []

    def __init__(self, timezone):
        self.timezone, self.jobs, self.started = timezone, [], False
        _FakeScheduler.instances.append(self)

    def add_job(self, func, trigger, **kwargs):
        self.jobs.append((func, trigger, kwargs))

    def start(self):
        self.started = True


def test_cleanup_scheduler_registers_one_utc_job():
    _FakeScheduler.instances.clear()
    service = MagicMock()
    sched = gcs.start_guest_cleanup(service, Settings(), _FakeScheduler)
    assert sched.started and sched.timezone == "UTC" and len(sched.jobs) == 1
    func, trigger, kwargs = sched.jobs[0]
    assert func is gcs.run_guest_cleanup and kwargs["id"] == gcs.JOB_ID
    assert kwargs["args"] == [service, 60] and "hour='0'" in str(trigger) and "minute='42'" in str(trigger)


def test_cleanup_scheduler_off_when_disabled():
    assert gcs.start_guest_cleanup(MagicMock(), Settings(guest_cleanup_enabled=False), _FakeScheduler) is None
    assert gcs.start_guest_cleanup(MagicMock(), Settings(guest_cleanup_age_days=-1), _FakeScheduler) is None


def test_cleanup_job_runs_the_match_less_purge():
    service = MagicMock()
    service.delete_stale_guests.return_value = {"guests": 4, "matches": 0}
    assert gcs.run_guest_cleanup(service, 60) == 4
    service.delete_stale_guests.assert_called_once_with(60, True)


def test_cleanup_scheduler_real_apscheduler():
    async def scenario():
        sched = gcs.start_guest_cleanup(MagicMock(), Settings())
        try:
            job = sched.get_job(gcs.JOB_ID)
            return len(sched.get_jobs()), repr(job.trigger)
        finally:
            sched.shutdown(wait=False)

    count, trigger = asyncio.run(scenario())
    assert count == 1 and "UTC" in trigger


def test_serve_checks_secrets_starts_the_job_once_and_both_servers(monkeypatch):
    import uvicorn
    from app import launcher
    started, served = [], []

    class _Server:
        def __init__(self, config):
            self.config = config

        async def serve(self):
            served.append(self.config.port)

    monkeypatch.setattr(uvicorn, "Server", _Server)
    monkeypatch.setattr(launcher, "start_guest_cleanup", lambda svc, cfg: started.append(svc))
    asyncio.run(launcher._serve())
    assert started == [launcher.guest_admin_service]
    assert sorted(served) == sorted([launcher.settings.port, launcher.settings.admin_port])


def test_serve_refuses_the_committed_secret_in_production(monkeypatch):
    import uvicorn
    from app import launcher
    monkeypatch.setattr(config_module, "settings", Settings(env="production", jwt_secret=DEV_JWT_SECRET))
    monkeypatch.setattr(uvicorn, "Server", MagicMock(side_effect=AssertionError("server started")))
    with pytest.raises(RuntimeError):
        asyncio.run(launcher._serve())
