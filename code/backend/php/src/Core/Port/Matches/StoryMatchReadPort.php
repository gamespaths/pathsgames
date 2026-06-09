<?php

namespace Games\Paths\Core\Port\Matches;

interface StoryMatchReadPort
{
    public function findStoryByUuid(string $storyUuid): ?array;

    public function findStoryById(int $storyId): ?array;

    public function findDifficultyByUuid(int $storyId, string $difficultyUuid): ?array;

    public function findDifficultyById(int $storyId, int $difficultyId): ?array;

    public function findLocationsByStoryId(int $storyId): array;

    public function findKeysByStoryId(int $storyId): array;

    /**
     * Step 20.1 — return the event row {id, uuid} for the given story-scoped uuid,
     * or null when no such event exists.
     */
    public function findEventByStoryIdAndUuid(int $storyId, string $uuidEvent): ?array;

    // === Step 21 — character template / class / trait lookups ===

    public function findCharacterTemplateByUuid(int $storyId, string $uuid): ?array;

    public function findCharacterTemplatesByStoryId(int $storyId): array;

    public function findClassByUuid(int $storyId, string $uuid): ?array;

    public function findTraitByUuid(int $storyId, string $uuid): ?array;

    public function findTraitsByStoryId(int $storyId): array;

    public function findClassBonusesByStoryId(int $storyId): array;
}
