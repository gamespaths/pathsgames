-- =============================================
-- Paths Games - Database Schema V0.19.5
-- Add id_class_permitted, id_class_prohibited to list_character_templates (PostgreSQL)
-- Mirrors the pattern used in list_traits / list_items: optional FK to a class
-- that restricts which classes can pick / are forbidden from picking the template.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

ALTER TABLE list_character_templates ADD COLUMN id_class_permitted  BIGINT;
ALTER TABLE list_character_templates ADD COLUMN id_class_prohibited BIGINT;

ALTER TABLE list_character_templates ADD CONSTRAINT fk_char_templates_class_permitted
    FOREIGN KEY (id_class_permitted, id_story) REFERENCES list_classes(id, id_story);

ALTER TABLE list_character_templates ADD CONSTRAINT fk_char_templates_class_prohibited
    FOREIGN KEY (id_class_prohibited, id_story) REFERENCES list_classes(id, id_story);
