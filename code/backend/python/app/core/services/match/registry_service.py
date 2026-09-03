"""Step 36 — the one place that reads, writes and compares the match registry.

Mirrors the Java RegistryService exactly: `render` and `parse` are inverses, and `evaluate` is
the single comparison behind every registry condition — events, edges, weather and choices.
"""
from typing import Any, Dict, List, Optional

OP_EQ = "="
OP_NE = "!="
OP_GT = ">"
OP_LT = "<"

#: Prefix of the log_events row every write leaves behind; read by the match-logs service.
MSG_REGISTRY_CHANGE = "REGISTRY_CHANGE"

#: A key hidden from the player: anything its definition does not mark PUBLIC.
VISIBILITY_PUBLIC = "PUBLIC"


def render(string_value: Optional[str], int_value: Optional[int]) -> Optional[str]:
    """A row as one comparable string: the string wins, else the int, else None."""
    if string_value is not None:
        return string_value
    return None if int_value is None else str(int_value)


def render_row(row: Optional[Dict[str, Any]]) -> Optional[str]:
    if not row:
        return None
    return render(row.get("string_value"), row.get("int_value"))


def parse(value: Optional[str]) -> Dict[str, Any]:
    """A value as the pair of columns: numeric to int_value, anything else to string_value,
    never both. Trimmed in both branches, so what an author types is what a condition reads."""
    if value is None:
        return {"string_value": None, "int_value": None}
    trimmed = str(value).strip()
    try:
        return {"string_value": None, "int_value": int(trimmed)}
    except ValueError:
        return {"string_value": trimmed, "int_value": None}


def _numeric(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except ValueError:
        return None


def no_condition(key: Optional[str]) -> bool:
    """True when the condition is absent altogether — a blank key means "no condition"."""
    return key is None or not str(key).strip()


def evaluate(operator: Optional[str], expected: Optional[str], actual: Optional[str]) -> bool:
    """The one registry comparison.

    ``=`` and ``!=`` are textual, ``>`` and ``<`` need both sides numeric. A None expected
    value, an unparseable operand or an unknown operator is NOT met: a typo must lock a door,
    never open one. An absent key satisfies only ``!=`` — "never set" really is different.
    """
    if expected is None:
        return False
    op = OP_EQ if operator is None or not str(operator).strip() else str(operator).strip()
    if op == OP_EQ:
        return expected == actual
    if op == OP_NE:
        return expected != actual
    if op in (OP_GT, OP_LT):
        a, e = _numeric(actual), _numeric(expected)
        if a is None or e is None:
            return False
        return a > e if op == OP_GT else a < e
    return False


class RegistryService:
    """Every read, write and comparison of gaming_state_registry."""

    def __init__(self, store, story_read_port=None, content_query_port=None):
        # story_read_port/content_query_port are None in the values-only wiring: entries then
        # carry no category, card or visibility.
        self.store = store
        self.story_read_port = story_read_port
        self.content_query_port = content_query_port

    # ── reads ────────────────────────────────────────────────────────────────

    def load_all(self, id_match: int) -> Dict[str, Optional[str]]:
        """Every key of the match as one dict. A row with no value maps its key to None."""
        out: Dict[str, Optional[str]] = {}
        for row in self.store.find_by_match(id_match) or []:
            key = row.get("key")
            if key:
                out[key] = render_row(row)
        return out

    def find(self, id_match: int, key: str) -> Optional[str]:
        """One key. None means absent, or present with no value — see `has`."""
        return render_row(self.store.find_by_match_and_key(id_match, key))

    def has(self, id_match: int, key: str) -> bool:
        return self.store.find_by_match_and_key(id_match, key) is not None

    def list_entries(self, id_match: int, id_story: Optional[int] = None,
                     include_hidden: bool = True, lang: str = "en") -> List[Dict[str, Any]]:
        """The rows joined with their list_keys definition. A row whose key the story no longer
        declares is kept but reads as hidden: it is state the engine wrote, and dropping it
        silently would hide a bug rather than a key."""
        defs = self._key_definitions(id_story)
        out: List[Dict[str, Any]] = []
        for row in self.store.find_by_match(id_match) or []:
            entry = {
                "uuid": row.get("uuid"),
                "key": row.get("key"),
                "string_value": row.get("string_value"),
                "int_value": row.get("int_value"),
                "id_character": row.get("id_character"),
                "category": None,
                "visible": False,
                "priority": None,
                "id_card": None,
                "card": None,
            }
            definition = defs.get(row.get("key")) if row.get("key") else None
            if definition is not None:
                entry["category"] = definition.get("key_group")
                entry["priority"] = definition.get("priority")
                entry["visible"] = (definition.get("visibility") or "").strip().upper() \
                    == VISIBILITY_PUBLIC
                entry["id_card"] = definition.get("id_card")
                entry["card"] = self._card(id_story, definition.get("id_card"), lang)
            if entry["visible"] or include_hidden:
                out.append(entry)
        out.sort(key=lambda e: (e["category"] or "", e["priority"] or 0, e["key"] or ""))
        return out

    def list_groups(self, id_match: int, id_story: Optional[int] = None,
                    include_hidden: bool = False, lang: str = "en") -> List[Dict[str, Any]]:
        """The same entries bucketed by category, keeping the order above inside each bucket."""
        groups: List[Dict[str, Any]] = []
        by_category: Dict[Any, Dict[str, Any]] = {}
        for entry in self.list_entries(id_match, id_story, include_hidden, lang):
            category = entry["category"]
            if category not in by_category:
                group = {"category": category, "entries": []}
                by_category[category] = group
                groups.append(group)
            by_category[category]["entries"].append(entry)
        return groups

    def _key_definitions(self, id_story: Optional[int]) -> Dict[str, Dict[str, Any]]:
        if self.story_read_port is None or id_story is None:
            return {}
        keys = self.story_read_port.find_keys_by_story_id(id_story) or []
        out = {}
        for k in keys:
            name = k.get("key_name") or k.get("name")
            if name:
                out[name] = k
        return out

    def _card(self, id_story: Optional[int], id_card: Optional[int], lang: str):
        if self.content_query_port is None or id_story is None or id_card is None:
            return None
        return self.content_query_port.get_card_by_story_id_and_card_id(id_story, id_card, lang)

    # ── writes ───────────────────────────────────────────────────────────────

    def upsert(self, id_match: int, key: Optional[str], value: Optional[str],
               id_character: Optional[int] = None, id_event: Optional[int] = None,
               id_choice: Optional[int] = None, clock: Optional[int] = None) -> None:
        """Set one key. A blank key is authored noise and is skipped, not an error."""
        if no_condition(key):
            return
        previous = self.find(id_match, key)
        parsed = parse(value)
        self.store.upsert(id_match, key, parsed["string_value"], parsed["int_value"],
                          id_character, id_event, id_choice, clock)
        # One writer, one audit row: a registry change can neither be missed nor doubled.
        self.store.log_change(id_match, id_character, id_event, id_choice, clock,
                              f"{MSG_REGISTRY_CHANGE} {key} {previous} -> {value}")

    def seed(self, id_match: int, keys: Optional[List[Dict[str, Any]]]) -> None:
        """Match creation: one row per story key, holding the default from list_keys.value."""
        rows = []
        for k in keys or []:
            parsed = parse(k.get("key_value") if "key_value" in k else k.get("value"))
            rows.append({"key": k.get("key_name") or k.get("name") or "", **parsed})
        self.store.insert_all(id_match, rows)

    def delete_by_match(self, match_ids: List[int]) -> None:
        self.store.delete_by_match_ids(match_ids)
