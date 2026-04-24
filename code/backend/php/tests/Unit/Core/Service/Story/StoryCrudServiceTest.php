<?php

declare(strict_types=1);

namespace Tests\Unit\Core\Service\Story;

use PHPUnit\Framework\TestCase;
use Games\Paths\Core\Service\Story\StoryCrudService;
use Games\Paths\Core\Port\Story\StoryReadPort;
use Games\Paths\Core\Port\Story\StoryPersistencePort;

/**
 * Tests for StoryCrudService — Step 17 admin CRUD.
 * Covers all branches: validation, dispatch, story-level CRUD, entity CRUD.
 */
class StoryCrudServiceTest extends TestCase
{
    private $readPort;
    private $persistPort;
    private StoryCrudService $service;

    protected function setUp(): void
    {
        $this->readPort = $this->createMock(StoryReadPort::class);
        $this->persistPort = $this->createMock(StoryPersistencePort::class);
        $this->service = new TestableStoryCrudService($this->readPort, $this->persistPort);
    }

    // === listEntities ===

    public function testListEntities_emptyUuid_returnsNull(): void
    {
        $this->assertNull($this->service->listEntities('', 'locations'));
    }

    public function testListEntities_emptyType_returnsNull(): void
    {
        $this->assertNull($this->service->listEntities('s-uuid', ''));
    }

    public function testListEntities_storyNotFound_returnsNull(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(null);
        $this->assertNull($this->service->listEntities('bad', 'locations'));
    }

    public function testListEntities_unknownType_returnsEmpty(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $result = $this->service->listEntities('s1', 'unknown');
        $this->assertEquals([], $result);
    }

    public function testListEntities_locations_returnsList(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findLocationsForStory')->willReturn([['uuid' => 'loc1']]);
        $result = $this->service->listEntities('s1', 'locations');
        $this->assertCount(1, $result);
    }

