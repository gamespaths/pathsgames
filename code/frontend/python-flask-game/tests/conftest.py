import pytest

from app import create_app
from app.config import Config


class TestConfig(Config):
    TESTING = True
    SECRET_KEY = "test-secret"
    BASE_URL = "mock"
    WTF_CSRF_ENABLED = False


@pytest.fixture
def app():
    return create_app(TestConfig)


@pytest.fixture
def client(app):
    return app.test_client()
