<?php

namespace Games\Paths\Adapter\Rest\Middleware;

use Games\Paths\Core\Port\Auth\SessionPort;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Slim\Psr7\Response as SlimResponse;

/**
 * Authentication middleware for API protection (Step 13).
 */
class JwtAuthenticationMiddleware implements MiddlewareInterface
{
    private SessionPort $sessionService;
    private array $publicPaths;
    private string $adminPathPrefix;

    public function __construct(
        SessionPort $sessionService,
        array $publicPaths = [],
        string $adminPathPrefix = '/api/admin/'
    ) {
        $this->sessionService = $sessionService;
        $this->publicPaths = $publicPaths;
        $this->adminPathPrefix = $adminPathPrefix;
    }

    public function process(Request $request, RequestHandler $handler): Response
    {
        $uri = $request->getUri()->getPath();

        // 1. Skip check for public paths
        foreach ($this->publicPaths as $publicPath) {
            if ($this->isPathMatch($uri, $publicPath)) {
                return $handler->handle($request);
            }
        }

        // 2. Options pre-flight: always allow
        if ($request->getMethod() === 'OPTIONS') {
            return $handler->handle($request);
        }

        // 3. Extract Bearer token
        $authHeader = $request->getHeaderLine('Authorization');
        if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            return $this->errorResponse('MISSING_TOKEN', 'Authorization header required', 401);
        }

        $token = $matches[1];

        // 4. Validate through SessionPort
        try {
            $tokenInfo = $this->sessionService->validateAccessToken($token);
        } catch (\RuntimeException $e) {
            return $this->errorResponse('INVALID_TOKEN', $e->getMessage(), 401);
        }

        // 5. Check Admin Authorization
        if (str_starts_with($uri, $this->adminPathPrefix) && !$tokenInfo->isAdmin()) {
            return $this->errorResponse('FORBIDDEN', 'Access denied: admins only', 403);
        }

        // 6. Enrich request with token data
        $request = $request
            ->withAttribute('userUuid', $tokenInfo->getUserUuid())
            ->withAttribute('username', $tokenInfo->getUsername())
            ->withAttribute('role', $tokenInfo->getRole());

        return $handler->handle($request);
    }

    private function isPathMatch(string $uri, string $pattern): bool
    {
        // Simple wildcard support: /api/echo/** -> /api/echo/
        if (str_ends_with($pattern, '/**')) {
            $base = substr($pattern, 0, -3);
            return str_starts_with($uri, $base);
        }
        return $uri === $pattern;
    }

    private function errorResponse(string $code, string $message, int $status): Response
    {
        $response = new SlimResponse($status);
        $response->getBody()->write(json_encode([
            'error' => $code,
            'message' => $message,
            'timestamp' => time() * 1000
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
