<?php

declare(strict_types=1);

namespace Games\Paths\Core\Service\Story;

use Games\Paths\Core\Port\Story\StoryCrudPort;
use Games\Paths\Core\Port\Story\StoryReadPort;
use Games\Paths\Core\Port\Story\StoryPersistencePort;

/**
 * StoryCrudService — Domain service implementing admin CRUD for all story entities.
 * Step 17: Provides create, read, update, delete for every story sub-table.
 */
class StoryCrudService implements StoryCrudPort
{
    private StoryReadPort $readPort;
    private StoryPersistencePort $persistencePort;

    private const TABLE_MAP = [
        'difficulties' => 'list_stories_difficulty',
        'locations' => 'list_locations',
        'location-neighbors' => 'list_locations_neighbors',
        'events' => 'list_events',
        'event-effects' => 'list_events_effects',
        'items' => 'list_items',
        'item-effects' => 'list_items_effects',
        'character-templates' => 'list_character_templates',
        'classes' => 'list_classes',
        'class-bonuses' => 'list_classes_bonus',
        'traits' => 'list_traits',
        'creators' => 'list_creator',
        'cards' => 'list_cards',
        'texts' => 'list_texts',
        'keys' => 'list_keys',
        'choices' => 'list_choices',
        'choice-conditions' => 'list_choices_conditions',
        'choice-effects' => 'list_choices_effects',
        'weather-rules' => 'list_weather_rules',
        'global-random-events' => 'list_global_random_events',
        'missions' => 'list_missions',
        'mission-steps' => 'list_missions_steps',
    ];

    public function __construct(StoryReadPort $readPort, StoryPersistencePort $persistencePort)
    {
        $this->readPort = $readPort;
        $this->persistencePort = $persistencePort;
    }

    public function listEntities(string $storyUuid, string $entityType): ?array
    {
        if (empty($storyUuid) || empty($entityType)) {
            return null;
        }
        $sid = $this->resolveStoryId($storyUuid);
        if ($sid === null) {
            return null;
        }
        $raw = $this->listByType($sid, $entityType);
        return array_map([$this, 'toCamelKeys'], $raw);
    }

    public function getEntity(string $storyUuid, string $entityType, string $entityUuid): ?array
    {
        if (empty($storyUuid) || empty($entityType) || empty($entityUuid)) {
            return null;
        }
        $sid = $this->resolveStoryId($storyUuid);
        if ($sid === null) {
            return null;
        }
        $table = self::TABLE_MAP[$entityType] ?? null;
        if (!$table) {
            return null;
        }
        $raw = $this->readPort->findEntityByStoryAndUuid($sid, $table, $entityUuid);
        return $raw ? $this->toCamelKeys($raw) : null;
    }

    public function createEntity(string $storyUuid, string $entityType, array $data): ?array
    {
        if (empty($storyUuid) || empty($entityType) || empty($data)) {
            return null;
        }
        $sid = $this->resolveStoryId($storyUuid);
        if ($sid === null) {
            return null;
        }
        $table = self::TABLE_MAP[$entityType] ?? null;
        if (!$table) {
            return null;
        }
        $newUuid = $this->generateUuid();
        $data['uuid'] = $newUuid;
        $this->persistencePort->saveEntity($sid, $table, $data);
        $raw = $this->readPort->findEntityByStoryAndUuid($sid, $table, $newUuid);
        return $raw ? $this->toCamelKeys($raw) : null;
    }

    public function updateEntity(string $storyUuid, string $entityType, string $entityUuid, array $data): ?array
    {
        if (empty($storyUuid) || empty($entityType) || empty($entityUuid) || empty($data)) {
            return null;
        }
        $sid = $this->resolveStoryId($storyUuid);
        if ($sid === null) {
            return null;
        }
        $table = self::TABLE_MAP[$entityType] ?? null;
        if (!$table) {
            return null;
        }
        $existing = $this->readPort->findEntityByStoryAndUuid($sid, $table, $entityUuid);
        if (!$existing) {
            return null;
        }
        $this->persistencePort->updateEntity($sid, $table, $entityUuid, $data);
        $raw = $this->readPort->findEntityByStoryAndUuid($sid, $table, $entityUuid);
        return $raw ? $this->toCamelKeys($raw) : null;
    }

    public function deleteEntity(string $storyUuid, string $entityType, string $entityUuid): bool
    {
        if (empty($storyUuid) || empty($entityType) || empty($entityUuid)) {
            return false;
        }
        $sid = $this->resolveStoryId($storyUuid);
        if ($sid === null) {
            return false;
        }
        $table = self::TABLE_MAP[$entityType] ?? null;
        if (!$table) {
            return false;
        }
        $existing = $this->readPort->findEntityByStoryAndUuid($sid, $table, $entityUuid);
        if (!$existing) {
            return false;
        }
        $this->persistencePort->deleteEntityByUuid($table, $entityUuid);
        return true;
    }

