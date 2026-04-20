<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Auth;

use Games\Paths\Adapter\Auth\JwtAdapter;
use PHPUnit\Framework\TestCase;

class JwtAdapterTest extends TestCase
{
    private string $secret = 'this-is-a-32-character-secret-!!';
    private JwtAdapter $adapter;

    protected function setUp(): void
    {
        $this->adapter = new JwtAdapter($this->secret);
    }

    public function testGenerateAndParseAccessToken(): void
    {
        $token = $this->adapter->generateAccessToken('u1', 'user1', 'ADMIN');
        $this->assertNotEmpty($token);

        $info = $this->adapter->parseToken($token);
        $this->assertSame('u1', $info->getUserUuid());
        $this->assertSame('user1', $info->getUsername());
        $this->assertSame('ADMIN', $info->getRole());
        $this->assertSame('access', $info->getType());
    }

    public function testGenerateAndParseRefreshToken(): void
    {
        $token = $this->adapter->generateRefreshToken('u1');
        $this->assertNotEmpty($token);

        $info = $this->adapter->parseToken($token);
        $this->assertSame('u1', $info->getUserUuid());
        $this->assertSame('refresh', $info->getType());
    }

    public function testValidateTokenSuccess(): void
    {
        $token = $this->adapter->generateAccessToken('u1', 'user1', 'PLAYER');
        $this->assertTrue($this->adapter->validateToken($token));
    }

    public function testValidateTokenFailure(): void
    {
        $this->assertFalse($this->adapter->validateToken('invalid.token.here'));
    }

    public function testParseTokenFailure(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('TOKEN_PARSE_ERROR');
        $this->adapter->parseToken('invalid.token');
    }

    public function testGetExpirations(): void
    {
        $accessExp = $this->adapter->getAccessTokenExpirationMs();
        $refreshExp = $this->adapter->getRefreshTokenExpirationMs();

        $this->assertGreaterThan(time() * 1000, $accessExp);
        $this->assertGreaterThan($accessExp, $refreshExp);
    }
}
