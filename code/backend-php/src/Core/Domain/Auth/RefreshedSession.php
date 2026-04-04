<?php

namespace Games\Paths\Core\Domain\Auth;

/**
 * Immutable domain model for the result of a token refresh operation.
 */
class RefreshedSession
{
    private string $userUuid;
    private string $username;
    private string $role;
    private string $accessToken;
    private string $refreshToken;
    private int $accessTokenExpiresAt;
    private int $refreshTokenExpiresAt;

    public function __construct(
        string $userUuid,
        string $username,
        string $role,
        string $accessToken,
        string $refreshToken,
        int $accessTokenExpiresAt,
        int $refreshTokenExpiresAt
    ) {
        $this->userUuid = $userUuid;
        $this->username = $username;
        $this->role = $role;
        $this->accessToken = $accessToken;
        $this->refreshToken = $refreshToken;
        $this->accessTokenExpiresAt = $accessTokenExpiresAt;
        $this->refreshTokenExpiresAt = $refreshTokenExpiresAt;
    }

    public function getUserUuid(): string
    {
        return $this->userUuid;
    }

    public function getUsername(): string
    {
        return $this->username;
    }

    public function getRole(): string
    {
        return $this->role;
    }

    public function getAccessToken(): string
    {
        return $this->accessToken;
    }

    public function getRefreshToken(): string
    {
        return $this->refreshToken;
    }

    public function getAccessTokenExpiresAt(): int
    {
        return $this->accessTokenExpiresAt;
    }

    public function getRefreshTokenExpiresAt(): int
    {
        return $this->refreshTokenExpiresAt;
    }
}
