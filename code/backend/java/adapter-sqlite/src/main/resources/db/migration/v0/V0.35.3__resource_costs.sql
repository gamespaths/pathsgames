-- =============================================
-- Paths Games - Database Schema V0.35.3 (SQLite)
-- Food, magic and coin as a COST of acting: what an event or a move takes.
--
--   cost_food / cost_magic / cost_coin  the resources the actor pays.
--                                       NULL or 0 -> the action is free.
--
-- Until now only energy and coins could be charged, and only by an event.
-- Food and magic were numbers that went up and never came down: nothing in
-- the engine consumed them. These columns are their first sink.
--
-- A cost is checked before it is paid (NOT_ENOUGH_FOOD / NOT_ENOUGH_MAGIC /
-- NOT_ENOUGH_COINS), so a resource can never go negative, exactly like the
-- energy and coin costs that came before.
--
-- list_events.coin_cost is RENAMED to cost_coin: three costs on one table
-- spelled three different ways is a trap for whoever authors next. The JSON
-- key follows (costCoin), and the import keeps accepting the old coinCost so
-- a story exported before today does not silently lose its prices.
--
-- On list_locations_neighbors the cost sits on the EDGE, the directed link
-- A -> B. energy_cost is left alone: energy sums three sources (edge +
-- list_locations.cost_energy_enter + weather modifier) while the resources
-- have one. The asymmetry is deliberate - the formula is a sum, so an entry
-- or weather term can be added later without invalidating a single story.
--
-- On list_choices the three columns are RESERVED: nothing reads them yet.
-- They are here so the option-level cost, when it lands, is not a second
-- migration - and they are deliberately absent from the admin form and from
-- import/export, because a field that saves and does nothing is worse than
-- a field that is missing.
--
-- The log tables gain the spend itself: log_events had no cost column at all
-- (an event's price lived only in the HTTP response and was never persisted)
-- and log_movements had energy alone. Column names stay bare - energy, food,
-- magic, coin - because in a log the column IS what was spent; the cost_
-- prefix belongs to the story tables that define the price.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

-- ── story: what an action costs ──────────────────────────────────────────
ALTER TABLE list_events RENAME COLUMN coin_cost TO cost_coin;
ALTER TABLE list_events ADD COLUMN cost_food INTEGER DEFAULT 0;
ALTER TABLE list_events ADD COLUMN cost_magic INTEGER DEFAULT 0;

ALTER TABLE list_locations_neighbors ADD COLUMN cost_food INTEGER DEFAULT 0;
ALTER TABLE list_locations_neighbors ADD COLUMN cost_magic INTEGER DEFAULT 0;
ALTER TABLE list_locations_neighbors ADD COLUMN cost_coin INTEGER DEFAULT 0;

-- reserved: no engine, no form, no import/export reads these yet
ALTER TABLE list_choices ADD COLUMN cost_food INTEGER DEFAULT 0;
ALTER TABLE list_choices ADD COLUMN cost_magic INTEGER DEFAULT 0;
ALTER TABLE list_choices ADD COLUMN cost_coin INTEGER DEFAULT 0;

-- ── logs: what was actually spent, and when ──────────────────────────────
ALTER TABLE log_events ADD COLUMN energy INTEGER DEFAULT 0;
ALTER TABLE log_events ADD COLUMN food INTEGER DEFAULT 0;
ALTER TABLE log_events ADD COLUMN magic INTEGER DEFAULT 0;
ALTER TABLE log_events ADD COLUMN coin INTEGER DEFAULT 0;

ALTER TABLE log_movements ADD COLUMN food INTEGER DEFAULT 0;
ALTER TABLE log_movements ADD COLUMN magic INTEGER DEFAULT 0;
ALTER TABLE log_movements ADD COLUMN coin INTEGER DEFAULT 0;
