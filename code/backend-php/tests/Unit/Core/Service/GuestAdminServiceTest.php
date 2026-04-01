<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Service;

use DateTimeImmutable;
use Games\Paths\Core\Domain\GuestSession;
use Games\Paths\Core\Port\GuestRepositoryPort;
use Games\Paths\Core\Service\GuestAdminService;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class GuestAdminServiceTest extends TestCase
{
    private GuestRepositoryPort&MockObject $guestRepo;
    private GuestAdminService $service;

    protected function setUp(): void
    {
        $this->guestRepo = $this->createMock(GuestRepositoryPort::class);
        $this->service   = new GuestAdminService($this->guestRepo);
    }

    private function makeSession(string $uuid = 'uuid-1'): GuestSession
    {
        return new GuestSession(
            $uuid,
            'guest_' . substr($uuid, 0, 8),
            'cookie-' . $uuid,
            new DateTimeImmutable(),
            new DateTimeImmutable('+30 days')
        );
    }

    public function testListGuestsDelegatesToRepository(): void
    {
        $sessions = [$this->makeSession('uuid-1'), $this->makeSession('uuid-2')];
        $this->guestRepo->method('findAll')->willReturn($sessions);

        $result = $this->service->listGuests();

        $this->assertCount(2, $result);
    }

    public function testListGuestsReturnsEmptyArray(): void
    {
        $this->guestRepo->method('findAll')->willReturn([]);

        $this->assertSame([], $this->service->listGuests());
    }

    public function testGetGuestStatsReturnsCorrectCounts(): void
    {
        $this->guestRepo->method('countAll')->willReturn(10);
        $this->guestRepo->method('countActive')->willReturn(7);
        $this->guestRepo->method('countExpired')->willReturn(3);

        $stats = $this->service->getGuestStats();

        $this->assertSame(10, $stats['total_guests']);
        $this->assertSame(7, $stats['active_guests']);
        $this->assertSame(3, $stats['expired_guests']);
    }

    public function testGetGuestByUuidReturnsSession(): void
    {
        $session = $this->makeSession('uuid-1');
        $this->guestRepo->method('findByUuid')->with('uuid-1')->willReturn($session);

        $result = $this->service->getGuestByUuid('uuid-1');

        $this->assertNotNull($result);
        $this->assertSame('uuid-1', $result->getUuid());
    }

    public function testGetGuestByUuidReturnsNullWhenNotFound(): void
    {
        $this->guestRepo->method('findByUuid')->willReturn(null);

        $this->assertNull($this->service->getGuestByUuid('nonexistent'));
    }

    public function testDeleteGuestByUuidReturnsTrueOnSuccess(): void
    {
        $this->guestRepo->method('deleteByUuid')->with('uuid-1')->willReturn(true);

        $this->assertTrue($this->service->deleteGuestByUuid('uuid-1'));
    }

    public function testDeleteGuestByUuidReturnsFalseWhenNotFound(): void
    {
        $this->guestRepo->method('deleteByUuid')->willReturn(false);

        $this->assertFalse($this->service->deleteGuestByUuid('nonexistent'));
    }

    public function testCleanupExpiredGuestsDelegatesToRepository(): void
    {
        $this->guestRepo->expects($this->once())
            ->method('deleteExpired')
            ->willReturn(5);

        $count = $this->service->cleanupExpiredGuests();

        $this->assertSame(5, $count);
    }
}
