"""v0.41.4 Step 41 H — the canonical JSON of the match export: keys by code point, no whitespace,
null keys dropped, minimal escapes (RFC 8785 for integers). Same output as Java ``CanonicalJson``."""
import hashlib
import json
from decimal import Decimal
from typing import Any


def drop_nulls(value: Any) -> Any:
    """Null-valued object keys removed at any depth; arrays keep their length."""
    if isinstance(value, dict):
        return {str(k): drop_nulls(v) for k, v in value.items() if v is not None}
    if isinstance(value, (list, tuple)):
        return [drop_nulls(v) for v in value]
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    return value


def write(value: Any) -> str:
    """The canonical text of a value built from dicts, lists, strings, numbers and booleans."""
    return json.dumps(drop_nulls(value), sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256(value: Any) -> str:
    """SHA-256 hex of the canonical text."""
    return sha256_hex(write(value))


def size(value: Any) -> int:
    """UTF-8 size of the canonical text."""
    return len(write(value).encode("utf-8"))


def parse(text):
    """JSON text to dicts/lists; None when it is not JSON."""
    if text is None:
        return None
    try:
        return json.loads(text)
    except (TypeError, ValueError):
        return None
