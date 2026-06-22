"""common/response.py — Shared HTTP response helpers for all Lambda handlers."""

import json
import decimal

HEADERS = {"Content-Type": "application/json"}


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
