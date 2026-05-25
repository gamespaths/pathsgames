<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Service\Matches;

use Games\Paths\Core\Domain\Matches\MatchCreateCommand;
use Games\Paths\Core\Domain\Matches\MatchCreationException;
use Games\Paths\Core\Port\Matches\MatchPersistencePort;
use Games\Paths\Core\Port\Matches\StoryMatchReadPort;
use Games\Paths\Core\Port\Matches\SystemModePort;
use Games\Paths\Core\Port\Matches\TurnstileVerificationPort;
use Games\Paths\Core\Port\Matches\UserAccessPort;
use Games\Paths\Core\Service\Matches\MatchCommandService;
use PHPUnit\Framework\TestCase;

class MatchCommandServiceTest extends TestCase
{
    private $storyRead;
    private $persistence;
    private $userAccess;
    private $systemMode;
    private MatchCommandService $service;

    protected function setUp(): void
    {
        $this->storyRead = $this->createMock(StoryMatchReadPort::class);
        $this->persistence = $this->createMock(MatchPersistencePort::class);
        $this->userAccess = $this->createMock(UserAccessPort::class);
        $this->systemMode = $this->createMock(SystemModePort::class);
        $this->service = new MatchCommandService(
            $this->storyRead,
            $this->persistence,
            $this->userAccess,
            $this->systemMode
        );
    }

    private function user(int $state = 2): array
    {
        return ['id' => 7, 'uuid' => 'user-uuid', 'username' => 'u', 'role' => 'PLAYER', 'state' => $state];
    }

    private function story(): array
    {
        return ['id' => 2, 'uuid' => 'story-uuid'];
    }

    private function difficulty(?int $exp = 5): array
    {
        return ['id' => 3, 'uuid' => 'diff-uuid', 'exp_cost' => $exp];
    }

    private function saved(string $uuid = 'match-uuid'): array
    {
        return [
            'id' => 99,
            'uuid' => $uuid,
            'status' => 'CREATED',
            'current_clock' => 0,
            'exp_cost' => 5,
            'name' => 'n',
            'ts_insert' => 'now',
        ];
    }

    public function testInvalidInputBlankFields(): void
    {
        $this->expectException(MatchCreationException::class);
        $this->service->createMatch(new MatchCreateCommand('', 's', 'd'));
    }

    public function testInvalidInputBlankStory(): void
    {
        $this->expectException(MatchCreationException::class);
        $this->service->createMatch(new MatchCreateCommand('u', '', 'd'));
    }

    public function testInvalidInputBlankDifficulty(): void
    {
        $this->expectException(MatchCreationException::class);
        $this->service->createMatch(new MatchCreateCommand('u', 's', ''));
    }

    public function testTurnstileRejected(): void
    {
        $rejectAll = $this->createMock(TurnstileVerificationPort::class);
        $rejectAll->method('verify')->willReturn(false);
        $strictService = new MatchCommandService(
            $this->storyRead,
            $this->persistence,
            $this->userAccess,
            $this->systemMode,
            $rejectAll
        );
        $this->expectException(MatchCreationException::class);
        try {
            $strictService->createMatch(new MatchCreateCommand('u', 's', 'd', null, null, null, [], null, 'bad-token', '1.2.3.4'));
        } catch (MatchCreationException $e) {
            $this->assertSame(MatchCreationException::TURNSTILE_VALIDATION_FAILED, $e->getCodeId());
            throw $e;
        }
    }

    public function testMaintenanceMode(): void
    {
        $this->systemMode->method('isMaintenance')->willReturn(true);
        $this->userAccess->expects($this->never())->method('findByUuid');
        $this->expectException(MatchCreationException::class);
        try {
            $this->service->createMatch(new MatchCreateCommand('u', 's', 'd'));
        } catch (MatchCreationException $e) {
            $this->assertSame(MatchCreationException::MAINTENANCE_MODE, $e->getCodeId());
            throw $e;
        }
    }

    public function testUserNotFound(): void
    {
        $this->systemMode->method('isMaintenance')->willReturn(false);
        $this->userAccess->method('findByUuid')->willReturn(null);
        try {
            $this->service->createMatch(new MatchCreateCommand('u', 's', 'd'));
            $this->fail('expected exception');
        } catch (MatchCreationException $e) {
            $this->assertSame(MatchCreationException::USER_NOT_FOUND, $e->getCodeId());
        }
    }

