<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Service\Matches;

use Games\Paths\Core\Port\Matches\MatchPersistencePort;
use Games\Paths\Core\Port\Matches\StoryMatchReadPort;
use Games\Paths\Core\Port\Matches\UserAccessPort;
use Games\Paths\Core\Service\Matches\MatchQueryService;
use PHPUnit\Framework\TestCase;

class MatchQueryServiceTest extends TestCase
{
    private $persistence;
    private $storyRead;
    private $userAccess;
    private MatchQueryService $service;

    protected function setUp(): void
    {
        $this->persistence = $this->createMock(MatchPersistencePort::class);
        $this->storyRead = $this->createMock(StoryMatchReadPort::class);
        $this->userAccess = $this->createMock(UserAccessPort::class);
        $this->service = new MatchQueryService(
            $this->persistence,
            $this->storyRead,
            $this->userAccess
        );
    }

    private function user(): array
    {
        return ['id' => 7, 'uuid' => 'user-uuid', 'username' => 'u', 'role' => 'PLAYER', 'state' => 2];
    }

    private function match(int $creator = 7): array
    {
        return [
            'id' => 99, 'uuid' => 'match-uuid', 'id_story' => 2, 'id_difficulty' => 3,
            'id_user_creator' => $creator, 'name' => 'n', 'status' => 'CREATED',
            'current_clock' => 0, 'exp_cost' => 5, 'ts_insert' => 'now',
            'single_player' => 1, 'character_template_uuid' => 'ct',
            'class_uuid' => 'cl', 'trait_uuids' => ['t1', 't2'],
        ];
    }

    public function testListBlankUserUuid(): void
    {
        $this->assertSame([], $this->service->listUserMatches(''));
    }

    public function testListUnknownUser(): void
    {
        $this->userAccess->method('findByUuid')->willReturn(null);
        $this->persistence->expects($this->never())->method('findMatchesByUserId');
        $this->assertSame([], $this->service->listUserMatches('u'));
    }

    public function testListReturnsSummaries(): void
    {
        $this->userAccess->method('findByUuid')->willReturn($this->user());
        $this->persistence->method('findMatchesByUserId')->willReturn([$this->match()]);
        $rows = $this->service->listUserMatches('u');
        $this->assertCount(1, $rows);
        $this->assertSame('match-uuid', $rows[0]->uuid);
        $this->assertSame(1, $rows[0]->singlePlayer);
        $this->assertSame('ct', $rows[0]->characterTemplateUuid);
        $this->assertSame('cl', $rows[0]->classUuid);
        $this->assertSame(['t1', 't2'], $rows[0]->traitUuids);
    }

    public function testListResolvesStoryAndDifficultyUuid(): void
    {
        // Regression: the list used to return storyUuid=null because the story
        // entity was not resolved per match (only getMatchInfo did).
        $this->userAccess->method('findByUuid')->willReturn($this->user());
        $this->persistence->method('findMatchesByUserId')->willReturn([$this->match()]);
        $this->storyRead->method('findStoryById')->willReturn(['id' => 2, 'uuid' => 'story-uuid']);
        $this->storyRead->method('findDifficultyById')->willReturn(['id' => 3, 'uuid' => 'diff-uuid']);
        $rows = $this->service->listUserMatches('u');
        $this->assertCount(1, $rows);
        $this->assertSame('story-uuid', $rows[0]->storyUuid);
        $this->assertSame('diff-uuid', $rows[0]->difficultyUuid);
    }

    public function testListAllMatchesEmpty(): void
    {
        $this->persistence->method('findAllMatches')->willReturn([]);
        $this->assertSame([], $this->service->listAllMatches());
    }

    public function testListAllMatchesReturnsSummaries(): void
    {
        $this->persistence->method('findAllMatches')->willReturn([
            $this->match(7),
            $this->match(8),
        ]);
        $rows = $this->service->listAllMatches();
        $this->assertCount(2, $rows);
        $this->assertSame('match-uuid', $rows[0]->uuid);
        $this->assertNull($rows[0]->userCreatorUuid);
        $this->assertSame(1, $rows[0]->singlePlayer);
    }

    public function testGetMatchInfoBlankInputs(): void
    {
        $this->assertNull($this->service->getMatchInfo('', 'u'));
        $this->assertNull($this->service->getMatchInfo('m', ''));
    }

    public function testGetMatchInfoUnknownUser(): void
    {
        $this->userAccess->method('findByUuid')->willReturn(null);
        $this->assertNull($this->service->getMatchInfo('m', 'u'));
    }

    public function testGetMatchInfoMatchNotFound(): void
    {
        $this->userAccess->method('findByUuid')->willReturn($this->user());
        $this->persistence->method('findMatchByUuid')->willReturn(null);
        $this->assertNull($this->service->getMatchInfo('m', 'u'));
    }

    public function testGetMatchInfoForeignOwner(): void
    {
        $this->userAccess->method('findByUuid')->willReturn($this->user());
        $this->persistence->method('findMatchByUuid')->willReturn($this->match(99));
        $this->assertNull($this->service->getMatchInfo('m', 'u'));
    }

