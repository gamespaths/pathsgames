-- =============================================
-- Paths Games - Database Schema V1.2.0 (SQLite)
-- V1 steps 2-5 (Google SSO): users_identities, no passwords, unique email/nickname,
-- hashed tokens with the refresh grace column, the ID-token replay store.
-- users.state: 1 and 5 unused (no passwords), 7 = deleting.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

CREATE TABLE IF NOT EXISTS users_identities (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid                TEXT    NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+abs(random())%4,1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
    id_user             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider            TEXT    NOT NULL,
    provider_subject    TEXT    NOT NULL,
    email               TEXT,
    profile_name        TEXT,
    given_name          TEXT,
    family_name         TEXT,
    picture_url         TEXT,
    locale              TEXT,
    ts_profile_update   TEXT,
    ts_insert           TEXT    NOT NULL DEFAULT (datetime('now')),
    ts_update           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- The email identifies the user (stored lowercase by the code); the subject is checked at login.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_identities_provider_email ON users_identities(provider, email);
CREATE INDEX IF NOT EXISTS idx_users_identities_subject ON users_identities(provider, provider_subject);
CREATE INDEX IF NOT EXISTS idx_users_identities_user ON users_identities(id_user);

-- No passwords and no single Google id column any more.
DROP INDEX IF EXISTS idx_users_google_sso;
ALTER TABLE users DROP COLUMN google_id_sso;
ALTER TABLE users DROP COLUMN password_hash;

-- users.email_address unique when present (guests have none): duplicates of older data cleared first.
UPDATE users SET email_address = NULL
 WHERE email_address IS NOT NULL
   AND id NOT IN (SELECT MIN(id) FROM users WHERE email_address IS NOT NULL GROUP BY email_address);
DROP INDEX IF EXISTS idx_users_email;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users(email_address) WHERE email_address IS NOT NULL;

-- users.nickname unique: a colliding older nickname gets the row id as suffix.
UPDATE users SET nickname = nickname || '#' || id
 WHERE nickname IS NOT NULL
   AND id NOT IN (SELECT MIN(id) FROM users WHERE nickname IS NOT NULL GROUP BY nickname);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_nickname ON users(nickname);
CREATE INDEX IF NOT EXISTS idx_users_guest_cookie ON users(guest_cookie_token);

-- Refresh tokens are stored as SHA-256 hash; ts_rotated opens the 30-second refresh grace.
ALTER TABLE users_tokens ADD COLUMN ts_rotated TEXT;
CREATE INDEX IF NOT EXISTS idx_users_tokens_refresh ON users_tokens(refresh_token);

-- Hash of every Google ID token used, kept until its exp, to refuse a replay.
CREATE TABLE IF NOT EXISTS auth_id_token_seen (
    token_hash   TEXT    PRIMARY KEY,
    expires_at   TEXT    NOT NULL,
    ts_insert    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_auth_id_token_seen_expires ON auth_id_token_seen(expires_at);
