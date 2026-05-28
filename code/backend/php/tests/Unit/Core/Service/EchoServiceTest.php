<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Service;

use Games\Paths\Core\Service\EchoService;
use PHPUnit\Framework\TestCase;

class EchoServiceTest extends TestCase
{
    private EchoService $service;

    protected function setUp(): void
    {
        $this->service = new EchoService();
    }

    public function testGetStatusReturnsOk(): void
    {
        $status = $this->service->getStatus();
        $this->assertSame('OK', $status['status']);
    }

    public function testGetStatusContainsTimestamp(): void
    {
        $before = time() * 1000;
        $status = $this->service->getStatus();
        $after = time() * 1000;

        $this->assertArrayHasKey('timestamp', $status);
        $this->assertGreaterThanOrEqual($before, $status['timestamp']);
        $this->assertLessThanOrEqual($after, $status['timestamp']);
    }

    public function testGetStatusContainsProperties(): void
    {
        $status = $this->service->getStatus();

        $this->assertArrayHasKey('properties', $status);
        $this->assertArrayHasKey('env', $status['properties']);
        $this->assertArrayHasKey('version', $status['properties']);
        $this->assertArrayHasKey('applicationName', $status['properties']);
        $this->assertArrayHasKey('phpVersion', $status['properties']);
    }

    public function testApplicationNameIsCorrect(): void
    {
        $status = $this->service->getStatus();
        $this->assertSame('paths-game-backend-php', $status['properties']['applicationName']);
    }

    public function testPhpVersionIsSet(): void
    {
        $status = $this->service->getStatus();
        $this->assertSame(PHP_VERSION, $status['properties']['phpVersion']);
    }

    public function testNoJavaVersionKey(): void
    {
        $status = $this->service->getStatus();
        $this->assertArrayNotHasKey('javaVersion', $status['properties']);
    }
}
