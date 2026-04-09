<?php

namespace Games\Paths\Core\Domain\Auth;

/**
 * Immutable domain model for parsed JWT claims.
 */
class TokenInfo
{
    private string $userUuid;
    private string $username;
    private string $role;
    private string $type;
    private int $iat;
    private int $exp;
    private ?string $jti;

    public function __construct(
        string $userUuid,
        string $username,
        string $role,
        string $type,
        int $iat,
        int $exp,
        ?string $jti = null
    ) {
        $this->userUuid = $userUuid;
        $this->username = $username;
        $this->role = $role;
        $this->type = $type;
        $this->iat = $iat;
        $this->exp = $exp;
        $this->jti = $jti;
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

    public function getType(): string
    {
        return $this->type;
    }

    public function getIat(): int
    {
        return $this->iat;
    }

    public function getExp(): int
    {
        return $this->exp;
    }

    public function getJti(): ?string
    {
        return $this->jti;
    }

    public function isAdmin(): bool
    {
        return $this->role === 'ADMIN';
    }

    public function isAccessToken(): bool
    {
        return $this->type === 'access';
    }

    public function isRefreshToken(): bool
    {
        return $this->type === 'refresh';
    }
}