    public function testUserBannedState4(): void
    {
        $this->systemMode->method('isMaintenance')->willReturn(false);
        $this->userAccess->method('findByUuid')->willReturn($this->user(4));
        try {
            $this->service->createMatch(new MatchCreateCommand('u', 's', 'd'));
            $this->fail('expected exception');
        } catch (MatchCreationException $e) {
            $this->assertSame(MatchCreationException::USER_BANNED, $e->getCodeId());
        }
    }

    public function testUserBannedState3(): void
    {
        $this->systemMode->method('isMaintenance')->willReturn(false);
        $this->userAccess->method('findByUuid')->willReturn($this->user(3));
        $this->expectException(MatchCreationException::class);
        $this->service->createMatch(new MatchCreateCommand('u', 's', 'd'));
    }

    public function testUserStateNullPasses(): void
    {
        $this->systemMode->method('isMaintenance')->willReturn(false);
        $this->userAccess->method('findByUuid')->willReturn(['id' => 7, 'uuid' => 'u', 'username' => 'u', 'role' => 'P', 'state' => null]);
        $this->storyRead->method('findStoryByUuid')->willReturn($this->story());
        $this->storyRead->method('findDifficultyByUuid')->willReturn($this->difficulty());
        $this->storyRead->method('findLocationsByStoryId')->willReturn([['id' => 10, 'uuid' => 'l', 'counter_start' => 0]]);
        $this->storyRead->method('findKeysByStoryId')->willReturn([]);
        $this->persistence->method('saveMatch')->willReturn($this->saved());
        $summary = $this->service->createMatch(new MatchCreateCommand('u', 's', 'd'));
        $this->assertSame('match-uuid', $summary->uuid);
    }

    public function testStoryNotFound(): void
    {
        $this->systemMode->method('isMaintenance')->willReturn(false);
        $this->userAccess->method('findByUuid')->willReturn($this->user());
        $this->storyRead->method('findStoryByUuid')->willReturn(null);
        try {
            $this->service->createMatch(new MatchCreateCommand('u', 's', 'd'));
            $this->fail();
        } catch (MatchCreationException $e) {
            $this->assertSame(MatchCreationException::STORY_NOT_FOUND, $e->getCodeId());
        }
    }

    public function testDifficultyNotFound(): void
    {
        $this->systemMode->method('isMaintenance')->willReturn(false);
        $this->userAccess->method('findByUuid')->willReturn($this->user());
        $this->storyRead->method('findStoryByUuid')->willReturn($this->story());
        $this->storyRead->method('findDifficultyByUuid')->willReturn(null);
        try {
            $this->service->createMatch(new MatchCreateCommand('u', 's', 'd'));
            $this->fail();
        } catch (MatchCreationException $e) {
            $this->assertSame(MatchCreationException::DIFFICULTY_NOT_FOUND, $e->getCodeId());
        }
    }

    public function testNoLocations(): void
    {
        $this->systemMode->method('isMaintenance')->willReturn(false);
        $this->userAccess->method('findByUuid')->willReturn($this->user());
        $this->storyRead->method('findStoryByUuid')->willReturn($this->story());
        $this->storyRead->method('findDifficultyByUuid')->willReturn($this->difficulty());
        $this->storyRead->method('findLocationsByStoryId')->willReturn([]);
        try {
            $this->service->createMatch(new MatchCreateCommand('u', 's', 'd'));
            $this->fail();
        } catch (MatchCreationException $e) {
            $this->assertSame(MatchCreationException::STORY_HAS_NO_LOCATIONS, $e->getCodeId());
        }
    }

