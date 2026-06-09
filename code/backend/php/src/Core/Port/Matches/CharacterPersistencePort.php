<?php

namespace Games\Paths\Core\Port\Matches;

interface CharacterPersistencePort
{
    /** Insert a gaming_character_instance row; return the saved row (with uuid). */
    public function saveCharacter(array $row): array;

    public function saveBackpack(array $row): void;

    /** @param array[] $rows */
    public function saveTraits(array $rows): void;

    /** Already-joined check — returns the user's character in the match, or null. */
    public function findCharacterByMatchAndUser(int $matchId, int $userId): ?array;

    public function countCharactersByMatchId(int $matchId): int;
}
