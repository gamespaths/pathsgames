-- =============================================
-- Paths Games - Database Schema V0.19.4
-- Add card_type column to list_cards (PostgreSQL)
-- Classifies which entity the card represents
-- (e.g. character, class, trait, difficulty, event, ...).
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

ALTER TABLE list_cards ADD COLUMN card_type VARCHAR(50);
