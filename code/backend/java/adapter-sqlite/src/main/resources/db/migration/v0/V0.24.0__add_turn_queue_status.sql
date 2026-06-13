-- =============================================
-- Paths Games - Database Schema V0.24.0
-- Add explicit turn status column to gaming_turn_queue (SQLite)
-- Step 24: each turn-queue row carries its own lifecycle state
-- WAITING -> ACTIVE -> COMPLETED (instead of deriving it from timestamps).
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

ALTER TABLE gaming_turn_queue ADD COLUMN status TEXT NOT NULL DEFAULT 'WAITING';
