-- =============================================
-- Paths Games - Database Schema V0.23.1
-- Add trait cost budget columns to list_stories_difficulty (SQLite)
-- Step 23: a difficulty may cap the sum of cost_positive and the sum of
-- cost_negative over the traits selected at character creation.
-- NULL means "no limit" (backward compatible).
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

ALTER TABLE list_stories_difficulty ADD COLUMN trait_cost_positive_budget INTEGER NULL;
ALTER TABLE list_stories_difficulty ADD COLUMN trait_cost_negative_budget INTEGER NULL;
