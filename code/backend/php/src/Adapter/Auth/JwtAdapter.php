<?php

namespace Games\Paths\Adapter\Auth;

use Games\Paths\Core\Port\Auth\JwtPort;
use Games\Paths\Core\Domain\Auth\TokenInfo;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Ramsey\Uuid\Uuid;

/**
 * JWT Adapter — replicates the Python JwtAdapter logic exactly.
 * Uses HS256 with the same secret, same payload structure, same expiry calculation.
 */
class JwtAdapter implements JwtPort
{
    private string $secret;
    private int $accessTokenMinutes;
    private int $refreshTokenDays;

    public function __construct(string $secret, int $accessTokenMinutes = 30, int $refreshTokenDays = 7)
    {
        $this->secret = $secret;
        $this->accessTokenMinutes = $accessTokenMinutes;
        $this->refreshTokenDays = $refreshTokenDays;
    }

    public function generateAccessToken(string $userUuid, string $username, string $role): string
    {
        $now = time();
        $payload = [
            'sub'      => $userUuid,
            'username' => $username,
            'role'     => $role,
            'type'     => 'access',
            'iat'      => $now,
            'exp'      => $now + ($this->accessTokenMinutes * 60),
            'jti'      => Uuid::uuid4()->toString(),
        ];
        return JWT::encode($payload, $this->secret, 'HS256');
    }

    public function generateRefreshToken(string $userUuid): string
    {
        $now = time();
        $payload = [
            'sub'  => $userUuid,
            'type' => 'refresh',
            'iat'  => $now,
            'exp'  => $now + ($this->refreshTokenDays * 24 * 60 * 60),
            'jti'  => Uuid::uuid4()->toString(),
        ];
        return JWT::encode($payload, $this->secret, 'HS256');
    }

    public function getAccessTokenExpirationMs(): int
    {
        return (time() + ($this->accessTokenMinutes * 60)) * 1000;
    }

    public function getRefreshTokenExpirationMs(): int
    {
        return (time() + ($this->refreshTokenDays * 24 * 60 * 60)) * 1000;
    }

    public function parseToken(string $token): TokenInfo
    {
        try {
            $payload = JWT::decode($token, new Key($this->secret, 'HS256'));
            return new TokenInfo(
                $payload->sub,
                $payload->username ?? '',
                $payload->role ?? 'PLAYER',
                $payload->type,
                $payload->iat,
                $payload->exp,
                $payload->jti ?? null
            );
        } catch (\Exception $e) {
            throw new \RuntimeException("TOKEN_PARSE_ERROR: " . $e->getMessage(), 401);
        }
    }

    public function validateToken(string $token): bool
    {
        try {
            JWT::decode($token, new Key($this->secret, 'HS256'));
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }
}
