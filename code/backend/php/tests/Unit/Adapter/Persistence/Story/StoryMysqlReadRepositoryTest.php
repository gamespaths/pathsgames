<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Persistence\Story;

use Games\Paths\Adapter\Persistence\Story\StoryMysqlReadRepository;
use PDO;
use PDOStatement;
use PHPUnit\Framework\TestCase;

class StoryMysqlReadRepositoryTest extends TestCase
{
    private $pdo;
    private $repository;

    protected function setUp(): void
    {
        $this->pdo = $this->createMock(PDO::class);
        $this->repository = new StoryMysqlReadRepository($this->pdo);
    }

    private function mockQuery(string $method, array $return): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method($method)->willReturn($return);
        $this->pdo->method('query')->willReturn($stmt);
    }

    private function mockPrepare(string $method, $return): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method($method)->willReturn($return);
        $this->pdo->method('prepare')->willReturn($stmt);
    }

    public function testFindPublicStories(): void
    {
        $this->mockQuery('fetchAll', [['uuid' => 's1']]);
        $result = $this->repository->findPublicStories();
        $this->assertCount(1, $result);
    }

    public function testFindAllStories(): void
    {
        $this->mockQuery('fetchAll', [['uuid' => 's1'], ['uuid' => 's2']]);
        $result = $this->repository->findAllStories();
        $this->assertCount(2, $result);
    }

    public function testFindStoryByUuid(): void
    {
        $this->mockPrepare('fetch', ['uuid' => 's1']);
        $result = $this->repository->findStoryByUuid('s1');
        $this->assertNotNull($result);
        
        $this->setUp(); // reset pdo
        $this->mockPrepare('fetch', false);
        $result = $this->repository->findStoryByUuid('s1');
        $this->assertNull($result);
    }

    public function testFindTextsForStory(): void
    {
        $this->mockPrepare('fetchAll', [['id' => 1]]);
        $result = $this->repository->findTextsForStory(1);
        $this->assertCount(1, $result);
    }

    public function testFindDifficultiesForStory(): void
    {
        $this->mockPrepare('fetchAll', [['id' => 1]]);
        $result = $this->repository->findDifficultiesForStory(1);
        $this->assertCount(1, $result);
    }

    public function testCountLocationsForStory(): void
    {
        $this->mockPrepare('fetchColumn', 5);
        $result = $this->repository->countLocationsForStory(1);
        $this->assertSame(5, $result);
    }

    public function testCountEventsForStory(): void
    {
        $this->mockPrepare('fetchColumn', 5);
        $result = $this->repository->countEventsForStory(1);
        $this->assertSame(5, $result);
    }

    public function testCountItemsForStory(): void
    {
        $this->mockPrepare('fetchColumn', 5);
        $result = $this->repository->countItemsForStory(1);
        $this->assertSame(5, $result);
    }

    public function testFindUniqueCategories(): void
    {
        $this->mockQuery('fetchAll', [['category' => 'A'], ['category' => 'B']]);
        $result = $this->repository->findUniqueCategories();
        $this->assertSame(['A', 'B'], $result);
    }

    public function testFindUniqueGroups(): void
    {
        $this->mockQuery('fetchAll', [['group_name' => 'A']]);
        $result = $this->repository->findUniqueGroups();
        $this->assertSame(['A'], $result);
    }

    public function testFindStoriesByCategory(): void
    {
        $this->mockPrepare('fetchAll', [['uuid' => 's1']]);
        $result = $this->repository->findStoriesByCategory('A');
        $this->assertCount(1, $result);
    }

    public function testFindStoriesByGroup(): void
    {
        $this->mockPrepare('fetchAll', [['uuid' => 's1']]);
        $result = $this->repository->findStoriesByGroup('A');
        $this->assertCount(1, $result);
    }

    public function testFindClassesForStory(): void
    {
        $this->mockPrepare('fetchAll', [['id' => 1]]);
        $result = $this->repository->findClassesForStory(1);
        $this->assertCount(1, $result);
    }

    public function testFindCharacterTemplatesForStory(): void
    {
        $this->mockPrepare('fetchAll', [['id' => 1]]);
        $result = $this->repository->findCharacterTemplatesForStory(1);
        $this->assertCount(1, $result);
    }

    public function testFindTraitsForStory(): void
    {
        $this->mockPrepare('fetchAll', [['id' => 1]]);
        $result = $this->repository->findTraitsForStory(1);
        $this->assertCount(1, $result);
    }

    public function testFindCardForStory(): void
    {
        $this->mockPrepare('fetch', ['id' => 1]);
        $result = $this->repository->findCardForStory(1, 1);
        $this->assertNotNull($result);
        
        $this->setUp(); // reset pdo
        $this->mockPrepare('fetch', false);
        $result = $this->repository->findCardForStory(1, 1);
        $this->assertNull($result);
    }

    public function testFindCardByStoryIdAndUuid(): void
    {
        $this->mockPrepare('fetch', ['id' => 1]);
        $result = $this->repository->findCardByStoryIdAndUuid(1, 'u1');
        $this->assertNotNull($result);
        
        $this->setUp(); // reset pdo
        $this->mockPrepare('fetch', false);
        $result = $this->repository->findCardByStoryIdAndUuid(1, 'u1');
        $this->assertNull($result);
    }

    public function testFindTextByStoryIdTextAndLang(): void
    {
        $this->mockPrepare('fetch', ['id' => 1]);
        $result = $this->repository->findTextByStoryIdTextAndLang(1, 1, 'en');
        $this->assertNotNull($result);
        
        $this->setUp(); // reset pdo
        $this->mockPrepare('fetch', false);
        $result = $this->repository->findTextByStoryIdTextAndLang(1, 1, 'en');
        $this->assertNull($result);
    }

    public function testFindCreatorByStoryIdAndUuid(): void
    {
        $this->mockPrepare('fetch', ['id' => 1]);
        $result = $this->repository->findCreatorByStoryIdAndUuid(1, 'u1');
        $this->assertNotNull($result);
        
        $this->setUp(); // reset pdo
        $this->mockPrepare('fetch', false);
        $result = $this->repository->findCreatorByStoryIdAndUuid(1, 'u1');
        $this->assertNull($result);
    }

    public function testFindCreatorsForStory(): void
    {
        $this->mockPrepare('fetchAll', [['id' => 1]]);
        $result = $this->repository->findCreatorsForStory(1);
        $this->assertCount(1, $result);
    }

    public function testFindLocationsForStory(): void
    {
        $this->mockPrepare('fetchAll', [['id' => 1]]);
        $result = $this->repository->findLocationsForStory(1);
        $this->assertCount(1, $result);
    }

    public function testFindEventsForStory(): void
    {
        $this->mockPrepare('fetchAll', [['id' => 1]]);
        $result = $this->repository->findEventsForStory(1);
        $this->assertCount(1, $result);
    }

    public function testFindItemsForStory(): void
    {
        $this->mockPrepare('fetchAll', [['id' => 1]]);
        $result = $this->repository->findItemsForStory(1);
        $this->assertCount(1, $result);
    }

    public function testFindCardsForStory(): void
    {
        $this->mockPrepare('fetchAll', [['id' => 1]]);
        $result = $this->repository->findCardsForStory(1);
        $this->assertCount(1, $result);
    }

    public function testFindEntityByStoryAndUuid(): void
    {
        $this->mockPrepare('fetch', ['id' => 1]);
        $result = $this->repository->findEntityByStoryAndUuid(1, 'list_cards', 'u1');
        $this->assertNotNull($result);
        
        $result = $this->repository->findEntityByStoryAndUuid(1, 'invalid_table', 'u1');
        $this->assertNull($result);
    }

    public function testFindEntitiesByStory(): void
    {
        $this->mockPrepare('fetchAll', [['id' => 1]]);
        $result = $this->repository->findEntitiesByStory(1, 'list_cards');
        $this->assertCount(1, $result);
        
        $result = $this->repository->findEntitiesByStory(1, 'invalid_table');
        $this->assertCount(0, $result);
    }
}
