<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Service\Dev;

use Games\Paths\Core\Port\Auth\GuestRepositoryPort;
use Games\Paths\Core\Port\Matches\MatchPersistencePort;
use Games\Paths\Core\Service\Dev\TestDataCleanupService;
use PHPUnit\Framework\TestCase;

class TestDataCleanupServiceTest extends TestCase
{
    public function testCleanupDeletesMarkedRows(): void
    {
        $guestRepo = $this->createMock(GuestRepositoryPort::class);
        $matchRepo = $this->createMock(MatchPersistencePort::class);
        $matchRepo->expects($this->once())->method('deleteMatchesByNameLike')
            ->with('robottest%')->willReturn(3);
        $guestRepo->expects($this->once())->method('deleteGuestsByUsernameLike')
            ->with('robottest%')->willReturn(7);

        $service = new TestDataCleanupService($guestRepo, $matchRepo);
        $result = $service->cleanupTestData();

        $this->assertSame(7, $result->deletedGuests);
        $this->assertSame(3, $result->deletedMatches);
    }

    public function testCleanupReturnsZeroWhenNothingMatches(): void
    {
        $guestRepo = $this->createMock(GuestRepositoryPort::class);
        $matchRepo = $this->createMock(MatchPersistencePort::class);
        $matchRepo->method('deleteMatchesByNameLike')->willReturn(0);
        $guestRepo->method('deleteGuestsByUsernameLike')->willReturn(0);

        $result = (new TestDataCleanupService($guestRepo, $matchRepo))->cleanupTestData();

        $this->assertSame(0, $result->deletedGuests);
        $this->assertSame(0, $result->deletedMatches);
    }
}
