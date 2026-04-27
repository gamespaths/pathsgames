<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Persistence\Story;

use Games\Paths\Adapter\Persistence\Story\StoryMysqlPersistenceRepository;
use PDO;
use PDOStatement;
use PHPUnit\Framework\TestCase;

class StoryMysqlPersistenceRepositoryTest extends TestCase
{
    private $pdo;
    private $repository;

    protected function setUp(): void
    {
        $this->pdo = $this->createMock(PDO::class);
        $this->repository = new StoryMysqlPersistenceRepository($this->pdo);
    }

    private function getStmt(): PDOStatement
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('execute')->willReturn(true);
        return $stmt;
    }

    public function testFindStoryIdByUuid(): void
    {
        $stmt = $this->getStmt();
        $stmt->method('fetchColumn')->willReturn(1);
        $this->pdo->method('prepare')->willReturn($stmt);
        
        $this->assertSame(1, $this->repository->findStoryIdByUuid('u1'));
    }

    public function testFindStoryIdByUuidNotFound(): void
    {
        $stmt = $this->getStmt();
        $stmt->method('fetchColumn')->willReturn(false);
        $this->pdo->method('prepare')->willReturn($stmt);
        
        $this->assertNull($this->repository->findStoryIdByUuid('u1'));
    }

    public function testDeleteStoryById(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        
        $this->repository->deleteStoryById(1);
        $this->assertTrue(true);
    }

    public function testSaveStory(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        $this->pdo->method('lastInsertId')->willReturn('1');
        
        $this->assertSame(1, $this->repository->saveStory(['uuid' => 'u1']));
    }

    public function testSaveTexts(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        
        $this->repository->saveTexts(1, [['idText' => 1]]);
        $this->assertTrue(true);
    }

    public function testSaveDifficulties(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        
        $this->repository->saveDifficulties(1, [['uuid' => 'u1']]);
        $this->assertTrue(true);
    }

    public function testSaveLocations(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        $this->pdo->method('lastInsertId')->willReturn('1');
        
        $this->repository->saveLocations(1, [['idTextName' => 1, 'neighbors' => [['idLocationTo' => 2]]]]);
        $this->assertTrue(true);
    }

    public function testSaveEvents(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        $this->pdo->method('lastInsertId')->willReturn('1');
        
        $this->repository->saveEvents(1, [['idTextName' => 1, 'effects' => [['effectType' => 'HEAL']]]]);
        $this->assertTrue(true);
    }

    public function testSaveItems(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        $this->pdo->method('lastInsertId')->willReturn('1');
        
        $this->repository->saveItems(1, [['idTextName' => 1, 'effects' => [['effectType' => 'HEAL']]]]);
        $this->assertTrue(true);
    }

    public function testSaveClasses(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        $this->pdo->method('lastInsertId')->willReturn('1');
        
        $this->repository->saveClasses(1, [['idTextName' => 1, 'bonuses' => [['bonusType' => 'HEAL']]]]);
        $this->assertTrue(true);
    }

    public function testSaveChoices(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        $this->pdo->method('lastInsertId')->willReturn('1');
        
        $this->repository->saveChoices(1, [['idTextName' => 1, 'conditions' => [['conditionType' => 'A']], 'effects' => [['effectType' => 'B']]]]);
        $this->assertTrue(true);
    }

    public function testSaveCards(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        $this->pdo->method('lastInsertId')->willReturn('1');
        
        $this->repository->saveCards(1, [['idTextName' => 1]]);
        $this->assertTrue(true);
    }

    public function testSaveKeys(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        
        $this->repository->saveKeys(1, [['keyName' => 'k']]);
        $this->assertTrue(true);
    }

    public function testSaveTraits(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        
        $this->repository->saveTraits(1, [['idTextName' => 1]]);
        $this->assertTrue(true);
    }

    public function testSaveCharacterTemplates(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        
        $this->repository->saveCharacterTemplates(1, [['idTextName' => 1]]);
        $this->assertTrue(true);
    }

    public function testSaveWeatherRules(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        
        $this->repository->saveWeatherRules(1, [['idTextName' => 1]]);
        $this->assertTrue(true);
    }

    public function testSaveGlobalRandomEvents(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        
        $this->repository->saveGlobalRandomEvents(1, [['idTextName' => 1]]);
        $this->assertTrue(true);
    }

    public function testSaveMissions(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        $this->pdo->method('lastInsertId')->willReturn('1');
        
        $this->repository->saveMissions(1, [['idTextName' => 1, 'steps' => [['stepOrder' => 1]]]]);
        $this->assertTrue(true);
    }

    public function testSaveCreators(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        
        $this->repository->saveCreators(1, [['idText' => 1]]);
        $this->assertTrue(true);
    }

    public function testSaveEntity(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        
        $this->repository->saveEntity(1, 'list_cards', ['uuid' => 'u1', 'idCard' => 1]);
        $this->repository->saveEntity(1, 'invalid_table', ['uuid' => 'u1']);
        $this->assertTrue(true);
    }

    public function testUpdateEntity(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        
        $this->repository->updateEntity(1, 'list_cards', 'u1', ['idCard' => 1, 'image_url' => 'http']);
        $this->repository->updateEntity(1, 'invalid_table', 'u1', ['idCard' => 1]);
        $this->assertTrue(true);
    }

    public function testDeleteEntityByUuid(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        
        $this->repository->deleteEntityByUuid('list_cards', 'u1');
        $this->repository->deleteEntityByUuid('invalid_table', 'u1');
        $this->assertTrue(true);
    }

    public function testUpdateStoryById(): void
    {
        $stmt = $this->getStmt();
        $this->pdo->method('prepare')->willReturn($stmt);
        
        $this->repository->updateStoryById(1, ['author' => 'a1']);
        $this->repository->updateStoryById(1, []);
        $this->assertTrue(true);
    }
}
