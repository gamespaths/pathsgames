<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Auth\Persistence\Mysql;

use Games\Paths\Adapter\Auth\Persistence\Mysql\GuestMysqlRepository;
use Games\Paths\Core\Domain\Auth\GuestSession;
use PDO;
use PDOStatement;
use PHPUnit\Framework\TestCase;

class GuestMysqlRepositoryTest extends TestCase
{
    private $pdo;
    private $repository;

    protected function setUp(): void
    {
        $this->pdo = $this->createMock(PDO::class);
        $this->repository = new GuestMysqlRepository($this->pdo);
    }

    public function testSave(): void
    {
        $session = new GuestSession(
            'uuid1', 'user1', 'cookie', new \DateTimeImmutable(), new \DateTimeImmutable(),
            'PLAYER', 6, 'nick', 'en', null, null, null
        );

        $stmt = $this->createMock(PDOStatement::class);
        $this->pdo->method('prepare')->willReturn($stmt);
        $stmt->expects($this->once())->method('execute');

        $this->repository->save($session);
    }

    public function testFindByCookieToken(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('fetch')->willReturn([
            'uuid' => 'uuid1',
            'username' => 'user1',
            'guest_cookie_token' => 'cookie',
            'ts_insert' => '2025-01-01 00:00:00',
            'expires_at' => '2025-01-01 00:00:00'
        ]);

        $this->pdo->method('prepare')->willReturn($stmt);
        $stmt->expects($this->once())->method('execute')->with([':cookieToken' => 'cookie']);

        $result = $this->repository->findByCookieToken('cookie');
        $this->assertNotNull($result);
        $this->assertSame('uuid1', $result->getUuid());
    }

    public function testFindByUuidNotFound(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('fetch')->willReturn(false);

        $this->pdo->method('prepare')->willReturn($stmt);

        $result = $this->repository->findByUuid('uuid1');
        $this->assertNull($result);
    }

    public function testFindAll(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('fetch')->willReturnOnConsecutiveCalls(
            [
                'uuid' => 'uuid1', 'username' => 'user1', 'guest_cookie_token' => 'cookie1',
                'ts_insert' => '2025-01-01 00:00:00', 'expires_at' => '2025-01-01 00:00:00'
            ],
            false
        );

        $this->pdo->method('query')->willReturn($stmt);

        $result = $this->repository->findAll();
        $this->assertCount(1, $result);
    }

    public function testDeleteByUuid(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('rowCount')->willReturn(1);

        $this->pdo->method('prepare')->willReturn($stmt);
        $stmt->expects($this->once())->method('execute')->with([':uuid' => 'uuid1']);

        $result = $this->repository->deleteByUuid('uuid1');
        $this->assertTrue($result);
    }

    public function testDeleteExpired(): void
    {
        $now = new \DateTimeImmutable();
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('rowCount')->willReturn(5);

        $this->pdo->method('prepare')->willReturn($stmt);

        $result = $this->repository->deleteExpired($now);
        $this->assertSame(5, $result);
    }

    public function testCountAll(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('fetchColumn')->willReturn(10);

        $this->pdo->method('query')->willReturn($stmt);

        $result = $this->repository->countAll();
        $this->assertSame(10, $result);
    }

    public function testCountActive(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('fetchColumn')->willReturn(5);

        $this->pdo->method('prepare')->willReturn($stmt);

        $result = $this->repository->countActive();
        $this->assertSame(5, $result);
    }

    public function testCountExpired(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('fetchColumn')->willReturn(2);

        $this->pdo->method('prepare')->willReturn($stmt);

        $result = $this->repository->countExpired();
        $this->assertSame(2, $result);
    }

    public function testUpdateLastAccess(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $this->pdo->method('prepare')->willReturn($stmt);
        $stmt->expects($this->once())->method('execute');

        $this->repository->updateLastAccess('uuid1');
    }
}
