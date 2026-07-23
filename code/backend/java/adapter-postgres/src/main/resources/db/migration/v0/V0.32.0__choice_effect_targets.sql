-- =============================================
-- Paths Games - Database Schema V0.32.0 (PostgreSQL)
-- Step 32 - Choice resolution: what a selected option can do.
--
-- Until this version list_choices_effects could only move a statistic
-- (statistics/value) or write a registry key (key/value_to_add/value_to_remove).
-- The resolution engine applies the same vocabulary the event effects already
-- speak (V0.29.0 / V0.29.3), so the five columns below are named and typed
-- exactly like their list_events_effects twins.
--
-- Who a row applies to is decided by the pre-existing flag_group: 0 (default)
-- targets the acting character alone, 1 targets every character standing in the
-- actor's location - the same set list_events_effects.target='ALL' resolves
-- (INV-27), never every character of the match.
--
-- No FK, deliberately: same as id_weather and the other effect columns on
-- list_events_effects. The reference is story-scoped and the Step 22 validator
-- owns the existence check. A value matching no row of the story is authored
-- noise: the engine skips that part of the effect silently.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- =============================================

ALTER TABLE list_choices_effects ADD COLUMN id_event       BIGINT;
ALTER TABLE list_choices_effects ADD COLUMN id_location    BIGINT;
ALTER TABLE list_choices_effects ADD COLUMN id_weather     BIGINT;
ALTER TABLE list_choices_effects ADD COLUMN id_item_target BIGINT;
ALTER TABLE list_choices_effects ADD COLUMN item_action    VARCHAR(20);

COMMENT ON COLUMN list_choices_effects.id_event       IS 'v0.32.0 EFFECT: runs that event inline with its whole id_event_next chain';
COMMENT ON COLUMN list_choices_effects.id_location    IS 'v0.32.0 EFFECT: moves the recipients to this location - no checks, no energy cost';
COMMENT ON COLUMN list_choices_effects.id_weather     IS 'v0.32.0 EFFECT: SETS the match weather, once per row';
COMMENT ON COLUMN list_choices_effects.id_item_target IS 'v0.32.0 EFFECT: the item added to / removed from the recipients';
COMMENT ON COLUMN list_choices_effects.item_action    IS 'v0.32.0 EFFECT: ADD or REMOVE, for id_item_target';
