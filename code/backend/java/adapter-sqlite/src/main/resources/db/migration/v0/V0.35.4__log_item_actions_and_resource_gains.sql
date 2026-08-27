-- =============================================
-- Paths Games - Database Schema V0.35.4 (SQLite)
-- What the log was missing: items and the resources an action GIVES.
--
-- log_item_usage was written on a use and read by nobody, and it was the only
-- item event the engine recorded at all: taking an item and dropping one left
-- no trace outside the HTTP response. The table stops being "the usage log"
-- and becomes the register of everything that happens to an item.
--
--   action    ADD | USE | DROP | REMOVE. Existing rows default to USE, which
--             is the honest reading of a table that until today logged
--             nothing else.
--   id_event  the event whose effect moved the item; NULL when the player
--             acted directly (use, drop). No FOREIGN KEY: list_events is keyed
--             on (id, id_story), so id alone carries no unique constraint and a
--             reference to it is not a valid one. Same shape on both dialects -
--             PostgreSQL refuses such a reference outright.
--
-- energy / food / magic / coin are SIGNED deltas here, not costs: a potion
-- that gives 10 energy and takes 1 magic writes +10 and -1. effects_json
-- keeps the full story - these four columns exist so a timeline can show the
-- numbers without parsing it.
--
-- On log_events the *_gain columns are the other half of V0.35.3: that
-- migration recorded what an event TOOK and nothing recorded what it GAVE, so
-- a match where the player earned 50 coins had 50 coins appear from nowhere.
-- Spend and gain stay separate columns rather than one signed number because
-- an event can do both at once - pay 5 coins, hand back 2 - and a single
-- column would report -3 for a transaction that was never worth -3.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

-- ── items: every action, not just the usages ─────────────────────────────
ALTER TABLE log_item_usage ADD COLUMN action TEXT DEFAULT 'USE';
ALTER TABLE log_item_usage ADD COLUMN id_event INTEGER;
ALTER TABLE log_item_usage ADD COLUMN energy INTEGER DEFAULT 0;
ALTER TABLE log_item_usage ADD COLUMN food INTEGER DEFAULT 0;
ALTER TABLE log_item_usage ADD COLUMN magic INTEGER DEFAULT 0;
ALTER TABLE log_item_usage ADD COLUMN coin INTEGER DEFAULT 0;

-- ── events: what the action gave, beside what it took ────────────────────
ALTER TABLE log_events ADD COLUMN energy_gain INTEGER DEFAULT 0;
ALTER TABLE log_events ADD COLUMN food_gain INTEGER DEFAULT 0;
ALTER TABLE log_events ADD COLUMN magic_gain INTEGER DEFAULT 0;
ALTER TABLE log_events ADD COLUMN coin_gain INTEGER DEFAULT 0;
