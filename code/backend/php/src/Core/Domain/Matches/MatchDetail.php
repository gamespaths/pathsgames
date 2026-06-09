<?php

namespace Games\Paths\Core\Domain\Matches;

class MatchDetail
{
    /**
     * @param MatchLocationState[] $locations
     * @param MatchRegistryEntry[] $registry
     * @param MatchEventOption[] $events
     * @param MatchEventOption[] $choices
     * @param CharacterInstanceInfo[] $players
     */
    public function __construct(
        public readonly MatchSummary $match,
        public readonly ?int $currentLocationId = null,
        public readonly ?string $currentLocationUuid = null,
        public readonly ?string $currentLocationName = null,
        public readonly array $locations = [],
        public readonly array $registry = [],
        public readonly array $events = [],
        public readonly array $choices = [],
        public readonly array $players = []
    ) {
    }

    public function toArray(): array
    {
        return [
            'match' => $this->match->toArray(),
            'currentLocationId' => $this->currentLocationId,
            'currentLocationUuid' => $this->currentLocationUuid,
            'currentLocationName' => $this->currentLocationName,
            'locations' => array_map(fn($l) => $l->toArray(), $this->locations),
            'registry' => array_map(fn($r) => $r->toArray(), $this->registry),
            'events' => array_map(fn($e) => $e->toArray(), $this->events),
            'choices' => array_map(fn($c) => $c->toArray(), $this->choices),
            'players' => array_map(fn($p) => $p->toSummaryArray(), $this->players),
        ];
    }
}
