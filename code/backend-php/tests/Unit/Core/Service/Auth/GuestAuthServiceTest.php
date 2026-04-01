<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Service\Auth;

use DateTimeImmutable;
use Games\Paths\Core\Domain\Auth\GuestSession;
use Games\Paths\Core\Port\Auth\GuestRepositoryPort;
use Games\Paths\Core\Port\Auth\JwtPort;
use Games\Paths\Core\Service\Auth\GuestAuthService;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class GuestAuthServiceTest extends TestCase
{
    private GuestRepositoryPort&MockObject $guestRepo;
    private JwtPort&MockObject $jwtPort;
    private GuestAuthService $service;

    protected function setUp(): void
    {
        $this->guestRepo = $this->createMock(GuestRepositoryPort::class);
        $this->jwtPort   = $this->createMock(JwtPort::class);
        $this->service   = new GuestAuthService($this->guestRepo, $this->jwtPort);
    }

    public function testCreateGuestSessionPersistsNewSession(): void
    {
        $this->guestRepo->expects($this->once())->method('save');

        $session = $this->service->createGuestSession();

        $this->assertNotEmpty($session->getUuid());
        $this->assertStringStartsWith('guest_', $session->getUsername());
    }

    public function testCreateGuestSessionUsernameIsFirst8CharsOfUuid(): void
    {
        $this->guestRepo->method('save');

        $session = $this->service->createGuestSession();

        $expectedUsername = 'guest_' . substr($session->getUuid(), 0, 8);
        $this->assertSame($expectedUsername, $session->getUsername());
    }

    public function testCreateGuestSessionExpiresIn30Days(): void
    {
        $this->guestRepo->method('save');

        $session = $this->service->createGuestSession();
        $diff = $session->getExpiresAt()->diff(new DateTimeImmutable());

        // Should be approximately 30 days in the future — at least 29 days
        $this->assertGreaterThanOrEqual(29, $diff->days);
    }

    public function testResumeGuestSessionReturnsSessionWhenValid(): void
    {
        $future  = new DateTimeImmutable('+10 days');
        $session = new GuestSession('uuid-1', 'guest_uuid1234', 'cookie-token', new DateTimeImmutable(), $future);

        $this->guestRepo->method('findByCookieToken')->with('cookie-token')->willReturn($session);
        $this->guestRepo->expects($this->once())->method('updateLastAccess')->with('uuid-1');

        $result = $this->service->resumeGuestSession('cookie-token');

        $this->assertNotNull($result);
        $this->assertSame('uuid-1', $result->getUuid());
    }

    public function testResumeGuestSessionReturnsNullWhenNotFound(): void
    {
        $this->guestRepo->method('findByCookieToken')->willReturn(null);

        $result = $this->service->resumeGuestSession('nonexistent-token');

        $this->assertNull($result);
    }

    public function testResumeGuestSessionReturnsNullAndDeletesWhenExpired(): void
    {
        $past    = new DateTimeImmutable('-1 day');
        $session = new GuestSession('uuid-2', 'guest_uuid2xxx', 'expired-token', new DateTimeImmutable(), $past);

        $this->guestRepo->method('findByCookieToken')->willReturn($session);
        $this->guestRepo->expects($this->once())->method('deleteByUuid')->with('uuid-2');

        $result = $this->service->resumeGuestSession('expired-token');

        $this->assertNull($result);
    }
}
