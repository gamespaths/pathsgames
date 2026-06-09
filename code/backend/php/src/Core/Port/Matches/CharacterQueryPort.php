<?php

namespace Games\Paths\Core\Port\Matches;

use Games\Paths\Core\Domain\Matches\CharacterInstanceInfo;

interface CharacterQueryPort
{
    /**
     * Step 21 — list the characters of a match, or null when the match is
     * missing or the user has no access.
     *
     * @return CharacterInstanceInfo[]|null
     */
    public function listPlayers(string $matchUuid, string $userUuid): ?array;

    /**
     * Step 21 — return a single character detail, or null when missing / not
     * accessible.
     */
    public function getCharacter(string $matchUuid, string $characterUuid, string $userUuid): ?CharacterInstanceInfo;
}
