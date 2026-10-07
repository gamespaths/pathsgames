"""Unit tests for app/adapters/turnstile/turnstile_adapter.py."""
from unittest.mock import patch, MagicMock

from app.adapters.turnstile.turnstile_adapter import TurnstileVerificationAdapter


def test_empty_secret_key_bypasses_validation():
    adapter = TurnstileVerificationAdapter("", bypass_token="0xROBOT", env="prod")
    assert adapter.verify("anything", None) is True
    assert adapter.verify(None, None) is True


def test_bypass_token_match_returns_true_in_non_prod():
    adapter = TurnstileVerificationAdapter(
        "real-secret", bypass_token="0xROBOT", env="test"
    )
    with patch("app.adapters.turnstile.turnstile_adapter.httpx.post") as mock_post:
        assert adapter.verify("0xROBOT", None) is True
        mock_post.assert_not_called()


def test_bypass_token_mismatch_falls_through_to_cloudflare_call():
    adapter = TurnstileVerificationAdapter(
        "real-secret", bypass_token="0xROBOT", env="test"
    )
    fake_response = MagicMock()
    fake_response.json.return_value = {"success": False}
    with patch(
        "app.adapters.turnstile.turnstile_adapter.httpx.post", return_value=fake_response
    ) as mock_post:
        assert adapter.verify("other-token", None) is False
        mock_post.assert_called_once()


def test_empty_bypass_token_never_short_circuits():
    adapter = TurnstileVerificationAdapter(
        "real-secret", bypass_token="", env="test"
    )
    assert adapter.verify(None, None) is False
    assert adapter.verify("", None) is False


def test_bypass_token_ignored_in_prod_environment():
    """Defense in depth: even when the bypass token is wired up, ENV=prod must
    force the Cloudflare siteverify call."""
    adapter = TurnstileVerificationAdapter(
        "real-secret", bypass_token="0xROBOT", env="prod"
    )
    fake_response = MagicMock()
    fake_response.json.return_value = {"success": False}
    with patch(
        "app.adapters.turnstile.turnstile_adapter.httpx.post", return_value=fake_response
    ) as mock_post:
        assert adapter.verify("0xROBOT", None) is False
        mock_post.assert_called_once()


def test_valid_token_passes_cloudflare_returns_true():
    adapter = TurnstileVerificationAdapter("real-secret", bypass_token="", env="test")
    fake_response = MagicMock()
    fake_response.json.return_value = {"success": True}
    with patch(
        "app.adapters.turnstile.turnstile_adapter.httpx.post", return_value=fake_response
    ):
        assert adapter.verify("valid-cf-token", "1.2.3.4") is True


def test_refusal_logs_the_cloudflare_error_codes(caplog):
    """The error-codes are the only way to tell a wrong secret from a reused or
    expired token, so they must reach the logs."""
    adapter = TurnstileVerificationAdapter("real-secret", bypass_token="", env="test")
    fake_response = MagicMock()
    fake_response.json.return_value = {
        "success": False,
        "error-codes": ["timeout-or-duplicate"],
    }
    with patch(
        "app.adapters.turnstile.turnstile_adapter.httpx.post", return_value=fake_response
    ):
        with caplog.at_level("WARNING"):
            assert adapter.verify("burnt-token", None) is False
    assert "timeout-or-duplicate" in caplog.text


def test_missing_token_is_logged(caplog):
    adapter = TurnstileVerificationAdapter("real-secret", bypass_token="", env="test")
    with caplog.at_level("WARNING"):
        assert adapter.verify(None, None) is False
    assert "no turnstileToken" in caplog.text


def test_transport_failure_is_logged_and_refuses(caplog):
    adapter = TurnstileVerificationAdapter("real-secret", bypass_token="", env="test")
    with patch(
        "app.adapters.turnstile.turnstile_adapter.httpx.post",
        side_effect=RuntimeError("boom"),
    ):
        with caplog.at_level("WARNING"):
            assert adapter.verify("some-token", None) is False
    assert "boom" in caplog.text
