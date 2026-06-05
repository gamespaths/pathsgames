"""
Unit tests for echo/handler.py — no mock needed (no DB calls).
"""
import json
from echo.handler import lambda_handler


def test_echo_status_200():
    result = lambda_handler({}, {})
    assert result['statusCode'] == 200

def test_echo_body_has_status_up():
    result = lambda_handler({}, {})
    body = json.loads(result['body'])
    assert body['status'] == 'UP'

def test_echo_body_has_timestamp():
    result = lambda_handler({}, {})
    body = json.loads(result['body'])
    assert 'timestamp' in body
    assert 'T' in body['timestamp']

def test_echo_body_has_properties():
    result = lambda_handler({}, {})
    body = json.loads(result['body'])
    assert 'properties' in body
    assert body['properties']['name'] == 'Paths Games'

def test_echo_env_defaults_to_dev(monkeypatch):
    monkeypatch.delenv('ENV', raising=False)
    result = lambda_handler({}, {})
    body = json.loads(result['body'])
    assert body['properties']['env'] == 'dev'

def test_echo_env_reflects_environment_variable(monkeypatch):
    # ENV is injected by SAM from the `Environment` deploy parameter (e.g. test/prod).
    monkeypatch.setenv('ENV', 'test')
    result = lambda_handler({}, {})
    body = json.loads(result['body'])
    assert body['properties']['env'] == 'test'

def test_echo_content_type_header():
    result = lambda_handler({}, {})
    assert result['headers']['Content-Type'] == 'application/json'
