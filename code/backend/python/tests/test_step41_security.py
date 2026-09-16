"""v0.37.7 — Step 41: the rate limiter on guest and match creation, and the CSRF token that
every access token is issued with and that POST /api/matches demands back."""
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.rest.auth.guest_auth_controller import GuestAuthController
from app.adapters.rest.auth.session_controller import SessionController
from app.adapters.rest.match.match_controller import MatchController
from app.core.models.auth.guest_session import GuestSession
from app.core.models.auth.refreshed_session import RefreshedSession
from app.core.models.auth.token_info import TokenInfo
from app.core.models.match.match_models import MatchSummary
from app.core.services.security.csrf_token_service import HEADER, CsrfTokenService
from app.core.services.security.rate_limit_service import RateLimitService, Verdict, client_ip

SECRET = "PathsGamesDevSecret2026_MustBeAtLeast32Chars!"
ACCESS = "eyJ.access.token"


# ── core: RateLimitService ─────────────────────────────────────────────────────

class _Clock:
    def __init__(self):
        self.now = 1_000_000.0

    def __call__(self):
        return self.now


def test_rate_limit_is_inclusive_then_refuses():
    svc = RateLimitService(60, _Clock())
    for i in range(3):
        v = svc.try_acquire("guest", "1.2.3.4", 3)
        assert v.allowed and v.remaining == 2 - i
    refused = svc.try_acquire("guest", "1.2.3.4", 3)
    assert not refused.allowed and refused.remaining == 0 and refused.limit == 3
    assert 1 <= refused.retry_after_seconds <= 60


def test_rate_limit_buckets_and_keys_are_independent():
    svc = RateLimitService(60, _Clock())
    svc.try_acquire("guest", "1.2.3.4", 1)
    assert not svc.try_acquire("guest", "1.2.3.4", 1).allowed
    assert svc.try_acquire("match", "1.2.3.4", 1).allowed
    assert svc.try_acquire("guest", "5.6.7.8", 1).allowed


def test_rate_limit_window_reopens_and_retry_after_counts_down():
    clock = _Clock()
    svc = RateLimitService(10, clock)
    svc.try_acquire("guest", "ip", 1)
    clock.now += 4
    refused = svc.try_acquire("guest", "ip", 1)
    assert not refused.allowed and refused.retry_after_seconds == 6
    clock.now += 6
    assert svc.try_acquire("guest", "ip", 1).allowed


def test_rate_limit_refused_attempts_count_and_reset_forgets():
    svc = RateLimitService(10, _Clock())
    for _ in range(5):
        svc.try_acquire("guest", "ip", 2)
    assert svc.try_acquire("guest", "ip", 2).remaining == 0
    svc.reset()
    assert svc.try_acquire("guest", "ip", 2).allowed


def test_rate_limit_disabled_or_anonymous_never_limits():
    svc = RateLimitService(60, _Clock())
    for _ in range(50):
        assert svc.try_acquire("guest", "ip", 0).allowed
        assert svc.try_acquire("guest", "ip", -1).allowed
        assert svc.try_acquire("guest", " ", 1).allowed
        assert svc.try_acquire("guest", None, 1).allowed
    assert Verdict.unlimited().remaining == 2**31 - 1


def test_rate_limit_sweep_keeps_working_and_window_is_clamped():
    clock = _Clock()
    svc = RateLimitService(0, clock)          # clamped to one second
    for i in range(2100):
        svc.try_acquire("guest", f"ip-{i}", 1)
        clock.now += 0.001
    clock.now += 5
    assert svc.try_acquire("guest", "ip-0", 1).allowed
    svc.try_acquire("guest", "x", 1)
    assert not svc.try_acquire("guest", "x", 1).allowed
    clock.now += 1
    assert svc.try_acquire("guest", "x", 1).allowed


def test_client_ip_prefers_first_forwarded_hop():
    assert client_ip("9.9.9.9, 10.0.0.1", "127.0.0.1") == "9.9.9.9"
    assert client_ip(" 9.9.9.9 ", "127.0.0.1") == "9.9.9.9"
    assert client_ip(None, "127.0.0.1") == "127.0.0.1"
    assert client_ip("  ", " 127.0.0.1 ") == "127.0.0.1"
    assert client_ip(" , 10.0.0.1", "127.0.0.1") == "127.0.0.1"
    assert client_ip(None, None) == ""


# ── core: CsrfTokenService ─────────────────────────────────────────────────────

