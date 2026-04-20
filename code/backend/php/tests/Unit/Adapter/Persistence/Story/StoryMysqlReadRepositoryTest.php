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

    public function testFindPublicStories(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('fetchAll')->willReturn([['uuid' => 's1']]);
        
        $this->pdo->method('query')->with($this->stringContains("visibility = 'PUBLIC'"))->willReturn($stmt);

        $result = $this->repository->findPublicStories();
        $this->assertCount(1, $result);
        $this->assertSame('s1', $result[0]['uuid']);
    }

    public function testFindAllStories(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('fetchAll')->willReturn([['uuid' => 's1'], ['uuid' => 's2']]);
        
        $this->pdo->method('query')->with($this->stringContains("SELECT * FROM list_stories"))->willReturn($stmt);

        $result = $this->repository->findAllStories();
        $this->assertCount(2, $result);
    }

    public function testFindStoryByUuid(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('fetch')->willReturn(['uuid' => 's1']);
        
        $this->pdo->method('prepare')->willReturn($stmt);
        $stmt->expects($this->once())->method('execute')->with([':uuid' => 's1']);

        $result = $this->repository->findStoryByUuid('s1');
        $this->assertSame('s1', $result['uuid']);
    }

    public function testFindStoryByUuidNotFound(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('fetch')->willReturn(false);
        
        $this->pdo->method('prepare')->willReturn($stmt);

        $result = $this->repository->findStoryByUuid('missing');
        $this->assertNull($result);
    }

    public function testCountLocationsForStory(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('fetchColumn')->willReturn(5);
        
        $this->pdo->method('prepare')->willReturn($stmt);

        $result = $this->repository->countLocationsForStory(123);
        $this->assertSame(5, $result);
    }

    public function testFindUniqueCategories(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('fetchAll')->willReturn([['category' => 'A'], ['category' => 'B']]);
        
        $this->pdo->method('query')->willReturn($stmt);

        $result = $this->repository->findUniqueCategories();
        $this->assertSame(['A', 'B'], $result);
    }
}