    public function testHappyPathSeedsAllRows(): void
    {
        $this->systemMode->method('isMaintenance')->willReturn(false);
        $this->userAccess->method('findByUuid')->willReturn($this->user());
        $this->storyRead->method('findStoryByUuid')->willReturn($this->story());
        $this->storyRead->method('findDifficultyByUuid')->willReturn($this->difficulty());
        $this->storyRead->method('findLocationsByStoryId')->willReturn([
            ['id' => 10, 'uuid' => 'l1', 'counter_start' => 5],
            ['id' => 11, 'uuid' => 'l2', 'counter_start' => null],
        ]);
        $this->storyRead->method('findKeysByStoryId')->willReturn([
            ['id' => 20, 'key_name' => 'k1', 'key_value' => '7'],
            ['id' => 21, 'key_name' => 'k2', 'key_value' => 'hello'],
            ['id' => 22, 'key_name' => 'k3', 'key_value' => '   '],
            ['id' => 23, 'key_name' => 'k4', 'key_value' => null],
        ]);
        $this->persistence->method('saveMatch')->willReturn($this->saved());

        $savedLocations = [];
        $savedRegistry = [];
        $this->persistence->method('saveLocations')->willReturnCallback(function ($rows) use (&$savedLocations) {
            $savedLocations = $rows;
        });
        $this->persistence->method('saveRegistry')->willReturnCallback(function ($rows) use (&$savedRegistry) {
            $savedRegistry = $rows;
        });

        $summary = $this->service->createMatch(new MatchCreateCommand('u', 's', 'd', 'name', 'ct'));
        $this->assertSame('match-uuid', $summary->uuid);
        $this->assertSame('story-uuid', $summary->storyUuid);
        $this->assertSame(5, $summary->expCost);

        $this->assertCount(2, $savedLocations);
        $this->assertSame(5, $savedLocations[0]['clock_counter']);
        $this->assertSame(0, $savedLocations[1]['clock_counter']);

        $this->assertCount(4, $savedRegistry);
        $this->assertSame(7, $savedRegistry[0]['int_value']);
        $this->assertNull($savedRegistry[0]['string_value']);
        $this->assertSame('hello', $savedRegistry[1]['string_value']);
        $this->assertSame('', $savedRegistry[2]['string_value']);
        $this->assertNull($savedRegistry[3]['string_value']);
        $this->assertNull($savedRegistry[3]['int_value']);
    }

    public function testDifficultyNullExpCostDefaultsTo5(): void
    {
        $this->systemMode->method('isMaintenance')->willReturn(false);
        $this->userAccess->method('findByUuid')->willReturn($this->user());
        $this->storyRead->method('findStoryByUuid')->willReturn($this->story());
        $this->storyRead->method('findDifficultyByUuid')->willReturn($this->difficulty(null));
        $this->storyRead->method('findLocationsByStoryId')->willReturn([['id' => 10, 'uuid' => 'l', 'counter_start' => 0]]);
        $this->storyRead->method('findKeysByStoryId')->willReturn([]);
        $this->persistence->method('saveMatch')->willReturn($this->saved());

        $summary = $this->service->createMatch(new MatchCreateCommand('u', 's', 'd'));
        $this->assertSame(5, $summary->expCost);
    }

    public function testLegacyKeyAndCounterColumnsSupported(): void
    {
        $this->systemMode->method('isMaintenance')->willReturn(false);
        $this->userAccess->method('findByUuid')->willReturn($this->user());
        $this->storyRead->method('findStoryByUuid')->willReturn($this->story());
        $this->storyRead->method('findDifficultyByUuid')->willReturn($this->difficulty());
        $this->storyRead->method('findLocationsByStoryId')->willReturn([['id' => 10, 'uuid' => 'l', 'counter_time' => 9]]);
        $this->storyRead->method('findKeysByStoryId')->willReturn([['id' => 20, 'name' => 'foo', 'value' => 'bar']]);
        $this->persistence->method('saveMatch')->willReturn($this->saved());

        $savedLocations = [];
        $savedRegistry = [];
        $this->persistence->method('saveLocations')->willReturnCallback(function ($rows) use (&$savedLocations) {
            $savedLocations = $rows;
        });
        $this->persistence->method('saveRegistry')->willReturnCallback(function ($rows) use (&$savedRegistry) {
            $savedRegistry = $rows;
        });

        $this->service->createMatch(new MatchCreateCommand('u', 's', 'd'));
        $this->assertSame(9, $savedLocations[0]['clock_counter']);
        $this->assertSame('foo', $savedRegistry[0]['key']);
        $this->assertSame('bar', $savedRegistry[0]['string_value']);
    }

    public function testNegativeIntegerValueParsed(): void
    {
        $this->systemMode->method('isMaintenance')->willReturn(false);
        $this->userAccess->method('findByUuid')->willReturn($this->user());
        $this->storyRead->method('findStoryByUuid')->willReturn($this->story());
        $this->storyRead->method('findDifficultyByUuid')->willReturn($this->difficulty());
        $this->storyRead->method('findLocationsByStoryId')->willReturn([['id' => 10, 'uuid' => 'l', 'counter_start' => 0]]);
        $this->storyRead->method('findKeysByStoryId')->willReturn([['id' => 20, 'key_name' => 'k', 'key_value' => '-5']]);
        $this->persistence->method('saveMatch')->willReturn($this->saved());

        $savedRegistry = [];
        $this->persistence->method('saveRegistry')->willReturnCallback(function ($rows) use (&$savedRegistry) {
            $savedRegistry = $rows;
        });
        $this->service->createMatch(new MatchCreateCommand('u', 's', 'd'));
        $this->assertSame(-5, $savedRegistry[0]['int_value']);
    }

