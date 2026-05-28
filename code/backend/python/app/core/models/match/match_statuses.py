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


def is_valid(status) -> bool:
    """Returns True when status is one of the valid match statuses."""
    return status in ALL


def is_terminal(status) -> bool:
    """Returns True when status is a terminal (stopped) status."""
    return status in TERMINAL
