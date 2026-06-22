"""common/http_utils.py — Shared HTTP/routing helpers for all Lambda handlers."""

import os

from common.response import err


def normalize_path(raw_path):
    """Strip API Gateway stage prefix: /dev/api/... → /api/..."""
    if raw_path.startswith('/api/'):
        return raw_path
    idx = raw_path.find('/api/')
    return raw_path[idx:] if idx >= 0 else raw_path


def get_source_ip(event):
    """Extract caller source IP from HTTP API v2 event."""
    return (event.get('requestContext', {}).get('http', {}).get('sourceIp', '') or
            (event.get('headers') or {}).get('x-forwarded-for', '').split(',')[0].strip())


def bearer_token(event):
    """Extract Bearer token from Authorization header; returns None if absent."""
    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}
    auth = headers.get('authorization')
    if auth and auth.lower().startswith('bearer '):
        return auth[7:].strip()
    return None


def check_admin_ip(event):
    """Return error response if caller IP not in ADMIN_IP_WHITELIST, else None."""
    whitelist_raw = os.environ.get('ADMIN_IP_WHITELIST', '').strip()
    if not whitelist_raw:
        return None
    allowed = [ip.strip() for ip in whitelist_raw.split(',') if ip.strip()]
    if not allowed:
        return None
    source_ip = get_source_ip(event)
    if source_ip not in allowed:
        return err(403, 'FORBIDDEN', 'Source IP not authorized for admin access')
    return None
