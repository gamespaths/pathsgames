<?php

declare(strict_types=1);

namespace Games\Paths\Core\Domain\Story;

class TraitInfo
{
    public function __construct(
        public string $uuid,
        public ?string $name = null,
        public ?string $description = null,
        public int $costPositive = 0,
        public int $costNegative = 0,
        public ?int $idClassPermitted = null,
        public ?int $idClassProhibited = null,
        public ?int $idCard = null,
        public ?CardInfo $card = null,
        public int $life = 0,
        public int $energy = 0,
        public int $sad = 0,
        public int $dexterity = 0,
        public int $intelligence = 0,
        public int $constitution = 0,
        public int $weight = 0
    ) {
    }
}
