<?php

namespace Games\Paths\Core\Port\Matches;

interface MatchPersistencePort
{
    public function saveMatch(array $match): array;

    public function findMatchByUuid(string $uuid): ?array;

    public function findMatchesByUserId(int $userId): array;

    public function findAllMatches(): array;

    public function saveLocations(array $rows): void;

    public function saveRegistry(array $rows): void;

    public function findLocationsByMatchId(int $matchId): array;

    public function findRegistryByMatchId(int $matchId): array;
}
