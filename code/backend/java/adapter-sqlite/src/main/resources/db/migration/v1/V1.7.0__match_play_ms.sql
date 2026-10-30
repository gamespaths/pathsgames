-- =============================================
-- Paths Games - Database Schema V1.7.0 (SQLite)
-- V1 step 6 (user profile): match play time, grown by every gameplay write (capped gap since
-- the previous ts_update); preferences use the existing users.language and users.theme_selected.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

ALTER TABLE gaming_match ADD COLUMN play_ms INTEGER NOT NULL DEFAULT 0;