    public function getStory(string $storyUuid): ?array
    {
        if (empty($storyUuid)) {
            return null;
        }
        $raw = $this->readPort->findStoryByUuid($storyUuid);
        if ($raw === null) {
            return null;
        }
        return [
            'id'                       => $raw['id'] ?? null,
            'uuid'                     => $raw['uuid'] ?? null,
            'author'                   => $raw['author'] ?? null,
            'category'                 => $raw['category'] ?? null,
            'group'                    => $raw['group_name'] ?? null,
            'visibility'               => $raw['visibility'] ?? null,
            'priority'                 => $raw['priority'] ?? null,
            'peghi'                    => $raw['peghi'] ?? null,
            'versionMin'               => $raw['version_min'] ?? null,
            'versionMax'               => $raw['version_max'] ?? null,
            'idTextClockSingular'      => $raw['id_text_clock_singular'] ?? null,
            'idTextClockPlural'        => $raw['id_text_clock_plural'] ?? null,
            'linkCopyright'            => $raw['link_copyright'] ?? null,
            'idCard'                   => $raw['id_card'] ?? null,
            'idTextName'               => $raw['id_text_name'] ?? null,
            'idTextTitle'              => $raw['id_text_title'] ?? null,
            'idTextDescription'        => $raw['id_text_description'] ?? null,
            'idTextCopyright'          => $raw['id_text_copyright'] ?? null,
            'idLocationStart'          => $raw['id_location_start'] ?? null,
            'idImage'                  => $raw['id_image'] ?? null,
            'idCreator'                => $raw['id_creator'] ?? null,
            'idLocationAllPlayerComa'  => $raw['id_location_all_player_coma'] ?? null,
            'idEventAllPlayerComa'     => $raw['id_event_all_player_coma'] ?? null,
            'idEventEndGame'           => $raw['id_event_end_game'] ?? null,
        ];
    }

    public function createStory(array $data): ?array
    {
        if (empty($data)) {
            return null;
        }
        $newUuid = $this->generateUuid();
        $storyData = ['uuid' => $newUuid];
        $this->applyStoryFields($storyData, $data);
        $this->persistencePort->saveStory($storyData);
        return $this->readPort->findStoryByUuid($newUuid);
    }

    public function updateStory(string $storyUuid, array $data): ?array
    {
        if (empty($storyUuid) || empty($data)) {
            return null;
        }
        $story = $this->readPort->findStoryByUuid($storyUuid);
        if (!$story) {
            return null;
        }
        $sid = (int) $story['id'];
        $this->persistencePort->updateStoryById($sid, $data);
        return $this->readPort->findStoryByUuid($storyUuid);
    }

    // === Private helpers ===

    private function resolveStoryId(string $uuid): ?int
    {
        $story = $this->readPort->findStoryByUuid($uuid);
        if (!$story) {
            return null;
        }
        return (int) $story['id'];
    }

    private function listByType(int $sid, string $type): array
    {
        switch ($type) {
            case 'difficulties': return $this->readPort->findDifficultiesForStory($sid);
            case 'locations': return $this->readPort->findLocationsForStory($sid);
            case 'events': return $this->readPort->findEventsForStory($sid);
            case 'items': return $this->readPort->findItemsForStory($sid);
            case 'character-templates': return $this->readPort->findCharacterTemplatesForStory($sid);
            case 'classes': return $this->readPort->findClassesForStory($sid);
            case 'traits': return $this->readPort->findTraitsForStory($sid);
            case 'creators': return $this->readPort->findCreatorsForStory($sid);
            case 'cards': return $this->readPort->findCardsForStory($sid);
            case 'texts': return $this->readPort->findTextsForStory($sid);
            default:
                $tableMap = [
                    'location-neighbors'  => 'list_locations_neighbors',
                    'event-effects'       => 'list_events_effects',
                    'item-effects'        => 'list_items_effects',
                    'class-bonuses'       => 'list_classes_bonus',
                    'keys'                => 'list_keys',
                    'choices'             => 'list_choices',
                    'choice-conditions'   => 'list_choices_conditions',
                    'choice-effects'      => 'list_choices_effects',
                    'weather-rules'       => 'list_weather_rules',
                    'global-random-events'=> 'list_global_random_events',
                    'missions'            => 'list_missions',
                    'mission-steps'       => 'list_missions_steps',
                ];
                if (isset($tableMap[$type])) {
                    return $this->readPort->findEntitiesByStory($sid, $tableMap[$type]);
                }
                return [];
        }
    }

    private function toCamelKeys(array $raw): array
    {
        $result = [];
        foreach ($raw as $key => $value) {
            $parts = explode('_', $key);
            $first = array_shift($parts);
            $camelKey = $first . implode('', array_map('ucfirst', $parts));
            $result[$camelKey] = $value;
        }
        return $result;
    }

    private function applyStoryFields(array &$storyData, array $data): void
    {
        $fields = ['author', 'category', 'group', 'visibility', 'priority', 'peghi',
                    'versionMin', 'versionMax', 'idTextTitle', 'idTextDescription',
                    'idLocationStart', 'idImage', 'idLocationAllPlayerComa', 'idEventAllPlayerComa',
                    'idTextClockSingular', 'idTextClockPlural', 'idEventEndGame',
                    'idTextCopyright', 'linkCopyright', 'idCreator', 'idCard'];
        foreach ($fields as $key) {
            if (isset($data[$key])) {
                $storyData[$key] = $data[$key];
            }
        }
    }

    protected function generateUuid(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            random_int(0, 0xffff), random_int(0, 0xffff),
            random_int(0, 0xffff),
            random_int(0, 0x0fff) | 0x4000,
            random_int(0, 0x3fff) | 0x8000,
            random_int(0, 0xffff), random_int(0, 0xffff), random_int(0, 0xffff)
        );
    }
}
