<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Service\Story;

use Games\Paths\Core\Port\Story\StoryReadPort;
use Games\Paths\Core\Service\Story\StoryQueryService;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class StoryQueryServiceTest extends TestCase
{
    private StoryReadPort&MockObject $readPort;
    private StoryQueryService $service;

    protected function setUp(): void
    {
        $this->readPort = $this->createMock(StoryReadPort::class);
        $this->service = new StoryQueryService($this->readPort);
    }

    public function testListPublicStoriesEmpty(): void
    {
        $this->readPort->method('findPublicStories')->willReturn([]);
        $this->assertEmpty($this->service->listPublicStories());
    }

    public function testListPublicStoriesWithData(): void
    {
        $this->readPort->method('findPublicStories')->willReturn([
            ['id' => 1, 'uuid' => 'u1', 'id_text_title' => 10]
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([
            ['id_text' => 10, 'lang' => 'en', 'short_text' => 'Story T']
        ]);
        $this->readPort->method('findDifficultiesForStory')->willReturn([]);

        $results = $this->service->listPublicStories();
        $this->assertCount(1, $results);
        $this->assertSame('Story T', $results[0]->title);
        $this->assertSame('u1', $results[0]->uuid);
    }

    public function testListAllStories(): void
    {
        $this->readPort->method('findAllStories')->willReturn([
            ['id' => 1, 'uuid' => 'u1', 'visibility' => 'PRIVATE']
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([]);
        $this->readPort->method('findDifficultiesForStory')->willReturn([]);

        $results = $this->service->listAllStories();
        $this->assertCount(1, $results);
        $this->assertSame('PRIVATE', $results[0]->visibility);
    }

    public function testGetStoryDetailNotFound(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(null);
        $this->assertNull($this->service->getStoryDetail('u1'));
    }

    public function testGetStoryDetailSuccess(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn([
            'id' => 1, 'uuid' => 'u1', 'id_text_title' => 10, 'peghi' => 2
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([
            ['id_text' => 10, 'lang' => 'en', 'long_text' => 'Title Long']
        ]);
        $this->readPort->method('findDifficultiesForStory')->willReturn([
            ['uuid' => 'd1', 'exp_cost' => 5]
        ]);
        $this->readPort->method('countLocationsForStory')->willReturn(5);

        $detail = $this->service->getStoryDetail('u1', 'en');

        $this->assertNotNull($detail);
        $this->assertSame('Title Long', $detail->title);
        $this->assertSame(2, $detail->peghi);
        $this->assertSame(5, $detail->locationCount);
        $this->assertCount(1, $detail->difficulties);
        $this->assertSame(5, $detail->difficulties[0]->expCost);
    }

    public function testResolveTextFallback(): void
    {
        $texts = [
            ['id_text' => 10, 'lang' => 'it', 'short_text' => 'Titolo']
        ];
        $this->assertSame('Titolo', $this->service->resolveText($texts, 10, 'en'));
    }

    public function testResolveTextEnFallback(): void
    {
        $texts = [
            ['id_text' => 10, 'lang' => 'it', 'short_text' => 'Titolo'],
            ['id_text' => 10, 'lang' => 'en', 'short_text' => 'Title']
        ];
        $this->assertSame('Title', $this->service->resolveText($texts, 10, 'fr'));
    }

    public function testResolveTextNullId(): void
    {
        $this->assertNull($this->service->resolveText([], null, 'en'));
    }

    public function testResolveTextNoCandidates(): void
    {
        $this->assertNull($this->service->resolveText([['id_text' => 99]], 10, 'en'));
    }
}
