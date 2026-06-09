<?php

namespace Games\Paths\Core\Port\Matches;

interface CharacterReadPort
{
    public function findCharactersByMatchId(int $matchId): array;

    public function findCharacterByMatchAndUuid(int $matchId, string $uuid): ?array;

    public function findBackpack(int $matchId, int $characterId): ?array;

    public function findTraits(int $matchId, int $characterId): array;
}
