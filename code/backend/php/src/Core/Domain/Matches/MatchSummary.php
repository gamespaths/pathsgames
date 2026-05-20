<?php

namespace Games\Paths\Core\Domain\Matches;

class MatchSummary
{
    /**
     * @param string[] $traitUuids Step 0.19.9 — selected trait uuids.
     */
    public function __construct(
        public readonly string $uuid,
        public readonly ?string $storyUuid,
        public readonly ?string $difficultyUuid,
        public readonly ?string $name,
        public readonly string $status,
        public readonly int $currentClock,
        public readonly int $expCost,
        public readonly string $userCreatorUuid,
        public readonly string $tsInsert,
        public readonly ?int $singlePlayer = null,
        public readonly ?string $characterTemplateUuid = null,
        public readonly ?string $classUuid = null,
        public readonly array $traitUuids = []
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
            'singlePlayer' => $this->singlePlayer,
            'characterTemplateUuid' => $this->characterTemplateUuid,
            'classUuid' => $this->classUuid,
            'traitUuids' => $this->traitUuids,
        ];
    }
}
