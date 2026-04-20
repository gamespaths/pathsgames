<?php

declare(strict_types=1);

namespace Games\Paths\Core\Service\Story;

use Games\Paths\Core\Domain\Story\CardInfo;
use Games\Paths\Core\Domain\Story\CreatorInfo;
use Games\Paths\Core\Domain\Story\TextInfo;
use Games\Paths\Core\Port\Story\ContentQueryPort;
use Games\Paths\Core\Port\Story\StoryReadPort;

class ContentQueryService implements ContentQueryPort
{
    private StoryReadPort $readPort;

    public function __construct(StoryReadPort $readPort)
    {
        $this->readPort = $readPort;
    }

    public function getCardByStoryAndCardUuid(string $storyUuid, string $cardUuid, string $lang): ?CardInfo
    {
        if (empty(trim($storyUuid)) || empty(trim($cardUuid))) {
            return null;
        }

        $story = $this->readPort->findStoryByUuid($storyUuid);
        if (!$story) {
            return null;
        }

        $storyId = (int) $story['id'];
        $card = $this->readPort->findCardByStoryIdAndUuid($storyId, $cardUuid);
        if (!$card) {
            return null;
        }

        $title = $this->resolveText($storyId, isset($card['id_text_title']) ? (int)$card['id_text_title'] : null, $lang);
        $description = $this->resolveText($storyId, isset($card['id_text_description']) ? (int)$card['id_text_description'] : null, $lang);
        $copyrightText = $this->resolveText($storyId, isset($card['id_text_copyright']) ? (int)$card['id_text_copyright'] : null, $lang);
        $creator = $this->resolveCreator($storyId, isset($card['id_creator']) ? (int)$card['id_creator'] : null, $lang);

        return new CardInfo(
            $card['uuid'] ?? '',
            $card['image_url'] ?? null,
            $card['alternative_image'] ?? null,
            $card['awesome_icon'] ?? null,
            $card['style_main'] ?? null,
            $card['style_detail'] ?? null,
            $title,
            $description,
            $copyrightText,
            $card['link_copyright'] ?? null,
            $creator
        );
    }

    public function getTextByStoryAndIdText(string $storyUuid, int $idText, string $lang): ?TextInfo
    {
        if (empty(trim($storyUuid))) {
            return null;
        }

        $story = $this->readPort->findStoryByUuid($storyUuid);
        if (!$story) {
            return null;
        }

        $storyId = (int) $story['id'];
        $effectiveLang = (!empty(trim($lang))) ? $lang : 'en';

        $text = $this->readPort->findTextByStoryIdTextAndLang($storyId, $idText, $effectiveLang);
        $resolvedLang = $effectiveLang;

        if (!$text && $effectiveLang !== 'en') {
            $text = $this->readPort->findTextByStoryIdTextAndLang($storyId, $idText, 'en');
            if ($text) {
                $resolvedLang = 'en';
            }
        }

        if (!$text) {
            return null;
        }

        $copyrightText = $this->resolveText($storyId, isset($text['id_text_copyright']) ? (int)$text['id_text_copyright'] : null, $effectiveLang);
        $creator = $this->resolveCreator($storyId, isset($text['id_creator']) ? (int)$text['id_creator'] : null, $effectiveLang);

        return new TextInfo(
            (int) $text['id_text'],
            $effectiveLang,
            $resolvedLang,
            $text['short_text'] ?? null,
            $text['long_text'] ?? null,
            $copyrightText,
            $text['link_copyright'] ?? null,
            $creator
        );
    }

    public function getCreatorByStoryAndCreatorUuid(string $storyUuid, string $creatorUuid, string $lang): ?CreatorInfo
    {
        if (empty(trim($storyUuid)) || empty(trim($creatorUuid))) {
            return null;
        }

        $story = $this->readPort->findStoryByUuid($storyUuid);
        if (!$story) {
            return null;
        }

        $storyId = (int) $story['id'];
        $creator = $this->readPort->findCreatorByStoryIdAndUuid($storyId, $creatorUuid);
        if (!$creator) {
            return null;
        }

        $name = $this->resolveText($storyId, isset($creator['id_text']) ? (int)$creator['id_text'] : null, $lang);

        return new CreatorInfo(
            $creator['uuid'] ?? '',
            $name,
            $creator['link'] ?? null,
            $creator['url'] ?? null,
            $creator['url_image'] ?? null,
            $creator['url_emote'] ?? null,
            $creator['url_instagram'] ?? null
        );
    }

    // === Private helpers ===

    public function resolveText(int $storyId, ?int $idText, string $lang): ?string
    {
        if ($idText === null) {
            return null;
        }
        $effectiveLang = (!empty(trim($lang))) ? $lang : 'en';

        $text = $this->readPort->findTextByStoryIdTextAndLang($storyId, $idText, $effectiveLang);
        if ($text) {
            return $text['short_text'] ?? null;
        }

        if ($effectiveLang !== 'en') {
            $fallback = $this->readPort->findTextByStoryIdTextAndLang($storyId, $idText, 'en');
            if ($fallback) {
                return $fallback['short_text'] ?? null;
            }
        }

        return null;
    }

    public function resolveCreator(int $storyId, ?int $idCreator, string $lang): ?CreatorInfo
    {
        if ($idCreator === null) {
            return null;
        }

        $creators = $this->readPort->findCreatorsForStory($storyId);
        foreach ($creators as $c) {
            if (isset($c['id']) && (int)$c['id'] === $idCreator) {
                $name = $this->resolveText($storyId, isset($c['id_text']) ? (int)$c['id_text'] : null, $lang);
                return new CreatorInfo(
                    $c['uuid'] ?? '',
                    $name,
                    $c['link'] ?? null,
                    $c['url'] ?? null,
                    $c['url_image'] ?? null,
                    $c['url_emote'] ?? null,
                    $c['url_instagram'] ?? null
                );
            }
        }

        return null;
    }
}
