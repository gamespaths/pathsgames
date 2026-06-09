<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Service\Matches;

use Games\Paths\Core\Port\Matches\CharacterReadPort;
use Games\Paths\Core\Port\Matches\MatchPersistencePort;
use Games\Paths\Core\Port\Matches\StoryMatchReadPort;
use Games\Paths\Core\Port\Matches\UserAccessPort;
use Games\Paths\Core\Service\Matches\CharacterQueryService;
use PHPUnit\Framework\TestCase;

class CharacterQueryServiceTest extends TestCase
{
    private $matchP;
    private $charR;
    private $story;
    private $userA;
    private CharacterQueryService $service;

    protected function setUp(): void
    {
        $this->matchP = $this->createMock(MatchPersistencePort::class);
        $this->charR = $this->createMock(CharacterReadPort::class);
        $this->story = $this->createMock(StoryMatchReadPort::class);
        $this->userA = $this->createMock(UserAccessPort::class);
        $this->service = new CharacterQueryService($this->matchP, $this->charR, $this->story, $this->userA);
    }

    private function match(int $creator = 7): array
    {
        return ['id' => 500, 'uuid' => 'match-uuid', 'id_story' => 9001, 'id_user_creator' => $creator];
    }

    private function user(): array
    {
        return ['id' => 7, 'uuid' => 'user-uuid', 'state' => 6];
    }

    private function character(): array
    {
        return ['id' => 1, 'uuid' => 'char-uuid', 'id_match' => 500, 'id_user' => 7,
                'id_character_template' => 90001, 'dexterity' => 19, 'intelligence' => 18,
                'constitution' => 19, 'energy' => 127, 'life' => 137, 'sad' => 0,
                'id_location' => 90001, 'is_sleeping' => 0, 'is_coma' => 0];
    }

    private function wireLookups(): void
    {
        $this->story->method('findCharacterTemplatesByStoryId')->willReturn([['id_tipo' => 90001, 'uuid' => 'tpl-uuid']]);
        $this->story->method('findTraitsByStoryId')->willReturn([['id' => 90001, 'uuid' => 'trait-1']]);
        $this->story->method('findLocationsByStoryId')->willReturn([['id' => 90001, 'uuid' => 'loc-uuid']]);
        $this->charR->method('findBackpack')->willReturn(['food' => 1, 'magic' => 2, 'coin' => 3]);
        $this->charR->method('findTraits')->willReturn([['id_traits' => 90001]]);
    }

    public function testListPlayersBlank(): void
    {
        $this->assertNull($this->service->listPlayers('', 'u'));
        $this->assertNull($this->service->listPlayers('m', ''));
    }

    public function testListPlayersMatchNotFound(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn(null);
        $this->assertNull($this->service->listPlayers('m', 'u'));
    }

    public function testListPlayersUserUnknown(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match());
        $this->userA->method('findByUuid')->willReturn(null);
        $this->assertNull($this->service->listPlayers('match-uuid', 'user-uuid'));
    }

    public function testListPlayersNoAccess(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match(999));
        $this->userA->method('findByUuid')->willReturn($this->user());
        $this->charR->method('findCharactersByMatchId')->willReturn([]);
        $this->assertNull($this->service->listPlayers('match-uuid', 'user-uuid'));
    }

    public function testListPlayersCreator(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match());
        $this->userA->method('findByUuid')->willReturn($this->user());
        $this->charR->method('findCharactersByMatchId')->willReturn([$this->character()]);
        $this->wireLookups();
        $players = $this->service->listPlayers('match-uuid', 'user-uuid');
        $this->assertCount(1, $players);
        $this->assertSame('char-uuid', $players[0]->uuid);
        $this->assertSame('tpl-uuid', $players[0]->characterTemplateUuid);
        $this->assertSame('user-uuid', $players[0]->userUuid);
        $this->assertSame(['trait-1'], $players[0]->traitUuids);
        $this->assertSame('loc-uuid', $players[0]->locationUuid);
        $this->assertSame(1, $players[0]->food);
    }

    public function testListPlayersParticipant(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match(999));
        $this->userA->method('findByUuid')->willReturn($this->user());
        $this->charR->method('findCharactersByMatchId')->willReturn([$this->character()]);
        $this->wireLookups();
        $this->assertCount(1, $this->service->listPlayers('match-uuid', 'user-uuid'));
    }

    public function testGetCharacterBlank(): void
    {
        $this->assertNull($this->service->getCharacter('', 'c', 'u'));
        $this->assertNull($this->service->getCharacter('m', '', 'u'));
    }

    public function testGetCharacterMatchNotFound(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn(null);
        $this->assertNull($this->service->getCharacter('m', 'c', 'u'));
    }

    public function testGetCharacterNoAccess(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match(999));
        $this->userA->method('findByUuid')->willReturn($this->user());
        $this->charR->method('findCharactersByMatchId')->willReturn([]);
        $this->assertNull($this->service->getCharacter('match-uuid', 'c', 'user-uuid'));
    }

    public function testGetCharacterNotFound(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match());
        $this->userA->method('findByUuid')->willReturn($this->user());
        $this->charR->method('findCharacterByMatchAndUuid')->willReturn(null);
        $this->assertNull($this->service->getCharacter('match-uuid', 'c', 'user-uuid'));
    }

    public function testGetCharacterFound(): void
    {
        $this->matchP->method('findMatchByUuid')->willReturn($this->match());
        $this->userA->method('findByUuid')->willReturn($this->user());
        $this->charR->method('findCharacterByMatchAndUuid')->willReturn($this->character());
        $this->wireLookups();
        $info = $this->service->getCharacter('match-uuid', 'char-uuid', 'user-uuid');
        $this->assertNotNull($info);
        $this->assertSame('char-uuid', $info->uuid);
        $this->assertSame(137, $info->life);
        $this->assertSame(['trait-1'], $info->traitUuids);
        $this->assertSame(2, $info->magic);
    }
}
