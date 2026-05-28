<?php

namespace Games\Paths\Core\Port\Dev;

use Games\Paths\Core\Domain\Dev\CleanupResult;

/**
 * Inbound port for the dev-only test-data cleanup use case.
 */
interface TestDataCleanupPort
{
    /**
     * Delete every guest and match created by automated test runs.
     */
    public function cleanupTestData(): CleanupResult;
}
