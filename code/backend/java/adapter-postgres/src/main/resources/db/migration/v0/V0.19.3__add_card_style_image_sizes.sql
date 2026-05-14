-- =============================================
-- Paths Games - Database Schema V0.19.3
-- Add per-size image style columns to list_cards (PostgreSQL)
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

ALTER TABLE list_cards ADD COLUMN style_image_little VARCHAR(100);
ALTER TABLE list_cards ADD COLUMN style_image_medium VARCHAR(100);
ALTER TABLE list_cards ADD COLUMN style_image_large  VARCHAR(100);
