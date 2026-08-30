-- =============================================
-- Paths Games - Database Schema V0.35.8 (SQLite)
-- list_texts.short_text widened to 2000 characters - see the PostgreSQL twin.
--
-- Nothing to alter here: SQLite declares short_text as TEXT and ignores any
-- length, which is exactly why the overflow only ever showed up on Postgres.
-- The file exists so both histories carry the same version, and so the next
-- reader finds the change where the Postgres one is.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

-- no-op: TEXT is already unbounded
SELECT 1;
