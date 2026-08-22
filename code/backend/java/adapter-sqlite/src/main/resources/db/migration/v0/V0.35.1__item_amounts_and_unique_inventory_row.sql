-- =============================================
-- Paths Games - Database Schema V0.35.1 (SQLite)
-- Step 35 - How MANY: the quantity every item action moves, and the cap on what
-- a character may carry.
--
-- Until this version every quantity was hardcoded: an event ADD gave exactly one
-- unit, an event REMOVE took exactly one, and use-item / drop-item discarded the
-- WHOLE row whatever it held. Three columns on list_items give those numbers back
-- to the author:
--
--   max_per_character  How many units of this item one character may hold. An ADD
--                      that would cross it is refused - no error, the event still
--                      runs and everything else it does still applies. 0 or NULL
--                      mean no limit, the same reading id_class_permitted already
--                      has. Written for "one map, ever" and "at most two apples".
--   amount_drop        Units removed by ONE drop-item. NULL reads as 1. Owning
--                      fewer than that is not a refusal: the drop takes what is
--                      there, because a player asking to put something down can
--                      always put down everything they hold.
--   amount_use         Units consumed by ONE use-item. NULL reads as 1. Owning
--                      fewer IS a refusal (ITEM_NOT_ENOUGH): half a potion heals
--                      nobody, and silently drinking less than the recipe asks for
--                      would make the effect a lie.
--
-- An ADD is always ONE unit. There is no amount_add on purpose: an event that has
-- to hand over three of something writes three effect rows, and the cap above
-- then applies to each of them in turn rather than to a lump the engine would
-- have to split.
--
-- The event REMOVE now takes EVERYTHING the character holds of that item, not one
-- unit. That is what "the story takes it away from you" has always meant, and it
-- also repairs a latent bug: the engine dropped the item from its owned-items set
-- after a REMOVE even when units were left, so a later condition in the same
-- execution read "not owned" while the bag still held two.
--
-- ── One row per (character, item) ────────────────────────────────────────────
--
-- The engine has always stacked an ADD onto the existing row, so no code path
-- creates a second one. Nothing enforced it, though, and a quantity spread over
-- two rows would make max_per_character and amount_drop lie about what is held.
-- The merge below folds any duplicate that a hand-written seed or an older build
-- may have left, and the unique index makes the rule the schema's own.
--
-- The merge keeps the LOWEST id of each group - the oldest row, the one another
-- table is most likely to reference - and sums the amounts onto it.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

ALTER TABLE list_items ADD COLUMN max_per_character INTEGER;
ALTER TABLE list_items ADD COLUMN amount_drop       INTEGER;
ALTER TABLE list_items ADD COLUMN amount_use        INTEGER;

-- 1. Sum every duplicate group onto its oldest row.
UPDATE gaming_inventory_items
   SET amount = (SELECT SUM(o.amount)
                   FROM gaming_inventory_items o
                  WHERE o.id_match           = gaming_inventory_items.id_match
                    AND o.id_character_match = gaming_inventory_items.id_character_match
                    AND o.id_item            = gaming_inventory_items.id_item)
 WHERE id = (SELECT MIN(m.id)
               FROM gaming_inventory_items m
              WHERE m.id_match           = gaming_inventory_items.id_match
                AND m.id_character_match = gaming_inventory_items.id_character_match
                AND m.id_item            = gaming_inventory_items.id_item);

-- 2. Drop the rows whose amount now lives on the oldest one.
DELETE FROM gaming_inventory_items
 WHERE id <> (SELECT MIN(m.id)
                FROM gaming_inventory_items m
               WHERE m.id_match           = gaming_inventory_items.id_match
                 AND m.id_character_match = gaming_inventory_items.id_character_match
                 AND m.id_item            = gaming_inventory_items.id_item);

-- 3. And now nobody can write a second one.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_char_item
    ON gaming_inventory_items (id_match, id_character_match, id_item);
