<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Service\Matches;

use Games\Paths\Core\Domain\Matches\CharacterJoinException;
use Games\Paths\Core\Domain\Matches\JoinMatchCommand;
use Games\Paths\Core\Port\Matches\CharacterPersistencePort;
use Games\Paths\Core\Port\Matches\MatchPersistencePort;
use Games\Paths\Core\Port\Matches\StoryMatchReadPort;
use Games\Paths\Core\Port\Matches\UserAccessPort;
use Games\Paths\Core\Service\Matches\CharacterCommandService;
use PHPUnit\Framework\TestCase;

class CharacterCommandServiceTest extends TestCase
{
    private $story;
    private $matchP;
    private $userA;
    private $charP;
    private CharacterCommandService $service;

    protected function setUp(): void
    {
        $this->story = $this->createMock(StoryMatchReadPort::class);
        $this->matchP = $this->createMock(MatchPersistencePort::class);
        $this->userA = $this->createMock(UserAccessPort::class);
        $this->charP = $this->createMock(CharacterPersistencePort::class);
        $this->service = new CharacterCommandService($this->story, $this->matchP, $this->userA, $this->charP);
    }

    private function match(array $over = []): array
    {
        return array_merge([
            'id' => 500, 'uuid' => 'match-uuid', 'id_story' => 9001, 'id_difficulty' => 90001,
            'status' => 'CREATED', 'id_user_creator' => 7,
            'character_template_uuid' => 'tpl-uuid', 'class_uuid' => 'class-uuid',
            'trait_uuids' => ['trait-1', 'trait-2'],
        ], $over);
    }

    private function user(int $state = 6): array
    {
        return ['id' => 7, 'uuid' => 'user-uuid', 'state' => $state];
    }

    private function template(array $over = []): array
    {
        return array_merge([
            'id_tipo' => 90001, 'uuid' => 'tpl-uuid', 'life_max' => 12, 'energy_max' => 12, 'sad_max' => 8,
            'dexterity_start' => 3, 'intelligence_start' => 3, 'constitution_start' => 3,
            'id_class_permitted' => null, 'id_class_prohibited' => null,
        ], $over);
    }

    private function clazz(): array
    {
        return ['id' => 90001, 'uuid' => 'class-uuid',
                'dexterity_base' => 3, 'intelligence_base' => 3, 'constitution_base' => 3];
    }

    private function difficulty(): array
    {
        return ['id' => 90001, 'uuid' => 'd', 'life' => 120, 'energy' => 110, 'sad' => 0,
                'dexterity' => 12, 'intelligence' => 12, 'constitution' => 12];
    }

    private function bonuses(): array
    {
        return [
            ['id_class' => 90001, 'statistic' => 'life', 'value' => 3],
            ['id_class' => 90001, 'statistic' => 'energy', 'value' => 3],
            ['id_class' => 90001, 'statistic' => 'exp', 'value' => 2],
        ];
    }

    private function cmd(): JoinMatchCommand
    {
        return new JoinMatchCommand('match-uuid', 'user-uuid', 'tpl-uuid', 'class-uuid', ['trait-1', 'trait-2']);
    }

