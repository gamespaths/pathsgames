-- =============================================
-- Paths Games - Database Schema V0.28.2
-- Add id_card_back to list_locations_neighbors (SQLite)
-- =============================================
-- Optional "return" card for a neighbor link: shown when the player traverses
-- the edge from the locationTo side. When NULL the return card falls back to
-- id_card (the existing forward card).
-- =============================================
-- (C) Paths Games 2042 - All rights reserved
-- =============================================

ALTER TABLE list_locations_neighbors ADD COLUMN id_card_back INTEGER;
