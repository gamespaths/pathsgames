<?php

namespace Games\Paths\Core\Service\Auth;

use Games\Paths\Core\Domain\Auth\GuestSession;
use Games\Paths\Core\Port\Auth\GuestAdminPort;
use Games\Paths\Core\Port\Auth\GuestRepositoryPort;

/**
 * Matches the Python GuestAdminService logic exactly.
 */
class GuestAdminService implements GuestAdminPort
{
    private GuestRepositoryPort $guestRepository;

    public function __construct(GuestRepositoryPort $guestRepository)
    {
        $this->guestRepository = $guestRepository;
    }

    public function listGuests(): array
    {
        return $this->guestRepository->findAll();
    }

    /**
     * Matches Python GuestStats: total_guests, active_guests, expired_guests
     */
    public function getGuestStats(): array
    {
        return [
            'total_guests' => $this->guestRepository->countAll(),
            'active_guests' => $this->guestRepository->countActive(),
            'expired_guests' => $this->guestRepository->countExpired(),
        ];
    }

    public function getGuestByUuid(string $uuid): ?GuestSession
    {
        return $this->guestRepository->findByUuid($uuid);
    }

    public function deleteGuestByUuid(string $uuid): bool
    {
        return $this->guestRepository->deleteByUuid($uuid);
    }

    public function cleanupExpiredGuests(): int
    {
        return $this->guestRepository->deleteExpired(new \DateTimeImmutable());
    }
}
