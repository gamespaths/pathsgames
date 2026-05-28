<?php

namespace Games\Paths\Core\Service\Dev;

use Games\Paths\Core\Domain\Dev\CleanupResult;
use Games\Paths\Core\Port\Auth\GuestRepositoryPort;
use Games\Paths\Core\Port\Dev\TestDataCleanupPort;
use Games\Paths\Core\Port\Matches\MatchPersistencePort;

/**
 * Removes guests and matches created by automated (Robot Framework) test runs,
 * identified by the canonical "robottest" marker:
 *
 *  - guest usernames start with "robottest_" (set when the X-Test-Marker
 *    header is sent to POST /api/auth/guest);
 *  - match names start with "robottest_" (set by the Robot test suites).
 *
 * All other rows are preserved.
 */
class TestDataCleanupService implements TestDataCleanupPort
{
    public const ROBOT_TEST_MARKER = 'robottest';
    private const MARKER_LIKE_PATTERN = self::ROBOT_TEST_MARKER . '%';

    public function __construct(
        private readonly GuestRepositoryPort $guestRepository,
        private readonly MatchPersistencePort $matchPersistence
    ) {
    }

    public function cleanupTestData(): CleanupResult
    {
        // Matches reference their guest creator via FK — delete them first.
        $deletedMatches = $this->matchPersistence->deleteMatchesByNameLike(self::MARKER_LIKE_PATTERN);
        $deletedGuests = $this->guestRepository->deleteGuestsByUsernameLike(self::MARKER_LIKE_PATTERN);

        return new CleanupResult($deletedGuests, $deletedMatches);
    }
}
