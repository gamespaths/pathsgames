from fastapi import APIRouter, HTTPException

from app.core.ports.dev.test_data_cleanup_port import TestDataCleanupPort


class DevController:
    """REST adapter for dev-only maintenance endpoints.

    POST /api/dev/cleanup removes the rows created by automated (Robot
    Framework) test runs — guests and matches carrying the ``robottest``
    marker — while preserving every other row.

    The endpoint returns 403 unless dev test endpoints are enabled, so it is
    inert in production deployments.
    """

    def __init__(self, cleanup_port: TestDataCleanupPort, test_endpoints_enabled: bool):
        self.cleanup_port = cleanup_port
        self.test_endpoints_enabled = test_endpoints_enabled
        self.router = APIRouter(prefix="/api/dev")
        self.router.add_api_route("/cleanup", self.cleanup, methods=["POST"])

    def cleanup(self):
        if not self.test_endpoints_enabled:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "DEV_ENDPOINTS_DISABLED",
                    "message": "Dev test endpoints are disabled on this environment",
                },
            )
        result = self.cleanup_port.cleanup_test_data()
        return {
            "deletedGuests": result.deleted_guests,
            "deletedMatches": result.deleted_matches,
        }
