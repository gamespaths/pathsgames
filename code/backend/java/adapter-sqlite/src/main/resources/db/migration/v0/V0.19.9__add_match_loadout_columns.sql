-- =============================================
-- Paths Games - Database Schema V0.19.9
-- Add player-choice loadout columns to gaming_match (SQLite)
-- The match creation request now records the creator's loadout:
--   single_player           -- 0/1 flag (single-player vs multiplayer match)
--   character_template_uuid -- selected character template uuid
--   class_uuid              -- selected class uuid
--   trait_uuids             -- selected trait uuids (comma-separated list)
-- UUIDs are stored loosely (no FK) - same pattern as id_card / id_text_* columns,
-- because the character/class/trait selection engine ships in Steps 21-23.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

ALTER TABLE gaming_match ADD COLUMN single_player           INTEGER NOT NULL DEFAULT 1;
ALTER TABLE gaming_match ADD COLUMN character_template_uuid TEXT;
ALTER TABLE gaming_match ADD COLUMN class_uuid              TEXT;
ALTER TABLE gaming_match ADD COLUMN trait_uuids             TEXT;
