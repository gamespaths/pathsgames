-- =============================================
-- Paths Games - Database Schema V0.28.7 (PostgreSQL)
-- Add clock column to log_events for sleep action logging (Step 28.7).
-- Existing rows get clock = NULL (backward-compatible).
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- =============================================

ALTER TABLE log_events ADD COLUMN clock INTEGER;
