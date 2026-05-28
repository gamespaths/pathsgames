<?php

declare(strict_types=1);

namespace Games\Paths\Core\Port\Story;

use Games\Paths\Core\Domain\Story\CardInfo;
use Games\Paths\Core\Domain\Story\CreatorInfo;
use Games\Paths\Core\Domain\Story\TextInfo;

interface ContentQueryPort
{
    public function getCardByStoryAndCardUuid(string $storyUuid, string $cardUuid, string $lang): ?CardInfo;

    public function getTextByStoryAndIdText(string $storyUuid, int $idText, string $lang): ?TextInfo;

    public function getCreatorByStoryAndCreatorUuid(string $storyUuid, string $creatorUuid, string $lang): ?CreatorInfo;
}
