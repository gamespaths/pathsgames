<?php

declare(strict_types=1);

namespace Games\Paths\Core\Port\Story;

interface StoryReadPort
{
    public function findPublicStories(): array;

    public function findAllStories(): array;

    public function findStoryByUuid(string $uuid): ?array;

    public function findTextsForStory(int $storyId): array;

    public function findDifficultiesForStory(int $storyId): array;

    public function countLocationsForStory(int $storyId): int;

    public function countEventsForStory(int $storyId): int;

    public function countItemsForStory(int $storyId): int;

    public function findUniqueCategories(): array;

    public function findUniqueGroups(): array;

    public function findStoriesByCategory(string $category): array;

    public function findStoriesByGroup(string $group): array;

    public function findClassesForStory(int $storyId): array;

    public function findCharacterTemplatesForStory(int $storyId): array;

    public function findTraitsForStory(int $storyId): array;

    public function findCardForStory(int $storyId, int $cardId): ?array;

    public function findCardByStoryIdAndUuid(int $storyId, string $uuid): ?array;

    public function findTextByStoryIdTextAndLang(int $storyId, int $idText, string $lang): ?array;

    public function findCreatorByStoryIdAndUuid(int $storyId, string $uuid): ?array;

    public function findCreatorsForStory(int $storyId): array;

    // Step 17: Generic CRUD read support

    public function findLocationsForStory(int $storyId): array;

    public function findEventsForStory(int $storyId): array;

    public function findItemsForStory(int $storyId): array;

    public function findCardsForStory(int $storyId): array;

    public function findEntityByStoryAndUuid(int $storyId, string $tableName, string $uuid): ?array;

    public function findEntitiesByStory(int $storyId, string $tableName): array;
}
