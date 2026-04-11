<?php

declare(strict_types=1);

namespace Games\Paths\Adapter\Persistence\Story;

use Games\Paths\Core\Port\Story\StoryReadPort;
use PDO;

class StoryMysqlReadRepository implements StoryReadPort
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function findPublicStories(): array
    {
        $stmt = $this->pdo->query("SELECT * FROM list_stories WHERE visibility = 'PUBLIC' ORDER BY priority DESC");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findAllStories(): array
    {
        $stmt = $this->pdo->query("SELECT * FROM list_stories ORDER BY priority DESC");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findStoryByUuid(string $uuid): ?array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM list_stories WHERE uuid = :uuid LIMIT 1");
        $stmt->execute([':uuid' => $uuid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findTextsForStory(int $storyId): array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM list_texts WHERE id_story = :id_story");
        $stmt->execute([':id_story' => $storyId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findDifficultiesForStory(int $storyId): array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM list_stories_difficulty WHERE id_story = :id_story");
        $stmt->execute([':id_story' => $storyId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function countLocationsForStory(int $storyId): int
    {
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM list_locations WHERE id_story = :id_story");
        $stmt->execute([':id_story' => $storyId]);
        return (int) $stmt->fetchColumn();
    }

    public function countEventsForStory(int $storyId): int
    {
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM list_events WHERE id_story = :id_story");
        $stmt->execute([':id_story' => $storyId]);
        return (int) $stmt->fetchColumn();
    }

    public function countItemsForStory(int $storyId): int
    {
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM list_items WHERE id_story = :id_story");
        $stmt->execute([':id_story' => $storyId]);
        return (int) $stmt->fetchColumn();
    }
}
