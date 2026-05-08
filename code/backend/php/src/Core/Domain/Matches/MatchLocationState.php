<?php

namespace Games\Paths\Core\Domain\Matches;

class MatchLocationState
{
    public function __construct(
        public readonly int $idLocation,
        public readonly string $uuid,
        public readonly int $flagAlreadyActived,
        public readonly int $clockCounter,
        public readonly ?string $name = null
    ) {
    }

    public function toArray(): array
    {
        return [
            'idLocation' => $this->idLocation,
            'uuid' => $this->uuid,
            'flagAlreadyActived' => $this->flagAlreadyActived,
            'clockCounter' => $this->clockCounter,
            'name' => $this->name,
        ];
    }
}
