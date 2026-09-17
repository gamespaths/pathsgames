-- =============================================
-- Paths Games - Database Schema V0.38.0 (SQLite)
-- Step 38 - experience is spent: a +1 on DEX/INT/COS costs
-- max(1, exp_cost * current_value + exp_cost_base) and may never push the stat past
-- max_stat_value (0 = no cap). cost_max_characteristics never meant one thing twice, so it goes;
-- list_locations.is_safe was read by nothing (secure_param is the one "safe" the engine knows).
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

-- SQLite (>= 3.35) refuses to drop an indexed column, so the V0.10.11 index goes first.
DROP INDEX IF EXISTS idx_locations_safe;
ALTER TABLE list_locations DROP COLUMN is_safe;

ALTER TABLE list_stories_difficulty DROP COLUMN cost_max_characteristics;
ALTER TABLE list_stories_difficulty ADD COLUMN exp_cost_base  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE list_stories_difficulty ADD COLUMN max_stat_value INTEGER NOT NULL DEFAULT 0;
