<?php

declare(strict_types=1);

namespace Games\Paths\Core\Domain\Story;

class CardInfo
{
    public function __construct(
        public string $uuid,
        public ?string $imageUrl = null,
        public ?string $alternativeImage = null,
        public ?string $awesomeIcon = null,
        public ?string $styleMain = null,
        public ?string $styleDetail = null,
        public ?string $title = null
    ) {
    }
}
