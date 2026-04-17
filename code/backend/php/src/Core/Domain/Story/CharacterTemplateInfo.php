<?php

declare(strict_types=1);

namespace Games\Paths\Core\Domain\Story;

class CharacterTemplateInfo
{
    public function __construct(
        public string $uuid,
        public ?string $name = null,
        public ?string $description = null,
        public int $lifeMax = 0,
        public int $energyMax = 0,
        public int $sadMax = 0,
        public int $dexterityStart = 0,
        public int $intelligenceStart = 0,
        public int $constitutionStart = 0
    ) {
    }
}
