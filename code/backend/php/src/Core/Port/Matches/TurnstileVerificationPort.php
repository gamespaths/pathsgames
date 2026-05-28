<?php

namespace Games\Paths\Core\Port\Matches;

interface TurnstileVerificationPort
{
    /**
     * Verify a Cloudflare Turnstile challenge token.
     * Returns true when the token is valid or when validation is disabled (empty secret key).
     */
    public function verify(?string $token, ?string $remoteIp): bool;
}