def test_csrf_token_is_deterministic_and_bound():
    svc = CsrfTokenService(SECRET, True)
    a = svc.token_for("eyJ.access.a")
    assert a and a == svc.token_for("eyJ.access.a") == svc.token_for("  eyJ.access.a  ")
    assert a != svc.token_for("eyJ.access.b")
    assert "=" not in a
    assert svc.enforced
    assert CsrfTokenService(SECRET + "x", True).token_for("t") != svc.token_for("t")


def test_csrf_token_matches_java_vector():
    # HMAC-SHA256("csrf:t") under the dev secret, base64url without padding — the value the
    # Java CsrfTokenService and the AWS handler compute for the same input.
    import base64, hashlib, hmac
    expected = base64.urlsafe_b64encode(
        hmac.new(SECRET.encode(), b"csrf:t", hashlib.sha256).digest()).rstrip(b"=").decode()
    assert CsrfTokenService(SECRET).token_for("t") == expected


def test_csrf_matches_and_blanks():
    svc = CsrfTokenService(SECRET, False)
    token = svc.token_for("eyJ.access")
    assert svc.matches("eyJ.access", token)
    assert svc.matches("eyJ.access", " " + token + " ")
    assert not svc.matches("eyJ.access", token + "x")
    assert not svc.matches("eyJ.other", token)
    assert not svc.matches("eyJ.access", None)
    assert not svc.matches("eyJ.access", "  ")
    assert not svc.matches(None, token)
    assert not svc.enforced
    assert svc.token_for(None) is None and svc.token_for("  ") is None
    with pytest.raises(ValueError):
        CsrfTokenService(" ")
    with pytest.raises(ValueError):
        CsrfTokenService("")


# ── REST: guest creation ───────────────────────────────────────────────────────

def _guest_app(guest_per_ip, limiter, csrf):
    guest_port, jwt_port, token_port = MagicMock(), MagicMock(), MagicMock()
    session = GuestSession(user_uuid="u1", username="user1", access_token="a", refresh_token="r",
                           access_token_expires_at=1, refresh_token_expires_at=2,
                           guest_cookie_token="cookie")
    guest_port.create_guest_session.return_value = session
    guest_port.resume_guest_session.return_value = session
    jwt_port.generate_access_token.return_value = ACCESS
    jwt_port.generate_refresh_token.return_value = "refresh"
    jwt_port.get_access_token_expiration_ms.return_value = 1000
    jwt_port.get_refresh_token_expiration_ms.return_value = 2000
    jwt_port.parse_token.return_value = TokenInfo(sub="u1", iss="i", aud="a", exp=1, nbf=0, iat=0,
                                                  jti="j", roles=[], username="u", type="refresh")
    app = FastAPI()
    app.include_router(GuestAuthController(guest_port, jwt_port, token_port, True,
                                           limiter, guest_per_ip, csrf).router)
    return TestClient(app), guest_port


def test_guest_response_carries_csrf_token_on_create_and_resume():
    csrf = CsrfTokenService(SECRET)
    client, _ = _guest_app(0, RateLimitService(3600), csrf)
    assert client.post("/api/auth/guest").json()["csrfToken"] == csrf.token_for(ACCESS)
    client.cookies.set("pathsgames.guestcookie", "cookie")
    res = client.post("/api/auth/guest/resume")
    assert res.status_code == 200 and res.json()["csrfToken"] == csrf.token_for(ACCESS)


def test_guest_creation_is_rate_limited_per_forwarded_address():
    client, guest_port = _guest_app(2, RateLimitService(3600), CsrfTokenService(SECRET))
    h = {"X-Forwarded-For": "1.1.1.1"}
    assert client.post("/api/auth/guest", headers=h).status_code == 201
    assert client.post("/api/auth/guest", headers=h).status_code == 201
    refused = client.post("/api/auth/guest", headers=h)
    assert refused.status_code == 429
    assert refused.headers["Retry-After"]
    body = refused.json()
    assert body["error"] == "RATE_LIMITED" and isinstance(body["retryAfterSeconds"], int)
    assert client.post("/api/auth/guest", headers={"X-Forwarded-For": "2.2.2.2, 1.1.1.1"}).status_code == 201
    assert guest_port.create_guest_session.call_count == 3


def test_guest_creation_unlimited_when_disabled_and_legacy_has_no_csrf():
    client, _ = _guest_app(0, RateLimitService(3600), None)
    for _ in range(20):
        res = client.post("/api/auth/guest")
        assert res.status_code == 201 and "csrfToken" not in res.json()


# ── REST: refresh ──────────────────────────────────────────────────────────────

