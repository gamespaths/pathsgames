<?php

namespace Games\Paths\Core\Domain\Matches;

class MatchSummary
{
    public function __construct(
        public readonly string $uuid,
        public readonly ?string $storyUuid,
        public readonly ?string $difficultyUuid,
        public readonly ?string $name,
        public readonly string $status,
        public readonly int $currentClock,
        public readonly int $expCost,
        public readonly string $userCreatorUuid,
        public readonly string $tsInsert
    ) {
    }

    public function toArray(): array
    {
        return [
            'uuid' => $this->uuid,
            'storyUuid' => $this->storyUuid,
            'difficultyUuid' => $this->difficultyUuid,
            'name' => $this->name,
            'status' => $this->status,
            'currentClock' => $this->currentClock,
            'expCost' => $this->expCost,
            'userCreatorUuid' => $this->userCreatorUuid,
            'tsInsert' => $this->tsInsert,
        ];
    }
}
