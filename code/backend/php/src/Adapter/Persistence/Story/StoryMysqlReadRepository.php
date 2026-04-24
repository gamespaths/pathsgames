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

    public function findUniqueCategories(): array
    {
        $stmt = $this->pdo->query(
            "SELECT DISTINCT category FROM list_stories WHERE visibility = 'PUBLIC' AND category IS NOT NULL ORDER BY category ASC"
        );
        return array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'category');
    }

    public function findUniqueGroups(): array
    {
        $stmt = $this->pdo->query(
            "SELECT DISTINCT group_name FROM list_stories WHERE visibility = 'PUBLIC' AND group_name IS NOT NULL ORDER BY group_name ASC"
        );
        return array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'group_name');
    }

    public function findStoriesByCategory(string $category): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT * FROM list_stories WHERE visibility = 'PUBLIC' AND category = :category ORDER BY priority DESC"
        );
        $stmt->execute([':category' => $category]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findStoriesByGroup(string $group): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT * FROM list_stories WHERE visibility = 'PUBLIC' AND group_name = :group_name ORDER BY priority DESC"
        );
        $stmt->execute([':group_name' => $group]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findClassesForStory(int $storyId): array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM list_classes WHERE id_story = :id_story");
        $stmt->execute([':id_story' => $storyId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findCharacterTemplatesForStory(int $storyId): array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM list_character_templates WHERE id_story = :id_story");
        $stmt->execute([':id_story' => $storyId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findTraitsForStory(int $storyId): array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM list_traits WHERE id_story = :id_story");
        $stmt->execute([':id_story' => $storyId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findCardForStory(int $storyId, int $cardId): ?array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM list_cards WHERE id_story = :id_story AND id = :id LIMIT 1");
        $stmt->execute([':id_story' => $storyId, ':id' => $cardId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findCardByStoryIdAndUuid(int $storyId, string $uuid): ?array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM list_cards WHERE id_story = :id_story AND uuid = :uuid LIMIT 1");
        $stmt->execute([':id_story' => $storyId, ':uuid' => $uuid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findTextByStoryIdTextAndLang(int $storyId, int $idText, string $lang): ?array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM list_texts WHERE id_story = :id_story AND id_text = :id_text AND lang = :lang LIMIT 1");
        $stmt->execute([':id_story' => $storyId, ':id_text' => $idText, ':lang' => $lang]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findCreatorByStoryIdAndUuid(int $storyId, string $uuid): ?array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM list_creator WHERE id_story = :id_story AND uuid = :uuid LIMIT 1");
        $stmt->execute([':id_story' => $storyId, ':uuid' => $uuid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findCreatorsForStory(int $storyId): array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM list_creator WHERE id_story = :id_story");
        $stmt->execute([':id_story' => $storyId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Step 17: Generic CRUD read support

    public function findLocationsForStory(int $storyId): array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM list_locations WHERE id_story = :id_story");
        $stmt->execute([':id_story' => $storyId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findEventsForStory(int $storyId): array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM list_events WHERE id_story = :id_story");
        $stmt->execute([':id_story' => $storyId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findItemsForStory(int $storyId): array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM list_items WHERE id_story = :id_story");
        $stmt->execute([':id_story' => $storyId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findCardsForStory(int $storyId): array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM list_cards WHERE id_story = :id_story");
        $stmt->execute([':id_story' => $storyId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findEntityByStoryAndUuid(int $storyId, string $tableName, string $uuid): ?array
    {
        $allowed = [
            'list_stories_difficulty', 'list_locations', 'list_events', 'list_items',
            'list_character_templates', 'list_classes', 'list_traits',
            'list_creator', 'list_cards', 'list_texts',
        ];
        if (!in_array($tableName, $allowed, true)) {
            return null;
        }
        $stmt = $this->pdo->prepare(
            "SELECT * FROM $tableName WHERE id_story = :id_story AND uuid = :uuid LIMIT 1"
        );
        $stmt->execute([':id_story' => $storyId, ':uuid' => $uuid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }
}

