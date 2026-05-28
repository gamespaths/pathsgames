<?php

namespace Games\Paths\Core\Port\Auth;

use Games\Paths\Core\Domain\Auth\TokenInfo;

/**
 * Outbound port for refresh token persistence in DB.
 */
interface TokenPersistencePort
{
    /**
     * Stores a new refresh token.
     */
    public function saveRefreshToken(string $userUuid, string $refreshToken, TokenInfo $tokenInfo): void;

    /**
     * Revokes a specific refresh token by its JTI or content.
     */
    public function revokeToken(string $refreshToken): void;

    /**
     * Revokes all active refresh tokens for a user.
     */
    public function revokeAllByUserUuid(string $userUuid): void;

    /**
     * Checks if a refresh token exists and is valid (not revoked and not expired).
     */
    public function isRefreshTokenValid(string $refreshToken): bool;

    /**
     * Finds the user unique ID (persistence id) by user UUID.
     */
    public function findUserIdByUuid(string $userUuid): ?int;

    /**
     * Enforces the maximum number of active tokens per user (deletes oldest).
     */
    public function enforceTokenLimit(int $userId, int $maxTokens): void;
}
