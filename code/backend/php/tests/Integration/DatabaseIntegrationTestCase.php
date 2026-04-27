<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Integration;

use PHPUnit\Framework\TestCase;
use PDO;

abstract class DatabaseIntegrationTestCase extends TestCase
{
    protected static ?PDO $pdo = null;

    protected function setUp(): void
    {
        if (self::$pdo === null) {
            self::$pdo = new PDO('sqlite::memory:');
            self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            // Read database.sql
            $sqlFile = __DIR__ . '/../../database.sql';
            if (file_exists($sqlFile)) {
                $sql = file_get_contents($sqlFile);
                
                // Remove MySQL specific start lines
                $sql = preg_replace('/CREATE DATABASE IF NOT EXISTS.*;/', '', $sql);
                $sql = preg_replace('/USE .*;/', '', $sql);

                // SQLite doesn't support AUTO_INCREMENT or specific MySQL types well
                $sql = str_replace('AUTO_INCREMENT PRIMARY KEY', 'PRIMARY KEY AUTOINCREMENT', $sql);
                $sql = str_replace('AUTO_INCREMENT', 'AUTOINCREMENT', $sql);
                
                // Remove INT(11) etc
                $sql = preg_replace('/INT\(\d+\)/', 'INTEGER', $sql);
                $sql = preg_replace('/BIGINT\(\d+\)/', 'INTEGER', $sql);
                $sql = str_replace(' BIGINT ', ' INTEGER ', $sql);
                $sql = str_replace(' TINYINT(1) ', ' INTEGER ', $sql);
                $sql = str_replace(' TINYINT ', ' INTEGER ', $sql);
                $sql = str_replace(' TINYINTEGER ', ' INTEGER ', $sql);
                
                // Remove ON UPDATE CURRENT_TIMESTAMP
                $sql = preg_replace('/ON UPDATE CURRENT_TIMESTAMP/', '', $sql);

                // Remove INDEX lines inside CREATE TABLE (SQLite wants separate CREATE INDEX)
                $sql = preg_replace('/,\s*(?:INDEX|KEY|UNIQUE INDEX|UNIQUE KEY)\s+.*\(.*\)/i', '', $sql);
                $sql = preg_replace('/,\s*CONSTRAINT\s+.*FOREIGN KEY\s+.*\(.*\)\s+REFERENCES\s+.*\(.*\).*/i', '', $sql);
                $sql = preg_replace('/,\s*FOREIGN KEY\s+.*\(.*\)\s+REFERENCES\s+.*\(.*\).*/i', '', $sql);

                // Remove trailing commas before closing parenthesis
                $sql = preg_replace('/,\s*\)/', "\n)", $sql);

                // Remove CHARACTER SET and ENGINE
                $sql = preg_replace('/CHARACTER SET [^ ]+/i', '', $sql);
                $sql = preg_replace('/COLLATE [^ ]+/i', '', $sql);
                $sql = preg_replace('/ENGINE=[^ ;]+/i', '', $sql);

                // Run SQL commands individually
                $statements = array_filter(array_map('trim', explode(';', $sql)));
                foreach ($statements as $statement) {
                    if (!empty($statement)) {
                        self::$pdo->exec($statement);
                    }
                }
            } else {
                $this->markTestSkipped('database.sql not found at ' . $sqlFile);
            }
        } else {
            // Clean tables for each test
            $tables = self::$pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")->fetchAll(PDO::FETCH_COLUMN);
            foreach ($tables as $table) {
                self::$pdo->exec("DELETE FROM $table");
            }
        }
    }

    protected function getPdo(): PDO
    {
        return self::$pdo;
    }
}
