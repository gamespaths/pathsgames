<?php

namespace Games\Paths\Core\Service\Matches;

use Games\Paths\Core\Domain\Matches\CharacterInstanceInfo;
use Games\Paths\Core\Domain\Matches\CharacterJoinException;
use Games\Paths\Core\Domain\Matches\JoinMatchCommand;
use Games\Paths\Core\Domain\Matches\MatchStatuses;
use Games\Paths\Core\Port\Matches\CharacterCommandPort;
use Games\Paths\Core\Port\Matches\CharacterPersistencePort;
use Games\Paths\Core\Port\Matches\MatchPersistencePort;
use Games\Paths\Core\Port\Matches\StoryMatchReadPort;
use Games\Paths\Core\Port\Matches\UserAccessPort;

class CharacterCommandService implements CharacterCommandPort
{
    private const BANNED_STATES = [3, 4];

    public function __construct(
        private readonly StoryMatchReadPort $storyReadPort,
        private readonly MatchPersistencePort $matchPersistencePort,
        private readonly UserAccessPort $userAccessPort,
        private readonly CharacterPersistencePort $characterPersistencePort
    ) {
    }

    public function join(JoinMatchCommand $command): CharacterInstanceInfo
    {
        if ($command->getMatchUuid() === '' || $command->getUserUuid() === '') {
            throw new CharacterJoinException(
                CharacterJoinException::INVALID_INPUT,
                'matchUuid and userUuid are required'
            );
        }

        $match = $this->matchPersistencePort->findMatchByUuid($command->getMatchUuid());
        if ($match === null) {
            throw new CharacterJoinException(
                CharacterJoinException::MATCH_NOT_FOUND,
                'Match not found: ' . $command->getMatchUuid()
            );
        }
        if (MatchStatuses::isTerminal($match['status'] ?? null)) {
            throw new CharacterJoinException(
                CharacterJoinException::MATCH_NOT_JOINABLE,
                'Match is in a terminal status and cannot be joined'
            );
        }

        $user = $this->userAccessPort->findByUuid($command->getUserUuid());
        if ($user === null) {
            throw new CharacterJoinException(CharacterJoinException::USER_NOT_FOUND, 'User does not exist');
        }
        $state = $user['state'] ?? null;
        if ($state !== null && in_array((int)$state, self::BANNED_STATES, true)) {
            throw new CharacterJoinException(
                CharacterJoinException::USER_BANNED,
                'User is not allowed to join matches'
            );
        }

        if ($this->characterPersistencePort->findCharacterByMatchAndUser((int)$match['id'], (int)$user['id']) !== null) {
            throw new CharacterJoinException(
                CharacterJoinException::ALREADY_JOINED,
                'User already has a character in this match'
            );
        }

        $story = $this->storyReadPort->findStoryById((int)$match['id_story']);
        if ($story === null) {
            throw new CharacterJoinException(CharacterJoinException::MATCH_NOT_FOUND, 'Match story not found');
        }

        $templateUuid = $this->firstNonEmpty($command->getCharacterTemplateUuid(), $match['character_template_uuid'] ?? null);
        $classUuid = $this->firstNonEmpty($command->getClassUuid(), $match['class_uuid'] ?? null);
        $traitUuids = !empty($command->getTraitUuids()) ? $command->getTraitUuids() : ($match['trait_uuids'] ?? []);
        if ($templateUuid === null || $templateUuid === '') {
            throw new CharacterJoinException(
                CharacterJoinException::INVALID_INPUT,
                'characterTemplateUuid is required (none provided and none stored on the match)'
            );
        }

        $template = $this->storyReadPort->findCharacterTemplateByUuid((int)$story['id'], $templateUuid);
        if ($template === null) {
            throw new CharacterJoinException(
                CharacterJoinException::TEMPLATE_NOT_FOUND,
                'Character template not found: ' . $templateUuid
            );
        }

        $class = null;
        if ($classUuid !== null && $classUuid !== '') {
            $class = $this->storyReadPort->findClassByUuid((int)$story['id'], $classUuid);
            if ($class === null) {
                throw new CharacterJoinException(
                    CharacterJoinException::CLASS_NOT_FOUND,
                    'Class not found: ' . $classUuid
                );
            }
            $this->validateClass($template, $class);
        }

        $traits = $this->resolveTraits((int)$story['id'], $traitUuids);
        $difficulty = $this->storyReadPort->findDifficultyById((int)$story['id'], (int)$match['id_difficulty']);
        $bonuses = $this->resolveBonuses((int)$story['id'], $class);

        $nextId = $this->characterPersistencePort->countCharactersByMatchId((int)$match['id']) + 1;
        $instance = $this->buildInstance($match, $user, $story, $template, $class, $difficulty, $traits, $bonuses, $nextId);
        $saved = $this->characterPersistencePort->saveCharacter($instance);

        $this->characterPersistencePort->saveBackpack([
            'id' => $saved['id'],
            'id_match' => (int)$match['id'],
            'id_character_match' => $saved['id'],
            'food' => 0,
            'magic' => 0,
            'coin' => 0,
        ]);

        $traitRows = [];
        $traitId = 1;
        foreach ($traits as $t) {
            $traitRows[] = [
                'id' => $traitId++,
                'id_match' => (int)$match['id'],
                'id_character_match' => $saved['id'],
                'id_traits' => (int)$t['id'],
            ];
        }
        $this->characterPersistencePort->saveTraits($traitRows);

        return $this->toInfo($saved, $match, $story, $user['uuid'], $templateUuid, $classUuid, $traitUuids);
    }

