-- paths.games MySQL Database Schema

CREATE DATABASE IF NOT EXISTS pathsgames CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pathsgames;

-- gaming_user_sessions Table (Guest Sessions)
-- Matches the Python SQLite schema columns
CREATE TABLE IF NOT EXISTS gaming_user_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL,
    nickname VARCHAR(100) DEFAULT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'PLAYER',
    state INT NOT NULL DEFAULT 6,
    guest_cookie_token VARCHAR(255) NOT NULL UNIQUE,
    guest_expires_at DATETIME DEFAULT NULL,
    language VARCHAR(10) DEFAULT NULL,
    ts_insert DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ts_update DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ts_registration DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ts_last_access DATETIME DEFAULT NULL,
    expires_at DATETIME NOT NULL,
    INDEX idx_guest_cookie (guest_cookie_token),
    INDEX idx_expires_at (expires_at),
    INDEX idx_uuid (uuid)
) ENGINE=InnoDB;

-- users_tokens Table (Refresh Tokens)
CREATE TABLE IF NOT EXISTS users_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_user BIGINT NOT NULL,
    token TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    ts_insert DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_token (id_user),
    FOREIGN KEY (id_user) REFERENCES gaming_user_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB;
