"""Cloudflare Turnstile verification adapter."""
import logging
from typing import Optional

import httpx

from app.core.ports.match.match_ports import TurnstileVerificationPort

_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

logger = logging.getLogger(__name__)


class TurnstileVerificationAdapter(TurnstileVerificationPort):
    """Calls the Cloudflare siteverify API.

    Bypasses verification when:
      - secret_key is empty (local dev / CI default), or
      - env is not "prod" AND bypass_token is non-empty AND the incoming token
        matches bypass_token (used by Robot tests against environments that run
        with a real Turnstile secret key).
    """

    def __init__(
        self,
        secret_key: str,
        bypass_token: str = "",
        env: str = "dev",
    ) -> None:
        self._secret_key = secret_key
        self._bypass_token = bypass_token
        self._env = env

    def verify(self, token: Optional[str], remote_ip: Optional[str]) -> bool:
        if not self._secret_key:
            return True
        if (
            self._env != "prod"
            and self._bypass_token
            and token == self._bypass_token
        ):
            return True
        if not token:
            logger.warning("Turnstile refused: no turnstileToken in the request body")
            return False
        try:
            data = {"secret": self._secret_key, "response": token}
            if remote_ip:
                data["remoteip"] = remote_ip
            response = httpx.post(_SITEVERIFY_URL, data=data, timeout=5.0)
            payload = response.json()
            if payload.get("success", False) is True:
                return True
            # error-codes tells a wrong secret from a reused/expired token
            logger.warning("Turnstile refused: %s", payload.get("error-codes"))
            return False
        except Exception as exc:
            logger.warning("Turnstile siteverify call failed: %s", exc)
            return False
