<?php

namespace Games\Paths\Adapter\Persistence\Matches;

use Games\Paths\Core\Port\Matches\StoryMatchReadPort;
use PDO;

class StoryMatchMysqlReadAdapter implements StoryMatchReadPort
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function findStoryByUuid(string $storyUuid): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, uuid, id_location_start, category, visibility FROM list_stories WHERE uuid = :u LIMIT 1'
        );
        $stmt->execute([':u' => $storyUuid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findStoryById(int $storyId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, uuid, id_location_start, category, visibility FROM list_stories WHERE id = :i LIMIT 1'
        );
        $stmt->execute([':i' => $storyId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findDifficultyByUuid(int $storyId, string $difficultyUuid): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, uuid, exp_cost, max_weight, min_character, max_character
             FROM list_stories_difficulty WHERE id_story = :s AND uuid = :u LIMIT 1'
        );
        $stmt->execute([':s' => $storyId, ':u' => $difficultyUuid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findDifficultyById(int $storyId, int $difficultyId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, uuid, exp_cost, max_weight, min_character, max_character
             FROM list_stories_difficulty WHERE id_story = :s AND id = :i LIMIT 1'
        );
        $stmt->execute([':s' => $storyId, ':i' => $difficultyId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findLocationsByStoryId(int $storyId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, uuid, counter_start FROM list_locations WHERE id_story = :s'
        );
        $stmt->execute([':s' => $storyId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function findKeysByStoryId(int $storyId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, uuid, key_name, key_value FROM list_keys WHERE id_story = :s'
        );
        $stmt->execute([':s' => $storyId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
}
