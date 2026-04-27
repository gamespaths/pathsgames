<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Auth\Persistence\Mysql;

use Games\Paths\Adapter\Auth\Persistence\Mysql\TokenMysqlRepository;
use Games\Paths\Core\Domain\Auth\TokenInfo;
use PDO;
use PDOStatement;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class TokenMysqlRepositoryTest extends TestCase
{
    private $pdo;
    private $repository;

    protected function setUp(): void
    {
        $this->pdo = $this->createMock(PDO::class);
        $this->repository = new TokenMysqlRepository($this->pdo);
    }

    public function testSaveRefreshTokenSuccess(): void
    {
        $stmtFind = $this->createMock(PDOStatement::class);
        $stmtFind->method('fetch')->willReturn(['id' => 1]);

        $stmtInsert = $this->createMock(PDOStatement::class);
        $stmtInsert->expects($this->once())->method('execute');

        $this->pdo->method('prepare')->willReturnMap([
            ["SELECT id FROM gaming_user_sessions WHERE uuid = :uuid LIMIT 1", [], $stmtFind],
            ["
            INSERT INTO users_tokens (id_user, token, jti, expires_at, revoked)
            VALUES (:userId, :token, :jti, :expiresAt, 0)
        ", [], $stmtInsert]
        ]);

        $tokenInfo = new TokenInfo('u1', 'user1', 'PLAYER', 'refresh', 0, 1000, 'jti');
        $this->repository->saveRefreshToken('u1', 'refresh', $tokenInfo);
    }

    public function testSaveRefreshTokenUserNotFound(): void
    {
        $stmtFind = $this->createMock(PDOStatement::class);
        $stmtFind->method('fetch')->willReturn(false);

        $this->pdo->method('prepare')->willReturn($stmtFind);

        $this->expectException(RuntimeException::class);
        $tokenInfo = new TokenInfo('u1', 'user1', 'PLAYER', 'refresh', 0, 1000, 'jti');
        $this->repository->saveRefreshToken('u1', 'refresh', $tokenInfo);
    }

    public function testRevokeToken(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $this->pdo->method('prepare')->willReturn($stmt);
        $stmt->expects($this->once())->method('execute')->with(['token' => 'tok']);

        $this->repository->revokeToken('tok');
    }

    public function testRevokeAllByUserUuid(): void
    {
        $stmtFind = $this->createMock(PDOStatement::class);
        $stmtFind->method('fetch')->willReturn(['id' => 1]);

        $stmtUpdate = $this->createMock(PDOStatement::class);
        $stmtUpdate->expects($this->once())->method('execute')->with(['userId' => 1]);

        $this->pdo->method('prepare')->willReturnOnConsecutiveCalls($stmtFind, $stmtUpdate);

        $this->repository->revokeAllByUserUuid('u1');
    }

    public function testRevokeAllByUserUuidNotFound(): void
    {
        $stmtFind = $this->createMock(PDOStatement::class);
        $stmtFind->method('fetch')->willReturn(false);

        $this->pdo->method('prepare')->willReturn($stmtFind);

        $this->repository->revokeAllByUserUuid('u1');
        $this->assertTrue(true);
    }

    public function testIsRefreshTokenValid(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('fetch')->willReturn(['revoked' => 0, 'expires_at' => '2025-01-01']);

        $this->pdo->method('prepare')->willReturn($stmt);
        $stmt->expects($this->once())->method('execute')->with(['token' => 'tok']);

        $result = $this->repository->isRefreshTokenValid('tok');
        $this->assertTrue($result);
    }

    public function testEnforceTokenLimit(): void
    {
        $stmtCount = $this->createMock(PDOStatement::class);
        $stmtCount->method('fetch')->willReturn(['count' => 10]);

        $stmtDelete = $this->createMock(PDOStatement::class);
        $stmtDelete->expects($this->once())->method('execute');

        $this->pdo->method('prepare')->willReturnOnConsecutiveCalls($stmtCount, $stmtDelete);

        $this->repository->enforceTokenLimit(1, 5);
    }
}
