from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import JSONResponse

from app.core.models.auth.auth_error import AuthError
from app.core.ports.dev.test_data_cleanup_port import TestDataCleanupPort

#: v1.2.0 the admin nickname Robot uses when the request names none (not a robottest one)
DEFAULT_ADMIN_NICKNAME = "robot_admin"


class DevController:
    """REST adapter for dev-only maintenance endpoints.

    POST /api/dev/cleanup removes the rows created by automated (Robot
    Framework) test runs — guests and matches carrying the ``robottest``
    marker — while preserving every other row.

    The endpoint returns 403 unless dev test endpoints are enabled, so it is
    inert in production deployments.
    """

    def __init__(self, cleanup_port: TestDataCleanupPort, test_endpoints_enabled: bool,
                 admin_bootstrap=None, fake_google=None, account_service=None):
        self.cleanup_port = cleanup_port
        self.test_endpoints_enabled = test_endpoints_enabled
        # v1.2.0 Robot's admin token, the fake Google provider and the account jobs, all test-only
        self.admin_bootstrap = admin_bootstrap
        self.fake_google = fake_google
        self.account_service = account_service
        self.router = APIRouter(prefix="/api/dev")
        self.router.add_api_route("/cleanup", self.cleanup, methods=["POST"])
        self.router.add_api_route("/admin-token", self.admin_token, methods=["POST"], status_code=201)
        self.router.add_api_route("/google-token", self.google_token, methods=["POST"])
        self.router.add_api_route("/jobs/account-deletion", self.account_deletion, methods=["POST"])

    def _require(self, *collaborators):
        if not self.test_endpoints_enabled or any(c is None for c in collaborators):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "DEV_ENDPOINTS_DISABLED",
                    "message": "Dev test endpoints are disabled on this environment",
                },
            )

    def cleanup(self):
        self._require()
        result = self.cleanup_port.cleanup_test_data()
        return {
            "deletedGuests": result.deleted_guests,
            "deletedMatches": result.deleted_matches,
            "deletedUsers": result.deleted_users,
        }

    def admin_token(self, body: Optional[Dict[str, Any]] = Body(default=None)):
        self._require(self.admin_bootstrap)
        nickname = (body or {}).get("nickname") if isinstance(body, dict) else None
        try:
            admin = self.admin_bootstrap.create_admin(nickname if isinstance(nickname, str) and nickname.strip()
                                                      else DEFAULT_ADMIN_NICKNAME)
        except AuthError as e:
            return JSONResponse(status_code=e.http_status, content={"error": e.code, "message": e.message})
        return JSONResponse(status_code=201, content={
            "userUuid": admin.user_uuid, "username": admin.username, "nickname": admin.nickname, "role": "ADMIN",
            "created": admin.created, "accessToken": admin.access_token, "expiresAt": admin.expires_at})

    def google_token(self, body: Optional[Dict[str, Any]] = Body(default=None)):
        self._require(self.fake_google)
        if not self.fake_google.enabled:
            self._require(None)
        return {"idToken": self.fake_google.mint(body if isinstance(body, dict) else {})}

    def account_deletion(self):
        self._require(self.account_service)
        return {"deletedUsers": self.account_service.run_deletion_job()}
