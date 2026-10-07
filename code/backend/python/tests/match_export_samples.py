"""v0.41.4 test fixture: the shared sample match export (also used by java/aws), fingerprint and checksum set."""
import json
from pathlib import Path

from app.core.services.match import canonical_json
from app.core.services.story import story_fingerprint

FIXTURES = Path(__file__).parent / "fixtures"


def with_checksum(doc):
    doc["checksum"] = canonical_json.sha256({k: v for k, v in doc.items() if k != "checksum"})
    return doc


def document():
    doc = json.loads((FIXTURES / "match_export_sample.json").read_text(encoding="utf-8"))
    doc["story"]["fingerprint"] = story_fingerprint.of(doc["story"]["data"])
    return with_checksum(doc)


def vectors():
    return json.loads((FIXTURES / "match_export_canonical_vectors.json").read_text(encoding="utf-8"))["vectors"]
