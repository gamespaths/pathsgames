<?php

namespace Games\Paths\Core\Port\Auth;

use Games\Paths\Core\Domain\Auth\TokenInfo;

/**
 * Port for JWT token generation and validation.
 */
interface JwtPort
{
    public function generateAccessToken(string $userUuid, string $username, string $role): string;
    public function generateRefreshToken(string $userUuid): string;
    public function getAccessTokenExpirationMs(): int;
    public function getRefreshTokenExpirationMs(): int;

    /**
     * Parses a JWT and returns its claims.
     */
    public function parseToken(string $token): TokenInfo;

    /**
     * Validates a JWT (checks signature and expiration).
     */
    public function validateToken(string $token): bool;
}
