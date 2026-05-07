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
}
