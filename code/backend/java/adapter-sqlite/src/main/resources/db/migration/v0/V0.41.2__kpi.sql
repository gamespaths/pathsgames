-- =============================================
-- Paths Games - Database Schema V0.41.2 (SQLite)
-- Step 41 F - daily UTC KPI counters per story, written at event time and keyed by uuids
-- (no FK, decision 12): one row per (story, day, metric, ref), incremented with ON CONFLICT.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

CREATE TABLE IF NOT EXISTS system_kpi_daily (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid        TEXT    NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+abs(random())%4,1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
    story_uuid  TEXT    NOT NULL,
    day         TEXT    NOT NULL,
    metric      TEXT    NOT NULL,
    ref_uuid    TEXT    NOT NULL DEFAULT '',
    value       INTEGER NOT NULL DEFAULT 0,
    ts_insert   TEXT    NOT NULL DEFAULT (datetime('now')),
    ts_update   TEXT    NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT uq_kpi_daily UNIQUE (story_uuid, day, metric, ref_uuid)
);

CREATE INDEX IF NOT EXISTS idx_kpi_daily_day ON system_kpi_daily(day);
