<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Domain\Matches;

use Games\Paths\Core\Domain\Matches\MatchTraitCodec;
use PHPUnit\Framework\TestCase;

class MatchTraitCodecTest extends TestCase
{
    public function testJoinNullOrEmptyReturnsNull(): void
    {
        $this->assertNull(MatchTraitCodec::join(null));
        $this->assertNull(MatchTraitCodec::join([]));
    }

    public function testJoinAllBlankReturnsNull(): void
    {
        $this->assertNull(MatchTraitCodec::join(['', '  ']));
    }

    public function testJoinKeepsAndTrimsNonBlankValues(): void
    {
        $this->assertSame('a,b', MatchTraitCodec::join(['a', '', '  b  ']));
    }

    public function testSplitNullOrBlankReturnsEmptyList(): void
    {
        $this->assertSame([], MatchTraitCodec::split(null));
        $this->assertSame([], MatchTraitCodec::split('   '));
    }

    public function testSplitParsesTrimsAndDropsBlanks(): void
    {
        $this->assertSame(['a', 'b'], MatchTraitCodec::split(' a , ,b, '));
    }
}
