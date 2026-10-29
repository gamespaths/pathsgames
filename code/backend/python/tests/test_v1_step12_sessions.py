"""V1 step 12 (1.7.0): cap of 12 sessions with SESSION_LIMIT, 2-minute grace and reuse detection, guest refresh
capped at 180 days, activeSessions, 7-day purge, sessions_valid_after, cookies and the admin stories envelope."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, Request, Response
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.adapters.persistence.match.models  # noqa: F401  registers gaming_* tables
import app.adapters.persistence.story.models  # noqa: F401  registers list_* tables
from app.adapters.persistence import database
from app.adapters.persistence.auth.identity_persistence_adapter import epoch_seconds
from app.adapters.persistence.auth.models import Base, User, UserToken
from app.adapters.persistence.auth.token_persistence_adapter import TokenPersistenceAdapter
from app.adapters.rest.auth import guest_auth_controller
from app.adapters.rest.auth.session_controller import SessionController
from app.adapters.rest.middleware.jwt_middleware import JwtMiddleware
from app.adapters.scheduler import account_jobs_scheduler
from app.config import Settings
from app.core.models.auth import revoke_reasons
from app.core.models.auth.auth_error import AuthError, CODES
from app.core.models.auth.identity import StoredRefreshToken, UserStatus
from app.core.models.auth.refreshed_session import RefreshedSession
from app.core.models.auth.token_info import TokenInfo
from app.core.ports.auth.session_port import SessionPort
from app.core.ports.auth.token_persistence_port import TokenPersistencePort
from app.core.services.auth import token_hasher
from app.core.services.auth.guest_auth_service import GuestAuthService
from app.core.services.auth.session_service import (DEFAULT_MAX_TOKENS_PER_USER, GRACE_SECONDS, SessionService,
                                                     refresh_expiry_ms, valid_after)
from app.core.services.story.story_query_service import StoryQueryService

NOW = datetime(2026, 10, 22, 10, 0, 0, 700000, tzinfo=timezone.utc)
TOKEN = "refresh-jwt"
HASH = token_hasher.sha256(TOKEN)
DAY_MS = 86_400_000


def ms(dt):
    return int(dt.timestamp() * 1000)


@pytest.fixture()
def tokens():
    t = MagicMock()
    t.find_user_by_id.return_value = UserStatus(1, "u", "g", "m", "PLAYER", 2)
    return t


@pytest.fixture()
def jwt_port():
    j = MagicMock()
    j.validate_token.return_value = True
    j.parse_token.return_value = TokenInfo(sub="u", username="", type="refresh", iat=0, exp=0)
    j.generate_access_token.return_value = "access-2"
    j.generate_refresh_token.return_value = "refresh-2"
    j.get_refresh_token_expiration_ms.return_value = ms(NOW + timedelta(days=250))
    j.get_access_token_expiration_ms.return_value = ms(NOW + timedelta(minutes=30))
    return j


@pytest.fixture()
def state():
    return MagicMock()


@pytest.fixture()
def service(jwt_port, tokens, state):
    return SessionService(jwt_port, tokens, clock=lambda: NOW, user_state=state)


def revoked(reason, rotated=None):
    return StoredRefreshToken(10, 1, True, (NOW + timedelta(days=5)).isoformat(), rotated, reason)


# ── session service ──────────────────────────────────────────────────────────

def test_defaults_are_twelve_sessions_and_two_minutes(service, tokens):
    assert DEFAULT_MAX_TOKENS_PER_USER == 12 and GRACE_SECONDS == 120
    assert CODES["SESSION_LIMIT"] == 401
    tokens.find_refresh_token.return_value = StoredRefreshToken(10, 1, False, None, None)
    session = service.refresh_session(TOKEN)
    assert session.refresh_token_expires_at == ms(NOW + timedelta(days=250))
    tokens.enforce_token_limit.assert_called_once_with(1, 12)


def test_a_token_revoked_by_the_cap_answers_session_limit(service, tokens):
    tokens.find_refresh_token.return_value = revoked(revoke_reasons.LIMIT)
    with pytest.raises(AuthError) as e:
        service.refresh_session(TOKEN)
    assert e.value.code == "SESSION_LIMIT" and e.value.http_status == 401
    tokens.revoke_all_by_user_id.assert_not_called()


@pytest.mark.parametrize("reason", [revoke_reasons.LOGOUT, revoke_reasons.LOGOUT_ALL, revoke_reasons.ADMIN, None])
def test_other_reasons_answer_session_revoked(service, tokens, reason):
    tokens.find_refresh_token.return_value = revoked(reason)
    with pytest.raises(AuthError) as e:
        service.refresh_session(TOKEN)
    assert e.value.code == "SESSION_REVOKED"
    tokens.revoke_all_by_user_id.assert_not_called()


def test_a_rotated_token_reused_after_the_grace_revokes_every_session(service, tokens, state):
    tokens.find_refresh_token.return_value = revoked(revoke_reasons.ROTATED, (NOW - timedelta(seconds=121)).isoformat())
    with pytest.raises(AuthError) as e:
        service.refresh_session(TOKEN)
    assert e.value.code == "SESSION_REVOKED"
    tokens.revoke_all_by_user_id.assert_called_once_with(1, revoke_reasons.LOGOUT_ALL)
    tokens.set_sessions_valid_after.assert_called_once_with(1, "2026-10-22T10:00:00Z")
    state.evict.assert_called_once_with("u")


def test_reuse_of_an_unknown_user_cuts_nothing(service, tokens):
    tokens.find_refresh_token.return_value = revoked(revoke_reasons.ROTATED, (NOW - timedelta(days=1)).isoformat())
    tokens.find_user_by_id.return_value = None
    with pytest.raises(AuthError):
        service.refresh_session(TOKEN)
    tokens.revoke_all_by_user_id.assert_not_called()


def test_a_rotated_token_at_the_edge_of_the_grace_is_accepted(service, tokens):
    tokens.find_refresh_token.return_value = revoked(revoke_reasons.ROTATED, (NOW - timedelta(seconds=120)).isoformat())
    assert service.refresh_session(TOKEN).access_token == "access-2"
    tokens.revoke_all_by_user_id.assert_not_called()
    tokens.mark_rotated.assert_not_called()


def test_v1_10_a_rotated_token_in_the_grace_is_refused_after_logout_all(service, tokens, jwt_port):
    cut = int(NOW.timestamp())
    jwt_port.parse_token.return_value = TokenInfo(sub="u", username="", type="refresh", iat=cut - 30, exp=0)
    tokens.find_refresh_token.return_value = revoked(revoke_reasons.ROTATED, (NOW - timedelta(seconds=10)).isoformat())
    tokens.find_user_by_id.return_value = UserStatus(1, "u", "g", "m", "PLAYER", 2, "en", cut)
    with pytest.raises(AuthError) as err:
        service.refresh_session(TOKEN)
    assert err.value.code == "SESSION_REVOKED"
    jwt_port.generate_refresh_token.assert_not_called()
    tokens.store_refresh_token.assert_not_called()


def test_v1_10_a_token_issued_after_the_cut_still_refreshes(service, tokens, jwt_port):
    cut = int(NOW.timestamp())
    jwt_port.parse_token.return_value = TokenInfo(sub="u", username="", type="refresh", iat=cut, exp=0)
    tokens.find_refresh_token.return_value = StoredRefreshToken(10, 1, False, (NOW + timedelta(days=5)).isoformat(), None)
    tokens.find_user_by_id.return_value = UserStatus(1, "u", "g", "m", "PLAYER", 2, "en", cut)
    assert service.refresh_session(TOKEN).access_token == "access-2"


def test_a_guest_refresh_is_capped_at_180_days(service, tokens):
    tokens.find_refresh_token.return_value = StoredRefreshToken(10, 1, False, None, None)
    tokens.find_user_by_id.return_value = UserStatus(1, "u", "guest_1", "g", "PLAYER", 6)
    assert service.refresh_session(TOKEN).refresh_token_expires_at == ms(NOW + timedelta(days=180))
    stored = tokens.store_refresh_token.call_args.args[2]
    assert stored.startswith("2027-04-20")


def test_refresh_expiry_and_valid_after_helpers():
    longer, shorter = ms(NOW + timedelta(days=250)), ms(NOW + timedelta(days=7))
    assert refresh_expiry_ms(longer, False, NOW) == longer
    assert refresh_expiry_ms(longer, True, NOW) == ms(NOW + timedelta(days=180))
    assert refresh_expiry_ms(shorter, True, NOW) == shorter
    assert valid_after(NOW) == "2026-10-22T10:00:00Z"


def test_logout_all_revokes_sets_valid_after_and_evicts(service, tokens, state):
    tokens.find_user_id_by_uuid.return_value = 1
    service.logout_all("u")
    tokens.revoke_all_by_user_id.assert_called_once_with(1, revoke_reasons.LOGOUT_ALL)
    tokens.set_sessions_valid_after.assert_called_once_with(1, "2026-10-22T10:00:00Z")
    state.evict.assert_called_once_with("u")
    plain = SessionService(MagicMock(), tokens, clock=lambda: NOW)
    plain.logout_all("u")
    assert tokens.set_sessions_valid_after.call_count == 2


def test_active_sessions_and_purge(service, tokens):
    assert service.active_sessions(None) == 0 and service.active_sessions(" ") == 0
    tokens.find_user_id_by_uuid.return_value = None
    assert service.active_sessions("x") == 0
    tokens.find_user_id_by_uuid.return_value = 1
    tokens.count_active_issued_after.return_value = 3
    assert service.active_sessions("u") == 3
    tokens.count_active_issued_after.assert_called_once_with(1, NOW - timedelta(days=30))
    tokens.delete_short_lived_revoked.return_value = 4
    assert service.purge_revoked_tokens() == 4
    tokens.delete_short_lived_revoked.assert_called_once_with((NOW - timedelta(days=7)).isoformat())


def test_user_status_accepts_tokens_from_the_boundary_second():
    bound = int(datetime(2026, 10, 22, 10, tzinfo=timezone.utc).timestamp())
    user = UserStatus(1, "u", "g", "m", "PLAYER", 2, "en", bound)
    assert not user.accepts_token_issued_at(bound - 1)
    assert user.accepts_token_issued_at(bound) and user.accepts_token_issued_at(bound + 1)
    assert UserStatus(1, "u", "g", "m", "PLAYER", 2).accepts_token_issued_at(0)


def test_port_defaults():
    class Bare(SessionPort):
        def refresh_session(self, refresh_token): return None
        def logout(self, refresh_token): return None
        def logout_all(self, user_uuid): return None
        def validate_access_token(self, access_token): return None
    assert Bare().active_sessions("u") == 0 and Bare().purge_revoked_tokens() == 0

    class BareTokens(TokenPersistencePort):
        pass
    BareTokens.__abstractmethods__ = frozenset()
    for call in (lambda t: t.count_active_issued_after(1, NOW), lambda t: t.set_sessions_valid_after(1, "x"),
                 lambda t: t.delete_short_lived_revoked("x")):
        with pytest.raises(NotImplementedError):
            call(BareTokens())


# ── guest sessions ───────────────────────────────────────────────────────────

def test_guest_refresh_is_capped_and_the_session_cap_applies(jwt_port):
    persistence, caps = MagicMock(), MagicMock()
    persistence.create_guest_user.return_value = 3
    persistence.find_guest_by_cookie_token.return_value = {"uuid": "g", "username": "guest_g", "id": 3,
                                                           "guest_expires_at": None}
    jwt_port.get_refresh_token_expiration_ms.return_value = int((datetime.now(timezone.utc)
                                                                 + timedelta(days=250)).timestamp() * 1000)
    service = GuestAuthService(jwt_port, persistence, caps, 12)
    created = service.create_guest_session()
    limit = int((datetime.now(timezone.utc) + timedelta(days=180)).timestamp() * 1000)
    assert created.refresh_token_expires_at <= limit
    assert service.resume_guest_session("cookie").refresh_token_expires_at <= limit
    assert caps.enforce_token_limit.call_count == 2
    caps.enforce_token_limit.assert_called_with(3, 12)
    assert GuestAuthService(jwt_port, persistence).create_guest_session() is not None


# ── persistence on SQLite ────────────────────────────────────────────────────

@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    with factory() as s:
        s.add(User(id=1, uuid="u-1", username="google_1", nickname="Mario", state=2, role="PLAYER"))
        s.commit()
    yield factory
    engine.dispose()


def test_token_adapter_reasons_counts_purge_and_valid_after(db):
    adapter = TokenPersistenceAdapter(db)
    future = "2999-01-01T00:00:00+00:00"
    for h in ("h-rot", "h-out", "h-lim", "h-new"):
        adapter.store_refresh_token(1, h, future)
    with db() as s:
        s.query(UserToken).filter(UserToken.refresh_token == "h-lim").update(
            {"ts_insert": datetime(2026, 1, 1)})
        s.commit()
    adapter.mark_rotated(adapter.find_refresh_token("h-rot", None).id, "2026-10-01T00:00:00+00:00")
    assert adapter.revoke_refresh_token("h-out", None)
    adapter.enforce_token_limit(1, 1)
    assert adapter.find_refresh_token("h-lim", None).revoked_reason == revoke_reasons.LIMIT
    assert adapter.find_refresh_token("h-rot", None).revoked_reason == revoke_reasons.ROTATED
    assert adapter.find_refresh_token("h-out", None).revoked_reason == revoke_reasons.LOGOUT
    assert adapter.count_active_issued_after(1, datetime.now(timezone.utc) - timedelta(days=30)) == 1
    assert adapter.count_active_issued_after(1, datetime(2020, 1, 1)) == 1
    with db() as s:
        s.query(UserToken).update({"ts_update": "2026-01-01T00:00:00+00:00"})
        s.commit()
    assert adapter.delete_short_lived_revoked("2026-06-01T00:00:00+00:00") == 2
    assert adapter.find_refresh_token("h-rot", None) is None
    assert adapter.find_refresh_token("h-lim", None) is not None
    adapter.revoke_all_by_user_id(1, revoke_reasons.ADMIN)
    assert adapter.find_refresh_token("h-new", None).revoked_reason == revoke_reasons.ADMIN
    assert adapter.find_refresh_token("h-lim", None).revoked_reason == revoke_reasons.LIMIT
    adapter.set_sessions_valid_after(1, "2026-10-22T10:00:00Z")
    assert adapter.find_user_by_id(1).sessions_valid_after == 1792663200


def test_epoch_seconds_of_the_valid_after_column():
    assert epoch_seconds(None) == 0 and epoch_seconds(" ") == 0 and epoch_seconds("garbage") == 0
    assert epoch_seconds("2026-10-22T10:00:00Z") == 1792663200
    assert epoch_seconds("2026-10-22T10:00:00") == 1792663200


def test_align_schema_adds_the_step12_columns():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as c:
        c.execute(text("CREATE TABLE users (id INTEGER, state INTEGER, last_access TEXT, nickname TEXT,"
                       " email_address TEXT, theme_selected TEXT, suspended_until TEXT, relink_pending INTEGER)"))
        c.execute(text("CREATE TABLE users_tokens (id INTEGER, id_user INTEGER, ts_rotated TEXT)"))
    applied = database.align_schema(engine)
    assert "ALTER TABLE users ADD COLUMN sessions_valid_after TEXT" in applied
    assert "ALTER TABLE users_tokens ADD COLUMN revoked_reason TEXT" in applied
    assert "ALTER TABLE users_tokens ADD COLUMN ts_update TEXT" in applied


# ── REST: middleware, /me, refresh cookie ────────────────────────────────────

def _request(token="Bearer tok"):
    request = MagicMock(spec=Request)
    request.url.path = "/api/matches"
    request.method = "GET"
    request.headers = {"Authorization": token}
    request.state = SimpleNamespace()
    return request


@pytest.mark.anyio
async def test_middleware_refuses_a_token_older_than_sessions_valid_after():
    sessions, states = MagicMock(), MagicMock()
    bound = 1792663200
    states.current.return_value = UserStatus(1, "u", "g", "m", "PLAYER", 2, "en", bound)
    middleware = JwtMiddleware(MagicMock(), sessions, public_paths=[], user_state=states)
    sessions.validate_access_token.return_value = TokenInfo(sub="u", username="g", type="access",
                                                            iat=bound - 1, exp=bound + 1800)
    response = await middleware.dispatch(_request(), AsyncMock(return_value=Response()))
    assert response.status_code == 401 and b"SESSION_REVOKED" in response.body
    sessions.validate_access_token.return_value = TokenInfo(sub="u", username="g", type="access",
                                                            iat=bound, exp=bound + 1800)
    call_next = AsyncMock(return_value=Response())
    await middleware.dispatch(_request(), call_next)
    call_next.assert_called_once()


@pytest.fixture()
def session_client():
    sessions = MagicMock()
    app = FastAPI()

    @app.middleware("http")
    async def auth(request: Request, call_next):
        request.state.user_uuid = "u1"
        return await call_next(request)

    app.include_router(SessionController(sessions).router)
    return TestClient(app), sessions


def test_me_carries_active_sessions(session_client):
    client, sessions = session_client
    sessions.active_sessions.return_value = 4
    assert client.get("/me").json()["activeSessions"] == 4
    sessions.active_sessions.return_value = MagicMock()
    assert client.get("/me").json()["activeSessions"] == 0


def test_refresh_sets_a_250_day_lax_cookie_and_maps_session_limit(session_client, monkeypatch):
    client, sessions = session_client
    sessions.refresh_session.return_value = RefreshedSession(
        user_uuid="u1", username="n", role="PLAYER", access_token="a", refresh_token="r",
        access_token_expires_at=1, refresh_token_expires_at=2)
    client.cookies.set("pathsgames.refreshToken", "old")
    cookie = client.post("/refresh").headers["set-cookie"]
    assert "Max-Age=21600000" in cookie and "SameSite=lax" in cookie
    sessions.refresh_session.side_effect = AuthError("SESSION_LIMIT", "Too many devices, sign in again")
    client.cookies.set("pathsgames.refreshToken", "old")
    res = client.post("/refresh")
    assert res.status_code == 401 and res.json()["error"] == "SESSION_LIMIT"


def test_same_site_parameter_and_cookie_ages(monkeypatch):
    assert guest_auth_controller.same_site("None") == "none"
    assert guest_auth_controller.same_site("Strict") == "strict"
    assert guest_auth_controller.same_site("bogus") == "lax"
    from app.config import settings
    monkeypatch.setattr(settings, "cookie_same_site", "none")
    assert guest_auth_controller.same_site() == "none"
    response = Response()
    guest_auth_controller.set_auth_cookie(response, "pathsgames.guestcookie", "g")
    # v1.11.0 the cookie on /api/auth like Java and AWS, the legacy "/" copy deleted in the same answer
    legacy, header = response.headers.getlist("set-cookie")
    assert "Max-Age=15552000" in header and "SameSite=none" in header and "Path=/api/auth" in header
    assert "pathsgames.guestcookie=" in legacy and "Max-Age=0" in legacy and "Path=/;" in legacy + ";"
    cleared = Response()
    guest_auth_controller.clear_auth_cookie(cleared, "pathsgames.refreshToken")
    paths = [h.split("Path=")[1].split(";")[0] for h in cleared.headers.getlist("set-cookie")]
    assert paths == ["/api/auth", "/"]
    for name in ("COOKIE_SAME_SITE", "MAX_TOKENS_PER_USER", "REFRESH_TOKEN_DAYS"):
        monkeypatch.delenv(name, raising=False)
    defaults = Settings(_env_file=None)  # v1.10.0 the code defaults, whatever the local .env says
    assert defaults.cookie_same_site == "lax" and defaults.max_tokens_per_user == 12
    assert defaults.refresh_token_days == 250


def test_retention_job_also_purges_the_revoked_tokens():
    account, sessions = MagicMock(), MagicMock()
    account.retire_inactive_users.return_value = 0
    assert account_jobs_scheduler.run_retention(account, None, sessions) == 0
    sessions.purge_revoked_tokens.assert_called_once()


# ── admin stories envelope ───────────────────────────────────────────────────

def test_story_query_service_pages_every_story():
    read = MagicMock()
    read.find_all_stories.return_value = [{"uuid": f"s-{i}"} for i in range(3)]
    service = StoryQueryService(read)
    service._map_to_summary = lambda raw, lang: raw["uuid"]
    first = service.list_all_stories_page("en", 2, None)
    assert first == {"items": ["s-0", "s-1"], "nextCursor": "2", "limit": 2}
    assert service.list_all_stories_page(None, 2, "2") == {"items": ["s-2"], "nextCursor": None, "limit": 2}
    assert service.list_all_stories_page("en", None, "bad")["limit"] == 50
    assert service.list_all_stories_page("en", 999, "99") == {"items": [], "nextCursor": None, "limit": 200}
    from app.core.ports.story.story_query_port import StoryQueryPort
    with pytest.raises(NotImplementedError):
        StoryQueryPort.list_all_stories_page(MagicMock())