    private function wireFull(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match());
        $this->userA->method('findByUuid')->willReturn($this->user());
        $this->charP->method('findCharacterByMatchAndUser')->willReturn(null);
        $this->charP->method('countCharactersByMatchId')->willReturn(0);
        $this->charP->method('saveCharacter')->willReturnCallback(
            fn(array $row) => array_merge($row, ['uuid' => 'char-uuid'])
        );
        $this->story->method('findStoryById')->willReturn(['id' => 9001, 'id_location_start' => 90001]);
        $this->story->method('findCharacterTemplateByUuid')->willReturn($this->template());
        $this->story->method('findClassByUuid')->willReturn($this->clazz());
        $this->story->method('findClassBonusesByStoryId')->willReturn($this->bonuses());
        $this->story->method('findDifficultyById')->willReturn($this->difficulty());
        $this->story->method('findTraitByUuid')->willReturnCallback(fn(int $s, string $u) => [
            'trait-1' => ['id' => 90001, 'uuid' => 'trait-1', 'life' => 2, 'energy' => 0, 'dexterity' => 0, 'intelligence' => 0, 'constitution' => 1],
            'trait-2' => ['id' => 90002, 'uuid' => 'trait-2', 'life' => 0, 'energy' => 2, 'dexterity' => 1, 'intelligence' => 0, 'constitution' => 0],
        ][$u] ?? null);
        $this->story->method('findLocationsByStoryId')->willReturn([['id' => 90001, 'uuid' => 'loc-start']]);
    }

    private function assertCode(string $code, callable $fn): void
    {
        try {
            $fn();
            $this->fail('Expected CharacterJoinException');
        } catch (CharacterJoinException $e) {
            $this->assertSame($code, $e->getCodeId());
        }
    }

    public function testBlankInput(): void
    {
        $this->assertCode(CharacterJoinException::INVALID_INPUT,
            fn() => $this->service->join(new JoinMatchCommand('', 'u')));
    }

    public function testMatchNotFound(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn(null);
        $this->assertCode(CharacterJoinException::MATCH_NOT_FOUND, fn() => $this->service->join($this->cmd()));
    }

    public function testTerminalMatch(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match(['status' => 'ENDED']));
        $this->assertCode(CharacterJoinException::MATCH_NOT_JOINABLE, fn() => $this->service->join($this->cmd()));
    }

    public function testUserNotFound(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match());
        $this->userA->method('findByUuid')->willReturn(null);
        $this->assertCode(CharacterJoinException::USER_NOT_FOUND, fn() => $this->service->join($this->cmd()));
    }

    public function testBannedUser(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match());
        $this->userA->method('findByUuid')->willReturn($this->user(4));
        $this->assertCode(CharacterJoinException::USER_BANNED, fn() => $this->service->join($this->cmd()));
    }

    public function testAlreadyJoined(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match());
        $this->userA->method('findByUuid')->willReturn($this->user());
        $this->charP->method('findCharacterByMatchAndUser')->willReturn(['id' => 1]);
        $this->assertCode(CharacterJoinException::ALREADY_JOINED, fn() => $this->service->join($this->cmd()));
    }

    public function testStoryMissing(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match());
        $this->userA->method('findByUuid')->willReturn($this->user());
        $this->charP->method('findCharacterByMatchAndUser')->willReturn(null);
        $this->story->method('findStoryById')->willReturn(null);
        $this->assertCode(CharacterJoinException::MATCH_NOT_FOUND, fn() => $this->service->join($this->cmd()));
    }

    public function testNoTemplate(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match(['character_template_uuid' => null]));
        $this->userA->method('findByUuid')->willReturn($this->user());
        $this->charP->method('findCharacterByMatchAndUser')->willReturn(null);
        $this->story->method('findStoryById')->willReturn(['id' => 9001, 'id_location_start' => 1]);
        $this->assertCode(CharacterJoinException::INVALID_INPUT,
            fn() => $this->service->join(new JoinMatchCommand('match-uuid', 'user-uuid')));
    }

    public function testTemplateNotFound(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match());
        $this->userA->method('findByUuid')->willReturn($this->user());
        $this->charP->method('findCharacterByMatchAndUser')->willReturn(null);
        $this->story->method('findStoryById')->willReturn(['id' => 9001, 'id_location_start' => 1]);
        $this->story->method('findCharacterTemplateByUuid')->willReturn(null);
        $this->assertCode(CharacterJoinException::TEMPLATE_NOT_FOUND, fn() => $this->service->join($this->cmd()));
    }

    public function testClassNotFound(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match());
        $this->userA->method('findByUuid')->willReturn($this->user());
        $this->charP->method('findCharacterByMatchAndUser')->willReturn(null);
        $this->story->method('findStoryById')->willReturn(['id' => 9001, 'id_location_start' => 1]);
        $this->story->method('findCharacterTemplateByUuid')->willReturn($this->template());
        $this->story->method('findClassByUuid')->willReturn(null);
        $this->assertCode(CharacterJoinException::CLASS_NOT_FOUND, fn() => $this->service->join($this->cmd()));
    }

    public function testClassNotPermitted(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match());
        $this->userA->method('findByUuid')->willReturn($this->user());
        $this->charP->method('findCharacterByMatchAndUser')->willReturn(null);
        $this->story->method('findStoryById')->willReturn(['id' => 9001, 'id_location_start' => 1]);
        $this->story->method('findCharacterTemplateByUuid')->willReturn($this->template(['id_class_permitted' => 99999]));
        $this->story->method('findClassByUuid')->willReturn($this->clazz());
        $this->assertCode(CharacterJoinException::CLASS_NOT_COMPATIBLE, fn() => $this->service->join($this->cmd()));
    }

    public function testClassProhibited(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match());
        $this->userA->method('findByUuid')->willReturn($this->user());
        $this->charP->method('findCharacterByMatchAndUser')->willReturn(null);
        $this->story->method('findStoryById')->willReturn(['id' => 9001, 'id_location_start' => 1]);
        $this->story->method('findCharacterTemplateByUuid')->willReturn($this->template(['id_class_prohibited' => 90001]));
        $this->story->method('findClassByUuid')->willReturn($this->clazz());
        $this->assertCode(CharacterJoinException::CLASS_NOT_COMPATIBLE, fn() => $this->service->join($this->cmd()));
    }

    public function testComputesFinalStats(): void
    {
        $this->wireFull();
        $info = $this->service->join($this->cmd());
        $this->assertSame(19, $info->dexterity);     // 3+3+12+1
        $this->assertSame(18, $info->intelligence);  // 3+3+12+0
        $this->assertSame(19, $info->constitution);  // 3+3+12+1
        $this->assertSame(137, $info->life);         // 12+120+2+3
        $this->assertSame(127, $info->energy);       // 12+110+2+3
        $this->assertSame(0, $info->sad);
        $this->assertSame(90001, $info->idLocation);
        $this->assertSame('loc-start', $info->locationUuid);
        $this->assertSame('user-uuid', $info->userUuid);
        $this->assertSame('class-uuid', $info->classUuid);
        $this->assertSame(['trait-1', 'trait-2'], $info->traitUuids);
        $this->assertSame(0, $info->food);
    }

    public function testPersistsBackpackAndTraits(): void
    {
        $this->wireFull();
        $this->charP->expects($this->once())->method('saveBackpack')
            ->with($this->callback(fn($r) => $r['food'] === 0 && $r['id_character_match'] === 1));
        $this->charP->expects($this->once())->method('saveTraits')
            ->with($this->callback(fn($rows) => count($rows) === 2 && $rows[0]['id_traits'] === 90001));
        $this->service->join($this->cmd());
    }

    public function testFallbackToMatchLoadout(): void
    {
        $this->wireFull();
        $info = $this->service->join(new JoinMatchCommand('match-uuid', 'user-uuid'));
        $this->assertSame('tpl-uuid', $info->characterTemplateUuid);
        $this->assertSame('class-uuid', $info->classUuid);
        $this->assertSame(19, $info->dexterity);
    }

    public function testNoClass(): void
    {
        $this->wireFull();
        $this->matchP = $this->createMock(MatchPersistencePort::class);
        $this->matchP->method('findMatchByUuid')->willReturn($this->match(['class_uuid' => null]));
        $service = new CharacterCommandService($this->story, $this->matchP, $this->userA, $this->charP);
        $info = $service->join(new JoinMatchCommand('match-uuid', 'user-uuid', 'tpl-uuid', null, ['trait-1', 'trait-2']));
        $this->assertSame(16, $info->dexterity);  // 3+0+12+1
        $this->assertNull($info->classUuid);
    }

    public function testNoDifficulty(): void
    {
        // Step 23: no traits selected (unknown trait uuids are now rejected)
        $this->matchP->method('findMatchByUuid')->willReturn($this->match(['trait_uuids' => []]));
        $this->userA->method('findByUuid')->willReturn($this->user());
        $this->charP->method('findCharacterByMatchAndUser')->willReturn(null);
        $this->charP->method('countCharactersByMatchId')->willReturn(0);
        $this->charP->method('saveCharacter')->willReturnCallback(fn(array $row) => array_merge($row, ['uuid' => 'c']));
        $this->story->method('findStoryById')->willReturn(['id' => 9001, 'id_location_start' => 90001]);
        $this->story->method('findCharacterTemplateByUuid')->willReturn($this->template());
        $this->story->method('findClassByUuid')->willReturn($this->clazz());
        $this->story->method('findClassBonusesByStoryId')->willReturn($this->bonuses());
        $this->story->method('findDifficultyById')->willReturn(null);
        $this->story->method('findLocationsByStoryId')->willReturn([]);
        $info = $this->service->join(new JoinMatchCommand('match-uuid', 'user-uuid', 'tpl-uuid', 'class-uuid', []));
        $this->assertSame(6, $info->dexterity);  // 3+3+0+0(no traits)
    }

    // ─── Step 23: trait selection validation ────────────────────────────────

    private function costTrait(int $id, string $uuid, int $costPositive = 0, int $costNegative = 0,
                               ?int $permitted = null, ?int $prohibited = null): array
    {
        return ['id' => $id, 'uuid' => $uuid,
                'cost_positive' => $costPositive, 'cost_negative' => $costNegative,
                'id_class_permitted' => $permitted, 'id_class_prohibited' => $prohibited];
    }

    private function wireUpToTraits(?array $difficulty = null, array $matchOver = []): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match($matchOver));
        $this->userA->method('findByUuid')->willReturn($this->user());
        $this->charP->method('findCharacterByMatchAndUser')->willReturn(null);
        $this->charP->method('countCharactersByMatchId')->willReturn(0);
        $this->charP->method('saveCharacter')->willReturnCallback(
            fn(array $row) => array_merge($row, ['uuid' => 'char-uuid'])
        );
        $this->story->method('findStoryById')->willReturn(['id' => 9001, 'id_location_start' => 90001]);
        $this->story->method('findCharacterTemplateByUuid')->willReturn($this->template());
        $this->story->method('findClassByUuid')->willReturn($this->clazz());
        $this->story->method('findClassBonusesByStoryId')->willReturn([]);
        $this->story->method('findDifficultyById')->willReturn($difficulty ?? $this->difficulty());
        $this->story->method('findLocationsByStoryId')->willReturn([]);
    }

    public function testUnknownTraitNotFound(): void
    {
        $this->wireUpToTraits();
        $this->story->method('findTraitByUuid')->willReturn(null);
        $this->assertCode(CharacterJoinException::TRAIT_NOT_FOUND, fn() => $this->service->join($this->cmd()));
    }

    public function testDuplicatedTrait(): void
    {
        $this->wireUpToTraits();
        $this->story->method('findTraitByUuid')->willReturn($this->costTrait(90001, 'trait-1', 1));
        $cmd = new JoinMatchCommand('match-uuid', 'user-uuid', 'tpl-uuid', 'class-uuid', ['trait-1', 'trait-1']);
        $this->assertCode(CharacterJoinException::TRAIT_DUPLICATED, fn() => $this->service->join($cmd));
    }

    public function testTraitPermittedForOtherClass(): void
    {
        $this->wireUpToTraits();
        $this->story->method('findTraitByUuid')
            ->willReturn($this->costTrait(90001, 'trait-1', 1, 0, 99999));
        $cmd = new JoinMatchCommand('match-uuid', 'user-uuid', 'tpl-uuid', 'class-uuid', ['trait-1']);
        $this->assertCode(CharacterJoinException::TRAIT_NOT_COMPATIBLE, fn() => $this->service->join($cmd));
    }

    public function testTraitProhibitedForClass(): void
    {
        $this->wireUpToTraits();
        $this->story->method('findTraitByUuid')
            ->willReturn($this->costTrait(90001, 'trait-1', 1, 0, null, 90001));
        $cmd = new JoinMatchCommand('match-uuid', 'user-uuid', 'tpl-uuid', 'class-uuid', ['trait-1']);
        $this->assertCode(CharacterJoinException::TRAIT_NOT_COMPATIBLE, fn() => $this->service->join($cmd));
    }

    public function testPositiveBudgetExceeded(): void
    {
        $difficulty = array_merge($this->difficulty(), ['trait_cost_positive_budget' => 1]);
        $this->wireUpToTraits($difficulty);
        $this->story->method('findTraitByUuid')->willReturnCallback(fn(int $s, string $u) => [
            'trait-1' => $this->costTrait(90001, 'trait-1', 1),
            'trait-2' => $this->costTrait(90002, 'trait-2', 1),
        ][$u] ?? null);
        $this->assertCode(CharacterJoinException::TRAIT_COST_EXCEEDED, fn() => $this->service->join($this->cmd()));
    }

    public function testNegativeBudgetExceeded(): void
    {
        $difficulty = array_merge($this->difficulty(), ['trait_cost_negative_budget' => 3]);
        $this->wireUpToTraits($difficulty);
        $this->story->method('findTraitByUuid')->willReturnCallback(fn(int $s, string $u) => [
            'trait-1' => $this->costTrait(90001, 'trait-1', 0, 2),
            'trait-2' => $this->costTrait(90002, 'trait-2', 0, 2),
        ][$u] ?? null);
        $this->assertCode(CharacterJoinException::TRAIT_COST_EXCEEDED, fn() => $this->service->join($this->cmd()));
    }

    public function testExactBudgetOk(): void
    {
        $difficulty = array_merge($this->difficulty(),
            ['trait_cost_positive_budget' => 2, 'trait_cost_negative_budget' => 2]);
        $this->wireUpToTraits($difficulty);
        $this->story->method('findTraitByUuid')->willReturnCallback(fn(int $s, string $u) => [
            'trait-1' => $this->costTrait(90001, 'trait-1', 1, 1),
            'trait-2' => $this->costTrait(90002, 'trait-2', 1, 1),
        ][$u] ?? null);
        $info = $this->service->join($this->cmd());
        $this->assertSame(['trait-1', 'trait-2'], $info->traitUuids);
    }

    public function testNullBudgetsUnlimited(): void
    {
        $this->wireUpToTraits();
        $this->story->method('findTraitByUuid')->willReturnCallback(fn(int $s, string $u) => [
            'trait-1' => $this->costTrait(90001, 'trait-1', 50, 50),
            'trait-2' => $this->costTrait(90002, 'trait-2', 50, 50),
        ][$u] ?? null);
        $info = $this->service->join($this->cmd());
        $this->assertSame(['trait-1', 'trait-2'], $info->traitUuids);
    }
}
