"""Steps 34 & 35 — tests for the FastAPI inventory controller."""
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.rest.match.inventory_controller import InventoryController
from app.core.models.match.event_models import EdgeStateOutcome, EventExecutionResult, StatChange
from app.core.models.match.match_models import ItemEffectPreview, ItemInstanceInfo
from app.core.ports.match.inventory_ports import InventoryError

INVENTORY = "/api/gameplay/m1/inventory"
USE = "/api/gameplay/m1/inventory/use-item"
DROP = "/api/gameplay/m1/inventory/drop-item"
RESOURCES = "/api/gameplay/m1/resources"
BODY = {"itemInstanceUuid": "row-1"}
AUTH = {"x-user": "user-uuid"}


@pytest.fixture()
def env():
    port = MagicMock()
    app = FastAPI()
    app.include_router(InventoryController(port).router)

    @app.middleware("http")
    async def inject_user(request, call_next):
        if request.headers.get("x-user"):
            request.state.user_uuid = request.headers["x-user"]
        return await call_next(request)

    return TestClient(app), port


def _item(effects=None):
    return ItemInstanceInfo(
        uuid="row-1", item_uuid="item-900", name="Potion", weight=3, amount=2,
        state="ACTIVE", id_card=77, card={"uuid": "card-77"}, is_consumabile=True,
        effects=effects or [])


def _inventory_view():
    return {"match_uuid": "m1", "character_uuid": "char-1", "items": [_item()],
            "weight": 6, "weight_max": 30}


def _usage_result():
    """The use-item payload: an execute-event result with no owning event."""
    return EventExecutionResult(
        match_uuid="m1", event_uuid=None, event_type=None, card={"uuid": "card-77"},
        executed_event_uuids=[], energy_spent=0, coin_spent=0, new_energy=17, new_coin=8,
        current_clock=5, turn_consumed=False, refresh_recommended=True,
        stat_changes=[StatChange("char-1", "life", 30, 33, 3)],
        edge_state=EdgeStateOutcome.none(), status="APPLIED",
    )


# ── happy paths ─────────────────────────────────────────────────────────────

def test_inventory_returns_items_weight_and_capacity(env):
    client, port = env
    port.list_inventory.return_value = _inventory_view()

    r = client.get(INVENTORY, params={"lang": "it"}, headers=AUTH)

    assert r.status_code == 200
    body = r.json()
    assert body["matchUuid"] == "m1"
    assert body["characterUuid"] == "char-1"
    assert body["weight"] == 6
    assert body["weightMax"] == 30
    assert body["items"][0]["uuid"] == "row-1"
    assert body["items"][0]["itemUuid"] == "item-900"
    assert body["items"][0]["idCard"] == 77
    assert body["items"][0]["card"] == {"uuid": "card-77"}
    assert body["items"][0]["isConsumabile"] is True
    # Step 35 — an item with no effect answers an empty array, never null.
    assert body["items"][0]["effects"] == []
    port.list_inventory.assert_called_once_with("m1", "user-uuid", "it")


def test_inventory_projects_the_effect_promise(env):
    client, port = env
    port.list_inventory.return_value = {
        "match_uuid": "m1", "character_uuid": "char-1",
        "items": [_item([ItemEffectPreview("life", 3), ItemEffectPreview("sad", -1)])],
        "weight": 6, "weight_max": 30}

    body = client.get(INVENTORY, headers=AUTH).json()

    assert body["items"][0]["effects"] == [
        {"statistic": "life", "value": 3},
        {"statistic": "sad", "value": -1},
    ]


def test_use_item_answers_the_execute_event_shape(env):
    client, port = env
    port.use_item.return_value = _usage_result()

    r = client.post(USE, json=BODY, headers=AUTH)

    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "APPLIED"
    assert body["eventUuid"] is None
    assert body["eventType"] is None
    assert body["card"] == {"uuid": "card-77"}
    assert body["statChanges"][0]["statistic"] == "life"
    assert body["pendingChoices"] == []


def test_use_item_forwards_the_language(env):
    client, port = env
    port.use_item.return_value = _usage_result()

    client.post(USE, params={"lang": "it"}, json=BODY, headers=AUTH)

    port.use_item.assert_called_once_with("m1", "user-uuid", "row-1", "it")


