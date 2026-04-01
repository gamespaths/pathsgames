import sys
import time
from app.core.ports.echo_port import EchoPort


class EchoService(EchoPort):
    def __init__(self, server_status: str, server_properties: dict[str, str]):
        self.server_status = server_status
        self.server_properties = server_properties

    def get_server_status(self) -> str:
        return self.server_status

    def get_timestamp(self) -> int:
        return int(time.time() * 1000)

    def get_server_properties(self) -> dict[str, str]:
        props = dict(self.server_properties)
        props["pythonVersion"] = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        return props
