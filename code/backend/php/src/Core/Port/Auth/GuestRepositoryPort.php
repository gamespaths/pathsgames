<?php

namespace Games\Paths\Core\Port\Auth;

use Games\Paths\Core\Domain\Auth\GuestSession;

interface GuestRepositoryPort
{
    public function save(GuestSession $session): void;
    public function findByCookieToken(string $cookieToken): ?GuestSession;
    public function findByUuid(string $uuid): ?GuestSession;
    public function findAll(): array;
    public function deleteByUuid(string $uuid): bool;
    public function deleteExpired(\DateTimeImmutable $now): int;

    /**
     * Delete all guest users whose username matches the given SQL LIKE
     * pattern, together with their tokens. Used by the dev-only test-data
     * cleanup. Returns the number of guest users removed.
     */
    public function deleteGuestsByUsernameLike(string $usernameLikePattern): int;
    public function countAll(): int;
    public function countActive(): int;
    public function countExpired(): int;
    public function updateLastAccess(string $uuid): void;
}
