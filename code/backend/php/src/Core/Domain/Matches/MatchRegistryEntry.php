<?php

namespace Games\Paths\Core\Domain\Matches;

class MatchRegistryEntry
{
    public function __construct(
        public readonly string $uuid,
        public readonly string $key,
        public readonly ?string $stringValue = null,
        public readonly ?int $intValue = null
    ) {
    }

    public function toArray(): array
    {
        return [
            'uuid' => $this->uuid,
            'key' => $this->key,
            'stringValue' => $this->stringValue,
            'intValue' => $this->intValue,
        ];
    }
}
