<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Integration;

use Games\Paths\Adapter\Auth\Persistence\Mysql\GuestMysqlRepository;
use Games\Paths\Core\Domain\Auth\GuestSession;

class GuestMysqlRepositoryTest extends DatabaseIntegrationTestCase
{
    private GuestMysqlRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repository = new GuestMysqlRepository($this->getPdo());
    }

    public function testSaveAndFindByUuid(): void
    {
        $session = new GuestSession(
            'test-uuid-123',
            'guest_test',
            'cookie-token-456',
            new \DateTimeImmutable('2023-01-01 10:00:00'),
            new \DateTimeImmutable('2023-02-01 10:00:00'),
            'PLAYER',
            6
        );

        $this->repository->save($session);

        $found = $this->repository->findByUuid('test-uuid-123');

        $this->assertNotNull($found);
        $this->assertEquals('test-uuid-123', $found->getUuid());
        $this->assertEquals('guest_test', $found->getUsername());
        $this->assertEquals('cookie-token-456', $found->getCookieToken());
    }

    public function testFindByCookieToken(): void
    {
        $session = new GuestSession(
            'test-uuid-222',
            'guest_222',
            'cookie-token-789',
            new \DateTimeImmutable(),
            new \DateTimeImmutable()
        );

        $this->repository->save($session);

        $found = $this->repository->findByCookieToken('cookie-token-789');

        $this->assertNotNull($found);
        $this->assertEquals('test-uuid-222', $found->getUuid());
        
        $notFound = $this->repository->findByCookieToken('invalid');
        $this->assertNull($notFound);
    }
}
