<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Integration;

use Games\Paths\Adapter\Persistence\Story\StoryMysqlPersistenceRepository;

class StoryMysqlPersistenceRepositoryTest extends DatabaseIntegrationTestCase
{
    private StoryMysqlPersistenceRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repository = new StoryMysqlPersistenceRepository($this->pdo);
    }

    public function testSaveAndFindStory(): void
    {
        $data = [
            'uuid' => 'story-123',
            'author' => 'Author Name',
            'category' => 'Fantasy',
            'visibility' => 'PUBLIC',
            'priority' => 10,
        ];

        $id = $this->repository->saveStory($data);
        $this->assertGreaterThan(0, $id);

        $foundId = $this->repository->findStoryIdByUuid('story-123');
        $this->assertSame($id, $foundId);
    }

    public function testDeleteStory(): void
    {
        $id = $this->repository->saveStory(['uuid' => 'to-delete', 'visibility' => 'DRAFT']);
        $this->repository->deleteStoryById($id);

        $this->assertNull($this->repository->findStoryIdByUuid('to-delete'));
    }

    public function testSaveEntityGeneric(): void
    {
        $storyId = $this->repository->saveStory(['uuid' => 'story-entity', 'visibility' => 'DRAFT']);
        
        // Test list_locations
        $locationData = [
            'uuid' => 'loc-1',
            'idTextName' => 101,
            'idTextDescription' => 201,
            'isSafe' => 1,
            'maxCharacters' => 4
        ];
        
        $this->repository->saveEntity($storyId, 'list_locations', $locationData);
        
        $stmt = $this->pdo->prepare("SELECT * FROM list_locations WHERE uuid = 'loc-1'");
        $stmt->execute();
        $row = $stmt->fetch();
        
        $this->assertNotFalse($row);
        $this->assertEquals(101, $row['id_text_name']);
        $this->assertEquals(1, $row['is_safe']);
    }

    public function testUpdateEntityGeneric(): void
    {
        $storyId = $this->repository->saveStory(['uuid' => 'story-upd', 'visibility' => 'DRAFT']);
        
        $this->repository->saveEntity($storyId, 'list_locations', [
            'uuid' => 'loc-upd',
            'isSafe' => 0
        ]);
        
        $this->repository->updateEntity($storyId, 'list_locations', 'loc-upd', [
            'isSafe' => 1,
            'maxCharacters' => 10
        ]);
        
        $stmt = $this->pdo->prepare("SELECT * FROM list_locations WHERE uuid = 'loc-upd'");
        $stmt->execute();
        $row = $stmt->fetch();
        
        $this->assertEquals(1, $row['is_safe']);
        $this->assertEquals(10, $row['max_characters']);
    }

    public function testDeleteEntityByUuid(): void
    {
        $storyId = $this->repository->saveStory(['uuid' => 'story-del', 'visibility' => 'DRAFT']);
        $this->repository->saveEntity($storyId, 'list_locations', ['uuid' => 'loc-to-del']);
        
        $this->repository->deleteEntityByUuid('list_locations', 'loc-to-del');
        
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM list_locations WHERE uuid = 'loc-to-del'");
        $stmt->execute();
        $this->assertEquals(0, $stmt.fetchColumn());
    }
}