    public function testCreatorLoadoutPersisted(): void
    {
        $this->systemMode->method('isMaintenance')->willReturn(false);
        $this->userAccess->method('findByUuid')->willReturn($this->user());
        $this->storyRead->method('findStoryByUuid')->willReturn($this->story());
        $this->storyRead->method('findDifficultyByUuid')->willReturn($this->difficulty());
        $this->storyRead->method('findLocationsByStoryId')->willReturn([['id' => 10, 'uuid' => 'l', 'counter_start' => 0]]);
        $this->storyRead->method('findKeysByStoryId')->willReturn([]);

        $savedArg = [];
        $this->persistence->method('saveMatch')->willReturnCallback(function ($match) use (&$savedArg) {
            $savedArg = $match;
            return $this->saved();
        });

        $command = new MatchCreateCommand('u', 's', 'd', 'n', 'ct', 'class-uuid', ['t1', 't2'], 0);
        $this->service->createMatch($command);

        $this->assertSame(0, $savedArg['single_player']);
        $this->assertSame('ct', $savedArg['character_template_uuid']);
        $this->assertSame('class-uuid', $savedArg['class_uuid']);
        $this->assertSame(['t1', 't2'], $savedArg['trait_uuids']);
    }

    public function testSinglePlayerDefaultsToOneWhenNotProvided(): void
    {
        $this->systemMode->method('isMaintenance')->willReturn(false);
        $this->userAccess->method('findByUuid')->willReturn($this->user());
        $this->storyRead->method('findStoryByUuid')->willReturn($this->story());
        $this->storyRead->method('findDifficultyByUuid')->willReturn($this->difficulty());
        $this->storyRead->method('findLocationsByStoryId')->willReturn([['id' => 10, 'uuid' => 'l', 'counter_start' => 0]]);
        $this->storyRead->method('findKeysByStoryId')->willReturn([]);

        $savedArg = [];
        $this->persistence->method('saveMatch')->willReturnCallback(function ($match) use (&$savedArg) {
            $savedArg = $match;
            return $this->saved();
        });

        $this->service->createMatch(new MatchCreateCommand('u', 's', 'd'));
        $this->assertSame(1, $savedArg['single_player']);
    }

    // ── admin update / delete ─────────────────────────────────────────────────

    public function testUpdateMatchValidStatusReturnsUpdated(): void
    {
        $this->persistence->method('updateMatchFields')->willReturn(true);
        $this->assertSame('UPDATED', $this->service->updateMatch('m1', 'ENDED', 'n'));
    }

    public function testUpdateMatchInvalidStatusReturnsInvalidStatus(): void
    {
        $this->persistence->expects($this->never())->method('updateMatchFields');
        $this->assertSame('INVALID_STATUS', $this->service->updateMatch('m1', 'BOGUS', null));
    }

    public function testUpdateMatchNotFound(): void
    {
        $this->persistence->method('updateMatchFields')->willReturn(false);
        $this->assertSame('NOT_FOUND', $this->service->updateMatch('m1', null, 'n'));
    }

    public function testDeleteMatchTerminalStatusDeletes(): void
    {
        $this->persistence->method('findMatchByUuid')
            ->willReturn(['uuid' => 'm1', 'status' => 'ENDED']);
        $this->persistence->expects($this->once())->method('deleteMatchByUuid')->with('m1');
        $this->assertSame('DELETED', $this->service->deleteMatch('m1'));
    }

    public function testDeleteMatchNonTerminalReturnsNotStopped(): void
    {
        $this->persistence->method('findMatchByUuid')
            ->willReturn(['uuid' => 'm1', 'status' => 'RUNNING']);
        $this->persistence->expects($this->never())->method('deleteMatchByUuid');
        $this->assertSame('NOT_STOPPED', $this->service->deleteMatch('m1'));
    }

    public function testDeleteMatchUnknownReturnsNotFound(): void
    {
        $this->persistence->method('findMatchByUuid')->willReturn(null);
        $this->assertSame('NOT_FOUND', $this->service->deleteMatch('m1'));
    }
}
