<?php

namespace Games\Paths\Core\Service\Matches;

use Games\Paths\Core\Domain\Matches\MatchCreateCommand;
use Games\Paths\Core\Domain\Matches\MatchCreationException;
use Games\Paths\Core\Domain\Matches\MatchSummary;
use Games\Paths\Core\Port\Matches\MatchCommandPort;
use Games\Paths\Core\Port\Matches\MatchPersistencePort;
use Games\Paths\Core\Port\Matches\StoryMatchReadPort;
use Games\Paths\Core\Port\Matches\SystemModePort;
use Games\Paths\Core\Port\Matches\UserAccessPort;

class MatchCommandService implements MatchCommandPort
{
    private const BANNED_STATES = [3, 4];

    public function __construct(
        private readonly StoryMatchReadPort $storyReadPort,
        private readonly MatchPersistencePort $persistencePort,
        private readonly UserAccessPort $userAccessPort,
        private readonly SystemModePort $systemModePort
    ) {
    }

    public function createMatch(MatchCreateCommand $command): MatchSummary
    {
        if ($command->getUserUuid() === '' || $command->getStoryUuid() === '' || $command->getDifficultyUuid() === '') {
            throw new MatchCreationException(
                MatchCreationException::INVALID_INPUT,
                'userUuid, storyUuid and difficultyUuid are required'
            );
        }

        if ($this->systemModePort->isMaintenance()) {
            throw new MatchCreationException(
                MatchCreationException::MAINTENANCE_MODE,
                'Server is under maintenance, no new match can be created'
            );
        }

        $user = $this->userAccessPort->findByUuid($command->getUserUuid());
        if ($user === null) {
            throw new MatchCreationException(
                MatchCreationException::USER_NOT_FOUND,
                'User does not exist'
            );
        }
        $state = $user['state'] ?? null;
        if ($state !== null && in_array((int)$state, self::BANNED_STATES, true)) {
            throw new MatchCreationException(
                MatchCreationException::USER_BANNED,
                'User is not allowed to create matches'
            );
        }

        $story = $this->storyReadPort->findStoryByUuid($command->getStoryUuid());
        if ($story === null) {
            throw new MatchCreationException(
                MatchCreationException::STORY_NOT_FOUND,
                'Story not found: ' . $command->getStoryUuid()
            );
        }

        $difficulty = $this->storyReadPort->findDifficultyByUuid($story['id'], $command->getDifficultyUuid());
        if ($difficulty === null) {
            throw new MatchCreationException(
                MatchCreationException::DIFFICULTY_NOT_FOUND,
                'Difficulty not found: ' . $command->getDifficultyUuid()
            );
        }

        $locations = $this->storyReadPort->findLocationsByStoryId($story['id']);
        if (empty($locations)) {
            throw new MatchCreationException(
                MatchCreationException::STORY_HAS_NO_LOCATIONS,
                'Story has no locations defined'
            );
        }
        $keys = $this->storyReadPort->findKeysByStoryId($story['id']);

        $expCost = $difficulty['exp_cost'] ?? 5;

        $saved = $this->persistencePort->saveMatch([
            'id_story' => $story['id'],
            'id_difficulty' => $difficulty['id'],
            'id_user_creator' => $user['id'],
            'name' => $command->getName(),
            'status' => 'CREATED',
            'current_clock' => 0,
            'exp_cost' => $expCost,
            'single_player' => $command->getSinglePlayer() ?? 1,
            'character_template_uuid' => $command->getCharacterTemplateUuid(),
            'class_uuid' => $command->getClassUuid(),
            'trait_uuids' => $command->getTraitUuids(),
        ]);

        $locationRows = [];
        foreach ($locations as $loc) {
            $locationRows[] = [
                'id_match' => $saved['id'],
                'id_location' => $loc['id'],
                'flag_already_actived' => 0,
                'clock_counter' => $loc['counter_start'] ?? $loc['counter_time'] ?? 0,
            ];
        }
        $this->persistencePort->saveLocations($locationRows);

        $registryRows = [];
        $nextId = 1;
        foreach ($keys as $k) {
            $row = [
                'id' => $nextId++,
                'id_match' => $saved['id'],
                'key' => $k['key_name'] ?? $k['name'] ?? '',
                'string_value' => null,
                'int_value' => null,
            ];
            $this->applyDefault($row, $k['key_value'] ?? $k['value'] ?? null);
            $registryRows[] = $row;
        }
        $this->persistencePort->saveRegistry($registryRows);

        return new MatchSummary(
            uuid: $saved['uuid'],
            storyUuid: $story['uuid'],
            difficultyUuid: $difficulty['uuid'],
            name: $saved['name'] ?? null,
            status: $saved['status'],
            currentClock: (int)($saved['current_clock'] ?? 0),
            expCost: (int)($saved['exp_cost'] ?? 0),
            userCreatorUuid: $user['uuid'],
            tsInsert: $saved['ts_insert'],
            singlePlayer: isset($saved['single_player']) ? (int)$saved['single_player'] : null,
            characterTemplateUuid: $saved['character_template_uuid'] ?? null,
            classUuid: $saved['class_uuid'] ?? null,
            traitUuids: $saved['trait_uuids'] ?? []
        );
    }

    private function applyDefault(array &$row, $rawValue): void
    {
        if ($rawValue === null) {
            return;
        }
        $value = (string)$rawValue;
        $trimmed = trim($value);
        if ($trimmed === '') {
            $row['string_value'] = '';
            return;
        }
        if (preg_match('/^-?\d+$/', $trimmed)) {
            $row['int_value'] = (int)$trimmed;
        } else {
            $row['string_value'] = $trimmed;
        }
    }
}
