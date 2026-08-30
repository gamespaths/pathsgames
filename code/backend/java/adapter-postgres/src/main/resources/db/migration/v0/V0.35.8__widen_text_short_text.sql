-- =============================================
-- Paths Games - Database Schema V0.35.8 (PostgreSQL)
-- list_texts.short_text widened from VARCHAR(500) to VARCHAR(2000).
--
-- The import of a story whose shortText passed 500 characters died with
-- "value too long for type character varying(500)" and rolled the whole
-- story back. SQLite never enforced the limit (its short_text is TEXT), so
-- the failure only ever appeared on a Postgres deployment - the tutorial
-- story alone carries twelve such rows.
--
-- 2000 is now the contract on both sides: the admin editors cap the field at
-- the same number, so a text that the form accepts always fits the column.
-- long_text stays TEXT: it is the unbounded one by design.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

ALTER TABLE list_texts ALTER COLUMN short_text TYPE VARCHAR(2000);

COMMENT ON COLUMN list_texts.short_text IS 'Summary text, max 2000 chars (V0.35.8, was 500); long_text holds the unbounded body';
