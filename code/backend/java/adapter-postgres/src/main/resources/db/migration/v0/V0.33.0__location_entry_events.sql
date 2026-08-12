-- =============================================
-- Paths Games - Database Schema V0.33.0 (PostgreSQL)
-- Step 33 - Location entry events (automatic triggers).
--
-- Two additive columns, no backfill, no behaviour change until a story
-- actually authors a trigger.
--
--   gaming_state_locations.flag_visited
--       "the party has entered this location at least once", keyed
--       (id_match, id_location). It decides id_event_if_first_time versus
--       id_event_not_first_time. INTEGER, not BOOLEAN, to match the JPA
--       mapping and what V0.19.2 did to flag_already_actived.
--
--       It is DELIBERATELY NOT flag_already_actived, which means "this
--       location's counter has been consumed" (Step 26) and latches the
--       counter re-seed. Overloading it would break counters and entry
--       triggers at once. First entry is the PARTY's, not the character's.
--       Match creation seeds 1 on the story's id_location_start.
--
--   log_events.id_location
--       the location a log row is about, structured instead of buried in
--       log_message.
--
-- No migration is needed for list_events.type: the executability gate is an
-- allowlist ({NORMAL, ONCE}), so an engine-driven event keeps type='AUTOMATIC'
-- and is already refused to players. The five trigger columns on list_locations
-- and priority_automatic_event have existed since V0.10.3 and are finally read
-- by the engine in this step.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- =============================================

ALTER TABLE gaming_state_locations ADD COLUMN flag_visited INTEGER NOT NULL DEFAULT 0;

ALTER TABLE log_events ADD COLUMN id_location BIGINT;

COMMENT ON COLUMN gaming_state_locations.flag_visited IS 'v0.33.0 Step 33: the PARTY has entered this location at least once - drives id_event_if_first_time vs id_event_not_first_time. Not flag_already_actived, which means "counter consumed"';
COMMENT ON COLUMN log_events.id_location IS 'v0.33.0 Step 33: the location this log row is about (counter-zero, automatic events) - structured instead of parsed out of log_message';