def test_drop_item_reports_what_left_the_inventory(env):
    client, port = env
    port.drop_item.return_value = {
        "match_uuid": "m1", "character_uuid": "char-1", "item_instance_uuid": "row-1",
        "item_uuid": "item-900", "amount_dropped": 3, "weight": 0, "weight_max": 30}

    r = client.post(DROP, json=BODY, headers=AUTH)

    assert r.status_code == 200
    body = r.json()
    assert body["itemInstanceUuid"] == "row-1"
    assert body["itemUuid"] == "item-900"
    assert body["amountDropped"] == 3
    assert body["weight"] == 0
    assert body["refreshRecommended"] is True


def test_resources_are_plain_numbers_with_no_card(env):
    client, port = env
    port.get_resources.return_value = {
        "match_uuid": "m1", "character_uuid": "char-1",
        "food": 4, "magic": 2, "coin": 9, "weight": 6, "weight_max": 30}

    r = client.get(RESOURCES, headers=AUTH)

    assert r.status_code == 200
    body = r.json()
    assert (body["food"], body["magic"], body["coin"]) == (4, 2, 9)
    assert body["weight"] == 6
    assert body["weightMax"] == 30
    assert "card" not in body


# ── request validation ──────────────────────────────────────────────────────

@pytest.mark.parametrize("method,url", [
    ("get", INVENTORY), ("post", USE), ("post", DROP), ("get", RESOURCES)])
def test_every_endpoint_refuses_an_anonymous_caller(env, method, url):
    client, port = env

    r = getattr(client, method)(url, json=BODY) if method == "post" \
        else getattr(client, method)(url)

    assert r.status_code == 401
    assert r.json()["error"] == "UNAUTHENTICATED"
    port.list_inventory.assert_not_called()
    port.use_item.assert_not_called()


@pytest.mark.parametrize("url", [USE, DROP])
@pytest.mark.parametrize("body", [{}, {"itemInstanceUuid": "  "}])
def test_use_and_drop_require_the_row_uuid(env, url, body):
    client, port = env

    r = client.post(url, json=body, headers=AUTH)

    assert r.status_code == 400
    assert r.json()["error"] == "MISSING_ITEM"
    port.use_item.assert_not_called()
    port.drop_item.assert_not_called()


# ── error mapping ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("code,expected", [
    (InventoryError.MATCH_NOT_FOUND, 404),
    (InventoryError.ITEM_NOT_FOUND, 404),
    (InventoryError.MATCH_NOT_RUNNING, 409),
    (InventoryError.SLEEPING, 409),
    (InventoryError.COMA, 409),
    (InventoryError.ITEM_NOT_CONSUMABLE, 409),
    (InventoryError.ITEM_CLASS_NOT_PERMITTED, 409),
    (InventoryError.ITEM_CLASS_PROHIBITED, 409),
])
def test_every_code_maps_to_a_status(env, code, expected):
    client, port = env
    port.use_item.side_effect = InventoryError(code, "boom")

    r = client.post(USE, json=BODY, headers=AUTH)

    assert r.status_code == expected
    assert r.json()["error"] == code
    assert r.json()["message"] == "boom"
    assert "timestamp" in r.json()


def test_read_endpoints_map_their_errors_too(env):
    client, port = env
    port.list_inventory.side_effect = InventoryError(InventoryError.MATCH_NOT_FOUND, "gone")
    port.get_resources.side_effect = InventoryError(InventoryError.MATCH_NOT_FOUND, "gone")
    port.drop_item.side_effect = InventoryError(InventoryError.ITEM_NOT_FOUND, "gone")

    assert client.get(INVENTORY, headers=AUTH).status_code == 404
    assert client.get(RESOURCES, headers=AUTH).status_code == 404
    assert client.post(DROP, json=BODY, headers=AUTH).status_code == 404


@pytest.mark.parametrize("url", [USE, DROP])
def test_a_malformed_body_is_a_missing_item_not_a_500(env, url):
    client, port = env

    r = client.post(url, content=b"not json",
                    headers={**AUTH, "content-type": "application/json"})

    assert r.status_code == 400
    assert r.json()["error"] == "MISSING_ITEM"
