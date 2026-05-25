<?php

namespace Games\Paths\Adapter\Turnstile;

use Games\Paths\Core\Port\Matches\TurnstileVerificationPort;

class TurnstileVerificationAdapter implements TurnstileVerificationPort
{
    private const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    public function __construct(private readonly string $secretKey)
    {
    }

    public function verify(?string $token, ?string $remoteIp): bool
    {
        if ($this->secretKey === '') {
            return true;
        }
        if ($token === null || $token === '') {
            return false;
        }
        $postData = http_build_query(array_filter([
            'secret'   => $this->secretKey,
            'response' => $token,
            'remoteip' => $remoteIp ?? '',
        ], fn($v) => $v !== ''));

        $ctx = stream_context_create([
            'http' => [
                'method'  => 'POST',
                'header'  => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content' => $postData,
                'timeout' => 5,
            ],
        ]);
        try {
            $raw = @file_get_contents(self::SITEVERIFY_URL, false, $ctx);
            if ($raw === false) {
                return false;
            }
            $json = json_decode($raw, true);
            return isset($json['success']) && $json['success'] === true;
        } catch (\Throwable) {
            return false;
        }
    }
}
