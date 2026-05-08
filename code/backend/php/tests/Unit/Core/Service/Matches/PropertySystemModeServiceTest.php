<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Service\Matches;

use Games\Paths\Core\Service\Matches\PropertySystemModeService;
use PHPUnit\Framework\TestCase;

class PropertySystemModeServiceTest extends TestCase
{
    public function testMaintenanceTrueWhenStatusMatches(): void
    {
        $this->assertTrue((new PropertySystemModeService('MAINTENANCE'))->isMaintenance());
        $this->assertTrue((new PropertySystemModeService('maintenance'))->isMaintenance());
        $this->assertTrue((new PropertySystemModeService(' Maintenance '))->isMaintenance());
    }

    public function testMaintenanceFalseForOtherStatus(): void
    {
        $this->assertFalse((new PropertySystemModeService('OK'))->isMaintenance());
        $this->assertFalse((new PropertySystemModeService(''))->isMaintenance());
    }
}
