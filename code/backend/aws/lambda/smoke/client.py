"""v1.1.0 — JSON HTTP calls of the smoke test (urllib only): status, parsed body, timing in ms.
An HTTP error status is returned as a response; a timeout or network error raises HttpCallError."""
import json
import time
import urllib.error
import urllib.request
from collections import namedtuple

Response = namedtuple('Response', 'status body text ms')


class HttpCallError(Exception):
    """No HTTP status at all: timeout, DNS, TLS or connection failure."""

    def __init__(self, message, ms):
        super().__init__(message)
        self.ms = ms


def _parse(text):
    try:
        return json.loads(text) if text else None
    except ValueError:
        return None


def _elapsed_ms(start):
    return int((time.monotonic() - start) * 1000)


def request(method, url, body=None, headers=None, timeout=20):
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=dict(headers or {}))
    start = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status, raw = resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        status = exc.code
        try:
            raw = exc.read() or b''
        except OSError:
            raw = b''
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        reason = getattr(exc, 'reason', None) or exc
        raise HttpCallError(f'{method} {url} failed: {reason}', _elapsed_ms(start)) from exc
    text = raw.decode('utf-8', 'replace')
    return Response(status, _parse(text), text, _elapsed_ms(start))
