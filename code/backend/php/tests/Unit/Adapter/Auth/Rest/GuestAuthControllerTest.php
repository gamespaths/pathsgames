<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Auth\Rest;

use Games\Paths\Adapter\Auth\Rest\GuestAuthController;
use Games\Paths\Core\Domain\Auth\GuestSession;
use Games\Paths\Core\Domain\Auth\TokenInfo;
use Games\Paths\Core\Port\Auth\GuestAuthPort;
use Games\Paths\Core\Port\Auth\JwtPort;
use Games\Paths\Core\Port\Auth\TokenPersistencePort;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

class GuestAuthControllerTest extends TestCase
{
    private $guestAuthService;
    private $jwtPort;
    private $tokenPersistence;
    private $controller;
    private $responseFactory;
    private $requestFactory;

    protected function setUp(): void
    {
        $this->guestAuthService = $this->createMock(GuestAuthPort::class);
        $this->jwtPort = $this->createMock(JwtPort::class);
        $this->tokenPersistence = $this->createMock(TokenPersistencePort::class);
        $this->controller = new GuestAuthController($this->guestAuthService, $this->jwtPort, $this->tokenPersistence);
        $this->responseFactory = new ResponseFactory();
        $this->requestFactory = new ServerRequestFactory();
    }

    private function setupJwtMocks(): void
    {
        $this->jwtPort->method('generateAccessToken')->willReturn('access-token');
        $this->jwtPort->method('generateRefreshToken')->willReturn('refresh-token');
        $this->jwtPort->method('getAccessTokenExpirationMs')->willReturn(1000);
        $this->jwtPort->method('getRefreshTokenExpirationMs')->willReturn(2000);
        
        $tokenInfo = new TokenInfo('u1', 'user1', 'PLAYER', 'refresh', 0, 1000, 'jti');
        $this->jwtPort->method('parseToken')->willReturn($tokenInfo);
    }

    public function testCreateGuest(): void
    {
        $session = new GuestSession('u1', 'user1', 'cookie-token', new \DateTimeImmutable(), new \DateTimeImmutable());
        $this->guestAuthService->method('createGuestSession')->willReturn($session);
        $this->setupJwtMocks();
        
        $this->tokenPersistence->expects($this->once())->method('saveRefreshToken');

        $request = $this->requestFactory->createServerRequest('POST', '/api/auth/guest');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->createGuest($request, $response);

        $this->assertSame(201, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('u1', $body['userUuid']);
        $this->assertSame('access-token', $body['accessToken']);
        
        $cookieHeader = $result->getHeaderLine('Set-Cookie');
        $this->assertStringContainsString('pathsgames.refreshToken=refresh-token', $cookieHeader);
        $this->assertStringContainsString('pathsgames.guestcookie=cookie-token', $cookieHeader);
    }

    public function testResumeGuestWithCookie(): void
    {
        $session = new GuestSession('u1', 'user1', 'cookie-token', new \DateTimeImmutable(), new \DateTimeImmutable());
        $this->guestAuthService->method('resumeGuestSession')->with('cookie-token')->willReturn($session);
        $this->setupJwtMocks();

        $request = $this->requestFactory->createServerRequest('POST', '/api/auth/guest/resume')
            ->withCookieParams(['pathsgames.guestcookie' => 'cookie-token']);
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->resumeGuest($request, $response);

        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('u1', $body['userUuid']);
    }

    public function testResumeGuestWithBody(): void
    {
        $session = new GuestSession('u1', 'user1', 'cookie-token', new \DateTimeImmutable(), new \DateTimeImmutable());
        $this->guestAuthService->method('resumeGuestSession')->with('cookie-token')->willReturn($session);
        $this->setupJwtMocks();

        $request = $this->requestFactory->createServerRequest('POST', '/api/auth/guest/resume');
        $request->getBody()->write(json_encode(['guestCookieToken' => 'cookie-token']));
        $request->getBody()->rewind();
        
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->resumeGuest($request, $response);

        $this->assertSame(200, $result->getStatusCode());
    }

    public function testResumeGuestMissingToken(): void
    {
        $request = $this->requestFactory->createServerRequest('POST', '/api/auth/guest/resume');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->resumeGuest($request, $response);

        $this->assertSame(400, $result->getStatusCode());
    }

    public function testResumeGuestExpired(): void
    {
        $this->guestAuthService->method('resumeGuestSession')->with('cookie-token')->willReturn(null);

        $request = $this->requestFactory->createServerRequest('POST', '/api/auth/guest/resume')
            ->withCookieParams(['pathsgames.guestcookie' => 'cookie-token']);
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->resumeGuest($request, $response);

        $this->assertSame(401, $result->getStatusCode());
    }
}
