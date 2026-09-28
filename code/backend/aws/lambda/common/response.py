"""common/response.py — Shared HTTP response helpers for all Lambda handlers."""

import json
import decimal

# v0.41.0 — Step 41 C: the Java/Python API security headers on every Lambda answer.
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Strict-Transport-Security": "max-age=31536000",
}
HEADERS = {"Content-Type": "application/json", **SECURITY_HEADERS}
_NO_STORE_PREFIXES = ("/api/auth/", "/api/admin/")


class DecimalEncoder(json.JSONEncoder):
    """Serialise DynamoDB Decimal values as int or float."""
    def default(self, obj):
        if isinstance(obj, decimal.Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)


def dumps(obj):
    return json.dumps(obj, cls=DecimalEncoder)


def ok(body, status=200, cookies=None):
    resp = {"statusCode": status, "headers": HEADERS, "body": dumps(body)}
    if cookies:
        resp["cookies"] = cookies
    return resp


def err(status, code, message):
    return {"statusCode": status, "headers": HEADERS,
            "body": dumps({"error": code, "message": message})}


def is_no_store_path(path):
    """Public story reads stay cacheable; tokens and admin data never are."""
    return bool(path) and (path in ("/api/auth", "/api/admin") or path.startswith(_NO_STORE_PREFIXES))


def finalize(resp, path):
    """v0.41.0 — last step of every handler: security headers (plus no-store on auth/admin), copied."""
    if not isinstance(resp, dict) or "statusCode" not in resp:
        return resp
    headers = {**SECURITY_HEADERS, **(resp.get("headers") or {})}
    if is_no_store_path(path):
        headers["Cache-Control"] = "no-store"
    resp["headers"] = headers
    return resp
