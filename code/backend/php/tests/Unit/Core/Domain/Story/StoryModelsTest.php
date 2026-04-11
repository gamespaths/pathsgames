<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Domain\Story;

use Games\Paths\Core\Domain\Story\DifficultyInfo;
use Games\Paths\Core\Domain\Story\StoryDetail;
use Games\Paths\Core\Domain\Story\StoryImportResult;
use Games\Paths\Core\Domain\Story\StorySummary;
use PHPUnit\Framework\TestCase;

class StoryModelsTest extends TestCase
{
    public function testStorySummaryDefaults(): void
    {
        $summary = new StorySummary('u1');
        $this->assertSame(0, $summary->priority);
        $this->assertNull($summary->title);
    }

    public function testDifficultyInfoDefaults(): void
    {
        $diff = new DifficultyInfo('u1');
        $this->assertSame(5, $diff->expCost);
        $this->assertSame(10, $diff->maxWeight);
    }

    public function testStoryDetailDefaults(): void
    {
        $detail = new StoryDetail('u1');
        $this->assertSame(0, $detail->locationCount);
        $this->assertIsArray($detail->difficulties);
        $this->assertEmpty($detail->difficulties);
    }

    public function testStoryImportResultDefaults(): void
    {
        $result = new StoryImportResult('u1', 'IMPORTED');
        $this->assertSame(0, $result->textsImported);
        $this->assertSame(0, $result->locationsImported);
    }
}
