<?php

namespace Games\Paths\Core\Port;

use Games\Paths\Core\Domain\GuestSession;

interface GuestAuthPort
{
    /**
     * Create a new guest session.
     */
    public function createGuestSession(): GuestSession;

    /**
     * Resume an existing guest session by cookie token.
     *
     * @param string $cookieToken
     * @return GuestSession|null
     */
    public function resumeGuestSession(string $cookieToken): ?GuestSession;
}
