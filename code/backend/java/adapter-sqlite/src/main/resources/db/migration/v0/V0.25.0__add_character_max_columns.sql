-- =============================================
-- Paths Games - Database Schema V0.27.0
-- Persist per-character max statistics (SQLite)
-- Step 27: life_max / energy_max / sad_max / weight_max are computed once at
-- join time (template + class + difficulty + traits + class-bonuses) and stored
-- on the character instance so the match /info endpoint can return them without
-- recomputation (the class id is not persisted on the instance).
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

ALTER TABLE gaming_character_instance ADD COLUMN life_max   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gaming_character_instance ADD COLUMN energy_max INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gaming_character_instance ADD COLUMN sad_max    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gaming_character_instance ADD COLUMN weight_max INTEGER NOT NULL DEFAULT 0;
