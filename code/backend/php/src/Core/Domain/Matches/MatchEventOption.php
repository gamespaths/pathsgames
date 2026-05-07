<?php

namespace Games\Paths\Core\Domain\Matches;

class MatchEventOption
{
    public function __construct(
        public readonly string $uuid,
        public readonly string $name,
        public readonly string $type
    ) {
    }

    public function toArray(): array
    {
        return [
            'uuid' => $this->uuid,
            'name' => $this->name,
            'type' => $this->type,
        ];
    }
}
