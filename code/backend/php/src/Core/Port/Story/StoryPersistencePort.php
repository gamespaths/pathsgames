<?php

declare(strict_types=1);

namespace Games\Paths\Core\Port\Story;

interface StoryPersistencePort
{
    public function findStoryIdByUuid(string $uuid): ?int;

    public function deleteStoryById(int $storyId): void;

    public function saveStory(array $storyData): int;

    public function saveDifficulties(int $storyId, array $difficulties): void;

    public function saveTexts(int $storyId, array $texts): void;

    public function saveLocations(int $storyId, array $locations): void;

    public function saveEvents(int $storyId, array $events): void;

    public function saveItems(int $storyId, array $items): void;

    public function saveClasses(int $storyId, array $classes): void;

    public function saveChoices(int $storyId, array $choices): void;

    public function saveCards(int $storyId, array $cards): void;

    public function saveKeys(int $storyId, array $keys): void;

    public function saveTraits(int $storyId, array $traits): void;

    public function saveCharacterTemplates(int $storyId, array $templates): void;

    public function saveWeatherRules(int $storyId, array $rules): void;

    public function saveGlobalRandomEvents(int $storyId, array $events): void;

    public function saveMissions(int $storyId, array $missions): void;

    public function saveCreators(int $storyId, array $creators): void;

    // Step 17: Generic entity CRUD

    public function saveEntity(int $storyId, string $tableName, array $data): void;

    public function updateEntity(int $storyId, string $tableName, string $uuid, array $data): void;

    public function deleteEntityByUuid(string $tableName, string $uuid): void;

    public function updateStoryById(int $storyId, array $data): void;

    // Explicit-ID import support

    public function existsStoryId(int $storyId): bool;

    public function existsEntityId(string $tableName, string $idColumn, int $entityId, int $storyId): bool;

    public function nextScopedId(string $tableName, string $idColumn, int $storyId): int;

    public function nextGlobalId(string $tableName, string $idColumn): int;

    public function syncSequences(): void;
}

