<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Domain\Matches;

use Games\Paths\Core\Domain\Matches\MatchStatuses;
use PHPUnit\Framework\TestCase;

class MatchStatusesTest extends TestCase
{
    public function testAllListsTheFiveLifecycleStatuses(): void
    {
        $this->assertSame(
            ['CREATED', 'RUNNING', 'PAUSED', 'ENDED', 'GAMEOVER'],
            MatchStatuses::ALL
        );
    }

    public function testIsValid(): void
    {
        $this->assertTrue(MatchStatuses::isValid('ENDED'));
        $this->assertTrue(MatchStatuses::isValid('CREATED'));
        $this->assertFalse(MatchStatuses::isValid('BOGUS'));
        $this->assertFalse(MatchStatuses::isValid(null));
    }

    public function testIsTerminal(): void
    {
        $this->assertTrue(MatchStatuses::isTerminal('ENDED'));
        $this->assertTrue(MatchStatuses::isTerminal('GAMEOVER'));
        $this->assertFalse(MatchStatuses::isTerminal('RUNNING'));
        $this->assertFalse(MatchStatuses::isTerminal(null));
    }
}
