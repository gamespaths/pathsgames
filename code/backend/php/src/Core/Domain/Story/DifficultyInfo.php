<?php

declare(strict_types=1);

namespace Games\Paths\Core\Domain\Story;

class DifficultyInfo
{
    public function __construct(
        public string $uuid,
        public ?string $description = null,
        public int $expCost = 5,
        public int $maxWeight = 10,
        public int $minCharacter = 1,
        public int $maxCharacter = 4,
        public int $costHelpComa = 3,
        public int $costMaxCharacteristics = 3,
        public int $numberMaxFreeAction = 1
    ) {
    }
}
