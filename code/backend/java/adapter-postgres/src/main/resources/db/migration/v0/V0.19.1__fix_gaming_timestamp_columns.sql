-- =============================================
-- Paths Games - Database Schema V0.10.14
-- Fix gaming tables: convert TIMESTAMP columns to VARCHAR(50)
-- to match Java entity fields typed as String (ISO-8601 text).
-- Affects: gaming_match, gaming_character_instance,
--          gaming_turn_queue, log_weather, log_clock_history
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

-- gaming_match
ALTER TABLE gaming_match
    ALTER COLUMN timestamp_start             TYPE VARCHAR(50) USING timestamp_start::text,
    ALTER COLUMN timestamp_lock_expiration   TYPE VARCHAR(50) USING timestamp_lock_expiration::text,
    ALTER COLUMN timestamp_gameover          TYPE VARCHAR(50) USING timestamp_gameover::text,
    ALTER COLUMN timestamp_end               TYPE VARCHAR(50) USING timestamp_end::text;

-- gaming_character_instance
ALTER TABLE gaming_character_instance
    ALTER COLUMN timestamp_last_pass TYPE VARCHAR(50) USING timestamp_last_pass::text;

-- gaming_turn_queue
ALTER TABLE gaming_turn_queue
    ALTER COLUMN timestamp_start TYPE VARCHAR(50) USING timestamp_start::text,
    ALTER COLUMN timestamp_end   TYPE VARCHAR(50) USING timestamp_end::text;

-- log_weather
ALTER TABLE log_weather
    ALTER COLUMN timestamp_start TYPE VARCHAR(50) USING timestamp_start::text,
    ALTER COLUMN timestamp_end   TYPE VARCHAR(50) USING timestamp_end::text;

-- log_clock_history
ALTER TABLE log_clock_history
    ALTER COLUMN timestamp_start TYPE VARCHAR(50) USING timestamp_start::text,
    ALTER COLUMN timestamp_end   TYPE VARCHAR(50) USING timestamp_end::text;
