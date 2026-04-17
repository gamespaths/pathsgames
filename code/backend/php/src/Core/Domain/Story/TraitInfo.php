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
        public ?int $idClassProhibited = null
    ) {
    }
}
