<?php

namespace Games\Paths\Core\Service\Auth;

use Games\Paths\Core\Domain\Auth\RefreshedSession;
use Games\Paths\Core\Domain\Auth\TokenInfo;
use Games\Paths\Core\Port\Auth\JwtPort;
use Games\Paths\Core\Port\Auth\SessionPort;
use Games\Paths\Core\Port\Auth\TokenPersistencePort;

/**
 * Domain service for session and token management.
 * 
 * Implements Token Rotation:
 * When a refresh token is used, ALL existing sessions for that user are revoked.
 * This is a security measure to detect and mitigate token theft (Step 13).
 */
class SessionService implements SessionPort
{
    private JwtPort $jwtPort;
    private TokenPersistencePort $tokenPersistence;
    private int $maxTokensPerUser;

    public function __construct(
        JwtPort $jwtPort,
        TokenPersistencePort $tokenPersistence,
        int $maxTokensPerUser = 5
    ) {
        $this->jwtPort = $jwtPort;
        $this->tokenPersistence = $tokenPersistence;
        $this->maxTokensPerUser = $maxTokensPerUser;
    }

    public function refreshSession(string $refreshToken): RefreshedSession
    {
        // 1. Validate refresh token structure and signature
        if (!$this->jwtPort->validateToken($refreshToken)) {
            throw new \RuntimeException("INVALID_REFRESH_TOKEN", 401);
        }

        // 2. Parse claims
        $tokenInfo = $this->jwtPort->parseToken($refreshToken);
        if (!$tokenInfo->isRefreshToken()) {
            throw new \RuntimeException("NOT_A_REFRESH_TOKEN", 401);
        }

        // 3. Verify in DB (not revoked)
        if (!$this->tokenPersistence->isRefreshTokenValid($refreshToken)) {
            throw new \RuntimeException("REVOKED_REFRESH_TOKEN", 401);
        }

        // 4. Implement Token Rotation: Revoke ALL sessions for this user
        $this->tokenPersistence->revokeAllByUserUuid($tokenInfo->getUserUuid());

        // 5. Generate new pair
        // We need the username and role for the access token. 
        // In a real scenario, we might want to reload the user from DB,
        // but for Step 13, we trust the claims in the refresh token if it's signed.
        $newAccessToken = $this->jwtPort->generateAccessToken(
            $tokenInfo->getUserUuid(),
            $tokenInfo->getUsername(),
            $tokenInfo->getRole()
        );
        $newRefreshToken = $this->jwtPort->generateRefreshToken($tokenInfo->getUserUuid());
        
        // Parse new refresh token info for storage
        $newRefreshInfo = $this->jwtPort->parseToken($newRefreshToken);

        // 6. Persist new refresh token and enforce limits
        $userId = $this->tokenPersistence->findUserIdByUuid($tokenInfo->getUserUuid());
        if ($userId === null) {
            throw new \RuntimeException("USER_NOT_FOUND", 404);
        }

        $this->tokenPersistence->saveRefreshToken($tokenInfo->getUserUuid(), $newRefreshToken, $newRefreshInfo);
        $this->tokenPersistence->enforceTokenLimit($userId, $this->maxTokensPerUser);

        // 7. Return refreshed session
        return new RefreshedSession(
            $tokenInfo->getUserUuid(),
            $tokenInfo->getUsername(),
            $tokenInfo->getRole(),
            $newAccessToken,
            $newRefreshToken,
            time() + ($this->jwtPort->getAccessTokenExpirationMs() / 1000),
            time() + ($this->jwtPort->getRefreshTokenExpirationMs() / 1000)
        );
    }

    public function logout(string $refreshToken): void
    {
        // We only revoke the specific refresh token
        $this->tokenPersistence->revokeToken($refreshToken);
    }

    public function logoutAll(string $userUuid): void
    {
        // Revoke all refresh tokens for this user
        $this->tokenPersistence->revokeAllByUserUuid($userUuid);
    }

    public function validateAccessToken(string $accessToken): TokenInfo
    {
        if (!$this->jwtPort->validateToken($accessToken)) {
            throw new \RuntimeException("INVALID_ACCESS_TOKEN", 401);
        }

        $tokenInfo = $this->jwtPort->parseToken($accessToken);
        if (!$tokenInfo->isAccessToken()) {
            throw new \RuntimeException("NOT_AN_ACCESS_TOKEN", 401);
        }

        return $tokenInfo;
    }
}
