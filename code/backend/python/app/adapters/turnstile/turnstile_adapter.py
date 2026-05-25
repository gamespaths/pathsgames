"""Cloudflare Turnstile verification adapter."""
from typing import Optional

import httpx

from app.core.ports.match.match_ports import TurnstileVerificationPort

_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


class TurnstileVerificationAdapter(TurnstileVerificationPort):
    """Calls the Cloudflare siteverify API.
    When secret_key is empty the check is skipped (dev bypass).
    """

    def __init__(self, secret_key: str) -> None:
        self._secret_key = secret_key

    def verify(self, token: Optional[str], remote_ip: Optional[str]) -> bool:
        if not self._secret_key:
            return True
        if not token:
            return False
        try:
            data = {"secret": self._secret_key, "response": token}
            if remote_ip:
                data["remoteip"] = remote_ip
            response = httpx.post(_SITEVERIFY_URL, data=data, timeout=5.0)
            return response.json().get("success", False) is True
        except Exception:
            return False
