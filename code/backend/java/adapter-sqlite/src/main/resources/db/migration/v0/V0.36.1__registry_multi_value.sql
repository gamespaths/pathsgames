-- =============================================
-- Paths Games - Database Schema V0.36.1 (SQLite)
-- Step 36.1 - a registry key may hold a SET of values instead of one. Opt-in per key: a key
-- left single behaves exactly as it did in V0.36.0, so no authored story changes meaning.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- The software is distributed under the terms of the GNU General Public License v3.0
-- =============================================

-- The declaration. DEFAULT 0 keeps every existing key single.
ALTER TABLE list_keys ADD COLUMN multi_value INTEGER DEFAULT 0;

-- Mirrored onto the state row for two reasons: an index cannot read list_keys, and a match in
-- progress must keep the behaviour it was born with even if the author flips the flag later.
ALTER TABLE gaming_state_registry ADD COLUMN multi_value INTEGER DEFAULT 0;

-- V0.36.0 made this UNIQUE (id_match, key) - the invariant a single key still needs, but which
-- a multi-valued one must not have. Two partial indexes give each kind its own rule.
DROP INDEX IF EXISTS idx_state_reg_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_state_reg_key_single
    ON gaming_state_registry(id_match, key) WHERE multi_value = 0;

-- The set: one row per DISTINCT value. The expression is literally RegistryService.render -
-- the string wins, else the int - so the string '1' and the integer 1 are the same member.
-- KEEP IN SYNC WITH RegistryService.render(): if one changes, the other must.
-- It is an expression and not the two raw columns because PostgreSQL treats NULLs as distinct
-- in a unique index, and exactly one of the two columns is always NULL; indexing them directly
-- would let a duplicate through there while blocking it here.
CREATE UNIQUE INDEX IF NOT EXISTS idx_state_reg_key_multi
    ON gaming_state_registry(id_match, key, COALESCE(string_value, CAST(int_value AS TEXT)))
    WHERE multi_value = 1;
