-- =============================================
-- Paths Games - Database Schema V0.41.0 (PostgreSQL)
-- Step 41 - the daily guest cleanup and the expired-guest delete select guests by state and
-- last access; one composite index keeps both off a full scan of users.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

CREATE INDEX IF NOT EXISTS idx_users_state_last_access ON users(state, ts_last_access);
