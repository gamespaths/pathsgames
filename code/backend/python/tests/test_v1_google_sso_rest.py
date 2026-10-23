"""v1.2.0 Google SSO REST: POST /api/auth/google, refresh SESSION_REVOKED, GET/DELETE /api/auth/me, echo,
dev endpoints (admin token, fake Google token, deletion job) and the JWT middleware state check."""
from unittest.mock import MagicMock

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.adapters.rest.auth.google_auth_controller import GoogleAuthController
from app.adapters.rest.auth.session_controller import SessionController
from app.adapters.rest.dev.dev_controller import DevController
from app.adapters.rest.echo_controller import EchoController
from app.adapters.rest.middleware.jwt_middleware import JwtMiddleware
from app.core.models.auth.auth_error import AuthError
from app.core.models.auth.identity import AdminBootstrapResult, AuthenticatedSession, UserProfile, UserStatus
from app.core.models.auth.token_info import TokenInfo
from app.core.services.security.csrf_token_service import CsrfTokenService
from app.core.services.security.rate_limit_service import RateLimitService

PROFILE = UserProfile("u-1", "google_u1", "mario", "Mario Rossi", "pic", "PLAYER", 2, "it", "GOOGLE")


def _session(merged=None):
    return AuthenticatedSession(PROFILE, "access", "refresh", 1, 2, True, merged, 1, ["m-cancelled"])


def _google_client(service, limiter=None, per_ip=0, csrf=None):
    app = FastAPI()
    app.include_router(GoogleAuthController(service, limiter, per_ip, csrf).router)
    return TestClient(app)


def test_google_login_sets_the_refresh_cookie_and_merges():
    service = MagicMock()
    service.login.return_value = _session("g-1")
    client = _google_client(service, csrf=CsrfTokenService("secret-secret-secret-secret-1234"))
    client.cookies.set("pathsgames.guestcookie", "cookie")
    res = client.post("/api/auth/google", json={"idToken": "id", "nonce": "n", "language": "it"},
                      headers={"Authorization": "Bearer guest-access"})
    body = res.json()
    assert res.status_code == 200 and body["nickname"] == "mario" and body["displayName"] == "Mario Rossi"
    assert body["mergedGuest"] is True and body["cancelledMatches"] == 1 and body["csrfToken"]
    assert body["cancelledMatchUuids"] == ["m-cancelled"]
    assert "pathsgames.refreshToken=refresh" in res.headers.get("set-cookie")
    service.login.assert_called_with("id", "n", "it", "guest-access", "cookie")


def test_google_login_without_body_or_guest():
    service = MagicMock()
    service.login.return_value = _session(None)
    res = _google_client(service).post("/api/auth/google", headers={"Authorization": "Basic x"})
    assert res.status_code == 200 and res.json()["mergedGuest"] is False and res.json()["csrfToken"] is None
    service.login.assert_called_with(None, None, None, None, None)


def test_google_login_refusals_and_rate_limit():
    service = MagicMock()
    service.login.side_effect = AuthError("EMAIL_DOMAIN_NOT_ALLOWED", "gmail only")
    res = _google_client(service).post("/api/auth/google", json={"idToken": "id", "nonce": "n"})
    assert res.status_code == 403 and res.json()["error"] == "EMAIL_DOMAIN_NOT_ALLOWED"
    service.login.side_effect = None
    service.login.return_value = _session()
    client = _google_client(service, RateLimitService(3600), 1)
    headers = {"X-Forwarded-For": "9.9.9.9"}
    assert client.post("/api/auth/google", json={}, headers=headers).status_code == 200
    limited = client.post("/api/auth/google", json={}, headers=headers)
    assert limited.status_code == 429 and limited.json()["error"] == "RATE_LIMITED"


class _State:
    def __init__(self, uuid):
        self.uuid = uuid


def _session_client(session_service, account_service, user_uuid=None):
    app = FastAPI()

    @app.middleware("http")
    async def _auth(request: Request, call_next):
        if user_uuid:
            request.state.user_uuid = user_uuid
            request.state.username = "g"
            request.state.role = "PLAYER"
        return await call_next(request)

    app.include_router(SessionController(session_service, None, account_service).router, prefix="/api/auth")
    return TestClient(app)


def test_refresh_of_a_revoked_session():
    sessions = MagicMock()
    sessions.refresh_session.side_effect = AuthError("SESSION_REVOKED", "closed")
    client = _session_client(sessions, None)
    client.cookies.set("pathsgames.refreshToken", "old")
    res = client.post("/api/auth/refresh")
    assert res.status_code == 401 and res.json()["error"] == "SESSION_REVOKED"
    sessions.refresh_session.side_effect = ValueError("INVALID_REFRESH_TOKEN")
    res = client.post("/api/auth/refresh")
    assert res.status_code == 401 and res.json()["detail"]["error"] == "INVALID_REFRESH_TOKEN"


