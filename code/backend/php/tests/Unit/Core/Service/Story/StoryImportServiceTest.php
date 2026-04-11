<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Service\Story;

use Games\Paths\Core\Port\Story\StoryPersistencePort;
use Games\Paths\Core\Service\Story\StoryImportService;
use InvalidArgumentException;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class StoryImportServiceTest extends TestCase
{
    private StoryPersistencePort&MockObject $persistencePort;
    private StoryImportService $service;

    protected function setUp(): void
    {
        $this->persistencePort = $this->createMock(StoryPersistencePort::class);
        $this->service = new StoryImportService($this->persistencePort);
    }

    public function testDeleteStoryNotFound(): void
    {
        $this->persistencePort->method('findStoryIdByUuid')->willReturn(null);
        $this->assertFalse($this->service->deleteStory('x'));
    }

    public function testDeleteStoryEmptyUuid(): void
    {
        $this->assertFalse($this->service->deleteStory(''));
        $this->assertFalse($this->service->deleteStory('   '));
    }

    public function testDeleteStorySuccess(): void
    {
        $this->persistencePort->method('findStoryIdByUuid')->willReturn(1);
        $this->persistencePort->expects($this->once())->method('deleteStoryById')->with(1);
        $this->assertTrue($this->service->deleteStory('x'));
    }

    public function testImportStoryEmptyData(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->service->importStory([]);
    }

    public function testImportStoryAutoUuid(): void
    {
        $this->persistencePort->method('findStoryIdByUuid')->willReturn(null);
        
        $this->persistencePort->expects($this->once())
            ->method('saveStory')
            ->willReturn(1);

        $result = $this->service->importStory(['title' => 'x']);

        $this->assertSame('IMPORTED', $result->status);
        $this->assertNotEmpty($result->storyUuid);
    }

    public function testImportStoryWithSubEntities(): void
    {
        $data = [
            'uuid' => 'u1',
            'texts' => [['idText' => 1]],
            'difficulties' => [['idTextDescription' => 2]],
            'locations' => [['idTextName' => 3, 'neighbors' => [['idLocationTo' => 2]]]],
            'events' => [['idTextName' => 4, 'effects' => [['type' => 'DMG']]]],
            'items' => [['idTextName' => 5, 'effects' => [['type' => 'HEAL']]]],
            'classes' => [['idTextName' => 6, 'bonuses' => [['type' => 'STR']]]],
            'choices' => [['idEvent' => 7, 'conditions' => [['type' => 'EQ']], 'effects' => [['type' => 'X']]]],
            'missions' => [['idTextName' => 8, 'steps' => [['stepOrder' => 1]]]]
        ];

        $this->persistencePort->expects($this->once())->method('saveTexts');
        $this->persistencePort->expects($this->once())->method('saveDifficulties');
        $this->persistencePort->expects($this->once())->method('saveLocations');
        $this->persistencePort->expects($this->once())->method('saveEvents');
        $this->persistencePort->expects($this->once())->method('saveItems');
        $this->persistencePort->expects($this->once())->method('saveClasses');
        $this->persistencePort->expects($this->once())->method('saveChoices');
        $this->persistencePort->expects($this->once())->method('saveMissions');

        $result = $this->service->importStory($data);

        $this->assertSame('u1', $result->storyUuid);
        $this->assertSame(1, $result->textsImported);
        $this->assertSame(1, $result->eventsImported);
        $this->assertSame(1, $result->difficultiesImported);
    }
}
