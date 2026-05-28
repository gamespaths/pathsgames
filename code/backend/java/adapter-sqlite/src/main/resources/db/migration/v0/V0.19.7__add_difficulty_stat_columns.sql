-- =============================================
-- Paths Games - Database Schema V0.19.7
-- Add stat columns to list_stories_difficulty (SQLite)
-- A difficulty configures the seven main statistics:
-- life, energy, sad, dexterity, intelligence, constitution, weight.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

ALTER TABLE list_stories_difficulty ADD COLUMN life         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE list_stories_difficulty ADD COLUMN energy       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE list_stories_difficulty ADD COLUMN sad          INTEGER NOT NULL DEFAULT 0;
ALTER TABLE list_stories_difficulty ADD COLUMN dexterity    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE list_stories_difficulty ADD COLUMN intelligence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE list_stories_difficulty ADD COLUMN constitution INTEGER NOT NULL DEFAULT 0;
ALTER TABLE list_stories_difficulty ADD COLUMN weight       INTEGER NOT NULL DEFAULT 0;
