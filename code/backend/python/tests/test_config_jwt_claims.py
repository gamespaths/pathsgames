"""v1.2.0 — iss and aud of the tokens: an empty .env key keeps the code default."""
from app.config import Settings


def test_empty_audience_and_issuer_fall_back_to_the_defaults(monkeypatch):
    monkeypatch.setenv("JWT_AUDIENCE", "")
    monkeypatch.setenv("JWT_ISSUER", "  ")
    settings = Settings(env="development")
    assert settings.jwt_audience_effective == "paths-games"
    assert settings.jwt_issuer_effective == "pathsgames-development-python"


def test_given_audience_and_issuer_are_used(monkeypatch):
    monkeypatch.setenv("JWT_AUDIENCE", " other-aud ")
    monkeypatch.setenv("JWT_ISSUER", "my-issuer")
    settings = Settings()
    assert settings.jwt_audience_effective == "other-aud"
    assert settings.jwt_issuer_effective == "my-issuer"
