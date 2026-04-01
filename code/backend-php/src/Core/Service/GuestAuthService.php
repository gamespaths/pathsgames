<?php

namespace Games\Paths\Core\Service;

use Games\Paths\Core\Domain\GuestSession;
use Games\Paths\Core\Port\GuestAuthPort;
use Games\Paths\Core\Port\GuestRepositoryPort;
use Games\Paths\Core\Port\JwtPort;
use Ramsey\Uuid\Uuid;

/**
 * Replicates the Python GuestAuthService logic exactly:
 * - UUID for user identity
 * - username = "guest_" + first 8 chars of uuid
 * - cookie token is a UUID (not random hex)
 * - JWT access + refresh tokens
 * - 30-day guest session expiry
 */
class GuestAuthService implements GuestAuthPort
{
    private const GUEST_ROLE = 'PLAYER';
    private const GUEST_USERNAME_PREFIX = 'guest_';
    private const GUEST_SESSION_DAYS = 30;

    private GuestRepositoryPort $guestRepository;
    private JwtPort $jwtPort;

    public function __construct(GuestRepositoryPort $guestRepository, JwtPort $jwtPort)
    {
        $this->guestRepository = $guestRepository;
        $this->jwtPort = $jwtPort;
    }

    public function createGuestSession(): GuestSession
    {
        // 1. Generate anonymous UUID identity (matches Python)
        $userUuid = Uuid::uuid4()->toString();
        $username = self::GUEST_USERNAME_PREFIX . substr($userUuid, 0, 8);
        $guestCookieToken = Uuid::uuid4()->toString();

        // 2. Calculate guest session expiration (30 days, like Python)
        $now = new \DateTimeImmutable();
        $expiresAt = $now->modify('+' . self::GUEST_SESSION_DAYS . ' days');
        $guestExpiresAtIso = $expiresAt->format('Y-m-d H:i:s');

        // 3. Build domain object
        $session = new GuestSession(
            $userUuid,
            $username,
            $guestCookieToken,
            $now,
            $expiresAt,
            self::GUEST_ROLE,
            6, // state
            null, // nickname
            null, // language
            $guestExpiresAtIso,
            $now->format('Y-m-d H:i:s'),
            $now->format('Y-m-d H:i:s')
        );

        // 4. Persist guest user
        $this->guestRepository->save($session);

        return $session;
    }

    /**
     * Returns the JwtPort so the controller can generate tokens.
     */
    public function getJwtPort(): JwtPort
    {
        return $this->jwtPort;
    }

    public function resumeGuestSession(string $cookieToken): ?GuestSession
    {
        $session = $this->guestRepository->findByCookieToken($cookieToken);
        if (!$session) {
            return null;
        }

        $now = new \DateTimeImmutable();
        if ($session->getExpiresAt() < $now) {
            $this->guestRepository->deleteByUuid($session->getUuid());
            return null;
        }

        // Update last access
        $this->guestRepository->updateLastAccess($session->getUuid());

        return $session;
    }
}
