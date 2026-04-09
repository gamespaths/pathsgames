<?php

namespace Games\Paths\Adapter\Auth\Rest;

use Games\Paths\Adapter\Rest\Cookie\CookieHelper;
use Games\Paths\Core\Port\Auth\SessionPort;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Controller for session management (Step 13).
 */
class SessionController
{
    private SessionPort $sessionService;

    public function __construct(SessionPort $sessionService)
    {
        $this->sessionService = $sessionService;
    }

    public function me(Request $request, Response $response): Response
    {
        // Data populated by JwtAuthenticationMiddleware
        $data = [
            'userUuid' => $request->getAttribute('userUuid'),
            'username' => $request->getAttribute('username'),
            'role' => $request->getAttribute('role'),
            'timestamp' => time() * 1000
        ];

        $response->getBody()->write(json_encode($data));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function refresh(Request $request, Response $response): Response
    {
        // 1. Get refresh token from HttpOnly cookie
        $cookies = $request->getCookieParams();
        $refreshToken = $cookies['pathsgames.refreshToken'] ?? null;

        if (!$refreshToken) {
            $data = ['error' => 'MISSING_REFRESH_TOKEN', 'message' => 'Refresh token cookie is missing', 'timestamp' => time() * 1000];
            $response->getBody()->write(json_encode($data));
            return $response->withStatus(401)->withHeader('Content-Type', 'application/json');
        }

        // 2. Perform refresh with rotation
        try {
            $refreshed = $this->sessionService->refreshSession($refreshToken);
        } catch (\RuntimeException $e) {
            $data = ['error' => 'INVALID_REFRESH_TOKEN', 'message' => $e->getMessage(), 'timestamp' => time() * 1000];
            $response->getBody()->write(json_encode($data));
            return $response->withStatus(401)->withHeader('Content-Type', 'application/json');
        }

        // 3. Set new HttpOnly rotated refresh token
        $response = CookieHelper::setCookie(
            $response,
            'pathsgames.refreshToken',
            $refreshed->getRefreshToken(),
            7 * 24 * 60 * 60, // 7 days
            '/'
        );

        // 4. Return new access token in JSON body
        $data = [
            'userUuid' => $refreshed->getUserUuid(),
            'username' => $refreshed->getUsername(),
            'role' => $refreshed->getRole(),
            'accessToken' => $refreshed->getAccessToken(),
            'accessTokenExpiresAt' => $refreshed->getAccessTokenExpiresAt(),
            'refreshTokenExpiresAt' => $refreshed->getRefreshTokenExpiresAt()
        ];

        $response->getBody()->write(json_encode($data));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function logout(Request $request, Response $response): Response
    {
        // 1. Get refresh token from cookie 
        $cookies = $request->getCookieParams();
        $refreshToken = $cookies['pathsgames.refreshToken'] ?? null;

        if ($refreshToken) {
            $this->sessionService->logout($refreshToken);
        }

        // 2. Always clear both cookies
        $response = CookieHelper::clearCookie($response, 'pathsgames.refreshToken', '/');
        $response = CookieHelper::clearCookie($response, 'pathsgames.guestcookie', '/');

        $data = ['status' => 'OK', 'message' => 'Token revoked successfully', 'timestamp' => time() * 1000];
        $response->getBody()->write(json_encode($data));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function logoutAll(Request $request, Response $response): Response
    {
        $userUuid = $request->getAttribute('userUuid');
        if ($userUuid) {
            $this->sessionService->logoutAll($userUuid);
        }

        // Clear cookies
        $response = CookieHelper::clearCookie($response, 'pathsgames.refreshToken', '/');
        $response = CookieHelper::clearCookie($response, 'pathsgames.guestcookie', '/');

        $data = ['status' => 'OK', 'message' => 'All sessions revoked successfully', 'timestamp' => time() * 1000];
        $response->getBody()->write(json_encode($data));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
