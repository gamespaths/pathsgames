-- =============================================
-- Paths Games - Database Schema V1.7.0_1 (SQLite)
-- V1 step 10 (admin user management): suspension end, one-time re-link flag, HMAC of banned
-- Google subjects and emails (no personal data), the admin intervention log (24 months).
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

-- ISO-8601 end of a suspension (state 3); null when the user is not suspended.
ALTER TABLE users ADD COLUMN suspended_until TEXT;
-- 1 = the admin armed a re-link: the next verified login with the email replaces the Google subject.
ALTER TABLE users ADD COLUMN relink_pending INTEGER NOT NULL DEFAULT 0;
-- Nickname prefix search of the admin users list (lowercase, keyset order).
CREATE INDEX IF NOT EXISTS idx_users_nickname_lower ON users(lower(nickname));

-- One row per banned user (uuid): HMAC-SHA256 with the stage pepper of the subject and of the email.
CREATE TABLE IF NOT EXISTS users_banned_subjects (
    uuid         TEXT    PRIMARY KEY,
    hash_sub     TEXT,
    hash_email   TEXT,
    ts_insert    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_banned_subjects_sub ON users_banned_subjects(hash_sub);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_banned_subjects_email ON users_banned_subjects(hash_email);

-- Who did what to whom and why (never nickname or email); SYSTEM = automatic action.
CREATE TABLE IF NOT EXISTS admin_intervention_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid         TEXT    NOT NULL UNIQUE,
    ts_insert    TEXT    NOT NULL,
    admin_uuid   TEXT    NOT NULL,
    action       TEXT    NOT NULL,
    target_uuid  TEXT    NOT NULL,
    reason       TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_intervention_log_ts ON admin_intervention_log(ts_insert);
CREATE INDEX IF NOT EXISTS idx_admin_intervention_log_target ON admin_intervention_log(target_uuid);
