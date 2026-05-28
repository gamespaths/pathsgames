<?php

declare(strict_types=1);

namespace Games\Paths\Core\Domain\Story;

class CardInfo
{
    public function __construct(
        public string $uuid,
        public ?string $cardType = null,
        public ?string $urlImage = null,
        public ?string $alternativeImage = null,
        public ?string $awesomeIcon = null,
        public ?string $styleMain = null,
        public ?string $styleDetail = null,
        public ?string $styleImageLittle = null,
        public ?string $styleImageMedium = null,
        public ?string $styleImageLarge = null,
        public ?string $title = null,
        public ?string $description = null,
        public ?string $copyrightText = null,
        public ?string $linkCopyright = null,
        public ?CreatorInfo $creator = null
    ) {
    }
}
