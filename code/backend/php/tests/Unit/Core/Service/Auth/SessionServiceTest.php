<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Service\Auth;

use Games\Paths\Core\Domain\Auth\TokenInfo;
use Games\Paths\Core\Port\Auth\JwtPort;
use Games\Paths\Core\Port\Auth\TokenPersistencePort;
use Games\Paths\Core\Service\Auth\SessionService;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class SessionServiceTest extends TestCase
{
    private JwtPort&MockObject $jwtPort;
    private TokenPersistencePort&MockObject $tokenPersistence;
    private SessionService $service;

    protected function setUp(): void
    {
        $this->jwtPort = $this->createMock(JwtPort::class);
        $this->tokenPersistence = $this->createMock(TokenPersistencePort::class);
        $this->service = new SessionService($this->jwtPort, $this->tokenPersistence, 5);
    }

    public function testRefreshSessionSuccess(): void
    {
        $oldToken = 'old-refresh-token';
        $userUuid = 'user-uuid-123';
        $username = 'testuser';
        
        $oldInfo = new TokenInfo($userUuid, $username, 'PLAYER', 'refresh', time(), time() + 3600, 'jti-1');
        
        $this->jwtPort->method('validateToken')->with($oldToken)->willReturn(true);
        $this->tokenPersistence->method('isRefreshTokenValid')->with($oldToken)->willReturn(true);
        $this->tokenPersistence->method('findUserIdByUuid')->with($userUuid)->willReturn(1);
        
        $this->tokenPersistence->expects($this->once())->method('revokeAllByUserUuid')->with($userUuid);
        
        $this->jwtPort->method('generateAccessToken')->willReturn('new-access-token');
        $this->jwtPort->method('generateRefreshToken')->willReturn('new-refresh-token');
        
        $newInfo = new TokenInfo($userUuid, $username, 'PLAYER', 'refresh', time(), time() + 7200, 'jti-2');
        $this->jwtPort->method('parseToken')->willReturnMap([
            [$oldToken, $oldInfo],
            ['new-refresh-token', $newInfo],
            ['new-access-token', new TokenInfo($userUuid, $username, 'PLAYER', 'access', time(), time() + 60, 'jti-3')]
        ]);

        $this->tokenPersistence->expects($this->once())->method('saveRefreshToken')->with($userUuid, 'new-refresh-token', $newInfo);
        $this->tokenPersistence->expects($this->once())->method('enforceTokenLimit')->with(1, 5);

        $result = $this->service->refreshSession($oldToken);

        $this->assertSame('new-access-token', $result->getAccessToken());
        $this->assertSame('new-refresh-token', $result->getRefreshToken());
        $this->assertSame($userUuid, $result->getUserUuid());
    }

    public function testRefreshSessionThrowsWhenInvalidToken(): void
    {
        $this->jwtPort->method('validateToken')->willReturn(false);
        
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('INVALID_REFRESH_TOKEN');
        $this->expectExceptionCode(401);

        $this->service->refreshSession('invalid');
    }

    public function testRefreshSessionThrowsWhenNotRefreshToken(): void
    {
        $token = 'access-token-wrongly-used';
        $info = new TokenInfo('u', 'n', 'r', 'access', time(), time()+3600);
        
        $this->jwtPort->method('validateToken')->willReturn(true);
        $this->jwtPort->method('parseToken')->willReturn($info);
        
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('NOT_A_REFRESH_TOKEN');
        
        $this->service->refreshSession($token);
    }

    public function testRefreshSessionThrowsWhenRevoked(): void
    {
        $token = 'revoked-token';
        $info = new TokenInfo('u', 'n', 'r', 'refresh', time(), time()+3600);
        
        $this->jwtPort->method('validateToken')->willReturn(true);
        $this->jwtPort->method('parseToken')->willReturn($info);
        $this->tokenPersistence->method('isRefreshTokenValid')->willReturn(false);
        
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('REVOKED_REFRESH_TOKEN');
        
        $this->service->refreshSession($token);
    }

    public function testRefreshSessionThrowsWhenUserNotFound(): void
    {
        $token = 'token-for-missing-user';
        $info = new TokenInfo('u', 'n', 'r', 'refresh', time(), time()+3600);
        
        $this->jwtPort->method('validateToken')->willReturn(true);
        $this->jwtPort->method('parseToken')->willReturn($info);
        $this->tokenPersistence->method('isRefreshTokenValid')->willReturn(true);
        $this->tokenPersistence->method('findUserIdByUuid')->willReturn(null);
        
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('USER_NOT_FOUND');
        
        $this->service->refreshSession($token);
    }

    public function testLogoutRevokesSpecificToken(): void
    {
        $token = 'logout-this';
        $this->tokenPersistence->expects($this->once())->method('revokeToken')->with($token);
        
        $this->service->logout($token);
    }

    public function testLogoutAllRevokesAllForUser(): void
    {
        $userUuid = 'user-1';
        $this->tokenPersistence->expects($this->once())->method('revokeAllByUserUuid')->with($userUuid);
        
        $this->service->logoutAll($userUuid);
    }

    public function testValidateAccessTokenSuccess(): void
    {
        $token = 'valid-access';
        $info = new TokenInfo('u', 'n', 'PLAYER', 'access', time(), time()+60);
        
        $this->jwtPort->method('validateToken')->with($token)->willReturn(true);
        $this->jwtPort->method('parseToken')->with($token)->willReturn($info);
        
        $result = $this->service->validateAccessToken($token);
        
        $this->assertSame($info, $result);
    }

    public function testValidateAccessTokenThrowsWhenInvalid(): void
    {
        $this->jwtPort->method('validateToken')->willReturn(false);
        
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('INVALID_ACCESS_TOKEN');
        
        $this->service->validateAccessToken('bad');
    }

    public function testValidateAccessTokenThrowsWhenNotAccessToken(): void
    {
        $token = 'refresh-token-wrongly-used';
        $info = new TokenInfo('u', 'n', 'r', 'refresh', time(), time()+3600);
        
        $this->jwtPort->method('validateToken')->willReturn(true);
        $this->jwtPort->method('parseToken')->willReturn($info);
        
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('NOT_AN_ACCESS_TOKEN');
        
        $this->service->validateAccessToken($token);
    }
}
