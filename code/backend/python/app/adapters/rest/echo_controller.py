from fastapi import APIRouter
from app.core.ports.echo_port import EchoPort

class EchoController:
    def __init__(self, echo_port: EchoPort):
        self.echo_port = echo_port
        self.router = APIRouter(prefix="/api/echo")
        self.router.add_api_route("/status", self.get_status, methods=["GET"])

    def get_status(self):
        return {
            "status": self.echo_port.get_server_status(),
            "timestamp": self.echo_port.get_timestamp(),
            "properties": self.echo_port.get_server_properties()
        }
