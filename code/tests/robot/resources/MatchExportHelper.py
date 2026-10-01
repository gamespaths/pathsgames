"""MatchExportHelper — v0.41.4 Step 41 H: the match export v1 seen from Robot. The same canonical JSON,
checksum and story fingerprint as the three backends; uuid rewrites for copies; schema validation.

Every function is a keyword (``Rewrite Export Uuids``, ``Validate Match Export`` …). Documents are
plain dicts; each rewrite answers a new document with its fingerprint and checksum recomputed.
"""
import copy
import hashlib
import json
import uuid as uuid_lib
from pathlib import Path

ROBOT_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_FILE = (ROBOT_ROOT.parents[1] / "backend" / "java" / "adapter-rest" / "src" / "main"
               / "resources" / "openapi" / "match-export-v1.schema.json")
if not SCHEMA_FILE.exists():  # the robot folder copied elsewhere: the schema next to the suites
    SCHEMA_FILE = ROBOT_ROOT / "tests" / "41_alpha_prep" / "fixtures" / "match-export-v1.schema.json"
_DROPPED = frozenset(("uuid", "tsInsert", "tsUpdate", "idStory"))


def _drop_nulls(value):
    if isinstance(value, dict):
        return {str(k): _drop_nulls(v) for k, v in value.items() if v is not None}
    if isinstance(value, list):
        return [_drop_nulls(v) for v in value]
    return value


def canonical_json(value):
    """Keys by code point, no whitespace, null keys dropped (RFC 8785 for this value domain)."""
    return json.dumps(_drop_nulls(value), sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_of(value):
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def checksum_of(doc):
    """SHA-256 of the canonical document without its checksum key."""
    return sha256_of({k: v for k, v in doc.items() if k != "checksum"})


def _rank(value):
    if value is None:
        return (0, 0)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return (1, value)
    if isinstance(value, bool):
        return (2, "true" if value else "false")
    return (2, str(value))


def _project(value):
    if isinstance(value, dict):
        return {k: _project(v) for k, v in value.items() if v is not None and k not in _DROPPED}
    if isinstance(value, list):
        out = [_project(v) for v in value]
        if all(isinstance(v, dict) for v in out):
            out.sort(key=lambda r: tuple(_rank(r.get(k)) for k in ("id", "idText", "lang")) + (canonical_json(r),))
        return out
    return value


def fingerprint_of(story_data):
    """The story fingerprint: projection without uuids/stamps/idStory/root id, arrays sorted by id."""
    root = _project(story_data or {})
    root.pop("id", None)
    return sha256_of(root)


def with_checksum(doc):
    """The document with its story fingerprint and checksum recomputed."""
    out = copy.deepcopy(doc)
    out["story"]["fingerprint"] = fingerprint_of(out["story"].get("data"))
    out["checksum"] = checksum_of(out)
    return out


def validate_match_export(doc):
    """Fails with the schema errors when the document is not a valid match export v1."""
    import jsonschema
    schema = json.loads(SCHEMA_FILE.read_text(encoding="utf-8"))
    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(doc), key=lambda e: list(e.path))
    if errors:
        raise AssertionError("; ".join(f"{list(e.path)}: {e.message}" for e in errors[:10]))
    if checksum_of(doc) != doc.get("checksum"):
        raise AssertionError("the checksum does not match the canonical document")
    if fingerprint_of(doc["story"].get("data")) != doc["story"].get("fingerprint"):
        raise AssertionError("the story fingerprint does not match the bundled story")
    return True


def new_uuid():
    return str(uuid_lib.uuid4())


def _replace_everywhere(doc, mapping):
    text = json.dumps(doc, ensure_ascii=False)
    for old, new in mapping.items():
        text = text.replace(f'"{old}"', f'"{new}"')
    return json.loads(text)


