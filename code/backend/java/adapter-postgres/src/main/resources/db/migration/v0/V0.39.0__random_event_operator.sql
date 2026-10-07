-- =============================================
-- Paths Games - Database Schema V0.39.0 (PostgreSQL)
-- Step 39 - random events fire at time-start; their registry condition gains an operator
-- (= != > <) like events, edges and weather rules got in V0.36.0.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

-- The column is DEFAULT '=' so every row authored before today keeps the behaviour it had.
ALTER TABLE list_global_random_events ADD COLUMN registry_value_operator_condition TEXT DEFAULT '=';

COMMENT ON COLUMN list_global_random_events.registry_value_operator_condition IS 'How condition_value is compared: = != > < ; NULL means =';
