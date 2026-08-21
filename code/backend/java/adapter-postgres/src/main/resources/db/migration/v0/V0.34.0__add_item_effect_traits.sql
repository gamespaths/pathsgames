-- =============================================
-- Paths Games - Database Schema V0.34.0 (PostgreSQL)
-- Steps 34 + 35 - Inventory and resources: what using an item can do.
--
-- Until this version list_items_effects could only move a statistic
-- (effect_code/effect_value). Using an item now speaks the same vocabulary the
-- event effects already speak (V0.10.4), so the two columns below are named and
-- typed exactly like their list_events_effects twins - CSV of story-scoped
-- list_traits ids, no new third format.
--
-- Recipient: an item effect always applies to the character who used it, and to
-- nobody else. There is no target/target_class column here on purpose - handing
-- an item to another character is multiplayer (steps 71-76) and out of scope.
--
-- No FK, deliberately: same as every other effect column. The reference is
-- story-scoped and the Step 22 validator owns the existence check. An id
-- matching no trait of the story is authored noise: the engine skips that part
-- of the effect silently.
--
-- The last statement below is a dialect-convergence fix, same reasoning as
-- V0.19.1 and V0.26.1: log_item_usage.effects_json is JSONB here and TEXT on
-- SQLite, while the Java entity field is a String like every other log column.
-- Binding a String to JSONB raises PSQLException 42804 - exactly the 500 that
-- V0.26.1 had to fix for the timestamp columns. Nothing in the project reads
-- effects_json with a JSON operator, so JSONB buys nothing and costs a
-- dialect-specific Hibernate type mapping.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

ALTER TABLE list_items_effects ADD COLUMN traits_to_add    VARCHAR(200);
ALTER TABLE list_items_effects ADD COLUMN traits_to_remove VARCHAR(200);

COMMENT ON COLUMN list_items_effects.traits_to_add    IS 'v0.34.0 EFFECT: CSV of list_traits ids granted to the user of the item - same format as list_events_effects';
COMMENT ON COLUMN list_items_effects.traits_to_remove IS 'v0.34.0 EFFECT: CSV of list_traits ids taken from the user of the item - same format as list_events_effects';
COMMENT ON COLUMN list_items_effects.effect_code      IS 'LIFE, ENERGY, EXP, SADNESS, DEX, INT, COS, FOOD, MAGIC, COIN - case-insensitive; SADNESS is the `sad` statistic';

-- log_item_usage: JSONB -> TEXT, to match the Java String field (see header).
ALTER TABLE log_item_usage
    ALTER COLUMN effects_json TYPE TEXT USING effects_json::text;
