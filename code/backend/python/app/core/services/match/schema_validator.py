"""v0.41.4 — the JSON Schema keywords match_export_v1.schema.json uses (type, required, properties,
additionalProperties, items, enum, const, pattern, minimum, minItems, uniqueItems, $ref). Mirrors Java."""
import json
import re
from pathlib import Path
from typing import Any, Dict, List

from app.core.services.match import canonical_json

SCHEMA_FILE = Path(__file__).with_name("match_export_v1.schema.json")
MAX_ERRORS = 20
_DEFS = "#/$defs/"


def is_integer(value) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def has_type(type_: str, value) -> bool:
    if type_ == "object":
        return isinstance(value, dict)
    if type_ == "array":
        return isinstance(value, list)
    if type_ == "string":
        return isinstance(value, str)
    if type_ == "boolean":
        return isinstance(value, bool)
    if type_ == "integer":
        return is_integer(value)
    if type_ == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    return True


def _same(expected, value) -> bool:
    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        return is_integer(value) and expected == value
    return expected is not None and expected == value


class SchemaValidator:

    def __init__(self, schema: Dict[str, Any]):
        self.root = schema

    @classmethod
    def match_export_v1(cls) -> "SchemaValidator":
        return cls(json.loads(SCHEMA_FILE.read_text(encoding="utf-8")))

    def validate(self, value) -> List[str]:
        """At most twenty "path: problem" lines; empty when the value is valid."""
        errors: List[str] = []
        self._check(self.root, value, "$", errors)
        return errors

    def _check(self, schema, value, path, errors) -> None:
        if len(errors) >= MAX_ERRORS or schema is None:
            return
        ref = schema.get("$ref")
        if isinstance(ref, str) and ref.startswith(_DEFS):
            self._check(self.root["$defs"].get(ref[len(_DEFS):]), value, path, errors)
            return
        if "const" in schema and not _same(schema["const"], value):
            errors.append(f"{path}: must be {schema['const']}")
            return
        options = schema.get("enum")
        if isinstance(options, list) and not any(_same(o, value) for o in options):
            errors.append(f"{path}: must be one of {options}")
            return
        type_ = schema.get("type")
        if isinstance(type_, str) and not has_type(type_, value):
            errors.append(f"{path}: must be {type_}")
            return
        if isinstance(value, dict):
            self._check_object(schema, value, path, errors)
        elif isinstance(value, list):
            self._check_array(schema, value, path, errors)
        elif isinstance(value, str) and isinstance(schema.get("pattern"), str) \
                and not re.search(schema["pattern"], value):
            errors.append(f"{path}: does not match {schema['pattern']}")
        elif is_integer(value) and is_integer(schema.get("minimum")) and value < schema["minimum"]:
            errors.append(f"{path}: must be >= {schema['minimum']}")

    def _check_object(self, schema, value, path, errors) -> None:
        for key in schema.get("required") or []:
            if value.get(key) is None:
                errors.append(f"{path}: missing {key}")
        properties = schema.get("properties") or {}
        for key, item in value.items():
            if item is None:
                continue
            sub = properties.get(key)
            if isinstance(sub, dict):
                self._check(sub, item, f"{path}.{key}", errors)
            elif schema.get("additionalProperties") is False:
                errors.append(f"{path}: unknown property {key}")

    def _check_array(self, schema, value, path, errors) -> None:
        minimum = schema.get("minItems")
        if is_integer(minimum) and len(value) < minimum:
            errors.append(f"{path}: needs at least {minimum} items")
        if schema.get("uniqueItems") is True:
            texts = [canonical_json.write(v) for v in value]
            if len(set(texts)) != len(texts):
                errors.append(f"{path}: items are not unique")
        items = schema.get("items")
        if isinstance(items, dict):
            for i, item in enumerate(value):
                self._check(items, item, f"{path}[{i}]", errors)
