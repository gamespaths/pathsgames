<?php

namespace Games\Paths\Adapter\Rest;

use Games\Paths\Core\Port\GuestAdminPort;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Matches the Python GuestAdminController response format exactly.
 */
class GuestAdminController
{
    private GuestAdminPort $guestAdminService;

    public function __construct(GuestAdminPort $guestAdminService)
    {
        $this->guestAdminService = $guestAdminService;
    }

    /**
     * GET /api/admin/guests — returns GuestInfo format (Python: model_dump(by_alias=True))
     */
    public function listGuests(Request $request, Response $response, array $args): Response
    {
        $guests = $this->guestAdminService->listGuests();
        $data = array_map(fn($g) => $g->toAdminArray(), $guests);

        $response->getBody()->write(json_encode($data));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(200);
    }

    /**
     * GET /api/admin/guests/stats — returns Python GuestStats format
     */
    public function getGuestStats(Request $request, Response $response, array $args): Response
    {
        $stats = $this->guestAdminService->getGuestStats();

        $response->getBody()->write(json_encode($stats));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(200);
    }

    /**
     * GET /api/admin/guests/{uuid} — returns GuestInfo format
     */
    public function getGuest(Request $request, Response $response, array $args): Response
    {
        $uuid = $args['uuid'];
        $guest = $this->guestAdminService->getGuestByUuid($uuid);

        if (!$guest) {
            $error = [
                'error' => 'GUEST_NOT_FOUND',
                'message' => "No guest user found with UUID: $uuid"
            ];
            $response->getBody()->write(json_encode($error));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(404);
        }

        $response->getBody()->write(json_encode($guest->toAdminArray()));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(200);
    }

    /**
     * DELETE /api/admin/guests/{uuid} — matches Python response
     */
    public function deleteGuest(Request $request, Response $response, array $args): Response
    {
        $uuid = $args['uuid'];
        $deleted = $this->guestAdminService->deleteGuestByUuid($uuid);

        if (!$deleted) {
            $error = [
                'error' => 'GUEST_NOT_FOUND',
                'message' => "No guest user found with UUID: $uuid"
            ];
            $response->getBody()->write(json_encode($error));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(404);
        }

        $response->getBody()->write(json_encode(['status' => 'DELETED', 'uuid' => $uuid]));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(200);
    }

    /**
     * DELETE /api/admin/guests/expired — matches Python response
     */
    public function cleanupExpired(Request $request, Response $response, array $args): Response
    {
        $count = $this->guestAdminService->cleanupExpiredGuests();

        $response->getBody()->write(json_encode([
            'status' => 'CLEANUP_COMPLETE',
            'deletedCount' => $count
        ]));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(200);
    }
}
