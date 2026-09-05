from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from typing import List, Any, Optional
from app.core.ports.auth.guest_admin_port import GuestAdminPort

class GuestAdminController:
    def __init__(self, guest_admin_port: GuestAdminPort):
        self.guest_admin_port = guest_admin_port
        self.router = APIRouter(prefix="/api/admin/guests")
        
        self.router.add_api_route("", self.list_all_guests, methods=["GET"])
        self.router.add_api_route("/stats", self.get_guest_stats, methods=["GET"])
        self.router.add_api_route("/expired", self.delete_expired_guests, methods=["DELETE"])
        # v0.36.2 — registered before /{uuid}, which would otherwise swallow "stale".
        self.router.add_api_route("/stale", self.preview_stale_guests, methods=["GET"])
        self.router.add_api_route("/stale", self.delete_stale_guests, methods=["DELETE"])
        self.router.add_api_route("/{uuid}", self.get_guest_by_uuid, methods=["GET"])
        self.router.add_api_route("/{uuid}", self.delete_guest, methods=["DELETE"])

    def list_all_guests(self, limit: Optional[int] = None, cursor: Optional[str] = None,
                        olderThanDays: Optional[int] = None):
        """GET /api/admin/guests — v0.36.2, one page at a time, most recently seen first.

        Answers the {items, nextCursor, limit} envelope the admin match list already uses.
        Before this the endpoint returned the whole table, which on the AWS backend is a
        full-table scan and timed out at 15s.
        """
        page = self.guest_admin_port.list_guests_page(olderThanDays, cursor, limit)
        return {
            "items": [g.model_dump(by_alias=True) for g in page["items"]],
            "nextCursor": page["next_cursor"],
            "limit": page["limit"],
        }

    def preview_stale_guests(self, olderThanDays: Optional[int] = None):
        """GET /api/admin/guests/stale?olderThanDays=N — the dry run: how many guests, and how
        many of their matches, the deletion below would take."""
        if olderThanDays is None or olderThanDays < 0:
            return _bad_older_than_days()
        return JSONResponse(status_code=200,
                            content=self.guest_admin_port.preview_stale_guests(olderThanDays))

    def delete_stale_guests(self, olderThanDays: Optional[int] = None):
        """DELETE /api/admin/guests/stale?olderThanDays=N — remove every guest not seen for N
        days AND every match they created, whatever its status. Matches go first: a match
        references its creator by foreign key. Distinct from DELETE /expired, which only ever
        removes sessions whose own expiry has passed and never touches a match."""
        if olderThanDays is None or olderThanDays < 0:
            return _bad_older_than_days()
        summary = dict(self.guest_admin_port.delete_stale_guests(olderThanDays))
        summary["status"] = "CLEANUP_COMPLETE"
        return JSONResponse(status_code=200, content=summary)

    def get_guest_stats(self):
        stats = self.guest_admin_port.get_guest_stats()
        return stats.model_dump(by_alias=True)

    def get_guest_by_uuid(self, uuid: str):
        guest = self.guest_admin_port.get_guest_by_uuid(uuid)
        if not guest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "GUEST_NOT_FOUND",
                    "message": f"No guest user found with UUID: {uuid}"
                }
            )
        return guest.model_dump(by_alias=True)

    def delete_guest(self, uuid: str):
        deleted = self.guest_admin_port.delete_guest(uuid)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "GUEST_NOT_FOUND",
                    "message": f"No guest user found with UUID: {uuid}"
                }
            )
        return {"status": "DELETED", "uuid": uuid}

    def delete_expired_guests(self):
        deleted_count = self.guest_admin_port.delete_expired_guests()
        return {
            "status": "CLEANUP_COMPLETE",
            "deletedCount": deleted_count
        }


def _bad_older_than_days():
    return JSONResponse(status_code=400, content={
        "error": "INVALID_INPUT",
        "message": "olderThanDays is required and must be >= 0",
    })
