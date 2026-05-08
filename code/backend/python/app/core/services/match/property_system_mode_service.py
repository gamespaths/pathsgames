"""Step 19 — property-driven SystemModePort implementation."""
from app.core.ports.match.match_ports import SystemModePort


class PropertySystemModeService(SystemModePort):
    """Returns ``True`` when the configured server status equals
    ``"MAINTENANCE"`` (case-insensitive)."""

    _MAINTENANCE = "maintenance"

    def __init__(self, server_status: str = ""):
        self.server_status = server_status or ""

    def is_maintenance(self) -> bool:
        return self.server_status.strip().lower() == self._MAINTENANCE
