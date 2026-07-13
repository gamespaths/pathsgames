-- =============================================
-- Paths Games - Database Schema V0.27.0 (SQLite)
-- Step 27 - Weather System: per-match RNG seed
-- =============================================
-- Adds gaming_match.rng_seed: a per-match deterministic seed used to
-- initialise the weather (and future probability) rolls. NULL = legacy
-- matches created before Step 27 (a seed is generated lazily at first use).
-- Robot tests create matches with rng_seed=42 for deterministic weather.
-- (C) Paths Games 2042 - GNU General Public License v3.0
-- =============================================

ALTER TABLE gaming_match ADD COLUMN rng_seed INTEGER;
