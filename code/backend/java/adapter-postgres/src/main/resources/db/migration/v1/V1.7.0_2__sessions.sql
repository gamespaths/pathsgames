-- =============================================
-- Paths Games - Database Schema V1.7.0_2 (PostgreSQL)
-- V1 step 12 (multi-device continuity): why a refresh token was revoked (SESSION_LIMIT, 7-day purge of
-- ROTATED and LOGOUT rows, reuse detection) and the second before which access tokens are refused.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

-- ROTATED, LOGOUT, LOGOUT_ALL, LIMIT or ADMIN; null while the token is active (and on older rows).
ALTER TABLE users_tokens ADD COLUMN IF NOT EXISTS revoked_reason VARCHAR(20);
-- The daily purge reads the reason and the revocation time (ts_update).
CREATE INDEX IF NOT EXISTS idx_users_tokens_reason_update ON users_tokens(revoked_reason, ts_update);
-- ISO-8601 second set by "log out of all devices", ban and suspend: older access tokens answer 401.
ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_valid_after VARCHAR(50);
