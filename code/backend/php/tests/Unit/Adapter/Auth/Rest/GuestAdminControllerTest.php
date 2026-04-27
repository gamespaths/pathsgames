<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Auth\Rest;

use Games\Paths\Adapter\Auth\Rest\GuestAdminController;
use Games\Paths\Core\Domain\Auth\GuestSession;
use Games\Paths\Core\Port\Auth\GuestAdminPort;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

class GuestAdminControllerTest extends TestCase
{
    private $guestAdminService;
    private $controller;
    private $responseFactory;
    private $requestFactory;

    protected function setUp(): void
    {
        $this->guestAdminService = $this->createMock(GuestAdminPort::class);
        $this->controller = new GuestAdminController($this->guestAdminService);
        $this->responseFactory = new ResponseFactory();
        $this->requestFactory = new ServerRequestFactory();
    }

    public function testListGuests(): void
    {
        $guest = new GuestSession('u1', 'user1', 'cookie', new \DateTimeImmutable(), new \DateTimeImmutable(), 'PLAYER', 6, 'nickname');
        $this->guestAdminService->method('listGuests')->willReturn([$guest]);

        $request = $this->requestFactory->createServerRequest('GET', '/api/admin/guests');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->listGuests($request, $response, []);

        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertCount(1, $body);
        $this->assertSame('u1', $body[0]['userUuid']);
    }

    public function testGetGuestStats(): void
    {
        $stats = ['totalGuests' => 10, 'activeGuests' => 5, 'expiredGuests' => 5];
        $this->guestAdminService->method('getGuestStats')->willReturn($stats);

        $request = $this->requestFactory->createServerRequest('GET', '/api/admin/guests/stats');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->getGuestStats($request, $response, []);

        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame(10, $body['totalGuests']);
    }

    public function testGetGuestSuccess(): void
    {
        $guest = new GuestSession('u1', 'user1', 'cookie', new \DateTimeImmutable(), new \DateTimeImmutable(), 'PLAYER', 6, 'nickname');
        $this->guestAdminService->method('getGuestByUuid')->with('u1')->willReturn($guest);

        $request = $this->requestFactory->createServerRequest('GET', '/api/admin/guests/u1');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->getGuest($request, $response, ['uuid' => 'u1']);

        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('u1', $body['userUuid']);
    }

    public function testGetGuestNotFound(): void
    {
        $this->guestAdminService->method('getGuestByUuid')->with('missing')->willReturn(null);

        $request = $this->requestFactory->createServerRequest('GET', '/api/admin/guests/missing');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->getGuest($request, $response, ['uuid' => 'missing']);

        $this->assertSame(404, $result->getStatusCode());
    }

    public function testDeleteGuestSuccess(): void
    {
        $this->guestAdminService->method('deleteGuestByUuid')->with('u1')->willReturn(true);

        $request = $this->requestFactory->createServerRequest('DELETE', '/api/admin/guests/u1');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->deleteGuest($request, $response, ['uuid' => 'u1']);

        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('DELETED', $body['status']);
    }

    public function testDeleteGuestNotFound(): void
    {
        $this->guestAdminService->method('deleteGuestByUuid')->with('missing')->willReturn(false);

        $request = $this->requestFactory->createServerRequest('DELETE', '/api/admin/guests/missing');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->deleteGuest($request, $response, ['uuid' => 'missing']);

        $this->assertSame(404, $result->getStatusCode());
    }

    public function testCleanupExpired(): void
    {
        $this->guestAdminService->method('cleanupExpiredGuests')->willReturn(5);

        $request = $this->requestFactory->createServerRequest('DELETE', '/api/admin/guests/expired');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->cleanupExpired($request, $response, []);

        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('CLEANUP_COMPLETE', $body['status']);
        $this->assertSame(5, $body['deletedCount']);
    }
}
