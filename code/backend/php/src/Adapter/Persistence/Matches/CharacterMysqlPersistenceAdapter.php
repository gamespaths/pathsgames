<?php

namespace Games\Paths\Adapter\Persistence\Matches;

use Games\Paths\Core\Port\Matches\CharacterPersistencePort;
use Games\Paths\Core\Port\Matches\CharacterReadPort;
use PDO;
use Ramsey\Uuid\Uuid;

/**
 * Step 21 — PDO adapter for the character instance / backpack / traits tables.
 * Implements both the write port (join + validation reads) and the read port.
 */
class CharacterMysqlPersistenceAdapter implements CharacterPersistencePort, CharacterReadPort
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    // ─── write side ──────────────────────────────────────────────────────────

    public function saveCharacter(array $row): array
    {
        $now = date('Y-m-d H:i:s');
        $uuid = Uuid::uuid4()->toString();
        $stmt = $this->pdo->prepare(
            'INSERT INTO gaming_character_instance
                (id, id_match, uuid, id_user, id_character_template, dexterity, intelligence,
                 constitution, energy, life, sad, id_location, is_sleeping, is_coma,
                 counter_consecutive_pass, ts_insert, ts_update)
             VALUES
                (:id, :id_match, :uuid, :id_user, :id_character_template, :dexterity, :intelligence,
                 :constitution, :energy, :life, :sad, :id_location, :is_sleeping, :is_coma,
                 0, :ts_insert, :ts_update)'
        );
        $stmt->execute([
            ':id' => (int)$row['id'],
            ':id_match' => (int)$row['id_match'],
            ':uuid' => $uuid,
            ':id_user' => (int)$row['id_user'],
            ':id_character_template' => (int)$row['id_character_template'],
            ':dexterity' => (int)($row['dexterity'] ?? 1),
            ':intelligence' => (int)($row['intelligence'] ?? 1),
            ':constitution' => (int)($row['constitution'] ?? 1),
            ':energy' => (int)($row['energy'] ?? 0),
            ':life' => (int)($row['life'] ?? 1),
            ':sad' => (int)($row['sad'] ?? 0),
            ':id_location' => $row['id_location'] ?? null,
            ':is_sleeping' => (int)($row['is_sleeping'] ?? 0),
            ':is_coma' => (int)($row['is_coma'] ?? 0),
            ':ts_insert' => $now,
            ':ts_update' => $now,
        ]);
        return $this->findCharacterByMatchAndUuid((int)$row['id_match'], $uuid) ?? [];
    }

    public function saveBackpack(array $row): void
    {
        $now = date('Y-m-d H:i:s');
        $stmt = $this->pdo->prepare(
            'INSERT INTO gaming_backpack_resources
                (id, id_match, uuid, id_character_match, food, magic, coin, ts_insert, ts_update)
             VALUES (:id, :id_match, :uuid, :id_character_match, :food, :magic, :coin, :ts_insert, :ts_update)'
        );
        $stmt->execute([
            ':id' => (int)$row['id'],
            ':id_match' => (int)$row['id_match'],
            ':uuid' => Uuid::uuid4()->toString(),
            ':id_character_match' => (int)$row['id_character_match'],
            ':food' => (int)($row['food'] ?? 0),
            ':magic' => (int)($row['magic'] ?? 0),
            ':coin' => (int)($row['coin'] ?? 0),
            ':ts_insert' => $now,
            ':ts_update' => $now,
        ]);
    }

    public function saveTraits(array $rows): void
    {
        if (empty($rows)) {
            return;
        }
        $now = date('Y-m-d H:i:s');
        $stmt = $this->pdo->prepare(
            'INSERT INTO gaming_character_traits
                (id, id_match, uuid, id_character_match, id_traits, ts_insert, ts_update)
             VALUES (:id, :id_match, :uuid, :id_character_match, :id_traits, :ts_insert, :ts_update)'
        );
        foreach ($rows as $r) {
            $stmt->execute([
                ':id' => (int)$r['id'],
                ':id_match' => (int)$r['id_match'],
                ':uuid' => Uuid::uuid4()->toString(),
                ':id_character_match' => (int)$r['id_character_match'],
                ':id_traits' => (int)$r['id_traits'],
                ':ts_insert' => $now,
                ':ts_update' => $now,
            ]);
        }
    }

    public function findCharacterByMatchAndUser(int $matchId, int $userId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM gaming_character_instance WHERE id_match = :m AND id_user = :u LIMIT 1'
        );
        $stmt->execute([':m' => $matchId, ':u' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? self::hydrate($row) : null;
    }

    public function countCharactersByMatchId(int $matchId): int
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM gaming_character_instance WHERE id_match = :m'
        );
        $stmt->execute([':m' => $matchId]);
        return (int)$stmt->fetchColumn();
    }

    // ─── read side ───────────────────────────────────────────────────────────

    public function findCharactersByMatchId(int $matchId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM gaming_character_instance WHERE id_match = :m'
        );
        $stmt->execute([':m' => $matchId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return array_map(static fn(array $r): array => self::hydrate($r), $rows);
    }

    public function findCharacterByMatchAndUuid(int $matchId, string $uuid): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM gaming_character_instance WHERE id_match = :m AND uuid = :u LIMIT 1'
        );
        $stmt->execute([':m' => $matchId, ':u' => $uuid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? self::hydrate($row) : null;
    }

    public function findBackpack(int $matchId, int $characterId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT food, magic, coin FROM gaming_backpack_resources
             WHERE id_match = :m AND id_character_match = :c LIMIT 1'
        );
        $stmt->execute([':m' => $matchId, ':c' => $characterId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }
        return ['food' => (int)$row['food'], 'magic' => (int)$row['magic'], 'coin' => (int)$row['coin']];
    }

    public function findTraits(int $matchId, int $characterId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id_traits FROM gaming_character_traits
             WHERE id_match = :m AND id_character_match = :c'
        );
        $stmt->execute([':m' => $matchId, ':c' => $characterId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return array_map(static fn(array $r): array => ['id_traits' => (int)$r['id_traits']], $rows);
    }

    private static function hydrate(array $row): array
    {
        return [
            'id' => (int)$row['id'],
            'uuid' => $row['uuid'],
            'id_match' => (int)$row['id_match'],
            'id_user' => (int)$row['id_user'],
            'id_character_template' => (int)$row['id_character_template'],
            'dexterity' => (int)$row['dexterity'],
            'intelligence' => (int)$row['intelligence'],
            'constitution' => (int)$row['constitution'],
            'energy' => (int)$row['energy'],
            'life' => (int)$row['life'],
            'sad' => (int)$row['sad'],
            'id_location' => $row['id_location'] !== null ? (int)$row['id_location'] : null,
            'is_sleeping' => (int)$row['is_sleeping'],
            'is_coma' => (int)$row['is_coma'],
        ];
    }
}
