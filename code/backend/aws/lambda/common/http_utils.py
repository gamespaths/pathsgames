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


def bearer_token_error(event):
    """v0.37.1 — which refusal a request WITHOUT a usable Bearer token deserves, in the
    vocabulary the Java filter set: MISSING_TOKEN when no Bearer header was sent at all,
    EMPTY_TOKEN when one was sent carrying nothing. Returns ``(code, message)``."""
    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}
    auth = headers.get('authorization')
    if not auth or not auth.lower().startswith('bearer '):
        return 'MISSING_TOKEN', 'Authorization header with Bearer token is required'
    return 'EMPTY_TOKEN', 'Bearer token is empty'


def admin_ip_allowed(source_ip):
    """v0.41.0 — the one allow-list rule; empty list = ADMIN_IP_EMPTY_MEANS (nobody|everybody)."""
    raw = os.environ.get('ADMIN_IP_WHITELIST', '').strip()
    allowed = [ip.strip() for ip in raw.split(',') if ip.strip()]
    if not allowed:
        return os.environ.get('ADMIN_IP_EMPTY_MEANS', 'nobody').strip().lower() == 'everybody'
    return source_ip in allowed


def check_admin_ip(event, err_fn=None):
    """A 403 (in the caller's ``err_fn`` shape) when the caller IP may not reach the admin API."""
    source_ip = get_source_ip(event)
    if admin_ip_allowed(source_ip):
        return None
    return (err_fn or err)(403, 'FORBIDDEN', f'IP {source_ip} not authorized for admin access')
