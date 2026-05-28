<?php

namespace Games\Paths\Adapter\Persistence\Matches;

use Games\Paths\Core\Domain\Matches\MatchTraitCodec;
use Games\Paths\Core\Port\Matches\MatchPersistencePort;
use PDO;
use Ramsey\Uuid\Uuid;

class MatchMysqlPersistenceAdapter implements MatchPersistencePort
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function saveMatch(array $match): array
    {
        $now = date('Y-m-d H:i:s');
        $uuid = Uuid::uuid4()->toString();
        $stmt = $this->pdo->prepare(
            'INSERT INTO gaming_match
              (uuid, id_story, id_difficulty, id_user_creator, name, exp_cost, status, current_clock,
               secure_location_param, counter_consecutive_pass, single_player, character_template_uuid,
               class_uuid, trait_uuids, ts_insert, ts_update)
             VALUES
              (:uuid, :id_story, :id_difficulty, :id_user_creator, :name, :exp_cost, :status, :current_clock,
               :secure_location_param, :counter_consecutive_pass, :single_player, :character_template_uuid,
               :class_uuid, :trait_uuids, :ts_insert, :ts_update)'
        );
        $stmt->execute([
            ':uuid' => $uuid,
            ':id_story' => (int)$match['id_story'],
            ':id_difficulty' => (int)$match['id_difficulty'],
            ':id_user_creator' => (int)$match['id_user_creator'],
            ':name' => $match['name'] ?? null,
            ':exp_cost' => (int)($match['exp_cost'] ?? 5),
            ':status' => $match['status'] ?? 'CREATED',
            ':current_clock' => (int)($match['current_clock'] ?? 0),
            ':secure_location_param' => (int)($match['secure_location_param'] ?? 0),
            ':counter_consecutive_pass' => (int)($match['counter_consecutive_pass'] ?? 0),
            ':single_player' => (int)($match['single_player'] ?? 1),
            ':character_template_uuid' => $match['character_template_uuid'] ?? null,
            ':class_uuid' => $match['class_uuid'] ?? null,
            ':trait_uuids' => MatchTraitCodec::join($match['trait_uuids'] ?? null),
            ':ts_insert' => $now,
            ':ts_update' => $now,
        ]);
        return $this->findMatchByUuid($uuid) ?? [];
    }

    public function findMatchByUuid(string $uuid): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM gaming_match WHERE uuid = :uuid LIMIT 1');
        $stmt->execute([':uuid' => $uuid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? self::hydrateMatch($row) : null;
    }

    public function findMatchesByUserId(int $userId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM gaming_match WHERE id_user_creator = :user ORDER BY ts_insert DESC'
        );
        $stmt->execute([':user' => $userId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return array_map(static fn(array $row): array => self::hydrateMatch($row), $rows);
    }

    public function findAllMatches(): array
    {
        $stmt = $this->pdo->query('SELECT * FROM gaming_match ORDER BY ts_insert DESC');
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return array_map(static fn(array $row): array => self::hydrateMatch($row), $rows);
    }

    public function saveLocations(array $rows): void
    {
        if (empty($rows)) {
            return;
        }
        $now = date('Y-m-d H:i:s');
        $stmt = $this->pdo->prepare(
            'INSERT INTO gaming_state_locations
                (id_match, id_location, uuid, flag_already_actived, clock_counter, ts_insert, ts_update)
             VALUES (:id_match, :id_location, :uuid, :flag_already_actived, :clock_counter, :ts_insert, :ts_update)'
        );
        foreach ($rows as $r) {
            $stmt->execute([
                ':id_match' => (int)$r['id_match'],
                ':id_location' => (int)$r['id_location'],
                ':uuid' => Uuid::uuid4()->toString(),
                ':flag_already_actived' => (int)($r['flag_already_actived'] ?? 0),
                ':clock_counter' => (int)($r['clock_counter'] ?? 0),
                ':ts_insert' => $now,
                ':ts_update' => $now,
            ]);
        }
    }

    public function saveRegistry(array $rows): void
    {
        if (empty($rows)) {
            return;
        }
        $now = date('Y-m-d H:i:s');
        $stmt = $this->pdo->prepare(
            'INSERT INTO gaming_state_registry
                (id, id_match, uuid, `key`, string_value, int_value, ts_insert, ts_update)
             VALUES (:id, :id_match, :uuid, :key, :string_value, :int_value, :ts_insert, :ts_update)'
        );
        foreach ($rows as $r) {
            $stmt->execute([
                ':id' => (int)$r['id'],
                ':id_match' => (int)$r['id_match'],
                ':uuid' => Uuid::uuid4()->toString(),
                ':key' => $r['key'] ?? '',
                ':string_value' => $r['string_value'] ?? null,
                ':int_value' => $r['int_value'] ?? null,
                ':ts_insert' => $now,
                ':ts_update' => $now,
            ]);
        }
    }

    public function findLocationsByMatchId(int $matchId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id_match, id_location, uuid, flag_already_actived, clock_counter
             FROM gaming_state_locations WHERE id_match = :id'
        );
        $stmt->execute([':id' => $matchId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function findRegistryByMatchId(int $matchId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, id_match, uuid, `key`, string_value, int_value
             FROM gaming_state_registry WHERE id_match = :id'
        );
        $stmt->execute([':id' => $matchId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Decode a raw gaming_match row: trait_uuids is stored as a
     * comma-separated string and exposed to the domain as a list.
     */
    private static function hydrateMatch(array $row): array
    {
        $row['trait_uuids'] = MatchTraitCodec::split($row['trait_uuids'] ?? null);
        return $row;
    }

    public function deleteMatchesByNameLike(string $nameLikePattern): int
    {
        // Remove the derived runtime state (locations + registry) first, then
        // the matches. Explicit child deletion keeps this correct even when
        // foreign-key cascades are not enforced (e.g. SQLite).
        $this->pdo->prepare(
            'DELETE FROM gaming_state_locations WHERE id_match IN
                (SELECT id FROM gaming_match WHERE name LIKE :pattern)'
        )->execute([':pattern' => $nameLikePattern]);

        $this->pdo->prepare(
            'DELETE FROM gaming_state_registry WHERE id_match IN
                (SELECT id FROM gaming_match WHERE name LIKE :pattern)'
        )->execute([':pattern' => $nameLikePattern]);

        $stmt = $this->pdo->prepare('DELETE FROM gaming_match WHERE name LIKE :pattern');
        $stmt->execute([':pattern' => $nameLikePattern]);
        return $stmt->rowCount();
    }

    public function updateMatchFields(string $uuid, ?string $status, ?string $name): bool
    {
        // Check existence first: an UPDATE that changes nothing still reports
        // rowCount() = 0 on MySQL, so it cannot be used to detect a missing row.
        $check = $this->pdo->prepare('SELECT 1 FROM gaming_match WHERE uuid = :uuid');
        $check->execute([':uuid' => $uuid]);
        if ($check->fetchColumn() === false) {
            return false;
        }

        $sets = ['ts_update = :ts'];
        $params = [':uuid' => $uuid, ':ts' => date('Y-m-d H:i:s')];
        if ($status !== null) {
            $sets[] = 'status = :status';
            $params[':status'] = $status;
        }
        if ($name !== null) {
            $sets[] = 'name = :name';
            $params[':name'] = $name;
        }
        $stmt = $this->pdo->prepare(
            'UPDATE gaming_match SET ' . implode(', ', $sets) . ' WHERE uuid = :uuid'
        );
        $stmt->execute($params);
        return true;
    }

    public function deleteMatchByUuid(string $uuid): bool
    {
        $idStmt = $this->pdo->prepare('SELECT id FROM gaming_match WHERE uuid = :uuid');
        $idStmt->execute([':uuid' => $uuid]);
        $id = $idStmt->fetchColumn();
        if ($id === false) {
            return false;
        }
        // Remove the derived runtime state (locations + registry) first.
        $this->pdo->prepare('DELETE FROM gaming_state_locations WHERE id_match = :id')
            ->execute([':id' => $id]);
        $this->pdo->prepare('DELETE FROM gaming_state_registry WHERE id_match = :id')
            ->execute([':id' => $id]);
        $this->pdo->prepare('DELETE FROM gaming_match WHERE id = :id')
            ->execute([':id' => $id]);
        return true;
    }
}