    public function testGetMatchInfoFullPath(): void
    {
        $this->userAccess->method('findByUuid')->willReturn($this->user());
        $this->persistence->method('findMatchByUuid')->willReturn($this->match());
        $this->storyRead->method('findStoryById')->willReturn(['id' => 2, 'uuid' => 'story-uuid', 'id_location_start' => 10]);
        $this->storyRead->method('findDifficultyById')->willReturn(['id' => 3, 'uuid' => 'diff-uuid']);
        $this->storyRead->method('findLocationsByStoryId')->willReturn([
            ['id' => 10, 'uuid' => 'loc-10'],
            ['id' => 11, 'uuid' => 'loc-11'],
        ]);
        $this->persistence->method('findLocationsByMatchId')->willReturn([
            ['id_match' => 99, 'id_location' => 10, 'uuid' => 'ls10', 'flag_already_actived' => 0, 'clock_counter' => 5],
            ['id_match' => 99, 'id_location' => 11, 'uuid' => 'ls11', 'flag_already_actived' => 0, 'clock_counter' => 0],
        ]);
        $this->persistence->method('findRegistryByMatchId')->willReturn([
            ['id' => 1, 'id_match' => 99, 'uuid' => 'r1', 'key' => 'k', 'string_value' => null, 'int_value' => 1],
        ]);

        $detail = $this->service->getMatchInfo('m', 'u');
        $this->assertNotNull($detail);
        $this->assertSame('story-uuid', $detail->match->storyUuid);
        $this->assertSame('diff-uuid', $detail->match->difficultyUuid);
        $this->assertSame(10, $detail->currentLocationId);
        $this->assertSame('loc-10', $detail->currentLocationUuid);
        $this->assertCount(2, $detail->locations);
        $this->assertCount(1, $detail->registry);
        $this->assertSame('k', $detail->registry[0]->key);
        $this->assertSame([], $detail->events);
        $this->assertSame([], $detail->choices);
    }

    public function testGetMatchInfoNoStartLocation(): void
    {
        $this->userAccess->method('findByUuid')->willReturn($this->user());
        $this->persistence->method('findMatchByUuid')->willReturn($this->match());
        $this->storyRead->method('findStoryById')->willReturn(['id' => 2, 'uuid' => 'story-uuid', 'id_location_start' => null]);
        $this->storyRead->method('findDifficultyById')->willReturn(['id' => 3, 'uuid' => 'd']);
        $this->storyRead->method('findLocationsByStoryId')->willReturn([]);
        $this->persistence->method('findLocationsByMatchId')->willReturn([]);
        $this->persistence->method('findRegistryByMatchId')->willReturn([]);

        $detail = $this->service->getMatchInfo('m', 'u');
        $this->assertNull($detail->currentLocationId);
    }

    public function testGetMatchInfoStartLocationMissingFromList(): void
    {
        $this->userAccess->method('findByUuid')->willReturn($this->user());
        $this->persistence->method('findMatchByUuid')->willReturn($this->match());
        $this->storyRead->method('findStoryById')->willReturn(['id' => 2, 'uuid' => 'story-uuid', 'id_location_start' => 10]);
        $this->storyRead->method('findDifficultyById')->willReturn(null);
        $this->storyRead->method('findLocationsByStoryId')->willReturn([]);
        $this->persistence->method('findLocationsByMatchId')->willReturn([]);
        $this->persistence->method('findRegistryByMatchId')->willReturn([]);

        $detail = $this->service->getMatchInfo('m', 'u');
        $this->assertSame(10, $detail->currentLocationId);
        $this->assertNull($detail->currentLocationUuid);
        $this->assertNull($detail->currentLocationName);
    }

    public function testGetMatchInfoMissingStory(): void
    {
        $this->userAccess->method('findByUuid')->willReturn($this->user());
        $this->persistence->method('findMatchByUuid')->willReturn($this->match());
        $this->storyRead->method('findStoryById')->willReturn(null);
        $this->persistence->method('findLocationsByMatchId')->willReturn([]);
        $this->persistence->method('findRegistryByMatchId')->willReturn([]);

        $detail = $this->service->getMatchInfo('m', 'u');
        $this->assertNotNull($detail);
        $this->assertNull($detail->match->storyUuid);
        $this->assertNull($detail->match->difficultyUuid);
    }

    // ── getMatchInfoForAdmin (no ownership check) ──────────────────────────────

    public function testGetMatchInfoForAdminBlankUuid(): void
    {
        $this->assertNull($this->service->getMatchInfoForAdmin(''));
    }

    public function testGetMatchInfoForAdminMatchNotFound(): void
    {
        $this->persistence->method('findMatchByUuid')->willReturn(null);
        $this->assertNull($this->service->getMatchInfoForAdmin('m'));
    }

    public function testGetMatchInfoForAdminReturnsDetailOfAnyOwner(): void
    {
        // match created by user 99 — admin info skips the ownership check
        $this->persistence->method('findMatchByUuid')->willReturn($this->match(99));
        $this->storyRead->method('findStoryById')->willReturn(['id' => 2, 'uuid' => 'story-uuid']);
        $this->storyRead->method('findDifficultyById')->willReturn(['id' => 3, 'uuid' => 'diff-uuid']);
        $this->storyRead->method('findLocationsByStoryId')->willReturn([]);
        $this->persistence->method('findLocationsByMatchId')->willReturn([]);
        $this->persistence->method('findRegistryByMatchId')->willReturn([]);

        $detail = $this->service->getMatchInfoForAdmin('m');
        $this->assertNotNull($detail);
        $this->assertSame('match-uuid', $detail->match->uuid);
        $this->assertSame('story-uuid', $detail->match->storyUuid);
    }
}