def rewrite_export_uuids(doc, match_uuid=None, story_uuid=None, user_map=None):
    """A copy: a new match uuid, new character uuids everywhere, optionally a new story uuid and users
    renamed by uuid (``user_map`` old → new); fingerprint and checksum recomputed."""
    mapping = {doc["match"]["uuid"]: match_uuid or new_uuid()}
    for c in doc.get("characters") or []:
        mapping[c["uuid"]] = new_uuid()
    for old, new in (user_map or {}).items():
        mapping[old] = new
    out = _replace_everywhere(doc, mapping)
    if story_uuid:
        out["story"]["uuid"] = story_uuid
        out["story"]["data"]["uuid"] = story_uuid
    return with_checksum(out)


def with_user_email(doc, user_uuid, email):
    """The file with the e-mail of one user set (match by e-mail, decisions 54/56); checksum recomputed."""
    out = copy.deepcopy(doc)
    for u in out.get("users") or []:
        if u.get("uuid") == user_uuid:
            u["emailAddress"] = email
    return with_checksum(out)


def creator_uuid(doc):
    return doc["match"]["creatorUserUuid"]


def edit_story_text(doc):
    """The bundled story with one text changed (the first one), fingerprint and checksum recomputed."""
    out = copy.deepcopy(doc)
    texts = out["story"]["data"].get("texts") or []
    if not texts:
        raise AssertionError("the bundled story has no texts to edit")
    texts[0]["shortText"] = (texts[0].get("shortText") or "") + " (edited)"
    return with_checksum(out)


def tamper_checksum(doc):
    out = copy.deepcopy(doc)
    out["checksum"] = ("0" if out["checksum"][0] != "0" else "1") + out["checksum"][1:]
    return out


def with_format_version(doc, version):
    out = copy.deepcopy(doc)
    out["formatVersion"] = int(version)
    return out


def import_request(doc, dry_run=False, replace=False, story_mode="AUTO", start_paused=False):
    return {"export": doc, "dryRun": bool(dry_run), "replace": bool(replace), "storyMode": story_mode,
            "startPaused": bool(start_paused)}


def codes_of(rows):
    return [r.get("code") for r in rows or []]


def load_fixture(path, story_file, creator_uuid_value, guest_uuid_value=None):
    """The hand-built cross-family fixture with the story bundled from ``story_file``, fresh match and
    character uuids, the creator mapped to ``creator_uuid_value`` (an existing robot guest)."""
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    story = json.loads(Path(story_file).read_text(encoding="utf-8"))
    doc["story"]["data"] = story
    doc["story"]["uuid"] = story["uuid"]
    users = {"{{CREATOR}}": creator_uuid_value, "{{GUEST}}": guest_uuid_value or new_uuid()}
    doc = json.loads(json.dumps(doc).replace("{{CREATOR}}", users["{{CREATOR}}"])
                     .replace("{{GUEST}}", users["{{GUEST}}"]))
    doc["users"][1]["username"] = f"robottest_export_{users['{{GUEST}}'][:8]}"
    return rewrite_export_uuids(doc)


def guest_of_fixture(doc):
    """The uuid of the fixture's second (copied, tokenless) guest."""
    return doc["users"][1]["uuid"]


def golden_files(directory):
    """The committed golden exports (fixtures/golden/export_<backend>.json), sorted."""
    folder = Path(directory)
    return sorted(str(p) for p in folder.glob("export_*.json")) if folder.exists() else []


def load_export(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_golden(doc, directory):
    """Saves fixtures/golden/export_<backend>.json (pretty, for review) and answers the path."""
    folder = Path(directory)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"export_{doc['source']['backend']}.json"
    path.write_text(json.dumps(doc, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    return str(path)


def find_dicts(body, field, value):
    """Every dict, at any depth of an API answer, whose ``field`` equals ``value``."""
    found = []
    stack = [body]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            if str(node.get(field)) == str(value):
                found.append(node)
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)
    return found


def registry_values(body, key):
    """The values of one registry key in a GET /registry answer (grouped or flat), as strings."""
    out = []
    for row in find_dicts(body, "key", key):
        values = row.get("values")
        if values is None:
            values = [row.get("value") if row.get("value") is not None else row.get("stringValue")]
        out += [str(v) for v in values if v is not None]
    return out
