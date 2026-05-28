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
        $this->persistencePort->method('existsStoryId')->willReturn(false);

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

        $this->persistencePort->method('existsStoryId')->willReturn(false);
        $this->persistencePort->method('existsEntityId')->willReturn(false);
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

    public function testImportStoryFullCoverage(): void
    {
        $data = [
            'uuid' => 'u-full',
            'keys' => [['name' => 'k1']],
            'traits' => [['idTextName' => 1]],
            'characterTemplates' => [['idTextName' => 2]],
            'weatherRules' => [['idTextName' => 3]],
            'globalRandomEvents' => [['probability' => 0.5]],
            'missions' => [['idTextName' => 10, 'steps' => [['stepOrder' => 1]]]],
            'creators' => [['creator_name' => 'C1']],
            'cards' => [['card_type' => 'T1']]
        ];

        $this->persistencePort->method('existsStoryId')->willReturn(false);
        $this->persistencePort->method('existsEntityId')->willReturn(false);
        $this->persistencePort->expects($this->once())->method('saveKeys');
        $this->persistencePort->expects($this->once())->method('saveTraits');
        $this->persistencePort->expects($this->once())->method('saveCharacterTemplates');
        $this->persistencePort->expects($this->once())->method('saveWeatherRules');
        $this->persistencePort->expects($this->once())->method('saveGlobalRandomEvents');
        $this->persistencePort->expects($this->once())->method('saveMissions');
        $this->persistencePort->expects($this->once())->method('saveCreators');
        $this->persistencePort->expects($this->once())->method('saveCards');

        $this->service->importStory($data);
    }

    // === NEW TESTS: Explicit-ID import ===

    public function testImportStoryWithExplicitStoryId(): void
    {
        $this->persistencePort->method('existsStoryId')->willReturn(false);
        $this->persistencePort->method('existsEntityId')->willReturn(false);
        $this->persistencePort->method('saveStory')->willReturn(990001);

        $data = ['uuid' => 'u-exp', 'id' => 990001, 'author' => 'robot'];
        $result = $this->service->importStory($data);
        $this->assertSame('IMPORTED', $result->status);
    }

    public function testImportStoryDuplicateStoryIdRaises(): void
    {
        $this->persistencePort->method('existsStoryId')->willReturn(true);
        $this->persistencePort->method('findStoryIdByUuid')->willReturn(null);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('story/list_stories id=990001 already present');

        $data = ['uuid' => 'u-dup', 'id' => 990001, 'author' => 'robot'];
        $this->service->importStory($data);
    }

    public function testImportStoryWithExplicitEntityIds(): void
    {
        $this->persistencePort->method('existsStoryId')->willReturn(false);
        $this->persistencePort->method('existsEntityId')->willReturn(false);
        $this->persistencePort->method('saveStory')->willReturn(1);

        $data = [
            'uuid' => 'u-ent-id',
            'texts' => [['id' => 971001, 'idText' => 1, 'lang' => 'en', 'shortText' => 'T1']],
            'events' => [['id' => 971010, 'type' => 'NORMAL']],
        ];
        $result = $this->service->importStory($data);
        $this->assertSame('IMPORTED', $result->status);
    }

    public function testImportStoryDuplicateEntityIdRaises(): void
    {
        $this->persistencePort->method('existsStoryId')->willReturn(false);
        $this->persistencePort->method('existsEntityId')->willReturn(true);
        $this->persistencePort->method('saveStory')->willReturn(1);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('story/list_texts id=971001 already present');

        $data = [
            'uuid' => 'u-ent-dup',
            'texts' => [['id' => 971001, 'idText' => 1, 'lang' => 'en', 'shortText' => 'T1']],
        ];
        $this->service->importStory($data);
    }

    public function testImportStorySyncSequencesCalled(): void
    {
        $this->persistencePort->method('existsStoryId')->willReturn(false);
        $this->persistencePort->method('existsEntityId')->willReturn(false);
        $this->persistencePort->method('saveStory')->willReturn(1);
        $this->persistencePort->expects($this->once())->method('syncSequences');

        $data = ['uuid' => 'u-sync', 'author' => 'robot'];
        $this->service->importStory($data);
    }
}
