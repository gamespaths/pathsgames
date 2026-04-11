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
}
