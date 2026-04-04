<?php

namespace Games\Paths\Adapter\Auth\Rest;

use Games\Paths\Core\Port\Auth\GuestAuthPort;
use Games\Paths\Core\Port\Auth\JwtPort;
use Games\Paths\Core\Port\Auth\TokenPersistencePort;
use Games\Paths\Core\Domain\Auth\GuestSession;
use Games\Paths\Adapter\Rest\Cookie\CookieHelper;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Controller for guest authentication (Step 12/13).
 */
class GuestAuthController
{
    private GuestAuthPort $guestAuthService;
    private JwtPort $jwtPort;
    private TokenPersistencePort $tokenPersistence;

    public function __construct(
        GuestAuthPort $guestAuthService,
        JwtPort $jwtPort,
        TokenPersistencePort $tokenPersistence
    ) {
        $this->guestAuthService = $guestAuthService;
        $this->jwtPort = $jwtPort;
        $this->tokenPersistence = $tokenPersistence;
    }

    /**
     * Build the session response — Step 13 version (tokens in cookies).
     */
    private function processSessionResponse(Response $response, GuestSession $session): array
    {
        $uuid = $session->getUuid();
        $username = $session->getUsername();
        $role = $session->getRole();

        // 1. Generate real JWT tokens
        $accessToken = $this->jwtPort->generateAccessToken($uuid, $username, $role);
        $refreshToken = $this->jwtPort->generateRefreshToken($uuid);

        // 2. Persist refresh token in DB (Step 13)
        $tokenInfo = $this->jwtPort->parseToken($refreshToken);
        $this->tokenPersistence->saveRefreshToken($uuid, $refreshToken, $tokenInfo);

        // 3. Set HttpOnly cookies
        // Refresh Token
        $response = CookieHelper::setCookie(
            $response,
            'pathsgames.refreshToken',
            $refreshToken,
            7 * 24 * 60 * 60, // 7 days
            '/'
        );

        // Guest Cookie Token (for resume)
        $response = CookieHelper::setCookie(
            $response,
            'pathsgames.guestcookie',
            $session->getCookieToken(),
            30 * 24 * 60 * 60, // 30 days
            '/'
        );

        // 4. Return clean JSON (no refresh token, no guest cookie token)
        return [
            'response' => $response,
            'data' => [
                'userUuid' => $uuid,
                'username' => $username,
                'role'     => $role,
                'accessToken' => $accessToken,
                'accessTokenExpiresAt' => $this->jwtPort->getAccessTokenExpirationMs(),
                'refreshTokenExpiresAt' => $this->jwtPort->getRefreshTokenExpirationMs(),
            ]
        ];
    }

    public function createGuest(Request $request, Response $response): Response
    {
        $session = $this->guestAuthService->createGuestSession();
        $result = $this->processSessionResponse($response, $session);
        
        $newResponse = $result['response'];
        $newResponse->getBody()->write(json_encode($result['data']));
        
        return $newResponse->withHeader('Content-Type', 'application/json')->withStatus(201);
    }

    public function resumeGuest(Request $request, Response $response): Response
    {
        // Step 13: Read guestCookieToken from HttpOnly cookie if body is empty
        $cookies = $request->getCookieParams();
        $guestCookieToken = $cookies['pathsgames.guestcookie'] ?? null;

        if (!$guestCookieToken) {
            // Fallback to body for backward compatibility or explicit requests
            $data = json_decode((string)$request->getBody(), true);
            $guestCookieToken = $data['guestCookieToken'] ?? null;
        }

        if (!$guestCookieToken) {
            $error = ['error' => 'Bad Request', 'message' => 'Missing guestCookieToken (cookie or body)'];
            $response->getBody()->write(json_encode($error));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $session = $this->guestAuthService->resumeGuestSession($guestCookieToken);
        if (!$session) {
            $error = [
                'error' => 'SESSION_EXPIRED_OR_NOT_FOUND',
                'message' => 'Guest session expired or not found. Please create a new session.'
            ];
            $response->getBody()->write(json_encode($error));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(401);
        }

        $result = $this->processSessionResponse($response, $session);
        
        $newResponse = $result['response'];
        $newResponse->getBody()->write(json_encode($result['data']));
        
        return $newResponse->withHeader('Content-Type', 'application/json')->withStatus(200);
    }
}
