"""v1.1.0 — creates the smoke match by calling match.handler in this process (no TURNSTILE_SECRET_KEY here).
The public MatchFunction is untouched: this module only builds a synthetic HTTP API v2 event."""
import json
import os
import uuid
from datetime import datetime, timezone

SOURCE_IP_FALLBACK = 'smoke-test'  # rate-limit key when SMOKE_SOURCE_IP is unset
ROUTE = 'POST /api/matches'
PATH = '/api/matches'


def match_name(now=None):
    now = now or datetime.now(timezone.utc)
    return 'smoketest-' + now.strftime('%Y%m%d-%H%M')


def source_ip():
    return os.environ.get('SMOKE_SOURCE_IP', '').strip() or SOURCE_IP_FALLBACK


def build_event(access_token, csrf_token, body, user_agent):
    return {
        'version': '2.0',
        'routeKey': ROUTE,
        'rawPath': PATH,
        'headers': {
            'authorization': f'Bearer {access_token}',
            'x-csrf-token': csrf_token or '',
            'content-type': 'application/json',
            'user-agent': user_agent,
        },
        'requestContext': {
            'http': {'method': 'POST', 'path': PATH, 'sourceIp': source_ip()},
            'requestId': f'smoke-{uuid.uuid4()}',
        },
        'body': json.dumps(body),
    }


def create_match(access_token, csrf_token, body, user_agent):
    """Returns ``(statusCode, parsed body)``; the import is lazy so a broken module is a reported failure."""
    from match import handler as match_handler
    result = match_handler.lambda_handler(build_event(access_token, csrf_token, body, user_agent), None) or {}
    try:
        parsed = json.loads(result.get('body') or 'null')
    except (TypeError, ValueError):
        parsed = None
    return result.get('statusCode'), parsed
