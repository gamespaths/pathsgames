<?php

declare(strict_types=1);

namespace Games\Paths\Core\Domain\Story;

class ClassInfo
{
    public function __construct(
        public string $uuid,
        public ?string $name = null,
        public ?string $description = null,
        public int $weightMax = 0,
        public int $dexterityBase = 0,
        public int $intelligenceBase = 0,
        public int $constitutionBase = 0
    ) {
    }
}
