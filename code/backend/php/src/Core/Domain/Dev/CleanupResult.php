<?php

namespace Games\Paths\Core\Domain\Dev;

/**
 * Immutable summary of a dev-only test-data cleanup operation.
 */
final class CleanupResult
{
    public function __construct(
        public readonly int $deletedGuests,
        public readonly int $deletedMatches
    ) {
    }
}
