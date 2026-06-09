<?php

namespace Games\Paths\Core\Service\Matches;

use Games\Paths\Core\Domain\Matches\CharacterInstanceInfo;
use Games\Paths\Core\Port\Matches\CharacterReadPort;
use Games\Paths\Core\Port\Matches\StoryMatchReadPort;

/**
 * Step 21 — shared mapping helper used by {@see CharacterQueryService} and
 * {@see MatchQueryService}. Resolves the per-match characters into
 * {@see CharacterInstanceInfo} models (template uuid, trait uuids, backpack,
 * location). The {@code requesterUuid}/{@code requesterId} pair is echoed onto
 * the character owned by the requesting user.
 */
final class CharacterMapper
{
    /**
     * @param array[] $characters
     * @return CharacterInstanceInfo[]
     */
    public static function buildAll(
        array $characters,
        array $match,
        StoryMatchReadPort $storyReadPort,
        CharacterReadPort $characterReadPort,
        ?string $requesterUuid,
        ?int $requesterId
    ): array {
        if (empty($characters)) {
            return [];
        }
        $storyId = isset($match['id_story']) ? (int)$match['id_story'] : null;
        $templateUuidById = [];
        $traitUuidById = [];
        $locationById = [];
        if ($storyId !== null) {
            foreach ($storyReadPort->findCharacterTemplatesByStoryId($storyId) as $t) {
                $templateUuidById[(int)$t['id_tipo']] = $t['uuid'];
            }
            foreach ($storyReadPort->findTraitsByStoryId($storyId) as $t) {
                $traitUuidById[(int)$t['id']] = $t['uuid'];
            }
            foreach ($storyReadPort->findLocationsByStoryId($storyId) as $l) {
                $locationById[(int)$l['id']] = $l;
            }
        }

        $matchId = (int)$match['id'];
        $result = [];
        foreach ($characters as $c) {
            $backpack = $characterReadPort->findBackpack($matchId, (int)$c['id']) ?? [];
            $traitUuids = [];
            foreach ($characterReadPort->findTraits($matchId, (int)$c['id']) as $row) {
                $uuid = $traitUuidById[(int)$row['id_traits']] ?? null;
                if ($uuid !== null) {
                    $traitUuids[] = $uuid;
                }
            }
            $locId = $c['id_location'] ?? null;
            $loc = ($locId !== null && isset($locationById[(int)$locId])) ? $locationById[(int)$locId] : null;
            $userUuid = ($requesterId !== null && $requesterId === (int)($c['id_user'] ?? -1))
                ? $requesterUuid : null;
            $result[] = new CharacterInstanceInfo(
                uuid: $c['uuid'],
                matchUuid: $match['uuid'],
                userUuid: $userUuid,
                characterTemplateUuid: $templateUuidById[(int)($c['id_character_template'] ?? -1)] ?? null,
                classUuid: null,
                dexterity: (int)$c['dexterity'],
                intelligence: (int)$c['intelligence'],
                constitution: (int)$c['constitution'],
                energy: (int)$c['energy'],
                life: (int)$c['life'],
                sad: (int)$c['sad'],
                idLocation: $locId !== null ? (int)$locId : null,
                locationUuid: $loc['uuid'] ?? null,
                locationName: $loc !== null ? 'location-' . $loc['id'] : null,
                isSleeping: (int)$c['is_sleeping'],
                isComa: (int)$c['is_coma'],
                traitUuids: $traitUuids,
                food: (int)($backpack['food'] ?? 0),
                magic: (int)($backpack['magic'] ?? 0),
                coin: (int)($backpack['coin'] ?? 0)
            );
        }
        return $result;
    }
}
