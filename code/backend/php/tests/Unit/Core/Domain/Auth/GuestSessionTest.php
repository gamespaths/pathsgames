<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Domain\Auth;

use Games\Paths\Core\Domain\Auth\GuestSession;
use PHPUnit\Framework\TestCase;

class GuestSessionTest extends TestCase
{
    public function testGuestSessionAccessors(): void
    {
        $uuid = 'test-uuid';
        $username = 'test-user';
        $cookieToken = 'test-token';
        $tsInsert = new \DateTimeImmutable('2023-01-01 10:00:00');
        $expiresAt = new \DateTimeImmutable('2023-01-02 10:00:00');
        $role = 'ADMIN';
        $state = 1;
        $nickname = 'nick';
        $language = 'it';
        $guestExpiresAt = '2023-01-03 10:00:00';
        $tsRegistration = '2023-01-01 09:00:00';
        $tsLastAccess = '2023-01-01 11:00:00';

        $session = new GuestSession(
            $uuid,
            $username,
            $cookieToken,
            $tsInsert,
            $expiresAt,
            $role,
            $state,
            $nickname,
            $language,
            $guestExpiresAt,
            $tsRegistration,
            $tsLastAccess
        );

        $this->assertSame($uuid, $session->getUuid());
        $this->assertSame($username, $session->getUsername());
        $this->assertSame($cookieToken, $session->getCookieToken());
        $this->assertSame($tsInsert, $session->getTsInsert());
        $this->assertSame($expiresAt, $session->getExpiresAt());
        $this->assertSame($role, $session->getRole());
        $this->assertSame($state, $session->getState());
        $this->assertSame($nickname, $session->getNickname());
        $this->assertSame($language, $session->getLanguage());
        $this->assertSame($guestExpiresAt, $session->getGuestExpiresAt());
        $this->assertSame($tsRegistration, $session->getTsRegistration());
        $this->assertSame($tsLastAccess, $session->getTsLastAccess());
    }

    public function testToAdminArray(): void
    {
        $uuid = 'test-uuid';
        $username = 'test-user';
        $cookieToken = 'test-token';
        $tsInsert = new \DateTimeImmutable('2023-01-01 10:00:00');
        $expiresAt = new \DateTimeImmutable('2023-01-02 10:00:00');
        
        // Test not expired
        $futureDate = (new \DateTimeImmutable('+1 day'))->format('Y-m-d H:i:s');
        $session = new GuestSession(
            $uuid, $username, $cookieToken, $tsInsert, $expiresAt,
            guestExpiresAt: $futureDate
        );

        $adminArray = $session->toAdminArray();
        $this->assertSame($uuid, $adminArray['userUuid']);
        $this->assertSame($username, $adminArray['username']);
        $this->assertSame($cookieToken, $adminArray['guestCookieToken']);
        $this->assertSame($futureDate, $adminArray['guestExpiresAt']);
        $this->assertFalse($adminArray['expired']);

        // Test expired
        $pastDate = (new \DateTimeImmutable('-1 day'))->format('Y-m-d H:i:s');
        $sessionExpired = new GuestSession(
            $uuid, $username, $cookieToken, $tsInsert, $expiresAt,
            guestExpiresAt: $pastDate
        );
        $this->assertTrue($sessionExpired->toAdminArray()['expired']);

        // Test invalid date
        $sessionInvalidDate = new GuestSession(
            $uuid, $username, $cookieToken, $tsInsert, $expiresAt,
            guestExpiresAt: 'invalid-date'
        );
        $this->assertFalse($sessionInvalidDate->toAdminArray()['expired']);

        // Test null guestExpiresAt
        $sessionNullDate = new GuestSession(
            $uuid, $username, $cookieToken, $tsInsert, $expiresAt,
            guestExpiresAt: null
        );
        $this->assertFalse($sessionNullDate->toAdminArray()['expired']);
    }

    public function testToArray(): void
    {
        $uuid = 'test-uuid';
        $username = 'test-user';
        $cookieToken = 'test-token';
        $tsInsert = new \DateTimeImmutable('2023-01-01 10:00:00');
        $expiresAt = new \DateTimeImmutable('2023-01-02 10:00:00');

        $session = new GuestSession($uuid, $username, $cookieToken, $tsInsert, $expiresAt);

        $array = $session->toArray();
        $this->assertSame($uuid, $array['uuid']);
        $this->assertSame($cookieToken, $array['guestCookieToken']);
        $this->assertSame($tsInsert->format(\DateTimeInterface::ATOM), $array['tsInsert']);
        $this->assertSame($expiresAt->format(\DateTimeInterface::ATOM), $array['expiresAt']);
    }
}
