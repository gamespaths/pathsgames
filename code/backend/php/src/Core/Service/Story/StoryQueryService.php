<?php

declare(strict_types=1);

namespace Games\Paths\Core\Service\Story;

use Games\Paths\Core\Domain\Story\CardInfo;
use Games\Paths\Core\Domain\Story\CharacterTemplateInfo;
use Games\Paths\Core\Domain\Story\ClassInfo;
use Games\Paths\Core\Domain\Story\DifficultyInfo;
use Games\Paths\Core\Domain\Story\StoryDetail;
use Games\Paths\Core\Domain\Story\StorySummary;
use Games\Paths\Core\Domain\Story\TraitInfo;
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

    public function listCategories(): array
    {
        return $this->readPort->findUniqueCategories();
    }

    public function listGroups(): array
    {
        return $this->readPort->findUniqueGroups();
    }

    public function listStoriesByCategory(string $category, string $lang = 'en'): array
    {
        $rawStories = $this->readPort->findStoriesByCategory($category);
        return array_map(fn($r) => $this->mapToSummary($r, $lang), $rawStories);
    }

    public function listStoriesByGroup(string $group, string $lang = 'en'): array
    {
        $rawStories = $this->readPort->findStoriesByGroup($group);
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

        // Step 15: Classes, Templates, Traits
        $rawClasses = $this->readPort->findClassesForStory($storyId);
        $rawTemplates = $this->readPort->findCharacterTemplatesForStory($storyId);
        $rawTraits = $this->readPort->findTraitsForStory($storyId);

        $classes = [];
        foreach ($rawClasses as $c) {
            $clsName = $this->resolveText($texts, isset($c['id_text_name']) ? (int)$c['id_text_name'] : null, $lang);
            $clsDesc = $this->resolveText($texts, isset($c['id_text_description']) ? (int)$c['id_text_description'] : null, $lang);
            $classes[] = new ClassInfo(
                $c['uuid'] ?? (string)($c['id'] ?? ''),
                $clsName,
                $clsDesc,
                isset($c['weight_max']) ? (int)$c['weight_max'] : 0,
                isset($c['dexterity_base']) ? (int)$c['dexterity_base'] : 0,
                isset($c['intelligence_base']) ? (int)$c['intelligence_base'] : 0,
                isset($c['constitution_base']) ? (int)$c['constitution_base'] : 0
            );
        }

        $characterTemplates = [];
        foreach ($rawTemplates as $t) {
            $tplName = $this->resolveText($texts, isset($t['id_text_name']) ? (int)$t['id_text_name'] : null, $lang);
            $tplDesc = $this->resolveText($texts, isset($t['id_text_description']) ? (int)$t['id_text_description'] : null, $lang);
            $characterTemplates[] = new CharacterTemplateInfo(
                $t['uuid'] ?? (string)($t['id'] ?? ''),
                $tplName,
                $tplDesc,
                isset($t['life_max']) ? (int)$t['life_max'] : 0,
                isset($t['energy_max']) ? (int)$t['energy_max'] : 0,
                isset($t['sad_max']) ? (int)$t['sad_max'] : 0,
                isset($t['dexterity_start']) ? (int)$t['dexterity_start'] : 0,
                isset($t['intelligence_start']) ? (int)$t['intelligence_start'] : 0,
                isset($t['constitution_start']) ? (int)$t['constitution_start'] : 0
            );
        }

        $traits = [];
        foreach ($rawTraits as $tr) {
            $trName = $this->resolveText($texts, isset($tr['id_text_name']) ? (int)$tr['id_text_name'] : null, $lang);
            $trDesc = $this->resolveText($texts, isset($tr['id_text_description']) ? (int)$tr['id_text_description'] : null, $lang);
            $traits[] = new TraitInfo(
                $tr['uuid'] ?? (string)($tr['id'] ?? ''),
                $trName,
                $trDesc,
                isset($tr['cost_positive']) ? (int)$tr['cost_positive'] : 0,
                isset($tr['cost_negative']) ? (int)$tr['cost_negative'] : 0,
                isset($tr['id_class_permitted']) ? (int)$tr['id_class_permitted'] : null,
                isset($tr['id_class_prohibited']) ? (int)$tr['id_class_prohibited'] : null
            );
        }

        // Step 15: Card
        $card = null;
        $storyIdCard = $rawStory['id_card'] ?? null;
        if ($storyIdCard !== null) {
            $rawCard = $this->readPort->findCardForStory($storyId, (int)$storyIdCard);
            if ($rawCard) {
                $cardTitleTextId = isset($rawCard['id_text_title']) ? (int)$rawCard['id_text_title']
                    : (isset($rawCard['id_text_name']) ? (int)$rawCard['id_text_name'] : null);
                $cardTitle = $this->resolveText($texts, $cardTitleTextId, $lang);
                $cardDescTextId = isset($rawCard['id_text_description']) ? (int)$rawCard['id_text_description'] : null;
                $cardDescription = $this->resolveText($texts, $cardDescTextId, $lang);
                $cardCopyrightTextId = isset($rawCard['id_text_copyright']) ? (int)$rawCard['id_text_copyright'] : null;
                $cardCopyrightText = $this->resolveText($texts, $cardCopyrightTextId, $lang);
                $card = new CardInfo(
                    $rawCard['uuid'] ?? (string)($rawCard['id'] ?? ''),
                    $rawCard['image_url'] ?? null,
                    $rawCard['alternative_image'] ?? null,
                    $rawCard['awesome_icon'] ?? null,
                    $rawCard['style_main'] ?? null,
                    $rawCard['style_detail'] ?? null,
                    $cardTitle,
                    $cardDescription,
                    $cardCopyrightText,
                    $rawCard['link_copyright'] ?? null
                );
            }
        }

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
            count($rawClasses),
            count($rawTemplates),
            count($rawTraits),
            $difficulties,
            $characterTemplates,
            $classes,
            $traits,
            $card
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
