"""v1.7.0 step 8: a write made on an out-of-date view of the match (409 STALE_MATCH).
Mirrors ``StaleMatchException.java``."""
from typing import Optional

STALE_MATCH = "STALE_MATCH"


class StaleMatchError(Exception):
    code = STALE_MATCH

    def __init__(self, match_uuid: Optional[str], current_version: Optional[str]):
        self.match_uuid = match_uuid
        self.current_version = current_version
        self.message = "The match was changed by another device: reload it"
        super().__init__(self.message)
