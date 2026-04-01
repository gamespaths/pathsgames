<?php

namespace Games\Paths\Adapter\Auth\Rest;

use Games\Paths\Core\Port\Auth\GuestAuthPort;
use Games\Paths\Core\Port\Auth\JwtPort;
use Games\Paths\Core\Domain\Auth\GuestSession;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Matches the Python GuestAuthController response format exactly.
 */
class GuestAuthController
{
    private GuestAuthPort $guestAuthService;
    private JwtPort $jwtPort;

    public function __construct(GuestAuthPort $guestAuthService, JwtPort $jwtPort)
    {
        $this->guestAuthService = $guestAuthService;
        $this->jwtPort = $jwtPort;
    }

    /**
     * Build the session response — matches Python GuestSession model_dump(by_alias=True).
     */
    private function formatSessionResponse(GuestSession $session): array
    {
        $uuid = $session->getUuid();
        $username = $session->getUsername();
        $role = $session->getRole();

        // Generate real JWT tokens (same payload/algorithm as Python)
        $accessToken = $this->jwtPort->generateAccessToken($uuid, $username, $role);
        $refreshToken = $this->jwtPort->generateRefreshToken($uuid);

        return [
            'userUuid' => $uuid,
            'username' => $username,
            'accessToken' => $accessToken,
            'refreshToken' => $refreshToken,
            'accessTokenExpiresAt' => $this->jwtPort->getAccessTokenExpirationMs(),
            'refreshTokenExpiresAt' => $this->jwtPort->getRefreshTokenExpirationMs(),
            'guestCookieToken' => $session->getCookieToken(),
        ];
    }

    public function createGuest(Request $request, Response $response, array $args): Response
    {
        $session = $this->guestAuthService->createGuestSession();

        $response->getBody()->write(json_encode($this->formatSessionResponse($session)));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(201);
    }

    public function resumeGuest(Request $request, Response $response, array $args): Response
    {
        $data = json_decode((string)$request->getBody(), true);
        if (!isset($data['guestCookieToken'])) {
            $error = ['error' => 'Bad Request', 'message' => 'Missing guestCookieToken'];
            $response->getBody()->write(json_encode($error));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $session = $this->guestAuthService->resumeGuestSession($data['guestCookieToken']);
        if (!$session) {
            $error = [
                'error' => 'SESSION_EXPIRED_OR_NOT_FOUND',
                'message' => 'Guest session expired or not found. Please create a new session.'
            ];
            $response->getBody()->write(json_encode($error));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(401);
        }

        $response->getBody()->write(json_encode($this->formatSessionResponse($session)));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(200);
    }
}
