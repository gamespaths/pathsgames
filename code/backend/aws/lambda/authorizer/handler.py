"""IP allow-list Lambda authorizer for the admin HTTP API.

Attached to PathsGamesAdminApi (the dedicated admin endpoint). It gates every /api/admin/**
route by source IP BEFORE the request reaches the domain Lambdas — the API-Gateway-level
equivalent of the per-port firewall used by the Java/Python/AWS backends.

HTTP API request authorizer with simple responses (payload format 2.0): return
{"isAuthorized": bool}. The same rule (common.http_utils.check_admin_ip) runs again in each
admin handler as defense-in-depth.

ADMIN_IP_WHITELIST: comma-separated allow-list. v0.41.0 — when empty, ADMIN_IP_EMPTY_MEANS
decides: 'nobody' (default, dev and test included) or 'everybody'.
"""
from common.http_utils import admin_ip_allowed as _admin_ip_allowed
from common.http_utils import get_source_ip as _get_source_ip
from common import log_utils

# v0.38.1 — botocore "Found credentials in environment variables" at INFO is noise on every cold start.
log_utils.quiet_botocore()


def lambda_handler(event, context):
    return {"isAuthorized": _admin_ip_allowed(_get_source_ip(event))}
