-- =============================================
-- Paths Games - Database Schema V1.7.0_1 (PostgreSQL)
-- V1 step 10 (admin user management): suspension end, one-time re-link flag, HMAC of banned
-- Google subjects and emails (no personal data), the admin intervention log (24 months).
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

-- ISO-8601 end of a suspension (state 3); null when the user is not suspended.
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until VARCHAR(50);
-- 1 = the admin armed a re-link: the next verified login with the email replaces the Google subject.
ALTER TABLE users ADD COLUMN IF NOT EXISTS relink_pending INTEGER NOT NULL DEFAULT 0;
-- Nickname prefix search of the admin users list (lowercase, keyset order).
CREATE INDEX IF NOT EXISTS idx_users_nickname_lower ON users(lower(nickname));

-- One row per banned user (uuid): HMAC-SHA256 with the stage pepper of the subject and of the email.
CREATE TABLE IF NOT EXISTS users_banned_subjects (
    uuid         VARCHAR(36)  PRIMARY KEY,
    hash_sub     VARCHAR(64),
    hash_email   VARCHAR(64),
    ts_insert    VARCHAR(50)  NOT NULL DEFAULT NOW()::text
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_banned_subjects_sub ON users_banned_subjects(hash_sub);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_banned_subjects_email ON users_banned_subjects(hash_email);

-- Who did what to whom and why (never nickname or email); SYSTEM = automatic action.
CREATE TABLE IF NOT EXISTS admin_intervention_log (
    id           BIGSERIAL    PRIMARY KEY,
    uuid         VARCHAR(36)  NOT NULL UNIQUE,
    ts_insert    VARCHAR(50)  NOT NULL,
    admin_uuid   VARCHAR(36)  NOT NULL,
    action       VARCHAR(30)  NOT NULL,
    target_uuid  VARCHAR(36)  NOT NULL,
    reason       VARCHAR(500) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_intervention_log_ts ON admin_intervention_log(ts_insert);
CREATE INDEX IF NOT EXISTS idx_admin_intervention_log_target ON admin_intervention_log(target_uuid);
