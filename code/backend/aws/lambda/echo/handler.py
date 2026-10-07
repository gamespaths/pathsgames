import json
import os
import time
from datetime import datetime, timezone

from common import log_utils
from common.http_utils import normalize_path as _normalize_path
from common.response import HEADERS, finalize as _finalize

# v0.38.1 — botocore "Found credentials in environment variables" at INFO is noise on every cold start.
log_utils.quiet_botocore()

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
            "version": "0.42.0"
        }
    }

    return {
        "statusCode": 200,
        "headers": HEADERS,
        "body": json.dumps(response_body)
    }
