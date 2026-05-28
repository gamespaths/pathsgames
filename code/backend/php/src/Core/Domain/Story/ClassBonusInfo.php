<?php

declare(strict_types=1);

namespace Games\Paths\Core\Domain\Story;

class ClassBonusInfo
{
    public function __construct(
        public ?string $uuid = null,
        public ?string $statistic = null,
        public int $value = 0
    ) {
    }
}
