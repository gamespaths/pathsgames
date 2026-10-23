import json
import os
import time
from datetime import datetime, timezone

from common import google_verifier
from common import log_utils
from common import profile
from common.http_utils import normalize_path as _normalize_path
from common.response import HEADERS, finalize as _finalize

# v0.38.1 — botocore "Found credentials in environment variables" at INFO is noise on every cold start.
log_utils.quiet_botocore()

def match_refetch_browsers():
    """v1.7.0 step 8 MATCH_REFETCH_BROWSERS: webkit (default) or all."""
    return profile.parse_list(os.environ.get('MATCH_REFETCH_BROWSERS'), ['webkit'])


def match_refetch_min_hidden_seconds():
    """v1.7.0 step 8 MATCH_REFETCH_MIN_HIDDEN_SECONDS, default 30 (a bad or negative value too)."""
    try:
        value = int(os.environ.get('MATCH_REFETCH_MIN_HIDDEN_SECONDS', '30') or 30)
    except ValueError:
        return 30
    return value if value >= 0 else 30


def lambda_handler(event, context):
    """v0.41.0 — every answer leaves through finalize (security headers)."""
    path = _normalize_path((event or {}).get('rawPath') or (event or {}).get('path') or '')
    return _finalize(_route(event, context), path)


def _route(event, context):
    """
    Health check endpoint: GET /api/echo/status
    Response shape matches EchoStatusResponse (v0.12.0-guest-auth-api.yaml)
    """
    now_ms = int(time.time() * 1000)
    timestamp = datetime.fromtimestamp(now_ms / 1000, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    response_body = {
        "status": "UP",
        "timestamp": timestamp,
        "properties": {
            # Deployment environment, from the SAM `Environment` parameter
            # (injected as the ENV variable on the function).
            "env":     os.environ.get("ENV", "dev"),
            "name":    "Paths Games",
            "version": "1.7.0"
        },
        # v1.2.0 the Google sign-in switch and the client id, read by react-game at runtime
        "googleEnabled": google_verifier.enabled(),
        "googleClientId": google_verifier.client_id(),
        # v1.7.0 the profile choices; react-game shows those it also has a bundle for
        "supportedLanguages": profile.supported_languages(),
        "supportedThemes": profile.supported_themes(),
        # v1.7.0 step 8 when react-game refetches a match on page return
        "matchRefetchBrowsers": match_refetch_browsers(),
        "matchRefetchMinHiddenSeconds": match_refetch_min_hidden_seconds(),
    }

    return {
        "statusCode": 200,
        "headers": HEADERS,
        "body": json.dumps(response_body)
    }
