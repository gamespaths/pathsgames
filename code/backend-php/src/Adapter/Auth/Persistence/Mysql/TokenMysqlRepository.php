<?php

namespace Games\Paths\Adapter\Auth\Persistence\Mysql;

use Games\Paths\Core\Domain\Auth\TokenInfo;
use Games\Paths\Core\Port\Auth\TokenPersistencePort;
use PDO;

/**
 * Persistence adapter for refresh tokens using MySQL (PDO).
 */
class TokenMysqlRepository implements TokenPersistencePort
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function saveRefreshToken(string $userUuid, string $refreshToken, TokenInfo $tokenInfo): void
    {
        $userId = $this->findUserIdByUuid($userUuid);
        if ($userId === null) {
            throw new \RuntimeException("User not found: $userUuid");
        }

        $stmt = $this->pdo->prepare("
            INSERT INTO users_tokens (id_user, token, jti, expires_at, revoked)
            VALUES (:userId, :token, :jti, :expiresAt, 0)
        ");

        $stmt->execute([
            'userId'    => $userId,
            'token'     => $refreshToken,
            'jti'       => $tokenInfo->getJti(),
            'expiresAt' => date('Y-m-d H:i:s', $tokenInfo->getExp())
        ]);
    }

    public function revokeToken(string $refreshToken): void
    {
        // We can revoke by token string or by JTI if we had it.
        // For logout, we usually have the token.
        $stmt = $this->pdo->prepare("UPDATE users_tokens SET revoked = 1 WHERE token = :token");
        $stmt->execute(['token' => $refreshToken]);
    }

    public function revokeAllByUserUuid(string $userUuid): void
    {
        $userId = $this->findUserIdByUuid($userUuid);
        if ($userId === null) {
            return;
        }

        $stmt = $this->pdo->prepare("UPDATE users_tokens SET revoked = 1 WHERE id_user = :userId");
        $stmt->execute(['userId' => $userId]);
    }

    public function isRefreshTokenValid(string $refreshToken): bool
    {
        $stmt = $this->pdo->prepare("
            SELECT revoked, expires_at FROM users_tokens 
            WHERE token = :token AND revoked = 0 AND expires_at > NOW()
            LIMIT 1
        ");
        $stmt->execute(['token' => $refreshToken]);
        $result = $stmt->fetch();

        return (bool)$result;
    }

    public function findUserIdByUuid(string $userUuid): ?int
    {
        $stmt = $this->pdo->prepare("SELECT id FROM gaming_user_sessions WHERE uuid = :uuid LIMIT 1");
        $stmt->execute(['uuid' => $userUuid]);
        $result = $stmt->fetch();

        return $result ? (int)$result['id'] : null;
    }

    public function enforceTokenLimit(int $userId, int $maxTokens): void
    {
        // Count active tokens
        $stmt = $this->pdo->prepare("SELECT COUNT(*) as count FROM users_tokens WHERE id_user = :userId AND revoked = 0");
        $stmt->execute(['userId' => $userId]);
        $activeCount = (int)$stmt->fetch()['count'];

        if ($activeCount > $maxTokens) {
            $toDelete = $activeCount - $maxTokens;
            // Delete the oldest active tokens (BY ts_insert)
            $stmt = $this->pdo->prepare("
                UPDATE users_tokens 
                SET revoked = 1 
                WHERE id_user = :userId AND revoked = 0 
                ORDER BY ts_insert ASC 
                LIMIT :limit
            ");
            $stmt->bindValue(':userId', $userId, PDO::PARAM_INT);
            $stmt->bindValue(':limit', $toDelete, PDO::PARAM_INT);
            $stmt->execute();
        }
    }
}
