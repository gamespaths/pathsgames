<?php

declare(strict_types=1);

namespace Games\Paths\Core\Service\Story;

use Games\Paths\Core\Domain\Story\StoryImportResult;
use Games\Paths\Core\Port\Story\StoryImportPort;
use Games\Paths\Core\Port\Story\StoryPersistencePort;
use Ramsey\Uuid\Uuid;

class StoryImportService implements StoryImportPort
{
    private StoryPersistencePort $persistencePort;

    public function __construct(StoryPersistencePort $persistencePort)
    {
        $this->persistencePort = $persistencePort;
    }

    public function importStory(array $data): StoryImportResult
    {
        if (empty($data)) {
            throw new \InvalidArgumentException("Empty import data");
        }

        $storyUuid = $data['uuid'] ?? '';
        if (trim($storyUuid) === '') {
            $storyUuid = Uuid::uuid4()->toString();
            $data['uuid'] = $storyUuid;
        }

        // Replace on conflict
        $this->deleteStory($storyUuid);

        // Check explicit story id
        $storyIdInput = self::getLong($data, 'id', 'idStory', 'id_story');
        if ($storyIdInput !== null) {
            if ($this->persistencePort->existsStoryId($storyIdInput)) {
                throw new \InvalidArgumentException("story/list_stories id={$storyIdInput} already present");
            }
        }

        // Save Header
        $storyId = $this->persistencePort->saveStory($data);

        // Texts
        $texts = $data['texts'] ?? [];
        if (!empty($texts)) {
            $this->validateEntityIds($storyId, $texts, 'list_texts', 'id');
            $this->persistencePort->saveTexts($storyId, $texts);
        }

        // Difficulties
        $diffs = $data['difficulties'] ?? [];
        if (!empty($diffs)) {
            foreach ($diffs as &$d) {
                if (empty($d['uuid'])) {
                    $d['uuid'] = Uuid::uuid4()->toString();
                }
            }
            unset($d);
            $this->validateEntityIds($storyId, $diffs, 'list_stories_difficulty', 'id');
            $this->persistencePort->saveDifficulties($storyId, $diffs);
        }

        // Other entities with explicit-id validation
        $entityMapping = [
            ['locations', 'list_locations', 'id', 'saveLocations'],
            ['events', 'list_events', 'id', 'saveEvents'],
            ['items', 'list_items', 'id', 'saveItems'],
            ['classes', 'list_classes', 'id', 'saveClasses'],
            ['choices', 'list_choices', 'id', 'saveChoices'],
            ['cards', 'list_cards', 'id', 'saveCards'],
            ['keys', 'list_keys', 'id', 'saveKeys'],
            ['traits', 'list_traits', 'id', 'saveTraits'],
            ['characterTemplates', 'list_character_templates', 'id_tipo', 'saveCharacterTemplates'],
            ['weatherRules', 'list_weather_rules', 'id', 'saveWeatherRules'],
            ['globalRandomEvents', 'list_global_random_events', 'id', 'saveGlobalRandomEvents'],
            ['missions', 'list_missions', 'id', 'saveMissions'],
            ['locationNeighbors', 'list_locations_neighbors', 'id', 'saveLocationNeighbors'],
            ['eventEffects', 'list_events_effects', 'id', 'saveEventEffects'],
            ['itemEffects', 'list_items_effects', 'id', 'saveItemEffects'],
            ['choiceConditions', 'list_choices_conditions', 'id', 'saveChoiceConditions'],
            ['choiceEffects', 'list_choices_effects', 'id', 'saveChoiceEffects'],
            ['classBonuses', 'list_classes_bonus', 'id', 'saveClassBonuses'],
            ['missionSteps', 'list_missions_steps', 'id', 'saveMissionSteps'],
            ['creators', 'list_creator', 'id', 'saveCreators'],
        ];

        foreach ($entityMapping as [$jsonKey, $tableName, $idCol, $method]) {
            $arr = $data[$jsonKey] ?? [];
            if (!empty($arr)) {
                $this->validateEntityIds($storyId, $arr, $tableName, $idCol);
                $this->persistencePort->$method($storyId, $arr);
            }
        }

        // Sync PostgreSQL sequences
        $this->persistencePort->syncSequences();

        return new StoryImportResult(
            $storyUuid,
            "IMPORTED",
            count($texts),
            count($data['locations'] ?? []),
            count($data['events'] ?? []),
            count($data['items'] ?? []),
            count($diffs),
            count($data['classes'] ?? []),
            count($data['choices'] ?? [])
        );
    }

    public function deleteStory(string $uuid): bool
    {
        if (trim($uuid) === '') {
            return false;
        }

        $storyId = $this->persistencePort->findStoryIdByUuid($uuid);
        if ($storyId === null) {
            return false;
        }

        $this->persistencePort->deleteStoryById($storyId);
        return true;
    }

    /**
     * Validate explicit IDs in items before they are saved.
     * If an item has an explicit 'id', check it's not already taken.
     */
    private function validateEntityIds(int $storyId, array $items, string $tableName, string $idColumn): void
    {
        foreach ($items as $item) {
            $itemId = self::getLong($item, 'id', 'id_tipo', 'idTipo');
            if ($itemId !== null) {
                if ($this->persistencePort->existsEntityId($tableName, $idColumn, $itemId, $storyId)) {
                    throw new \InvalidArgumentException("story/{$tableName} id={$itemId} already present");
                }
            }
        }
    }

    private static function getLong(array $data, string ...$keys): ?int
    {
        foreach ($keys as $key) {
            if (isset($data[$key])) {
                $v = $data[$key];
                if (is_int($v)) return $v;
                if (is_numeric($v)) return (int)$v;
            }
        }
        return null;
    }
}
