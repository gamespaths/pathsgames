<?php

namespace Games\Paths\Core\Port;

/**
 * Port for JWT token generation — matches Python JwtPort exactly.
 */
interface JwtPort
{
    public function generateAccessToken(string $userUuid, string $username, string $role): string;
    public function generateRefreshToken(string $userUuid): string;
    public function getAccessTokenExpirationMs(): int;
    public function getRefreshTokenExpirationMs(): int;
}
