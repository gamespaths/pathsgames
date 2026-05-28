<?php

namespace Games\Paths\Adapter\Rest\Dev;

use Games\Paths\Core\Port\Dev\TestDataCleanupPort;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Controller for dev-only maintenance endpoints.
 *
 * POST /api/dev/cleanup removes the rows created by automated (Robot
 * Framework) test runs — guests and matches carrying the "robottest" marker —
 * while preserving every other row.
 *
 * Returns 403 unless dev test endpoints are enabled, so it is inert in
 * production deployments.
 */
class DevController
{
    public function __construct(
        private readonly TestDataCleanupPort $cleanupPort,
        private readonly bool $testEndpointsEnabled
    ) {
    }

    public function cleanup(Request $request, Response $response): Response
    {
        if (!$this->testEndpointsEnabled) {
            $response->getBody()->write(json_encode([
                'error' => 'DEV_ENDPOINTS_DISABLED',
                'message' => 'Dev test endpoints are disabled on this environment',
            ]));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(403);
        }

        $result = $this->cleanupPort->cleanupTestData();
        $response->getBody()->write(json_encode([
            'deletedGuests' => $result->deletedGuests,
            'deletedMatches' => $result->deletedMatches,
        ]));

        return $response->withHeader('Content-Type', 'application/json')->withStatus(200);
    }
}
