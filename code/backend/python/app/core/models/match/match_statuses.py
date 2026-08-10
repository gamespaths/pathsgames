"""Lifecycle statuses of a gaming_match row.

A match is "stopped" (terminal) when it is ENDED or GAMEOVER; only stopped
matches may be deleted by an admin.
"""

CREATED = "CREATED"
RUNNING = "RUNNING"
PAUSED = "PAUSED"
ENDED = "ENDED"
GAMEOVER = "GAMEOVER"

# Every valid status, in lifecycle order.
ALL = [CREATED, RUNNING, PAUSED, ENDED, GAMEOVER]

# Terminal statuses — a match in one of these is "stopped" and deletable.
TERMINAL = {ENDED, GAMEOVER}

# v0.32.1 — active (non-terminal) statuses. A match in one of these still occupies
# its creator's slot on the story, so a second one cannot be created. PAUSED counts:
# an admin-paused match is not over, it is suspended.
ACTIVE = {CREATED, RUNNING, PAUSED}


def is_valid(status) -> bool:
    """Returns True when status is one of the valid match statuses."""
    return status in ALL


def is_terminal(status) -> bool:
    """Returns True when status is a terminal (stopped) status."""
    return status in TERMINAL


def is_active(status) -> bool:
    """Returns True when status is an active (non-terminal) status."""
    return status in ACTIVE
