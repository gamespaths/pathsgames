"""v1.11.0 a ?limit= that is not an integer reads as absent (the default page), like Java and AWS."""
from unittest.mock import MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.rest.auth.user_admin_controller import UserAdminController
from app.adapters.rest.query_limits import parse_limit


def test_parse_limit():
    assert parse_limit("25") == 25 and parse_limit(" 7 ") == 7 and parse_limit("-3") == -3
    for raw in ("abc", "1.5", " ", "", None):
        assert parse_limit(raw) is None


def test_a_text_limit_is_the_default_page_not_a_422():
    users = MagicMock()
    users.list.return_value.to_body.return_value = {"items": [], "nextCursor": None, "limit": 50}
    app = FastAPI()
    app.include_router(UserAdminController(MagicMock(), users).router)
    client = TestClient(app)
    assert client.get("/api/admin/users?limit=abc").status_code == 200
    assert users.list.call_args.args[-1] is None
    assert client.get("/api/admin/users?limit=20").status_code == 200
    assert users.list.call_args.args[-1] == 20
