import json
import time
from datetime import datetime, timezone

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
            "name":    "Paths Games",
            "version": "0.17.3"
        }
    }

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(response_body)
    }
