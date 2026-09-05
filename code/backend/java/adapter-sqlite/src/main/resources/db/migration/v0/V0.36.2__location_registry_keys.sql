-- =============================================
-- Paths Games - Database Schema V0.36.2 (SQLite)
-- Step 36.2 - a LOCATION may write the registry. Two pairs, so the place can say one thing
-- the first time the party arrives and another on every later arrival - the same split
-- id_event_if_first_time / id_event_not_first_time already draws for automatic events.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

-- The first arrival. Both nullable: a blank key is simply not a write.
ALTER TABLE list_locations ADD COLUMN key_to_add VARCHAR(200);
ALTER TABLE list_locations ADD COLUMN key_value_to_add VARCHAR(500);

-- Every later arrival. Orthogonal to the pair above: an arrival takes one branch, never both.
ALTER TABLE list_locations ADD COLUMN key_to_add_not_first VARCHAR(200);
ALTER TABLE list_locations ADD COLUMN key_value_to_add_not_first VARCHAR(500);
