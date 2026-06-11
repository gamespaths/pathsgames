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
        public int $numberMaxFreeAction = 1,
        public ?int $idCard = null,
        public ?CardInfo $card = null,
        public int $life = 100,
        public int $energy = 100,
        public int $sad = 0,
        public int $dexterity = 10,
        public int $intelligence = 10,
        public int $constitution = 10,
        public int $weight = 10,
        // Step 23 — trait cost budgets; null = no limit
        public ?int $traitCostPositiveBudget = null,
        public ?int $traitCostNegativeBudget = null
    ) {
    }
}
