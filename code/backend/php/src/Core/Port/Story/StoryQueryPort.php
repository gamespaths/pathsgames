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
}
