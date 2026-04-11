<?php

declare(strict_types=1);

namespace Games\Paths\Core\Domain\Story;

class StorySummary
{
    public function __construct(
        public string $uuid,
        public ?string $title = null,
        public ?string $description = null,
        public ?string $author = null,
        public ?string $category = null,
        public ?string $group = null,
        public ?string $visibility = null,
        public int $priority = 0,
        public int $peghi = 0,
        public int $difficultyCount = 0
    ) {
    }
}
