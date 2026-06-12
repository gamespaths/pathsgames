"""Translate submitted HTML form data into typed JSON payloads for the API."""
from .entities import STORIES_ENTITIES_FIELDS


def _to_number(raw):
    raw = str(raw).strip()
    if raw == "":
        return None
    try:
        if "." in raw or "e" in raw.lower():
            return float(raw)
        return int(raw)
    except ValueError:
        return None


def coerce_field(field, form):
    """Coerce one field's submitted value to its declared type."""
    ftype = field.get("type", "number")
    key = field["key"]
    if ftype == "checkbox":
        return form.get(key) is not None
    raw = form.get(key)
    if ftype in ("text", "textarea"):
        raw = (raw or "").strip()
        return raw if raw != "" else None
    if ftype == "select":
        raw = (raw or "").strip()
        if raw == "":
            return None
        if field.get("valueType") == "number":
            return _to_number(raw)
        return raw
    # number (default)
    return _to_number(raw)


def build_payload(entity_type, form):
    """Build the create/update JSON body for an entity from form data."""
    fields = STORIES_ENTITIES_FIELDS.get(entity_type, [])
    return {f["key"]: coerce_field(f, form) for f in fields}
