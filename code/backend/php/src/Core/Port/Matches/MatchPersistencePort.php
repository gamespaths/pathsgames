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

    /**
     * Delete all matches whose name matches the given SQL LIKE pattern,
     * together with their derived runtime state (locations and registry rows).
     * Used by the dev-only test-data cleanup. Returns the number of matches
     * removed.
     */
    public function deleteMatchesByNameLike(string $nameLikePattern): int;

    /**
     * Updates the status and/or name of a single match. A null field is left
     * unchanged. Returns false when no match has the given uuid.
     */
    public function updateMatchFields(string $uuid, ?string $status, ?string $name): bool;

    /**
     * Deletes a single match by uuid together with its derived runtime state
     * (locations and registry rows). Returns false when no match has the uuid.
     */
    public function deleteMatchByUuid(string $uuid): bool;
}
