-- =============================================
-- Paths Games - Database Schema V0.38.0 (PostgreSQL)
-- Step 38 - experience is spent: a +1 on DEX/INT/COS costs
-- max(1, exp_cost * current_value + exp_cost_base) and may never push the stat past
-- max_stat_value (0 = no cap). cost_max_characteristics never meant one thing twice, so it goes;
-- list_locations.is_safe was read by nothing (secure_param is the one "safe" the engine knows).
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

-- The index (V0.10.11) names the column, so it must go first.
DROP INDEX IF EXISTS idx_locations_safe;
ALTER TABLE list_locations DROP COLUMN IF EXISTS is_safe;

ALTER TABLE list_stories_difficulty DROP COLUMN IF EXISTS cost_max_characteristics;
ALTER TABLE list_stories_difficulty ADD COLUMN exp_cost_base  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE list_stories_difficulty ADD COLUMN max_stat_value INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN list_stories_difficulty.exp_cost_base  IS 'Step 38: flat addend of the use-exp cost (<= 0 reads as 0)';
COMMENT ON COLUMN list_stories_difficulty.max_stat_value IS 'Step 38: cap on DEX/INT/COS reachable through use-exp (<= 0 = no cap)';
COMMENT ON COLUMN gaming_character_instance.exp IS 'Experience points; written by Step 29 event effects, spent by Step 38 use-exp';
