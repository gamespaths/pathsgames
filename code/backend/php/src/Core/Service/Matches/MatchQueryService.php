<?php

namespace Games\Paths\Core\Service\Matches;

use Games\Paths\Core\Domain\Matches\MatchDetail;
use Games\Paths\Core\Domain\Matches\MatchLocationState;
use Games\Paths\Core\Domain\Matches\MatchRegistryEntry;
use Games\Paths\Core\Domain\Matches\MatchSummary;
use Games\Paths\Core\Port\Matches\MatchPersistencePort;
use Games\Paths\Core\Port\Matches\MatchQueryPort;
use Games\Paths\Core\Port\Matches\StoryMatchReadPort;
use Games\Paths\Core\Port\Matches\UserAccessPort;

class MatchQueryService implements MatchQueryPort
{
    public function __construct(
        private readonly MatchPersistencePort $persistencePort,
        private readonly StoryMatchReadPort $storyReadPort,
        private readonly UserAccessPort $userAccessPort
    ) {
    }

    public function listUserMatches(string $userUuid): array
    {
        if ($userUuid === '') {
            return [];
        }
        $user = $this->userAccessPort->findByUuid($userUuid);
        if ($user === null) {
            return [];
        }
        $rows = $this->persistencePort->findMatchesByUserId((int)$user['id']);
        $out = [];
        foreach ($rows as $row) {
            $out[] = $this->toSummary($row, $user['uuid'], null, null);
        }
        return $out;
    }

    public function listAllMatches(): array
    {
        $rows = $this->persistencePort->findAllMatches();
        $out = [];
        foreach ($rows as $row) {
            $out[] = $this->toSummary($row, null, null, null);
        }
        return $out;
    }

    public function getMatchInfo(string $matchUuid, string $userUuid): ?MatchDetail
    {
        if ($matchUuid === '' || $userUuid === '') {
            return null;
        }
        $user = $this->userAccessPort->findByUuid($userUuid);
        if ($user === null) {
            return null;
        }
        $match = $this->persistencePort->findMatchByUuid($matchUuid);
        if ($match === null || (int)$match['id_user_creator'] !== (int)$user['id']) {
            return null;
        }

        $story = $this->storyReadPort->findStoryById((int)$match['id_story']);
        $difficulty = $story !== null
            ? $this->storyReadPort->findDifficultyById((int)$match['id_story'], (int)$match['id_difficulty'])
            : null;

        $locations = $story !== null
            ? $this->storyReadPort->findLocationsByStoryId((int)$match['id_story'])
            : [];
        $locationsById = [];
        foreach ($locations as $l) {
            $locationsById[$l['id']] = $l;
        }

        $stateRows = $this->persistencePort->findLocationsByMatchId((int)$match['id']);
        $locationStates = [];
        foreach ($stateRows as $row) {
            $name = isset($locationsById[$row['id_location']]) ? "location-{$row['id_location']}" : null;
            $locationStates[] = new MatchLocationState(
                idLocation: (int)$row['id_location'],
                uuid: $row['uuid'],
                flagAlreadyActived: (int)$row['flag_already_actived'],
                clockCounter: (int)($row['clock_counter'] ?? 0),
                name: $name
            );
        }

        $registryRows = $this->persistencePort->findRegistryByMatchId((int)$match['id']);
        $registry = [];
        foreach ($registryRows as $row) {
            $registry[] = new MatchRegistryEntry(
                uuid: $row['uuid'],
                key: $row['key'],
                stringValue: $row['string_value'] ?? null,
                intValue: isset($row['int_value']) ? (int)$row['int_value'] : null
            );
        }

        $currentLocationId = $story['id_location_start'] ?? null;
        $currentLocation = $currentLocationId !== null && isset($locationsById[$currentLocationId])
            ? $locationsById[$currentLocationId]
            : null;

        return new MatchDetail(
            match: $this->toSummary(
                $match,
                $user['uuid'],
                $story['uuid'] ?? null,
                $difficulty['uuid'] ?? null
            ),
            currentLocationId: $currentLocationId !== null ? (int)$currentLocationId : null,
            currentLocationUuid: $currentLocation['uuid'] ?? null,
            currentLocationName: $currentLocation !== null ? "location-{$currentLocation['id']}" : null,
            locations: $locationStates,
            registry: $registry,
            events: [],
            choices: []
        );
    }

    private function toSummary(array $row, ?string $userUuid, ?string $storyUuid, ?string $difficultyUuid): MatchSummary
    {
        return new MatchSummary(
            uuid: $row['uuid'],
            storyUuid: $storyUuid,
            difficultyUuid: $difficultyUuid,
            name: $row['name'] ?? null,
            status: $row['status'],
            currentClock: (int)($row['current_clock'] ?? 0),
            expCost: (int)($row['exp_cost'] ?? 0),
            userCreatorUuid: $userUuid,
            tsInsert: $row['ts_insert'],
            singlePlayer: isset($row['single_player']) ? (int)$row['single_player'] : null,
            characterTemplateUuid: $row['character_template_uuid'] ?? null,
            classUuid: $row['class_uuid'] ?? null,
            traitUuids: $row['trait_uuids'] ?? []
        );
    }
}
