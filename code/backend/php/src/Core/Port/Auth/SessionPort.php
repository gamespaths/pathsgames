<?php

namespace Games\Paths\Core\Port\Auth;

use Games\Paths\Core\Domain\Auth\RefreshedSession;
use Games\Paths\Core\Domain\Auth\TokenInfo;

/**
 * Inbound port for session and token management.
 */
interface SessionPort
{
    /**
     * Refreshes a session using a refresh token.
     * Implements token rotation: revokes all previous tokens for the user.
     */
    public function refreshSession(string $refreshToken): RefreshedSession;

    /**
     * Revokes a specific refresh token (single logout).
     */
    public function logout(string $refreshToken): void;

    /**
     * Revokes all active refresh tokens for a user.
     */
    public function logoutAll(string $userUuid): void;

    /**
     * Validates an access token and returns its claims.
     */
    public function validateAccessToken(string $accessToken): TokenInfo;
}
