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
            'SELECT id, uuid, id_location_start, id_event_end_game, category, visibility
             FROM list_stories WHERE uuid = :u LIMIT 1'
        );
        $stmt->execute([':u' => $storyUuid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findStoryById(int $storyId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, uuid, id_location_start, id_event_end_game, category, visibility
             FROM list_stories WHERE id = :i LIMIT 1'
        );
        $stmt->execute([':i' => $storyId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findDifficultyByUuid(int $storyId, string $difficultyUuid): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, uuid, exp_cost, max_weight, min_character, max_character,
                    life, energy, sad, dexterity, intelligence, constitution,
                    trait_cost_positive_budget, trait_cost_negative_budget
             FROM list_stories_difficulty WHERE id_story = :s AND uuid = :u LIMIT 1'
        );
        $stmt->execute([':s' => $storyId, ':u' => $difficultyUuid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findDifficultyById(int $storyId, int $difficultyId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, uuid, exp_cost, max_weight, min_character, max_character,
                    life, energy, sad, dexterity, intelligence, constitution,
                    trait_cost_positive_budget, trait_cost_negative_budget
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

    public function findEventByStoryIdAndUuid(int $storyId, string $uuidEvent): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, uuid FROM list_events WHERE id_story = :s AND uuid = :u LIMIT 1'
        );
        $stmt->execute([':s' => $storyId, ':u' => $uuidEvent]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    // === Step 21 — character template / class / trait lookups ===

    private const TEMPLATE_COLS =
        'id_tipo, uuid, life_max, energy_max, sad_max, dexterity_start, intelligence_start,
         constitution_start, id_class_permitted, id_class_prohibited';

    private const TRAIT_COLS =
        'id, uuid, life, energy, sad, dexterity, intelligence, constitution,
         cost_positive, cost_negative, id_class_permitted, id_class_prohibited';

    public function findCharacterTemplateByUuid(int $storyId, string $uuid): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT ' . self::TEMPLATE_COLS .
            ' FROM list_character_templates WHERE id_story = :s AND uuid = :u LIMIT 1'
        );
        $stmt->execute([':s' => $storyId, ':u' => $uuid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findCharacterTemplatesByStoryId(int $storyId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT ' . self::TEMPLATE_COLS . ' FROM list_character_templates WHERE id_story = :s'
        );
        $stmt->execute([':s' => $storyId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function findClassByUuid(int $storyId, string $uuid): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, uuid, weight_max, dexterity_base, intelligence_base, constitution_base
             FROM list_classes WHERE id_story = :s AND uuid = :u LIMIT 1'
        );
        $stmt->execute([':s' => $storyId, ':u' => $uuid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findTraitByUuid(int $storyId, string $uuid): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT ' . self::TRAIT_COLS . ' FROM list_traits WHERE id_story = :s AND uuid = :u LIMIT 1'
        );
        $stmt->execute([':s' => $storyId, ':u' => $uuid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findTraitsByStoryId(int $storyId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT ' . self::TRAIT_COLS . ' FROM list_traits WHERE id_story = :s'
        );
        $stmt->execute([':s' => $storyId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function findClassBonusesByStoryId(int $storyId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id_class, statistic, value FROM list_classes_bonus WHERE id_story = :s'
        );
        $stmt->execute([':s' => $storyId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
}
