"""Step 36 — the one place that reads, writes and compares the match registry.

Mirrors the Java RegistryService exactly: `render` and `parse` are inverses, and `evaluate` is
the single comparison behind every registry condition — events, edges, weather and choices.
"""
from typing import Any, Dict, Iterable, List, Optional

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


def _values(rows: Optional[List[Dict[str, Any]]]) -> List[str]:
    """The rendered members of a key's rows, skipping a row that holds no value at all."""
    out = []
    for row in rows or []:
        value = render_row(row)
        if value is not None:
            out.append(value)
    return out


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


def evaluate(operator: Optional[str], expected: Optional[str],
             actual: Optional[Iterable[str]]) -> bool:
    """The one registry comparison, over the SET of values a key holds.

    Step 36.1 generalised it; on a one-element set every reading below is the equality or
    comparison it always was, which is why no authored story had to change.

    * ``=``  — ∃: at least one member equals the value
    * ``!=`` — ∄: no member equals it (so an absent key satisfies it, as before)
    * ``>`` ``<`` — ∀: EVERY member compares that way, and an empty set never does.
      Vacuous truth would open a door, and the doctrine is that a typo closes one.

    A None expected value, an unparseable operand or an unknown operator is NOT met.
    """
    if expected is None:
        return False
    values = list(actual or [])
    op = OP_EQ if operator is None or not str(operator).strip() else str(operator).strip()
    if op == OP_EQ:
        return any(v == expected for v in values)
    if op == OP_NE:
        return all(v != expected for v in values)
    if op in (OP_GT, OP_LT):
        # ∀ over an empty set is vacuously true in logic and wrong here.
        if not values:
            return False
        e = _numeric(expected)
        if e is None:
            return False
        numbers = [_numeric(v) for v in values]
        if any(n is None for n in numbers):
            return False
        return all(n > e for n in numbers) if op == OP_GT else all(n < e for n in numbers)
    return False


def ordered(values: Optional[Iterable[str]]) -> List[str]:
    """Members ordered for display: numbers numerically first, then the rest alphabetically.
    Computed here so both payloads and all three backends agree."""
    out = list(values or [])
    out.sort(key=lambda v: (0, _numeric(v), "") if _numeric(v) is not None else (1, 0, v or ""))
    return out


def is_multi(definition: Optional[Dict[str, Any]]) -> bool:
    """The story's own declaration, which decides how a write behaves for a key with no row."""
    return bool(definition) and bool(definition.get("multi_value"))


