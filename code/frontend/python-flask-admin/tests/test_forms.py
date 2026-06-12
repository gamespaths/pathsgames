from werkzeug.datastructures import MultiDict

from app.forms import build_payload, coerce_field


def test_number_coercion():
    assert coerce_field({"key": "x", "type": "number"}, MultiDict({"x": "5"})) == 5
    assert coerce_field({"key": "x", "type": "number"}, MultiDict({"x": "5.5"})) == 5.5
    assert coerce_field({"key": "x", "type": "number"}, MultiDict({"x": ""})) is None
    assert coerce_field({"key": "x", "type": "number"}, MultiDict({"x": "nan?"})) is None


def test_text_coercion_blank_to_none():
    assert coerce_field({"key": "t", "type": "text"}, MultiDict({"t": "  hi "})) == "hi"
    assert coerce_field({"key": "t", "type": "text"}, MultiDict({"t": "   "})) is None


def test_checkbox_coercion():
    assert coerce_field({"key": "c", "type": "checkbox"}, MultiDict({"c": "1"})) is True
    assert coerce_field({"key": "c", "type": "checkbox"}, MultiDict({})) is False


def test_select_number_valuetype():
    field = {"key": "flagBack", "type": "select", "valueType": "number"}
    assert coerce_field(field, MultiDict({"flagBack": "1"})) == 1
    assert coerce_field(field, MultiDict({"flagBack": ""})) is None


def test_build_payload_difficulties():
    form = MultiDict({"idCard": "3", "expCost": "10", "life": "5"})
    payload = build_payload("difficulties", form)
    assert payload["idCard"] == 3
    assert payload["expCost"] == 10
    assert payload["life"] == 5
    # unspecified numeric fields default to None
    assert payload["maxWeight"] is None


def test_build_payload_location_checkbox():
    payload = build_payload("locations", MultiDict({"idCard": "1", "isSafe": "1"}))
    assert payload["isSafe"] is True
    payload2 = build_payload("locations", MultiDict({"idCard": "1"}))
    assert payload2["isSafe"] is False