def test_refresh_carries_its_own_csrf_token():
    csrf = CsrfTokenService(SECRET)
    session_service = MagicMock()
    session_service.refresh_session.return_value = RefreshedSession(
        user_uuid="u1", username="user1", role="PLAYER", access_token="new-access",
        refresh_token="new-refresh", access_token_expires_at=1000, refresh_token_expires_at=2000)
    app = FastAPI()
    app.include_router(SessionController(session_service, csrf).router)
    client = TestClient(app)
    client.cookies.set("pathsgames.refreshToken", "old")
    res = client.post("/refresh")
    assert res.status_code == 200 and res.json()["csrfToken"] == csrf.token_for("new-access")


def test_me_carries_the_csrf_token_of_the_bearer():
    from fastapi import Request
    csrf = CsrfTokenService(SECRET)
    app = FastAPI()

    @app.middleware("http")
    async def auth(request: Request, call_next):
        request.state.user_uuid, request.state.username, request.state.role = "u1", "g", "PLAYER"
        return await call_next(request)

    app.include_router(SessionController(MagicMock(), csrf).router)
    res = TestClient(app).get("/me", headers={"Authorization": "Bearer " + ACCESS})
    assert res.status_code == 200 and res.json()["csrfToken"] == csrf.token_for(ACCESS)
    bare = FastAPI()

    @bare.middleware("http")
    async def auth2(request: Request, call_next):
        request.state.user_uuid = "u1"
        return await call_next(request)

    bare.include_router(SessionController(MagicMock()).router)
    assert "csrfToken" not in TestClient(bare).get("/me").json()


# ── REST: match creation ───────────────────────────────────────────────────────

def _match_app(match_per_ip, limiter, csrf):
    command_port = MagicMock()
    command_port.create_match.return_value = MatchSummary(
        uuid="m-1", story_uuid="s", difficulty_uuid="d", status="CREATED", current_clock=0,
        exp_cost=0, user_creator_uuid="u", name="n", ts_insert="ts")
    controller = MatchController(command_port, MagicMock(), None, limiter, match_per_ip, csrf)
    app = FastAPI()
    app.include_router(controller.router)

    @app.middleware("http")
    async def inject_user(request, call_next):
        if request.headers.get("x-user"):
            request.state.user_uuid = request.headers["x-user"]
        return await call_next(request)

    return TestClient(app), command_port


def _create(client, ip, **extra):
    headers = {"x-user": "u", "Authorization": "Bearer " + ACCESS, "X-Forwarded-For": ip}
    headers.update(extra)
    return client.post("/api/matches", headers=headers, json={"storyUuid": "s", "difficultyUuid": "d"})


def test_match_creation_without_csrf_header_is_refused():
    client, command_port = _match_app(0, RateLimitService(3600), CsrfTokenService(SECRET))
    res = _create(client, "1.1.1.1")
    assert res.status_code == 403 and res.json()["error"] == "CSRF_TOKEN_MISSING"
    command_port.create_match.assert_not_called()


def test_match_creation_with_foreign_csrf_token_is_refused():
    csrf = CsrfTokenService(SECRET)
    client, command_port = _match_app(0, RateLimitService(3600), csrf)
    res = _create(client, "1.1.1.1", **{HEADER: csrf.token_for("other")})
    assert res.status_code == 403 and res.json()["error"] == "CSRF_TOKEN_INVALID"
    command_port.create_match.assert_not_called()


def test_match_creation_with_the_issued_csrf_token_passes():
    csrf = CsrfTokenService(SECRET)
    client, _ = _match_app(0, RateLimitService(3600), csrf)
    res = _create(client, "1.1.1.1", **{HEADER: csrf.token_for(ACCESS)})
    assert res.status_code == 201 and res.json()["uuid"] == "m-1"


def test_match_creation_not_enforced_or_legacy_needs_no_header():
    client, _ = _match_app(0, RateLimitService(3600), CsrfTokenService(SECRET, False))
    assert _create(client, "1.1.1.1").status_code == 201
    legacy, _ = _match_app(0, None, None)
    assert _create(legacy, "1.1.1.1").status_code == 201


def test_match_creation_is_rate_limited_and_csrf_runs_first():
    csrf = CsrfTokenService(SECRET)
    client, command_port = _match_app(1, RateLimitService(3600), csrf)
    token = {HEADER: csrf.token_for(ACCESS)}
    assert _create(client, "3.3.3.3").status_code == 403          # forged: spends nothing
    assert _create(client, "3.3.3.3", **token).status_code == 201
    refused = _create(client, "3.3.3.3", **token)
    assert refused.status_code == 429 and refused.headers["Retry-After"]
    assert refused.json()["error"] == "RATE_LIMITED"
    assert _create(client, "4.4.4.4", **token).status_code == 201
    assert command_port.create_match.call_count == 2
