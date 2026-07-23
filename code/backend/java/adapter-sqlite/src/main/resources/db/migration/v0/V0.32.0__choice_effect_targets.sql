-- =============================================
-- Paths Games - Database Schema V0.32.0 (SQLite)
-- Step 32 - Choice resolution: what a selected option can do.
--
-- Until this version list_choices_effects could only move a statistic
-- (statistics/value) or write a registry key (key/value_to_add/value_to_remove).
-- The resolution engine applies the same vocabulary the event effects already
-- speak (V0.29.0 / V0.29.3), so the five columns below are named and typed
-- exactly like their list_events_effects twins:
--
--   id_event       EFFECT - runs that event inline, with its whole id_event_next
--                  chain, exactly like list_choices.id_event_torun. NOT a condition.
--   id_location    EFFECT - forced movement of the row's recipients: no neighbor
--                  adjacency, no energy cost, no availability check. Each actual
--                  move writes a cost-0 row to log_movements (v0.29.3 rule).
--   id_weather     EFFECT - SETS the match weather. Applied once per effect row,
--                  no matter how many characters the row targets: weather is a
--                  property of the MATCH, not of a character.
--   id_item_target EFFECT - the item added to / removed from the recipients.
--   item_action    ADD or REMOVE - which of the two, for id_item_target.
--
-- Who a row applies to is decided by the pre-existing flag_group: 0 (default)
-- targets the acting character alone, 1 targets every character standing in the
-- actor's location - the same set list_events_effects.target='ALL' resolves
-- (INV-27), never every character of the match.
--
-- No FK, deliberately: same as id_weather and the other effect columns on
-- list_events_effects. The reference is story-scoped and the Step 22 validator
-- owns the existence check (R1 referential integrity, extended this step to the
-- four new id columns). A value matching no row of the story is authored noise:
-- the engine skips that part of the effect silently rather than failing the
-- whole resolution.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- =============================================

ALTER TABLE list_choices_effects ADD COLUMN id_event       INTEGER;
ALTER TABLE list_choices_effects ADD COLUMN id_location    INTEGER;
ALTER TABLE list_choices_effects ADD COLUMN id_weather     INTEGER;
ALTER TABLE list_choices_effects ADD COLUMN id_item_target INTEGER;
ALTER TABLE list_choices_effects ADD COLUMN item_action    TEXT;
