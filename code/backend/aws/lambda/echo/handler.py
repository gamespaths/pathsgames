import json
import os
import time
from datetime import datetime, timezone

from common import log_utils

# v0.38.1 — botocore "Found credentials in environment variables" at INFO is noise on every cold start.
log_utils.quiet_botocore()

def lambda_handler(event, context):
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
            "version": "0.38.3"
        }
    }

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(response_body)
    }
