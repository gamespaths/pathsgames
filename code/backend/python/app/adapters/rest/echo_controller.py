from fastapi import APIRouter
from app.core.ports.echo_port import EchoPort

class EchoController:
    def __init__(self, echo_port: EchoPort, google_login_service=None):
        self.echo_port = echo_port
        # v1.2.0 the Google sign-in switch and the client id, read by react-game at runtime
        self.google_login_service = google_login_service
        self.router = APIRouter(prefix="/api/echo")
        self.router.add_api_route("/status", self.get_status, methods=["GET"])

    def get_status(self):
        body = {
            "status": self.echo_port.get_server_status(),
            "timestamp": self.echo_port.get_timestamp(),
            "properties": self.echo_port.get_server_properties()
        }
        if self.google_login_service is not None:
            body["googleEnabled"] = self.google_login_service.enabled
            body["googleClientId"] = self.google_login_service.client_id()
        return body
