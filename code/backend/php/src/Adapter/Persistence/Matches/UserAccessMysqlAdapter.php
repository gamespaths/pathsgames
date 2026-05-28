<?php

namespace Games\Paths\Adapter\Persistence\Matches;

use Games\Paths\Core\Port\Matches\UserAccessPort;
use PDO;

class UserAccessMysqlAdapter implements UserAccessPort
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function findByUuid(string $userUuid): ?array
    {
        if ($userUuid === '') {
            return null;
        }
        $stmt = $this->pdo->prepare(
            'SELECT id, uuid, username, role, state FROM gaming_user_sessions WHERE uuid = :u LIMIT 1'
        );
        $stmt->execute([':u' => $userUuid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }
        return [
            'id' => (int)$row['id'],
            'uuid' => $row['uuid'],
            'username' => $row['username'],
            'role' => $row['role'],
            'state' => (int)$row['state'],
        ];
    }
}
