-- =============================================
-- Paths Games - Database Schema V0.37.0 (PostgreSQL)
-- Step 37 - a mission condition is now one key and one OR MORE values: condition_value holds a
-- single value, condition_values a PIPE-separated list that is an AND. The old from/to pair is
-- gone: missions never had an operator, so a range was a promise the engine could not keep.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

-- Neither column is indexed nor named by a foreign key, so both drop in place.
ALTER TABLE list_missions DROP COLUMN condition_value_from;
ALTER TABLE list_missions DROP COLUMN condition_value_to;
ALTER TABLE list_missions ADD COLUMN condition_value VARCHAR(500);
ALTER TABLE list_missions ADD COLUMN condition_values VARCHAR(2000);

ALTER TABLE list_missions_steps DROP COLUMN condition_value_from;
ALTER TABLE list_missions_steps DROP COLUMN condition_value_to;
ALTER TABLE list_missions_steps ADD COLUMN condition_value VARCHAR(500);
ALTER TABLE list_missions_steps ADD COLUMN condition_values VARCHAR(2000);

-- Steps are strictly sequential, so two rows may not claim the same place in the same mission.
CREATE UNIQUE INDEX IF NOT EXISTS idx_missions_steps_order
    ON list_missions_steps (id_story, id_mission, step);
