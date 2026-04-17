<?php

declare(strict_types=1);

namespace Games\Paths\Core\Service\Story;

use Games\Paths\Core\Domain\Story\DifficultyInfo;
use Games\Paths\Core\Domain\Story\StoryDetail;
use Games\Paths\Core\Domain\Story\StorySummary;
use Games\Paths\Core\Port\Story\StoryQueryPort;
use Games\Paths\Core\Port\Story\StoryReadPort;

class StoryQueryService implements StoryQueryPort
{
    private StoryReadPort $readPort;

    public function __construct(StoryReadPort $readPort)
    {
        $this->readPort = $readPort;
    }

    public function listPublicStories(string $lang = 'en'): array
    {
        $rawStories = $this->readPort->findPublicStories();
        return array_map(fn($r) => $this->mapToSummary($r, $lang), $rawStories);
    }

    public function listAllStories(string $lang = 'en'): array
    {
        $rawStories = $this->readPort->findAllStories();
        return array_map(fn($r) => $this->mapToSummary($r, $lang), $rawStories);
    }

    public function getStoryDetail(string $uuid, string $lang = 'en'): ?StoryDetail
    {
        $rawStory = $this->readPort->findStoryByUuid($uuid);
        if (!$rawStory) {
            return null;
        }

        $storyId = (int) $rawStory['id'];
        $texts = $this->readPort->findTextsForStory($storyId);

        $rawDiffs = $this->readPort->findDifficultiesForStory($storyId);
        $difficulties = [];
        foreach ($rawDiffs as $rd) {
            $desc = $this->resolveText($texts, isset($rd['id_text_description']) ? (int)$rd['id_text_description'] : null, $lang);
            $difficulties[] = new DifficultyInfo(
                $rd['uuid'] ?? '',
                $desc,
                isset($rd['exp_cost']) ? (int)$rd['exp_cost'] : 5,
                isset($rd['max_weight']) ? (int)$rd['max_weight'] : 10,
                isset($rd['min_character']) ? (int)$rd['min_character'] : 1,
                isset($rd['max_character']) ? (int)$rd['max_character'] : 4,
                isset($rd['cost_help_coma']) ? (int)$rd['cost_help_coma'] : 3,
                isset($rd['cost_max_characteristics']) ? (int)$rd['cost_max_characteristics'] : 3,
                isset($rd['number_max_free_action']) ? (int)$rd['number_max_free_action'] : 1
            );
        }

        $locCount = $this->readPort->countLocationsForStory($storyId);
        $eventCount = $this->readPort->countEventsForStory($storyId);
        $itemCount = $this->readPort->countItemsForStory($storyId);

        $title = $this->resolveText($texts, isset($rawStory['id_text_title']) ? (int)$rawStory['id_text_title'] : null, $lang);
        $desc = $this->resolveText($texts, isset($rawStory['id_text_description']) ? (int)$rawStory['id_text_description'] : null, $lang);
        $copyrightTxt = $this->resolveText($texts, isset($rawStory['id_text_copyright']) ? (int)$rawStory['id_text_copyright'] : null, $lang);

        return new StoryDetail(
            $rawStory['uuid'],
            $title,
            $desc,
            $rawStory['author'] ?? null,
            $rawStory['category'] ?? null,
            $rawStory['group_name'] ?? null,
            $rawStory['visibility'] ?? null,
            isset($rawStory['priority']) ? (int)$rawStory['priority'] : 0,
            isset($rawStory['peghi']) ? (int)$rawStory['peghi'] : 0,
            $rawStory['version_min'] ?? null,
            $rawStory['version_max'] ?? null,
            $rawStory['clock_singular'] ?? null,
            $rawStory['clock_plural'] ?? null,
            $copyrightTxt,
            $rawStory['link_copyright'] ?? null,
            $locCount,
            $eventCount,
            $itemCount,
            0,
            0,
            0,
            $difficulties
        );
    }

    private function mapToSummary(array $rawStory, string $lang): StorySummary
    {
        $storyId = (int) $rawStory['id'];
        $texts = $this->readPort->findTextsForStory($storyId);

        $title = $this->resolveText($texts, isset($rawStory['id_text_title']) ? (int)$rawStory['id_text_title'] : null, $lang);
        $desc = $this->resolveText($texts, isset($rawStory['id_text_description']) ? (int)$rawStory['id_text_description'] : null, $lang);
        
        $diffCount = count($this->readPort->findDifficultiesForStory($storyId));

        return new StorySummary(
            $rawStory['uuid'],
            $title,
            $desc,
            $rawStory['author'] ?? null,
            $rawStory['category'] ?? null,
            $rawStory['group_name'] ?? null,
            $rawStory['visibility'] ?? null,
            isset($rawStory['priority']) ? (int)$rawStory['priority'] : 0,
            isset($rawStory['peghi']) ? (int)$rawStory['peghi'] : 0,
            $diffCount
        );
    }

    /**
     * @param array $texts
     * @param int|null $txtId
     * @param string $targetLang
     * @return string|null
     */
    public function resolveText(array $texts, ?int $txtId, string $targetLang): ?string
    {
        if ($txtId === null) {
            return null;
        }

        $candidates = array_filter($texts, fn($t) => (int)$t['id_text'] === $txtId);
        if (empty($candidates)) {
            return null;
        }

        // 1. Exact language match
        foreach ($candidates as $t) {
            if ($t['lang'] === $targetLang) {
                return $t['short_text'] ?? $t['long_text'];
            }
        }

        // 2. English fallback
        foreach ($candidates as $t) {
            if ($t['lang'] === 'en') {
                return $t['short_text'] ?? $t['long_text'];
            }
        }

        // 3. Any available
        $t = reset($candidates);
        return $t['short_text'] ?? $t['long_text'];
    }
}
