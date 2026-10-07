-- =============================================
-- Paths Games - Database Schema V0.36.0 (SQLite)
-- Step 36 - registry conditions gain an operator, so an event, an edge or a weather rule can
-- compare a key with =, !=, > or < instead of the equality that was the only choice until now.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

-- The column is DEFAULT '=' so every row authored before today keeps the behaviour it had.
ALTER TABLE list_events ADD COLUMN registry_value_operator_condition TEXT DEFAULT '=';
ALTER TABLE list_locations_neighbors ADD COLUMN registry_value_operator_condition TEXT DEFAULT '=';
ALTER TABLE list_weather_rules ADD COLUMN registry_value_operator_condition TEXT DEFAULT '=';

-- list_choices_conditions already has `operator` with the same vocabulary; it is reused as is.

-- One row per key per match: the invariant the upsert has always assumed but nothing enforced.
-- Nothing should have written a duplicate, but list_keys does not forbid two keys with the same
-- name, so a story could seed one; drop the older row before the index makes it impossible.
DELETE FROM gaming_state_registry
 WHERE rowid NOT IN (SELECT MAX(rowid) FROM gaming_state_registry GROUP BY id_match, key);

DROP INDEX IF EXISTS idx_state_reg_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_state_reg_key ON gaming_state_registry(id_match, key);
