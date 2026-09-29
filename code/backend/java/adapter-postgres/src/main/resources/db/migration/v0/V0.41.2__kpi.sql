-- =============================================
-- Paths Games - Database Schema V0.41.2 (PostgreSQL)
-- Step 41 F - daily UTC KPI counters per story, written at event time and keyed by uuids
-- (no FK, decision 12): one row per (story, day, metric, ref), incremented with ON CONFLICT.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

CREATE TABLE IF NOT EXISTS system_kpi_daily (
    id          BIGSERIAL    PRIMARY KEY,
    uuid        VARCHAR(36)  NOT NULL DEFAULT gen_random_uuid()::text UNIQUE,
    story_uuid  VARCHAR(36)  NOT NULL,
    day         VARCHAR(10)  NOT NULL,
    metric      VARCHAR(40)  NOT NULL,
    ref_uuid    VARCHAR(36)  NOT NULL DEFAULT '',
    value       BIGINT       NOT NULL DEFAULT 0,
    ts_insert   VARCHAR(50)  NOT NULL DEFAULT NOW()::text,
    ts_update   VARCHAR(50)  NOT NULL DEFAULT NOW()::text,
    CONSTRAINT uq_kpi_daily UNIQUE (story_uuid, day, metric, ref_uuid)
);

CREATE INDEX IF NOT EXISTS idx_kpi_daily_day ON system_kpi_daily(day);

COMMENT ON TABLE system_kpi_daily IS 'Step 41 F KPI counters: MATCH_STARTED, MATCH_COMPLETED, DURATION_MS, DURATION_CLOCKS, COMA, CHOICE, LOCATION_VISIT, MISSION_ACTIVE, MISSION_COMPLETED, MISSION_FAILED';
