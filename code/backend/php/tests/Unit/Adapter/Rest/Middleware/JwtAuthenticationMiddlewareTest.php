<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Rest\Middleware;

use Games\Paths\Adapter\Rest\Middleware\JwtAuthenticationMiddleware;
use Games\Paths\Core\Domain\Auth\TokenInfo;
use Games\Paths\Core\Port\Auth\SessionPort;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\UriInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Response;

class JwtAuthenticationMiddlewareTest extends TestCase
{
    private SessionPort&MockObject $sessionService;
    private RequestHandlerInterface&MockObject $handler;
    private ServerRequestInterface&MockObject $request;
    private JwtAuthenticationMiddleware $middleware;

    protected function setUp(): void
    {
        $this->sessionService = $this->createMock(SessionPort::class);
        $this->handler = $this->createMock(RequestHandlerInterface::class);
        $this->request = $this->createMock(ServerRequestInterface::class);
        
        $this->middleware = new JwtAuthenticationMiddleware(
            $this->sessionService,
            ['/api/public', '/api/wildcard/**']
        );
    }

    public function testProcessAllowsPublicPath(): void
    {
        $uri = $this->createMock(UriInterface::class);
        $uri->method('getPath')->willReturn('/api/public');
        $this->request->method('getUri')->willReturn($uri);

        $this->handler->expects($this->once())->method('handle')->willReturn(new Response());

        $this->middleware->process($this->request, $this->handler);
    }

    public function testProcessAllowsWildcardPublicPath(): void
    {
        $uri = $this->createMock(UriInterface::class);
        $uri->method('getPath')->willReturn('/api/wildcard/sub/path');
        $this->request->method('getUri')->willReturn($uri);

        $this->handler->expects($this->once())->method('handle')->willReturn(new Response());

        $this->middleware->process($this->request, $this->handler);
    }

    public function testProcessAllowsOptionsMethod(): void
    {
        $uri = $this->createMock(UriInterface::class);
        $uri->method('getPath')->willReturn('/api/private');
        $this->request->method('getUri')->willReturn($uri);
        $this->request->method('getMethod')->willReturn('OPTIONS');

        $this->handler->expects($this->once())->method('handle')->willReturn(new Response());

        $this->middleware->process($this->request, $this->handler);
    }

    public function testProcessReturns401WhenTokenMissing(): void
    {
        $uri = $this->createMock(UriInterface::class);
        $uri->method('getPath')->willReturn('/api/private');
        $this->request->method('getUri')->willReturn($uri);
        $this->request->method('getHeaderLine')->with('Authorization')->willReturn('');

        $response = $this->middleware->process($this->request, $this->handler);

        $this->assertSame(401, $response->getStatusCode());
    }

    public function testProcessReturns401WhenTokenInvalid(): void
    {
        $uri = $this->createMock(UriInterface::class);
        $uri->method('getPath')->willReturn('/api/private');
        $this->request->method('getUri')->willReturn($uri);
        $this->request->method('getHeaderLine')->with('Authorization')->willReturn('Bearer invalid-token');

        $this->sessionService->method('validateAccessToken')->willThrowException(new \RuntimeException('Invalid'));

        $response = $this->middleware->process($this->request, $this->handler);

        $this->assertSame(401, $response->getStatusCode());
    }

    public function testProcessReturns403WhenAdminRequiredButNotAdmin(): void
    {
        $uri = $this->createMock(UriInterface::class);
        $uri->method('getPath')->willReturn('/api/admin/system');
        $this->request->method('getUri')->willReturn($uri);
        $this->request->method('getHeaderLine')->with('Authorization')->willReturn('Bearer valid-token');

        $tokenInfo = $this->createMock(TokenInfo::class);
        $tokenInfo->method('isAdmin')->willReturn(false);
        $this->sessionService->method('validateAccessToken')->willReturn($tokenInfo);

        $response = $this->middleware->process($this->request, $this->handler);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testProcessEnrichesRequestAndCallsHandler(): void
    {
        $uri = $this->createMock(UriInterface::class);
        $uri->method('getPath')->willReturn('/api/private');
        $this->request->method('getUri')->willReturn($uri);
        $this->request->method('getHeaderLine')->with('Authorization')->willReturn('Bearer valid-token');

        $tokenInfo = $this->createMock(TokenInfo::class);
        $tokenInfo->method('getUserUuid')->willReturn('u1');
        $tokenInfo->method('getUsername')->willReturn('user1');
        $tokenInfo->method('getRole')->willReturn('GUEST');
        $this->sessionService->method('validateAccessToken')->willReturn($tokenInfo);

        $this->request->expects($this->exactly(3))->method('withAttribute')->willReturnSelf();
        $this->handler->expects($this->once())->method('handle')->willReturn(new Response());

        $this->middleware->process($this->request, $this->handler);
    }
}
