-- =============================================
-- Paths Games - Database Schema V0.26.1
-- Fix log tables: convert remaining TIMESTAMP columns to VARCHAR(50)
-- to match Java entity fields typed as String (ISO-8601 text).
-- V0.19.1 fixed most gaming/log tables but missed log_events.timestamp
-- and log_item_usage.timestamp, causing 500 errors on sleep actions
-- (PSQLException 42804: timestamp vs character varying).
-- Affects: log_events, log_item_usage
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

-- log_events
ALTER TABLE log_events
    ALTER COLUMN timestamp TYPE VARCHAR(50) USING timestamp::text;

-- log_item_usage
ALTER TABLE log_item_usage
    ALTER COLUMN timestamp TYPE VARCHAR(50) USING timestamp::text;
