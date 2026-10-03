"""v0.41.6 — the outcome of an admin owner move. Mirrors ``MatchOwnerMoveResult.java``."""
from dataclasses import dataclass
from typing import Optional

MOVED = "MOVED"
UNCHANGED = "UNCHANGED"


@dataclass(frozen=True)
class Owner:
    uuid: Optional[str]
    username: Optional[str]


@dataclass(frozen=True)
class MatchOwnerMoveResult:
    status: str
    match_uuid: str
    previous_owner: Owner
    owner: Owner
    characters_moved: int

    def to_response(self) -> dict:
        return {
            "status": self.status, "matchUuid": self.match_uuid,
            "previousOwner": {"uuid": self.previous_owner.uuid, "username": self.previous_owner.username},
            "owner": {"uuid": self.owner.uuid, "username": self.owner.username},
            "charactersMoved": self.characters_moved,
        }
