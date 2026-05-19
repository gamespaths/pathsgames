-- =============================================
-- Paths Games - Database Schema V0.19.6
-- Add stat bonus columns to list_traits (SQLite)
-- A trait can grant numeric deltas on the seven main statistics:
-- life, energy, sad, dexterity, intelligence, constitution, weight.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

ALTER TABLE list_traits ADD COLUMN life         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE list_traits ADD COLUMN energy       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE list_traits ADD COLUMN sad          INTEGER NOT NULL DEFAULT 0;
ALTER TABLE list_traits ADD COLUMN dexterity    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE list_traits ADD COLUMN intelligence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE list_traits ADD COLUMN constitution INTEGER NOT NULL DEFAULT 0;
ALTER TABLE list_traits ADD COLUMN weight       INTEGER NOT NULL DEFAULT 0;
