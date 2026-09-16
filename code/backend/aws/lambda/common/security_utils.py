"""common/security_utils.py — Step 41 (v0.37.7): the per-IP rate limiter and the CSRF token.

* ``csrf_token_for(access_token)`` is base64url(HMAC-SHA256(JWT_SECRET, "csrf:" + token)) with
  no padding — the very value the Java and Python backends compute — so nothing is stored.
* ``rate_limit(bucket, ip, limit)`` counts one attempt in a fixed wall-clock window on a
  DynamoDB item ``RATELIMIT#<bucket>#<ip>`` / ``WINDOW#<start>`` with a ``ttl`` so the table
  cleans up after itself. Lambdas share no memory, which is why the counter lives there.
  A limit of zero or less disables a bucket (the dev / Robot default).
"""
import base64
import hashlib
import hmac
import os
import time
from dataclasses import dataclass

from botocore.exceptions import ClientError

from common import db_utils
from common import jwt_utils

CSRF_HEADER = 'x-csrf-token'
_PREFIX = 'csrf:'


def _flag(name, default):
    return os.environ.get(name, default).strip().lower() not in ('false', '0', 'no', '')


def _int_env(name, default):
    try:
        return int(os.environ.get(name, str(default)) or default)
    except ValueError:
        return default


def csrf_enforced():
    return _flag('CSRF_ENFORCED', 'true')


def guest_per_ip():
    return _int_env('RATE_LIMIT_GUEST_PER_IP', 0)


def match_per_ip():
    return _int_env('RATE_LIMIT_MATCH_PER_IP', 0)


def window_seconds():
    return max(1, _int_env('RATE_LIMIT_WINDOW_SECONDS', 3600))


def _secret_bytes():
    secret = os.environ.get('CSRF_SECRET', '').strip() or jwt_utils.JWT_SECRET
    return secret.encode('utf-8') if isinstance(secret, str) else secret


def csrf_token_for(access_token):
    """The token a client must echo back in X-CSRF-TOKEN while it holds this access token."""
    if not access_token or not str(access_token).strip():
        return None
    digest = hmac.new(_secret_bytes(), (_PREFIX + str(access_token).strip()).encode('utf-8'),
                      hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b'=').decode('ascii')


def csrf_matches(access_token, presented):
    """Constant-time comparison of what the client sent against what this token deserves."""
    expected = csrf_token_for(access_token)
    if expected is None or not presented or not str(presented).strip():
        return False
    return hmac.compare_digest(expected, str(presented).strip())


def csrf_header(event):
    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}
    return headers.get(CSRF_HEADER)


@dataclass(frozen=True)
class Verdict:
    allowed: bool
    limit: int
    remaining: int
    retry_after_seconds: int


def rate_limit(bucket, ip, limit, now=None):
    """Count one attempt of ``ip`` in ``bucket``; refused attempts count too. A DynamoDB error
    never blocks a player: the counter is a guard, not a gate the game depends on."""
    if limit <= 0 or not ip or not str(ip).strip():
        return Verdict(True, 0, 2**31 - 1, 0)
    window = window_seconds()
    now = int(time.time()) if now is None else int(now)
    start = now - (now % window)
    retry_after = max(1, start + window - now)
    try:
        result = db_utils._get_table().update_item(
            Key={'PK': f'RATELIMIT#{bucket}#{str(ip).strip()}', 'SK': f'WINDOW#{start}'},
            UpdateExpression='ADD cnt :one SET #ttl = :ttl',
            ExpressionAttributeNames={'#ttl': 'ttl'},
            ExpressionAttributeValues={':one': 1, ':ttl': start + 2 * window},
            ReturnValues='UPDATED_NEW',
        )
        count = int(result.get('Attributes', {}).get('cnt', 1))
    except ClientError as exc:
        print(f'Rate limit counter unavailable for {bucket}/{ip}: {exc}')
        return Verdict(True, limit, limit, 0)
    return Verdict(count <= limit, limit, max(0, limit - count), retry_after)


def rate_limited(verdict, what, now_ms=None):
    """The 429 every limited route answers with, Retry-After included."""
    from common.response import dumps, HEADERS
    headers = dict(HEADERS)
    headers['Retry-After'] = str(verdict.retry_after_seconds)
    return {
        'statusCode': 429,
        'headers': headers,
        'body': dumps({
            'error': 'RATE_LIMITED',
            'message': f'{what}, retry in {verdict.retry_after_seconds} seconds',
            'retryAfterSeconds': verdict.retry_after_seconds,
            'timestamp': int(time.time() * 1000) if now_ms is None else now_ms,
        }),
    }
