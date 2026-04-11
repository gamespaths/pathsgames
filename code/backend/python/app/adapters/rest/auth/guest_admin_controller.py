from fastapi import APIRouter, HTTPException, status
from typing import List, Any
from app.core.ports.auth.guest_admin_port import GuestAdminPort

class GuestAdminController:
    def __init__(self, guest_admin_port: GuestAdminPort):
        self.guest_admin_port = guest_admin_port
        self.router = APIRouter(prefix="/api/admin/guests")
        
        self.router.add_api_route("", self.list_all_guests, methods=["GET"])
        self.router.add_api_route("/stats", self.get_guest_stats, methods=["GET"])
        self.router.add_api_route("/expired", self.delete_expired_guests, methods=["DELETE"])
        self.router.add_api_route("/{uuid}", self.get_guest_by_uuid, methods=["GET"])
        self.router.add_api_route("/{uuid}", self.delete_guest, methods=["DELETE"])

    async def list_all_guests(self):
        guests = self.guest_admin_port.list_all_guests()
        return [g.model_dump(by_alias=True) for g in guests]

    async def get_guest_stats(self):
        stats = self.guest_admin_port.get_guest_stats()
        return stats.model_dump(by_alias=True)

    async def get_guest_by_uuid(self, uuid: str):
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

    async def delete_guest(self, uuid: str):
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

    async def delete_expired_guests(self):
        deleted_count = self.guest_admin_port.delete_expired_guests()
        return {
            "status": "CLEANUP_COMPLETE",
            "deletedCount": deleted_count
        }
