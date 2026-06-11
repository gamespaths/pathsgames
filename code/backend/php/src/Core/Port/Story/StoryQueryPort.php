<?php

declare(strict_types=1);

namespace Games\Paths\Core\Port\Story;

use Games\Paths\Core\Domain\Story\StoryDetail;

interface StoryQueryPort
{
    /**
     * @return \Games\Paths\Core\Domain\Story\StorySummary[]
     */
    public function listPublicStories(string $lang = 'en'): array;

    /**
     * @return \Games\Paths\Core\Domain\Story\StorySummary[]
     */
    public function listAllStories(string $lang = 'en'): array;

    public function getStoryDetail(string $uuid, string $lang = 'en'): ?StoryDetail;

    /**
     * @return string[]
     */
    public function listCategories(): array;

    /**
     * @return string[]
     */
    public function listGroups(): array;

    /**
     * @return \Games\Paths\Core\Domain\Story\StorySummary[]
     */
    public function listStoriesByCategory(string $category, string $lang = 'en'): array;

    /**
     * @return \Games\Paths\Core\Domain\Story\StorySummary[]
     */
    public function listStoriesByGroup(string $group, string $lang = 'en'): array;

    /**
     * Step 23 — lists the story traits selectable with the given class.
     *
     * @return array{0: string, 1: \Games\Paths\Core\Domain\Story\TraitInfo[]}
     *         [status, traits] with status "OK" | "STORY_NOT_FOUND" | "CLASS_NOT_FOUND"
     */
    public function listTraitsForClass(string $storyUuid, string $classUuid, string $lang = 'en'): array;
}