    private function validateClass(array $template, array $class): void
    {
        $classId = (int)$class['id'];
        $permitted = $template['id_class_permitted'] ?? null;
        $prohibited = $template['id_class_prohibited'] ?? null;
        if ($permitted !== null && (int)$permitted !== $classId) {
            throw new CharacterJoinException(
                CharacterJoinException::CLASS_NOT_COMPATIBLE,
                'Selected class is not permitted for this character template'
            );
        }
        if ($prohibited !== null && (int)$prohibited === $classId) {
            throw new CharacterJoinException(
                CharacterJoinException::CLASS_NOT_COMPATIBLE,
                'Selected class is prohibited for this character template'
            );
        }
    }

    private function resolveTraits(int $storyId, array $traitUuids): array
    {
        $resolved = [];
        foreach ($traitUuids as $uuid) {
            if ($uuid === null || $uuid === '') {
                continue;
            }
            $trait = $this->storyReadPort->findTraitByUuid($storyId, (string)$uuid);
            if ($trait !== null) {
                $resolved[] = $trait;
            }
        }
        return $resolved;
    }

    private function resolveBonuses(int $storyId, ?array $class): array
    {
        if ($class === null) {
            return [];
        }
        $out = [];
        foreach ($this->storyReadPort->findClassBonusesByStoryId($storyId) as $b) {
            if ((int)($b['id_class'] ?? 0) === (int)$class['id']) {
                $out[] = $b;
            }
        }
        return $out;
    }

    private function buildInstance(array $match, array $user, array $story, array $template,
                                   ?array $class, ?array $difficulty, array $traits, array $bonuses, int $nextId): array
    {
        $dexterity = $this->nz($template['dexterity_start'] ?? 0)
            + $this->nz($class['dexterity_base'] ?? 0)
            + $this->nz($difficulty['dexterity'] ?? 0)
            + $this->sumTrait($traits, 'dexterity') + $this->sumBonus($bonuses, 'dex');
        $intelligence = $this->nz($template['intelligence_start'] ?? 0)
            + $this->nz($class['intelligence_base'] ?? 0)
            + $this->nz($difficulty['intelligence'] ?? 0)
            + $this->sumTrait($traits, 'intelligence') + $this->sumBonus($bonuses, 'int');
        $constitution = $this->nz($template['constitution_start'] ?? 0)
            + $this->nz($class['constitution_base'] ?? 0)
            + $this->nz($difficulty['constitution'] ?? 0)
            + $this->sumTrait($traits, 'constitution') + $this->sumBonus($bonuses, 'con');
        $lifeMax = $this->nz($template['life_max'] ?? 0)
            + $this->nz($difficulty['life'] ?? 0)
            + $this->sumTrait($traits, 'life') + $this->sumBonus($bonuses, 'life');
        $energyMax = $this->nz($template['energy_max'] ?? 0)
            + $this->nz($difficulty['energy'] ?? 0)
            + $this->sumTrait($traits, 'energy') + $this->sumBonus($bonuses, 'energy');

        return [
            'id' => $nextId,
            'id_match' => (int)$match['id'],
            'id_user' => (int)$user['id'],
            'id_character_template' => (int)$template['id_tipo'],
            'dexterity' => $dexterity,
            'intelligence' => $intelligence,
            'constitution' => $constitution,
            'life' => $lifeMax,       // start full
            'energy' => $energyMax,   // start full
            'sad' => 0,
            'id_location' => isset($story['id_location_start']) ? (int)$story['id_location_start'] : null,
            'is_sleeping' => 0,
            'is_coma' => 0,
        ];
    }

    private function toInfo(array $saved, array $match, array $story, string $userUuid,
                            string $templateUuid, ?string $classUuid, array $traitUuids): CharacterInstanceInfo
    {
        $locationUuid = null;
        $locationName = null;
        $locId = $saved['id_location'] ?? null;
        if ($locId !== null) {
            foreach ($this->storyReadPort->findLocationsByStoryId((int)$story['id']) as $loc) {
                if ((int)$loc['id'] === (int)$locId) {
                    $locationUuid = $loc['uuid'];
                    $locationName = 'location-' . $loc['id'];
                    break;
                }
            }
        }
        return new CharacterInstanceInfo(
            uuid: $saved['uuid'],
            matchUuid: $match['uuid'],
            userUuid: $userUuid,
            characterTemplateUuid: $templateUuid,
            classUuid: $classUuid,
            dexterity: (int)$saved['dexterity'],
            intelligence: (int)$saved['intelligence'],
            constitution: (int)$saved['constitution'],
            energy: (int)$saved['energy'],
            life: (int)$saved['life'],
            sad: (int)$saved['sad'],
            idLocation: $locId !== null ? (int)$locId : null,
            locationUuid: $locationUuid,
            locationName: $locationName,
            isSleeping: (int)$saved['is_sleeping'],
            isComa: (int)$saved['is_coma'],
            traitUuids: array_values($traitUuids),
            food: 0,
            magic: 0,
            coin: 0
        );
    }

    private function firstNonEmpty(?string $a, ?string $b): ?string
    {
        return ($a !== null && $a !== '') ? $a : $b;
    }

    private function nz($v): int
    {
        return $v !== null ? (int)$v : 0;
    }

    private function sumTrait(array $traits, string $stat): int
    {
        $total = 0;
        foreach ($traits as $t) {
            $total += $this->nz($t[$stat] ?? 0);
        }
        return $total;
    }

    private function sumBonus(array $bonuses, string $stat): int
    {
        $total = 0;
        foreach ($bonuses as $b) {
            if (strtolower((string)($b['statistic'] ?? '')) === $stat) {
                $total += $this->nz($b['value'] ?? 0);
            }
        }
        return $total;
    }
}
