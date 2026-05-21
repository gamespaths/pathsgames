from dataclasses import dataclass


@dataclass(frozen=True)
class CleanupResult:
    """Immutable summary of a dev-only test-data cleanup operation."""
    deleted_guests: int
    deleted_matches: int
