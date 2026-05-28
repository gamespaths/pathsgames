<?php

namespace Games\Paths\Core\Port\Auth;

use Games\Paths\Core\Domain\Auth\GuestSession;

interface GuestAuthPort
{
    /**
     * Create a new guest session.
     *
     * @param string|null $testMarker Optional marker (e.g. "robottest"); when
     *                                non-blank the generated username is
     *                                prefixed with the sanitized marker so the
     *                                guest can later be removed by the dev-only
     *                                test-data cleanup.
     */
    public function createGuestSession(?string $testMarker = null): GuestSession;

    /**
     * Resume an existing guest session by cookie token.
     *
     * @param string $cookieToken
     * @return GuestSession|null
     */
    public function resumeGuestSession(string $cookieToken): ?GuestSession;
}
