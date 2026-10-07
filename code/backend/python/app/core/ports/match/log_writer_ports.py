"""v0.41.1 Step 41 A — pass, trait, lifecycle and admin rows on log_events. Mirrors ``MatchLogWriterPort.java``.
Stored with a prefix the match logs service strips; none may start with EVENT_EXECUTED/CHOICE_SELECTED."""
from abc import ABC, abstractmethod
from typing import Optional

MSG_PASS = "ACTION_PASS"
MSG_TRAIT_ADD = "TRAIT_ADD"
MSG_TRAIT_REMOVE = "TRAIT_REMOVE"
PREFIX_TRAIT = "TRAIT_"
PREFIX_MATCH = "MATCH_"
PREFIX_ADMIN = "ADMIN_"

LIFECYCLE_CREATED = "CREATED"
LIFECYCLE_STARTED = "STARTED"
LIFECYCLE_ENDED = "ENDED"

ADMIN_PAUSE = "PAUSE"
ADMIN_RESUME = "RESUME"
ADMIN_STOP = "STOP"
ADMIN_STATUS = "STATUS"
ADMIN_STATS = "STATS"
# Reserved for the snapshot restore: SNAPSHOT_RESTORED clock=<n>.
ADMIN_SNAPSHOT_RESTORED = "SNAPSHOT_RESTORED"
# v0.41.4 — the match export (EXPORTED clock=<n>) and import (IMPORTED <server> clock=<n>).
ADMIN_EXPORTED = "EXPORTED"
ADMIN_IMPORTED = "IMPORTED"
# v0.41.6 — the admin owner move: OWNER_CHANGED from=<username>/<uuid> to=<username>/<uuid>.
ADMIN_OWNER_CHANGED = "OWNER_CHANGED"

# The admin change-statistics fields, in the order the STATS row lists them.
STATS_FIELDS = ("dex", "intel", "con", "energy", "life", "sad", "coin", "food", "magic",
                "exp", "sleeping", "coma")


def lifecycle(detail: str) -> str:
    return PREFIX_MATCH + detail


def admin(detail: str) -> str:
    return PREFIX_ADMIN + detail


def admin_status(status: str) -> str:
    return admin(f"{ADMIN_STATUS} {str(status).upper()}")


def snapshot_restored(clock: int) -> str:
    return admin(f"{ADMIN_SNAPSHOT_RESTORED} clock={int(clock)}")


def exported(clock: int) -> str:
    return admin(f"{ADMIN_EXPORTED} clock={int(clock)}")


def imported(server: str, clock: int) -> str:
    return admin(f"{ADMIN_IMPORTED} {server} clock={int(clock)}")


def owner_changed(from_: str, to: str) -> str:
    return admin(f"{ADMIN_OWNER_CHANGED} from={from_} to={to}")


def stats_message(applied: dict) -> Optional[str]:
    """``ADMIN_STATS field=value ...`` over the applied fields, None when none was."""
    parts = []
    for name in STATS_FIELDS:
        value = applied.get(name)
        if value is None:
            continue
        text = ("true" if value else "false") if isinstance(value, bool) else str(value)
        parts.append(f"{name}={text}")
    return admin(f"{ADMIN_STATS} " + " ".join(parts)) if parts else None


class MatchLogWriterPort(ABC):

    @abstractmethod
    def write(self, id_match: int, id_character: Optional[int], id_event: Optional[int],
              clock: int, message: str) -> None:
        """One log_events row; character and event are None when the row belongs to the match."""

    @abstractmethod
    def count_rows(self, id_match: int) -> int:
        """Rows of the match in every log_* table; WARNs once when it reaches LOG_WARN_ROWS."""
