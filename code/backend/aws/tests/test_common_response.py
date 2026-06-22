"""Tests for common/response.py — DecimalEncoder, dumps, HEADERS, ok, err."""
import json
import decimal

from common.response import DecimalEncoder, dumps, ok, err, HEADERS


def test_headers_constant():
    assert HEADERS == {"Content-Type": "application/json"}


def test_decimal_encoder_int():
    result = json.loads(dumps({"n": decimal.Decimal("42")}))
    assert result["n"] == 42
    assert isinstance(result["n"], int)


def test_decimal_encoder_float():
    result = json.loads(dumps({"n": decimal.Decimal("3.14")}))
    assert abs(result["n"] - 3.14) < 0.001


def test_ok_default_status():
    resp = ok({"key": "val"})
    assert resp["statusCode"] == 200
    assert resp["headers"] == HEADERS
    body = json.loads(resp["body"])
    assert body["key"] == "val"


def test_ok_custom_status():
    resp = ok({"x": 1}, status=201)
    assert resp["statusCode"] == 201


def test_ok_with_cookies():
    resp = ok({}, cookies=["session=abc"])
    assert resp["cookies"] == ["session=abc"]


def test_ok_without_cookies_omits_key():
    resp = ok({})
    assert "cookies" not in resp


def test_err_structure():
    resp = err(404, "NOT_FOUND", "Resource missing")
    assert resp["statusCode"] == 404
    assert resp["headers"] == HEADERS
    body = json.loads(resp["body"])
    assert body["error"] == "NOT_FOUND"
    assert body["message"] == "Resource missing"


def test_err_403():
    resp = err(403, "FORBIDDEN", "No access")
    assert resp["statusCode"] == 403
