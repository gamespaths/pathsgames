import sys
import time
from typing import List, Optional

from app.core.models.auth.profile import DEFAULT_LANGUAGES, DEFAULT_THEMES
from app.core.ports.echo_port import EchoPort

DEFAULT_REFETCH_BROWSERS = ["webkit"]
DEFAULT_REFETCH_MIN_HIDDEN_SECONDS = 30


class EchoService(EchoPort):
    def __init__(self, server_status: str, server_properties: dict[str, str],
                 supported_languages: Optional[List[str]] = None, supported_themes: Optional[List[str]] = None):
        self.server_status = server_status
        self.server_properties = server_properties
        # v1.7.0 the profile choices shown by /api/echo/status
        self.supported_languages = list(supported_languages or DEFAULT_LANGUAGES)
        self.supported_themes = list(supported_themes or DEFAULT_THEMES)
        self.match_refetch_browsers = list(DEFAULT_REFETCH_BROWSERS)
        self.match_refetch_min_hidden_seconds = DEFAULT_REFETCH_MIN_HIDDEN_SECONDS

    def set_match_refetch(self, browsers: Optional[List[str]], min_hidden_seconds: Optional[int]) -> None:
        """v1.7.0 step 8 the page-return refetch parameters; empty or negative keeps the default."""
        if browsers:
            self.match_refetch_browsers = list(browsers)
        if min_hidden_seconds is not None and min_hidden_seconds >= 0:
            self.match_refetch_min_hidden_seconds = int(min_hidden_seconds)

    def get_server_status(self) -> str:
        return self.server_status

    def get_timestamp(self) -> int:
        return int(time.time() * 1000)

    def get_server_properties(self) -> dict[str, str]:
        props = dict(self.server_properties)
        props["pythonVersion"] = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        return props

    def get_supported_languages(self) -> list[str]:
        return list(self.supported_languages)

    def get_supported_themes(self) -> list[str]:
        return list(self.supported_themes)

    def get_match_refetch_browsers(self) -> list[str]:
        return list(self.match_refetch_browsers)

    def get_match_refetch_min_hidden_seconds(self) -> int:
        return self.match_refetch_min_hidden_seconds
