<?php

namespace Games\Paths\Core\Service\Matches;

use Games\Paths\Core\Domain\Matches\CharacterInstanceInfo;
use Games\Paths\Core\Port\Matches\CharacterQueryPort;
use Games\Paths\Core\Port\Matches\CharacterReadPort;
use Games\Paths\Core\Port\Matches\MatchPersistencePort;
use Games\Paths\Core\Port\Matches\StoryMatchReadPort;
use Games\Paths\Core\Port\Matches\UserAccessPort;

/**
 * Step 21 — read-side character service (players list, character detail).
 * Access is granted to the match creator or to any user who already has a
 * character in the match.
 */
class CharacterQueryService implements CharacterQueryPort
{
    public function __construct(
        private readonly MatchPersistencePort $matchPersistencePort,
        private readonly CharacterReadPort $characterReadPort,
        private readonly StoryMatchReadPort $storyReadPort,
        private readonly UserAccessPort $userAccessPort
    ) {
    }

    public function listPlayers(string $matchUuid, string $userUuid): ?array
    {
        if ($matchUuid === '' || $userUuid === '') {
            return null;
        }
        $match = $this->matchPersistencePort->findMatchByUuid($matchUuid);
        if ($match === null) {
            return null;
        }
        $user = $this->resolveAccess($match, $userUuid);
        if ($user === null) {
            return null;
        }
        $characters = $this->characterReadPort->findCharactersByMatchId((int)$match['id']);
        return CharacterMapper::buildAll(
            $characters, $match, $this->storyReadPort, $this->characterReadPort,
            $user['uuid'], (int)$user['id']
        );
    }

    public function getCharacter(string $matchUuid, string $characterUuid, string $userUuid): ?CharacterInstanceInfo
    {
        if ($matchUuid === '' || $characterUuid === '' || $userUuid === '') {
            return null;
        }
        $match = $this->matchPersistencePort->findMatchByUuid($matchUuid);
        if ($match === null) {
            return null;
        }
        $user = $this->resolveAccess($match, $userUuid);
        if ($user === null) {
            return null;
        }
        $character = $this->characterReadPort->findCharacterByMatchAndUuid((int)$match['id'], $characterUuid);
        if ($character === null) {
            return null;
        }
        $built = CharacterMapper::buildAll(
            [$character], $match, $this->storyReadPort, $this->characterReadPort,
            $user['uuid'], (int)$user['id']
        );
        return $built[0] ?? null;
    }

    private function resolveAccess(array $match, string $userUuid): ?array
    {
        $user = $this->userAccessPort->findByUuid($userUuid);
        if ($user === null) {
            return null;
        }
        if ((int)$user['id'] === (int)($match['id_user_creator'] ?? -1)) {
            return $user;
        }
        foreach ($this->characterReadPort->findCharactersByMatchId((int)$match['id']) as $c) {
            if ((int)($c['id_user'] ?? -1) === (int)$user['id']) {
                return $user;
            }
        }
        return null;
    }
}
