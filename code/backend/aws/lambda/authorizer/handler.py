"""IP allow-list Lambda authorizer for the admin HTTP API.

Attached to PathsGamesAdminApi (the dedicated admin endpoint). It gates every /api/admin/**
route by source IP BEFORE the request reaches the domain Lambdas — the API-Gateway-level
equivalent of the per-port firewall used by the Java/Python/AWS backends.

HTTP API request authorizer with simple responses (payload format 2.0): return
{"isAuthorized": bool}. The in-Lambda _check_admin_ip in each handler stays as
defense-in-depth.

ADMIN_IP_WHITELIST: comma-separated allow-list. Empty = allow all (dev only, insecure).
"""
import os


def _allowed_ips():
    raw = os.environ.get('ADMIN_IP_WHITELIST', '').strip()
    return [ip.strip() for ip in raw.split(',') if ip.strip()]


def _get_source_ip(event):
    return (event.get('requestContext', {}).get('http', {}).get('sourceIp', '') or
            (event.get('headers') or {}).get('x-forwarded-for', '').split(',')[0].strip())


def lambda_handler(event, context):
    allowed = _allowed_ips()
    # Empty allow-list = no IP restriction (dev only).
    if not allowed:
        return {"isAuthorized": True}
    source_ip = _get_source_ip(event)
    return {"isAuthorized": source_ip in allowed}
