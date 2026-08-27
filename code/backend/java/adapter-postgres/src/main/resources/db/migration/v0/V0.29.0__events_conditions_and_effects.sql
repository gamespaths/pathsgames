-- =============================================
-- Paths Games - Database Schema V0.29.0 (PostgreSQL)
-- Step 29 - Normal events (player-triggered actions).
--
--   * list_events gains the four CONDITION columns read by the check procedure.
--   * list_events_effects gains id_weather plus the four effect columns that
--     used to live on list_events.
--   * gaming_character_instance gains exp and characteristics: two effect
--     targets that had nowhere to be written before this step.
--   * Authored values in the four moved columns are copied into a new effect
--     row, then the columns are dropped.
--
-- id_weather means the OPPOSITE thing on the two tables:
--   list_events.id_weather          CONDITION - the event is only available when
--                                   the match's current weather equals it.
--   list_events_effects.id_weather  EFFECT    - it SETS the match weather.
--
-- list_events.id_item_to_add is DEPRECATED from this version: the engine ignores
-- it and items are granted/removed through list_events_effects.(id_item_target,
-- item_action). The column stays because it is used in a FK clause. The new
-- list_events.id_item_condition is a CONDITION (the character must own the item).
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- =============================================

-- 1. list_events: the CONDITION columns of the check procedure.
ALTER TABLE list_events ADD COLUMN registry_key_condition   VARCHAR(200);
ALTER TABLE list_events ADD COLUMN registry_value_condition VARCHAR(500);
ALTER TABLE list_events ADD COLUMN id_class_condition       BIGINT;
ALTER TABLE list_events ADD COLUMN id_item_condition        BIGINT;

COMMENT ON COLUMN list_events.registry_key_condition   IS 'Step 29 CONDITION: registry key that must hold registry_value_condition';
COMMENT ON COLUMN list_events.registry_value_condition IS 'Step 29 CONDITION: expected value of registry_key_condition';
COMMENT ON COLUMN list_events.id_class_condition       IS 'Step 29 CONDITION: the character must have this class';
COMMENT ON COLUMN list_events.id_item_condition        IS 'Step 29 CONDITION: the character must own this item';
COMMENT ON COLUMN list_events.id_weather               IS 'Step 29 CONDITION: the match current weather must equal this (list_events_effects.id_weather SETS it instead)';
COMMENT ON COLUMN list_events.id_item_to_add           IS 'DEPRECATED v0.29.0 - ignored by the engine; use list_events_effects.(id_item_target, item_action)';
COMMENT ON COLUMN list_events.type                     IS 'AUTOMATIC, FIRST, NORMAL, ONCE';

-- 2. list_events_effects: the EFFECT columns.
ALTER TABLE list_events_effects ADD COLUMN id_weather               BIGINT;
ALTER TABLE list_events_effects ADD COLUMN key_to_add               VARCHAR(200);
ALTER TABLE list_events_effects ADD COLUMN key_value_to_add         VARCHAR(500);
ALTER TABLE list_events_effects ADD COLUMN characteristic_to_add    VARCHAR(200);
ALTER TABLE list_events_effects ADD COLUMN characteristic_to_remove VARCHAR(200);

COMMENT ON COLUMN list_events_effects.id_weather IS 'Step 29 EFFECT: sets gaming_match.id_current_weather (list_events.id_weather is a CONDITION instead)';
COMMENT ON COLUMN list_events_effects.key_to_add IS 'Step 29 EFFECT: registry key to upsert with key_value_to_add (moved from list_events)';

-- 3. Effect targets on the character instance.
ALTER TABLE gaming_character_instance ADD COLUMN exp             INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gaming_character_instance ADD COLUMN characteristics VARCHAR(500);

COMMENT ON COLUMN gaming_character_instance.exp             IS 'Experience points; written by Step 29 event effects, spent in Step 37';
COMMENT ON COLUMN gaming_character_instance.characteristics IS 'CSV of characteristics, see MatchTraitCodec (Step 29)';

-- 4. Move the authored values: one effect row per event that used the old columns.
--    The id offset is an uncorrelated scalar (evaluated once, before any row is
--    inserted) plus a global ROW_NUMBER, so a new id cannot collide with an
--    existing (id, id_story) pair. Per-story gaps are harmless:
--    StoryPersistenceAdapter.nextStoryScopedId allocates MAX(id)+1 per story.
INSERT INTO list_events_effects
       (id, id_story, id_event, statistics, value, target,
        key_to_add, key_value_to_add, characteristic_to_add, characteristic_to_remove)
SELECT (SELECT COALESCE(MAX(x.id), 0) FROM list_events_effects x)
           + ROW_NUMBER() OVER (ORDER BY e.id_story, e.id),
       e.id_story, e.id, NULL, 0, 'ALL',
       e.key_to_add, e.key_value_to_add, e.characteristic_to_add, e.characteristic_to_remove
FROM   list_events e
WHERE  e.key_to_add               IS NOT NULL
    OR e.key_value_to_add         IS NOT NULL
    OR e.characteristic_to_add    IS NOT NULL
    OR e.characteristic_to_remove IS NOT NULL;

-- The id column is BIGSERIAL but the app always writes explicit ids. Keep the
-- sequence ahead of the rows just inserted (same guard as
-- StoryPersistenceAdapter.syncSequence).
SELECT setval(pg_get_serial_sequence('list_events_effects', 'id'),
              COALESCE((SELECT MAX(id) FROM list_events_effects), 1), true);

-- 5. Drop the moved columns. Safe: they are in no index (V0.10.11) and in no FK
--    clause (V0.10.4).
ALTER TABLE list_events DROP COLUMN IF EXISTS characteristic_to_add;
ALTER TABLE list_events DROP COLUMN IF EXISTS characteristic_to_remove;
ALTER TABLE list_events DROP COLUMN IF EXISTS key_to_add;
ALTER TABLE list_events DROP COLUMN IF EXISTS key_value_to_add;
