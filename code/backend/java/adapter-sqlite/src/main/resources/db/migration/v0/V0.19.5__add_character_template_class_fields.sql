-- =============================================
-- Paths Games - Database Schema V0.19.5
-- Add id_class_permitted, id_class_prohibited to list_character_templates (SQLite)
-- Mirrors the pattern used in list_traits / list_items.
-- SQLite does not support adding FK constraints via ALTER TABLE; values are
-- enforced at the application level (same as id_card / id_text_* columns).
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

ALTER TABLE list_character_templates ADD COLUMN id_class_permitted  INTEGER;
ALTER TABLE list_character_templates ADD COLUMN id_class_prohibited INTEGER;
