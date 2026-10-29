"""v1.11.0 a ?limit= that is not an integer reads as absent (the default page), like a broken cursor; the same
rule on Java, Python and AWS instead of the FastAPI 422."""
from typing import Optional


def parse_limit(raw: Optional[str]) -> Optional[int]:
    if raw is None or not str(raw).strip():
        return None
    try:
        return int(str(raw).strip())
    except ValueError:
        return None
