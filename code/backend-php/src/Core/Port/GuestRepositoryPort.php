<?php

namespace Games\Paths\Core\Port;

use Games\Paths\Core\Domain\GuestSession;

interface GuestRepositoryPort
{
    public function save(GuestSession $session): void;
    public function findByCookieToken(string $cookieToken): ?GuestSession;
    public function findByUuid(string $uuid): ?GuestSession;
    public function findAll(): array;
    public function deleteByUuid(string $uuid): bool;
    public function deleteExpired(\DateTimeImmutable $now): int;
    public function countAll(): int;
    public function countActive(): int;
    public function countExpired(): int;
    public function updateLastAccess(string $uuid): void;
}