    /**
     * @dataProvider entityTypeProvider
     */
    public function testListEntities_allTypes_callsCorrectMethod(string $type, string $method): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method($method)->willReturn([['uuid' => 'x']]);
        $result = $this->service->listEntities('s1', $type);
        $this->assertCount(1, $result);
    }

    public static function entityTypeProvider(): array
    {
        return [
            ['difficulties', 'findDifficultiesForStory'],
            ['events', 'findEventsForStory'],
            ['items', 'findItemsForStory'],
            ['character-templates', 'findCharacterTemplatesForStory'],
            ['classes', 'findClassesForStory'],
            ['traits', 'findTraitsForStory'],
            ['creators', 'findCreatorsForStory'],
            ['cards', 'findCardsForStory'],
            ['texts', 'findTextsForStory'],
        ];
    }

    // === getEntity ===

    public function testGetEntity_emptyParams_returnsNull(): void
    {
        $this->assertNull($this->service->getEntity('', 'locations', 'eu'));
        $this->assertNull($this->service->getEntity('su', '', 'eu'));
        $this->assertNull($this->service->getEntity('su', 'locations', ''));
    }

    public function testGetEntity_storyNotFound_returnsNull(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(null);
        $this->assertNull($this->service->getEntity('bad', 'locations', 'eu'));
    }

    public function testGetEntity_unknownType_returnsNull(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->assertNull($this->service->getEntity('s1', 'unknown', 'eu'));
    }

    public function testGetEntity_returnsEntity(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findEntityByStoryAndUuid')->willReturn(['uuid' => 'e1']);
        $result = $this->service->getEntity('s1', 'locations', 'e1');
        $this->assertEquals(['uuid' => 'e1'], $result);
    }

    // === createEntity ===

    public function testCreateEntity_emptyParams_returnsNull(): void
    {
        $this->assertNull($this->service->createEntity('', 'locations', ['k' => 'v']));
        $this->assertNull($this->service->createEntity('su', '', ['k' => 'v']));
        $this->assertNull($this->service->createEntity('su', 'locations', []));
    }

    public function testCreateEntity_storyNotFound_returnsNull(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(null);
        $this->assertNull($this->service->createEntity('bad', 'locations', ['k' => 'v']));
    }

    public function testCreateEntity_unknownType_returnsNull(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->assertNull($this->service->createEntity('s1', 'unknown', ['k' => 'v']));
    }

    public function testCreateEntity_success(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findEntityByStoryAndUuid')->willReturn(['uuid' => 'fixed-uuid']);
        $this->persistPort->expects($this->once())->method('saveEntity');
        $result = $this->service->createEntity('s1', 'locations', ['isSafe' => 1]);
        $this->assertEquals('fixed-uuid', $result['uuid']);
    }

    // === updateEntity ===

    public function testUpdateEntity_emptyParams_returnsNull(): void
    {
        $this->assertNull($this->service->updateEntity('', 'locations', 'eu', ['k' => 'v']));
        $this->assertNull($this->service->updateEntity('su', '', 'eu', ['k' => 'v']));
        $this->assertNull($this->service->updateEntity('su', 'locations', '', ['k' => 'v']));
        $this->assertNull($this->service->updateEntity('su', 'locations', 'eu', []));
    }

    public function testUpdateEntity_storyNotFound_returnsNull(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(null);
        $this->assertNull($this->service->updateEntity('bad', 'locations', 'eu', ['k' => 'v']));
    }

    public function testUpdateEntity_unknownType_returnsNull(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->assertNull($this->service->updateEntity('s1', 'unknown', 'eu', ['k' => 'v']));
    }

    public function testUpdateEntity_entityNotFound_returnsNull(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findEntityByStoryAndUuid')->willReturn(null);
        $this->assertNull($this->service->updateEntity('s1', 'locations', 'eu', ['k' => 'v']));
    }

    public function testUpdateEntity_success(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findEntityByStoryAndUuid')->willReturn(['uuid' => 'eu']);
        $this->persistPort->expects($this->once())->method('updateEntity');
        $result = $this->service->updateEntity('s1', 'locations', 'eu', ['isSafe' => 0]);
        $this->assertNotNull($result);
    }

    // === deleteEntity ===

    public function testDeleteEntity_emptyParams_returnsFalse(): void
    {
        $this->assertFalse($this->service->deleteEntity('', 'locations', 'eu'));
        $this->assertFalse($this->service->deleteEntity('su', '', 'eu'));
        $this->assertFalse($this->service->deleteEntity('su', 'locations', ''));
    }

    public function testDeleteEntity_storyNotFound_returnsFalse(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(null);
        $this->assertFalse($this->service->deleteEntity('bad', 'locations', 'eu'));
    }

    public function testDeleteEntity_unknownType_returnsFalse(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->assertFalse($this->service->deleteEntity('s1', 'unknown', 'eu'));
    }

    public function testDeleteEntity_entityNotFound_returnsFalse(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findEntityByStoryAndUuid')->willReturn(null);
        $this->assertFalse($this->service->deleteEntity('s1', 'locations', 'eu'));
    }

    public function testDeleteEntity_success(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findEntityByStoryAndUuid')->willReturn(['uuid' => 'eu']);
        $this->persistPort->expects($this->once())->method('deleteEntityByUuid');
        $this->assertTrue($this->service->deleteEntity('s1', 'locations', 'eu'));
    }

    // === createStory ===

    public function testCreateStory_emptyData_returnsNull(): void
    {
        $this->assertNull($this->service->createStory([]));
    }

    public function testCreateStory_success(): void
    {
        $this->persistPort->expects($this->once())->method('saveStory');
        $this->readPort->method('findStoryByUuid')->willReturn(['uuid' => 'fixed-uuid', 'id' => 42]);
        $result = $this->service->createStory(['author' => 'Test']);
        $this->assertEquals('fixed-uuid', $result['uuid']);
    }

    // === updateStory ===

    public function testUpdateStory_emptyParams_returnsNull(): void
    {
        $this->assertNull($this->service->updateStory('', ['k' => 'v']));
        $this->assertNull($this->service->updateStory('uuid', []));
    }

    public function testUpdateStory_storyNotFound_returnsNull(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(null);
        $this->assertNull($this->service->updateStory('bad', ['k' => 'v']));
    }

    public function testUpdateStory_success(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->persistPort->expects($this->once())->method('updateStoryById');
        $result = $this->service->updateStory('s1', ['author' => 'Updated']);
        $this->assertNotNull($result);
    }
}

/**
 * Testable subclass that overrides UUID generation.
 */
class TestableStoryCrudService extends StoryCrudService
{
    protected function generateUuid(): string
    {
        return 'fixed-uuid';
    }
}