def test_me_profile_and_fallback():
    account = MagicMock()
    account.profile.return_value = PROFILE
    res = _session_client(MagicMock(), account, "u-1").get("/api/auth/me")
    assert res.json()["accountType"] == "GOOGLE" and res.json()["pictureUrl"] == "pic"
    account.profile.return_value = None
    assert _session_client(MagicMock(), account, "u-2").get("/api/auth/me").json()["username"] == "g"


def test_delete_me():
    account = MagicMock()
    client = _session_client(MagicMock(), account, "u-1")
    res = client.request("DELETE", "/api/auth/me", json={"idToken": "fresh", "nonce": "n"})
    assert res.status_code == 202 and res.json()["status"] == "DELETING"
    account.request_deletion.assert_called_with("u-1", "fresh", "n")
    account.request_deletion.side_effect = AuthError("FRESH_TOKEN_REQUIRED", "again")
    res = client.request("DELETE", "/api/auth/me", json={"idToken": 5})
    assert res.status_code == 401 and res.json()["error"] == "FRESH_TOKEN_REQUIRED"
    assert _session_client(MagicMock(), account).request("DELETE", "/api/auth/me").status_code == 401


def test_echo_google_fields():
    echo, google = MagicMock(), MagicMock()
    echo.get_server_status.return_value = "OK"
    echo.get_timestamp.return_value = 1
    echo.get_server_properties.return_value = {}
    google.enabled = True
    google.client_id.return_value = "client"
    app = FastAPI()
    app.include_router(EchoController(echo, google).router)
    body = TestClient(app).get("/api/echo/status").json()
    assert body["googleEnabled"] is True and body["googleClientId"] == "client"
    plain = FastAPI()
    plain.include_router(EchoController(echo).router)
    assert "googleEnabled" not in TestClient(plain).get("/api/echo/status").json()


def _dev_client(enabled, admin=None, fake=None, account=None):
    app = FastAPI()
    app.include_router(DevController(MagicMock(), enabled, admin, fake, account).router)
    return TestClient(app)


def test_dev_endpoints():
    admin, fake, account = MagicMock(), MagicMock(), MagicMock()
    admin.create_admin.return_value = AdminBootstrapResult("a-1", "admin_a1", "robot_admin", True, "tok", 5)
    fake.enabled = True
    fake.mint.return_value = "fake-id"
    account.run_deletion_job.return_value = 2
    client = _dev_client(True, admin, fake, account)
    res = client.post("/api/dev/admin-token")
    assert res.status_code == 201 and res.json()["accessToken"] == "tok"
    admin.create_admin.assert_called_with("robot_admin")
    client.post("/api/dev/admin-token", json={"nickname": "ops"})
    admin.create_admin.assert_called_with("ops")
    assert client.post("/api/dev/google-token", json={"sub": "s"}).json()["idToken"] == "fake-id"
    assert client.post("/api/dev/jobs/account-deletion").json()["deletedUsers"] == 2
    admin.create_admin.side_effect = AuthError("NICKNAME_TAKEN", "taken")
    assert client.post("/api/dev/admin-token", json={"nickname": "mario"}).status_code == 409


def test_dev_endpoints_refused():
    off = _dev_client(False)
    for path in ("/api/dev/admin-token", "/api/dev/google-token", "/api/dev/jobs/account-deletion"):
        assert off.post(path).status_code == 403
    fake = MagicMock()
    fake.enabled = False
    assert _dev_client(True, fake=fake).post("/api/dev/google-token").status_code == 403


def _mw_client(user):
    sessions, states = MagicMock(), MagicMock()
    sessions.validate_access_token.return_value = TokenInfo(sub="u-1", username="claimed", role="ADMIN",
                                                            type="access", iat=0, exp=0)
    states.current.return_value = user
    app = FastAPI()

    @app.get("/api/admin/x")
    def admin_x(request: Request):
        return {"role": request.state.role, "username": request.state.username}

    @app.get("/api/matches")
    def matches(request: Request):
        return {"ok": True}

    app.add_middleware(JwtMiddleware, session_service=sessions, public_paths=[], user_state=states)
    return TestClient(app)


def test_middleware_refuses_unknown_disabled_and_deleting_users():
    headers = {"Authorization": "Bearer t"}
    assert _mw_client(None).get("/api/matches", headers=headers).status_code == 401
    for state, code in ((3, "ACCOUNT_DISABLED"), (4, "ACCOUNT_DISABLED"), (7, "ACCOUNT_DELETION_IN_PROGRESS")):
        res = _mw_client(UserStatus(1, "u-1", "db", "n", "PLAYER", state)).get("/api/matches", headers=headers)
        assert res.status_code == 403 and res.json()["error"] == code


def test_middleware_reads_the_role_from_the_database():
    headers = {"Authorization": "Bearer t"}
    assert _mw_client(UserStatus(1, "u-1", "db", "n", "PLAYER", 2)).get("/api/admin/x", headers=headers).status_code == 403
    res = _mw_client(UserStatus(1, "u-1", "db", "n", "ADMIN", 2)).get("/api/admin/x", headers=headers)
    assert res.json() == {"role": "ADMIN", "username": "db"}
