<?php

namespace Games\Paths\Core\Domain\Matches;

/**
 * Step 21 — a character materialised in a match (computed stats, location,
 * runtime flags, selected traits and backpack resources).
 */
class CharacterInstanceInfo
{
    /**
     * @param string[] $traitUuids
     */
    public function __construct(
        public readonly string $uuid,
        public readonly ?string $matchUuid = null,
        public readonly ?string $userUuid = null,
        public readonly ?string $characterTemplateUuid = null,
        public readonly ?string $classUuid = null,
        public readonly int $dexterity = 0,
        public readonly int $intelligence = 0,
        public readonly int $constitution = 0,
        public readonly int $energy = 0,
        public readonly int $life = 0,
        public readonly int $sad = 0,
        public readonly ?int $idLocation = null,
        public readonly ?string $locationUuid = null,
        public readonly ?string $locationName = null,
        public readonly int $isSleeping = 0,
        public readonly int $isComa = 0,
        public readonly array $traitUuids = [],
        public readonly int $food = 0,
        public readonly int $magic = 0,
        public readonly int $coin = 0
    ) {
    }

    /** Full detail body (join / character endpoint). */
    public function toArray(): array
    {
        return [
            'uuid' => $this->uuid,
            'matchUuid' => $this->matchUuid,
            'userUuid' => $this->userUuid,
            'characterTemplateUuid' => $this->characterTemplateUuid,
            'classUuid' => $this->classUuid,
            'dexterity' => $this->dexterity,
            'intelligence' => $this->intelligence,
            'constitution' => $this->constitution,
            'energy' => $this->energy,
            'life' => $this->life,
            'sad' => $this->sad,
            'idLocation' => $this->idLocation,
            'locationUuid' => $this->locationUuid,
            'locationName' => $this->locationName,
            'isSleeping' => $this->isSleeping,
            'isComa' => $this->isComa,
            'traitUuids' => $this->traitUuids,
            'food' => $this->food,
            'magic' => $this->magic,
            'coin' => $this->coin,
        ];
    }

    /** Lightweight row (players list / MatchInfo.players). */
    public function toSummaryArray(): array
    {
        return [
            'uuid' => $this->uuid,
            'userUuid' => $this->userUuid,
            'characterTemplateUuid' => $this->characterTemplateUuid,
            'dexterity' => $this->dexterity,
            'intelligence' => $this->intelligence,
            'constitution' => $this->constitution,
            'energy' => $this->energy,
            'life' => $this->life,
            'sad' => $this->sad,
            'idLocation' => $this->idLocation,
            'locationName' => $this->locationName,
            'isSleeping' => $this->isSleeping,
            'isComa' => $this->isComa,
            'classUuid' => $this->classUuid,
            'traitUuids' => $this->traitUuids,
        ];
    }
}
