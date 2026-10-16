"""v1.1.0 — V1 step 1: the smoke-test HTTP client (urllib mocked): JSON parsing, HTTP errors as statuses,
timeouts and network errors as HttpCallError."""
import io
import json
import urllib.error

import pytest

from smoke import client


class _Resp:
    def __init__(self, status, raw):
        self.status = status
        self._raw = raw

    def read(self):
        return self._raw

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _urlopen(monkeypatch, result):
    seen = {}

    def fake(req, timeout=None):
        seen.update(req=req, timeout=timeout)
        if isinstance(result, Exception):
            raise result
        return result

    monkeypatch.setattr(client.urllib.request, 'urlopen', fake)
    return seen


def test_json_body_sent_and_parsed(monkeypatch):
    seen = _urlopen(monkeypatch, _Resp(201, b'{"uuid": "m1"}'))
    resp = client.request('POST', 'https://x/api/matches', {'a': 1}, {'X-Test': 'y'}, timeout=7)
    assert (resp.status, resp.body, resp.text) == (201, {'uuid': 'm1'}, '{"uuid": "m1"}')
    assert resp.ms >= 0
    req = seen['req']
    assert req.get_method() == 'POST' and json.loads(req.data) == {'a': 1}
    assert req.get_header('X-test') == 'y' and seen['timeout'] == 7


def test_get_without_body_and_non_json_text(monkeypatch):
    seen = _urlopen(monkeypatch, _Resp(200, b'<title>Paths Games</title>'))
    resp = client.request('GET', 'https://site/')
    assert resp.body is None and 'Paths Games' in resp.text
    assert seen['req'].data is None


def test_empty_body_parses_to_none(monkeypatch):
    _urlopen(monkeypatch, _Resp(204, b''))
    assert client.request('GET', 'https://x/').body is None


def test_http_error_becomes_a_status(monkeypatch):
    err = urllib.error.HTTPError('https://x', 409, 'Conflict', {}, io.BytesIO(b'{"error": "NOT_A_NEIGHBOR"}'))
    _urlopen(monkeypatch, err)
    resp = client.request('POST', 'https://x', {})
    assert (resp.status, resp.body) == (409, {'error': 'NOT_A_NEIGHBOR'})


def test_http_error_with_unreadable_body(monkeypatch):
    err = urllib.error.HTTPError('https://x', 502, 'Bad Gateway', {}, None)
    monkeypatch.setattr(err, 'read', lambda: (_ for _ in ()).throw(OSError('closed')))
    _urlopen(monkeypatch, err)
    resp = client.request('GET', 'https://x')
    assert (resp.status, resp.body, resp.text) == (502, None, '')


@pytest.mark.parametrize('exc', [urllib.error.URLError('dns failure'), TimeoutError('timed out'),
                                 ConnectionResetError('reset')])
def test_network_errors_raise_http_call_error(monkeypatch, exc):
    _urlopen(monkeypatch, exc)
    with pytest.raises(client.HttpCallError) as info:
        client.request('GET', 'https://x/api/echo/status')
    assert 'GET https://x/api/echo/status failed' in str(info.value)
    assert info.value.ms >= 0
