-- =============================================
-- Paths Games - Database Schema V0.41.1 (PostgreSQL)
-- Step 41 B - the LIGHT snapshot written at every time-end: the clock it closes, the SHA-256
-- of its canonical payload, and one index for the per-match list and the pruning.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

ALTER TABLE system_snapshot ADD COLUMN IF NOT EXISTS clock INTEGER;
ALTER TABLE system_snapshot ADD COLUMN IF NOT EXISTS checksum VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_snapshot_match_clock ON system_snapshot(id_match, clock);
