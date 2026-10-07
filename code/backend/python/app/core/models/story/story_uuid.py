"""Story uuid accepted by the import: 8-4-4-4-12 hex, stored lowercase (v0.41.5).
Input is trimmed and lowercased first; no RFC 4122 version check (demo stories would fail it)."""

import re
from typing import Any, Optional

# Same shape as $defs.uuid in match-export-v1.schema.json.
_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def normalize_story_uuid(raw: Any) -> Optional[str]:
    """Trimmed and lowercased value, or None when absent or blank (the import mints one)."""
    if raw is None:
        return None
    value = str(raw).strip()
    return value.lower() if value else None


def is_valid_story_uuid(value: Optional[str]) -> bool:
    """True when the value is a normalized story uuid."""
    return value is not None and _PATTERN.fullmatch(value) is not None
