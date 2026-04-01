<?php

namespace Games\Paths\Core\Port;

use Games\Paths\Core\Domain\GuestSession;

interface GuestAdminPort
{
    /**
     * List all guest users.
     *
     * @return GuestSession[]
     */
    public function listGuests(): array;

    /**
     * Get statistics about guest users.
     *
     * @return array
     */
    public function getGuestStats(): array;

    /**
     * Get guest by UUID.
     *
     * @param string $uuid
     * @return GuestSession|null
     */
    public function getGuestByUuid(string $uuid): ?GuestSession;

    /**
     * Delete guest by UUID.
     *
     * @param string $uuid
     * @return bool True if deleted, false if not found.
     */
    public function deleteGuestByUuid(string $uuid): bool;

    /**
     * Cleanup expired guest sessions.
     *
     * @return int Number of deleted sessions.
     */
    public function cleanupExpiredGuests(): int;
}