class RegistryService:
    """Every read, write and comparison of gaming_state_registry."""

    def __init__(self, store, story_read_port=None, content_query_port=None):
        # story_read_port/content_query_port are None in the values-only wiring: entries then
        # carry no category, card or visibility.
        self.store = store
        self.story_read_port = story_read_port
        self.content_query_port = content_query_port

    # ── reads ────────────────────────────────────────────────────────────────

    def load_all(self, id_match: int) -> Dict[str, List[str]]:
        """Every key of the match, each with the SET of values it holds. A key with no value
        at all maps to an empty list — never to None, so a caller never has to guard."""
        out: Dict[str, List[str]] = {}
        for row in self.store.find_by_match(id_match) or []:
            key = row.get("key")
            if key:
                value = render_row(row)
                bucket = out.setdefault(key, [])
                if value is not None:
                    bucket.append(value)
        return out

    def find(self, id_match: int, key: str) -> List[str]:
        """The values of one key. Empty when the key is absent, or present with an empty set."""
        return _values(self.store.find_by_match_and_key(id_match, key))

    def has(self, id_match: int, key: str) -> bool:
        return bool(self.store.find_by_match_and_key(id_match, key))

    def list_entries(self, id_match: int, id_story: Optional[int] = None,
                     include_hidden: bool = True, lang: str = "en") -> List[Dict[str, Any]]:
        """The rows joined with their list_keys definition. A row whose key the story no longer
        declares is kept but reads as hidden: it is state the engine wrote, and dropping it
        silently would hide a bug rather than a key."""
        defs = self._key_definitions(id_story)

        # Step 36.1 — one entry per KEY, holding its whole set. The keys are the union of what
        # the story declares and what the match holds: a key whose members were all removed,
        # or one added to the story after this match began, still has an entry with an empty
        # set, and a row whose key the story no longer declares is kept but reads as hidden.
        by_key: Dict[str, List[Dict[str, Any]]] = {name: [] for name in defs}
        for row in self.store.find_by_match(id_match) or []:
            if row.get("key"):
                by_key.setdefault(row["key"], []).append(row)

        out: List[Dict[str, Any]] = []
        for name, rows in by_key.items():
            entry = {
                "uuid": rows[-1].get("uuid") if rows else None,
                "key": name,
                "values": ordered(_values(rows)),
                "multi_value": any(row.get("multi_value") for row in rows),
                "id_character": rows[-1].get("id_character") if rows else None,
                "category": None,
                "visible": False,
                "priority": None,
                "id_card": None,
                "card": None,
            }
            definition = defs.get(name)
            if definition is not None:
                entry["category"] = definition.get("key_group")
                entry["priority"] = definition.get("priority")
                entry["visible"] = (definition.get("visibility") or "").strip().upper() \
                    == VISIBILITY_PUBLIC
                entry["id_card"] = definition.get("id_card")
                entry["card"] = self._card(id_story, definition.get("id_card"), lang)
                entry["multi_value"] = is_multi(definition)
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

    def upsert(self, id_match: int, id_story: Optional[int], key: Optional[str],
               value: Optional[str], id_character: Optional[int] = None,
               id_event: Optional[int] = None, id_choice: Optional[int] = None,
               clock: Optional[int] = None) -> List[str]:
        """Write one key. A blank key is authored noise and is skipped, not an error.

        Whether the value REPLACES the key or JOINS it is decided by the rows already there —
        their multi_value mirror — and only by the story's declaration when the key has no row
        yet. That is what lets an author flip the flag without disturbing a match already in
        progress: a running match keeps the behaviour it was born with.
        """
        if no_condition(key):
            return []
        rows = self.store.find_by_match_and_key(id_match, key) or []
        # The rows decide; the story is consulted only for a key this match has never written.
        multi = self._declared_multi(id_story, key) if not rows \
            else bool(rows[0].get("multi_value"))
        parsed = parse(value)
        rendered = render(parsed["string_value"], parsed["int_value"])

        if not multi:
            previous = render_row(rows[0]) if rows else None
            self.store.upsert(id_match, key, parsed["string_value"], parsed["int_value"],
                              id_character, id_event, id_choice, clock)
            self._log(id_match, id_character, id_event, id_choice, clock,
                      f"{key} {previous} -> {value}")
            return [] if rendered is None else [rendered]

        # A set: adding a member it already holds changes nothing, so it says nothing either.
        current = _values(rows)
        if rendered is None or rendered in current:
            return ordered(current)
        self.store.insert_value(id_match, key, parsed["string_value"], parsed["int_value"],
                                id_character, id_event, id_choice, clock)
        self._log(id_match, id_character, id_event, id_choice, clock, f"{key} +{rendered}")
        return ordered(current + [rendered])

    def remove(self, id_match: int, key: Optional[str], value: Optional[str],
               id_character: Optional[int] = None, id_event: Optional[int] = None,
               id_choice: Optional[int] = None, clock: Optional[int] = None) -> List[str]:
        """Take one value away. On a single key this is the compare-and-clear it has always
        been; on a multi key it removes that one member and leaves the rest. Removing the last
        member leaves the key with an empty set — the row goes, the key does not."""
        if no_condition(key):
            return []
        rows = self.store.find_by_match_and_key(id_match, key) or []
        current = _values(rows)
        if not rows:
            return current
        parsed = parse(value)
        rendered = render(parsed["string_value"], parsed["int_value"])

        if not rows[0].get("multi_value"):
            if rendered is None or rendered != render_row(rows[0]):
                return current  # a value the story has since moved on from: leave it alone
            self.store.upsert(id_match, key, None, None,
                              id_character, id_event, id_choice, clock)
            self._log(id_match, id_character, id_event, id_choice, clock,
                      f"{key} {rendered} -> None")
            return []

        if rendered is None or rendered not in current:
            return ordered(current)
        self.store.delete_value(id_match, key, parsed["string_value"], parsed["int_value"])
        self._log(id_match, id_character, id_event, id_choice, clock, f"{key} -{rendered}")
        after = list(current)
        after.remove(rendered)
        return ordered(after)

    def _log(self, id_match: int, id_character: Optional[int], id_event: Optional[int],
             id_choice: Optional[int], clock: Optional[int], detail: str) -> None:
        """One writer, one audit row: a registry change can neither be missed nor doubled."""
        self.store.log_change(id_match, id_character, id_event, id_choice, clock,
                              f"{MSG_REGISTRY_CHANGE} {detail}")

    def _declared_multi(self, id_story: Optional[int], key: str) -> bool:
        """What the story says about a key the match has never written."""
        return is_multi(self._key_definitions(id_story).get(key))

    def seed(self, id_match: int, keys: Optional[List[Dict[str, Any]]]) -> None:
        """Match creation: one row per story key, holding the default from list_keys.value.
        A MULTI key with no default seeds no row at all — its set starts empty, and an empty
        set is the absence of rows, not a row holding nothing."""
        rows = []
        for k in keys or []:
            multi = bool(k.get("multi_value"))
            parsed = parse(k.get("key_value") if "key_value" in k else k.get("value"))
            if multi and render(parsed["string_value"], parsed["int_value"]) is None:
                continue
            rows.append({"key": k.get("key_name") or k.get("name") or "",
                         "multi_value": 1 if multi else 0, **parsed})
        self.store.insert_all(id_match, rows)

    def delete_by_match(self, match_ids: List[int]) -> None:
        self.store.delete_by_match_ids(match_ids)
