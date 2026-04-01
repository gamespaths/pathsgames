<?php

namespace Games\Paths\Adapter\Persistence\Mysql;

use Games\Paths\Core\Domain\GuestSession;
use Games\Paths\Core\Port\GuestRepositoryPort;
use PDO;

class GuestMysqlRepository implements GuestRepositoryPort
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function save(GuestSession $session): void
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO gaming_user_sessions 
                (uuid, username, role, state, guest_cookie_token, guest_expires_at, ts_insert, ts_registration, ts_last_access, expires_at)
            VALUES 
                (:uuid, :username, :role, :state, :cookieToken, :guestExpiresAt, :tsInsert, :tsRegistration, :tsLastAccess, :expiresAt)
        ");
        $stmt->execute([
            ':uuid' => $session->getUuid(),
            ':username' => $session->getUsername(),
            ':role' => $session->getRole(),
            ':state' => $session->getState(),
            ':cookieToken' => $session->getCookieToken(),
            ':guestExpiresAt' => $session->getGuestExpiresAt(),
            ':tsInsert' => $session->getTsInsert()->format('Y-m-d H:i:s'),
            ':tsRegistration' => $session->getTsRegistration(),
            ':tsLastAccess' => $session->getTsLastAccess(),
            ':expiresAt' => $session->getExpiresAt()->format('Y-m-d H:i:s'),
        ]);
    }

    public function findByCookieToken(string $cookieToken): ?GuestSession
    {
        $stmt = $this->pdo->prepare("SELECT * FROM gaming_user_sessions WHERE guest_cookie_token = :cookieToken LIMIT 1");
        $stmt->execute([':cookieToken' => $cookieToken]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;
        return $this->rowToSession($row);
    }

    public function findByUuid(string $uuid): ?GuestSession
    {
        $stmt = $this->pdo->prepare("SELECT * FROM gaming_user_sessions WHERE uuid = :uuid LIMIT 1");
        $stmt->execute([':uuid' => $uuid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;
        return $this->rowToSession($row);
    }

    public function findAll(): array
    {
        $stmt = $this->pdo->query("SELECT * FROM gaming_user_sessions ORDER BY ts_insert DESC");
        $sessions = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $sessions[] = $this->rowToSession($row);
        }
        return $sessions;
    }

    public function deleteByUuid(string $uuid): bool
    {
        $stmt = $this->pdo->prepare("DELETE FROM gaming_user_sessions WHERE uuid = :uuid");
        $stmt->execute([':uuid' => $uuid]);
        return $stmt->rowCount() > 0;
    }

    public function deleteExpired(\DateTimeImmutable $now): int
    {
        $stmt = $this->pdo->prepare("DELETE FROM gaming_user_sessions WHERE expires_at < :now");
        $stmt->execute([':now' => $now->format('Y-m-d H:i:s')]);
        return $stmt->rowCount();
    }

    public function countAll(): int
    {
        $stmt = $this->pdo->query("SELECT COUNT(*) FROM gaming_user_sessions");
        return (int) $stmt->fetchColumn();
    }

    public function countActive(): int
    {
        $now = (new \DateTimeImmutable())->format('Y-m-d H:i:s');
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM gaming_user_sessions WHERE expires_at >= :now");
        $stmt->execute([':now' => $now]);
        return (int) $stmt->fetchColumn();
    }

    public function countExpired(): int
    {
        $now = (new \DateTimeImmutable())->format('Y-m-d H:i:s');
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM gaming_user_sessions WHERE expires_at < :now");
        $stmt->execute([':now' => $now]);
        return (int) $stmt->fetchColumn();
    }

    public function updateLastAccess(string $uuid): void
    {
        $now = (new \DateTimeImmutable())->format('Y-m-d H:i:s');
        $stmt = $this->pdo->prepare("UPDATE gaming_user_sessions SET ts_last_access = :now WHERE uuid = :uuid");
        $stmt->execute([':now' => $now, ':uuid' => $uuid]);
    }

    private function rowToSession(array $row): GuestSession
    {
        return new GuestSession(
            $row['uuid'],
            $row['username'] ?? ('guest_' . substr($row['uuid'], 0, 8)),
            $row['guest_cookie_token'],
            new \DateTimeImmutable($row['ts_insert']),
            new \DateTimeImmutable($row['expires_at']),
            $row['role'] ?? 'PLAYER',
            (int)($row['state'] ?? 6),
            $row['nickname'] ?? null,
            $row['language'] ?? null,
            $row['guest_expires_at'] ?? null,
            $row['ts_registration'] ?? null,
            $row['ts_last_access'] ?? null
        );
    }
}
