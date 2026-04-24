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
        'events' => 'list_events',
        'items' => 'list_items',
        'character-templates' => 'list_character_templates',
        'classes' => 'list_classes',
        'traits' => 'list_traits',
        'creators' => 'list_creator',
        'cards' => 'list_cards',
        'texts' => 'list_texts',
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
        return $this->listByType($sid, $entityType);
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
        return $this->readPort->findEntityByStoryAndUuid($sid, $table, $entityUuid);
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
        return $this->readPort->findEntityByStoryAndUuid($sid, $table, $newUuid);
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
        return $this->readPort->findEntityByStoryAndUuid($sid, $table, $entityUuid);
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
            default: return [];
        }
    }

    private function applyStoryFields(array &$storyData, array $data): void
    {
        $fields = ['author', 'category', 'group', 'visibility', 'priority', 'peghi',
                    'versionMin', 'versionMax', 'idTextTitle', 'idTextDescription'];
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
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
}
