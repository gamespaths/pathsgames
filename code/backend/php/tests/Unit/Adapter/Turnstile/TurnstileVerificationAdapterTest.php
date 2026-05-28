<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Turnstile;

use Games\Paths\Adapter\Turnstile\TurnstileVerificationAdapter;
use PHPUnit\Framework\TestCase;

class TurnstileVerificationAdapterTest extends TestCase
{
    public function testEmptySecretKeyBypassesValidation(): void
    {
        $adapter = new TurnstileVerificationAdapter('', '0xROBOT', 'prod');
        $this->assertTrue($adapter->verify('anything', null));
        $this->assertTrue($adapter->verify(null, null));
    }

    public function testBypassTokenMatchReturnsTrueInNonProd(): void
    {
        $adapter = new TurnstileVerificationAdapter('real-secret', '0xROBOT', 'test');
        $this->assertTrue($adapter->verify('0xROBOT', null));
    }

    public function testEmptyBypassTokenNeverShortCircuits(): void
    {
        $adapter = new TurnstileVerificationAdapter('real-secret', '', 'test');
        $this->assertFalse($adapter->verify(null, null));
        $this->assertFalse($adapter->verify('', null));
    }

    public function testBypassTokenIgnoredInProdEnvironment(): void
    {
        $adapter = new TurnstileVerificationAdapter('real-secret', '0xROBOT', 'prod');
        // ENV=prod forces the Cloudflare siteverify call. We can't actually
        // reach Cloudflare here, so file_get_contents returns false and the
        // adapter returns false. The relevant assertion is that the bypass
        // branch was NOT taken (otherwise the result would be true).
        $this->assertFalse($adapter->verify('0xROBOT', null));
    }

    public function testMismatchedBypassTokenDoesNotShortCircuit(): void
    {
        $adapter = new TurnstileVerificationAdapter('real-secret', '0xROBOT', 'test');
        // The wrong token forces the Cloudflare path (which fails offline → false).
        $this->assertFalse($adapter->verify('some-other-token', null));
    }
}
