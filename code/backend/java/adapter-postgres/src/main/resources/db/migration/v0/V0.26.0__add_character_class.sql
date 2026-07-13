-- =============================================
-- Paths Games - Database Schema V0.26.0
-- Persist the character's class on the instance (PostgreSQL)
-- Step 26: time-start recovery applies class bonuses (list_classes_bonus) per
-- character on every clock advance. That lookup needs the character's class id,
-- which was previously NOT stored on the instance (only the final computed stats
-- were). This column lets the recovery engine resolve the class bonuses at
-- time-start without re-deriving the loadout.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

ALTER TABLE gaming_character_instance ADD COLUMN id_class INTEGER;

COMMENT ON COLUMN gaming_character_instance.id_class IS 'Selected class id; used by Step 26 time-start class-bonus recovery';
