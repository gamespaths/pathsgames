<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Auth\Rest;

use Games\Paths\Adapter\Auth\Rest\SessionController;
use Games\Paths\Core\Domain\Auth\RefreshedSession;
use Games\Paths\Core\Port\Auth\SessionPort;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

class SessionControllerTest extends TestCase
{
    private $sessionService;
    private $controller;
    private $responseFactory;
    private $requestFactory;

    protected function setUp(): void
    {
        $this->sessionService = $this->createMock(SessionPort::class);
        $this->controller = new SessionController($this->sessionService);
        $this->responseFactory = new ResponseFactory();
        $this->requestFactory = new ServerRequestFactory();
    }

    public function testMe(): void
    {
        $request = $this->requestFactory->createServerRequest('GET', '/me')
            ->withAttribute('userUuid', 'u1')
            ->withAttribute('username', 'user1')
            ->withAttribute('role', 'PLAYER');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->me($request, $response);

        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('u1', $body['userUuid']);
        $this->assertSame('user1', $body['username']);
        $this->assertSame('PLAYER', $body['role']);
        $this->assertArrayHasKey('timestamp', $body);
    }

    public function testRefreshSuccess(): void
    {
        $refreshed = new RefreshedSession('u1', 'user1', 'PLAYER', 'new-access', 'new-refresh', 100, 200);
        $this->sessionService->method('refreshSession')
            ->with('old-refresh')
            ->willReturn($refreshed);

        $request = $this->requestFactory->createServerRequest('POST', '/refresh')
            ->withCookieParams(['pathsgames.refreshToken' => 'old-refresh']);
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->refresh($request, $response);

        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('new-access', $body['accessToken']);
        
        $cookieHeader = $result->getHeaderLine('Set-Cookie');
        $this->assertStringContainsString('pathsgames.refreshToken=new-refresh', $cookieHeader);
    }

    public function testRefreshMissingToken(): void
    {
        $request = $this->requestFactory->createServerRequest('POST', '/refresh');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->refresh($request, $response);

        $this->assertSame(401, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('MISSING_REFRESH_TOKEN', $body['error']);
    }

    public function testRefreshInvalidToken(): void
    {
        $this->sessionService->method('refreshSession')
            ->willThrowException(new \RuntimeException('Invalid token'));

        $request = $this->requestFactory->createServerRequest('POST', '/refresh')
            ->withCookieParams(['pathsgames.refreshToken' => 'invalid-token']);
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->refresh($request, $response);

        $this->assertSame(401, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('INVALID_REFRESH_TOKEN', $body['error']);
    }

    public function testLogout(): void
    {
        $this->sessionService->expects($this->once())
            ->method('logout')
            ->with('refresh-token');

        $request = $this->requestFactory->createServerRequest('POST', '/logout')
            ->withCookieParams(['pathsgames.refreshToken' => 'refresh-token']);
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->logout($request, $response);

        $this->assertSame(200, $result->getStatusCode());
        $cookieHeader = $result->getHeaderLine('Set-Cookie');
        $this->assertStringContainsString('pathsgames.refreshToken=;', $cookieHeader);
        $this->assertStringContainsString('pathsgames.guestcookie=;', $cookieHeader);
    }

    public function testLogoutAll(): void
    {
        $this->sessionService->expects($this->once())
            ->method('logoutAll')
            ->with('u1');

        $request = $this->requestFactory->createServerRequest('POST', '/logout-all')
            ->withAttribute('userUuid', 'u1');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->logoutAll($request, $response);

        $this->assertSame(200, $result->getStatusCode());
        $cookieHeader = $result->getHeaderLine('Set-Cookie');
        $this->assertStringContainsString('pathsgames.refreshToken=;', $cookieHeader);
    }
}
