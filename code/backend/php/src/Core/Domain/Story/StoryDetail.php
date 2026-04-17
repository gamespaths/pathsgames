<?php

declare(strict_types=1);

namespace Games\Paths\Core\Domain\Story;

class StoryDetail
{
    /**
     * @param DifficultyInfo[] $difficulties
     * @param CharacterTemplateInfo[] $characterTemplates
     * @param ClassInfo[] $classes
     * @param TraitInfo[] $traits
     */
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
        public ?string $versionMin = null,
        public ?string $versionMax = null,
        public ?string $clockSingularDescription = null,
        public ?string $clockPluralDescription = null,
        public ?string $copyrightText = null,
        public ?string $linkCopyright = null,
        public int $locationCount = 0,
        public int $eventCount = 0,
        public int $itemCount = 0,
        public int $classCount = 0,
        public int $characterTemplateCount = 0,
        public int $traitCount = 0,
        public array $difficulties = [],
        public array $characterTemplates = [],
        public array $classes = [],
        public array $traits = [],
        public ?CardInfo $card = null
    ) {
    }
}
