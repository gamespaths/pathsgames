-- =============================================
-- Paths Games - Database Schema V0.29.3 (PostgreSQL)
-- v0.29.3 - Forced movement: an event effect can move its recipients.
--
--   * list_events_effects gains id_location: when valued, every recipient of the
--     effect row (per target/target_class, INV-27) is MOVED to that location.
--     None of the Step 28 movement checks apply - no neighbor adjacency, no
--     energy cost, no availability procedure. Each actual move writes a cost-0
--     row to log_movements, so the timeline and the visited set stay truthful.
--   * No FK - same as id_weather and the other effect columns: the reference is
--     story-scoped and the Step 22 validator owns the existence check. A value
--     that matches no location of the story is authored noise: the engine skips
--     the move silently.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved - See https://github.com/gamespaths/pathsgames
-- =============================================

ALTER TABLE list_events_effects ADD COLUMN id_location BIGINT;

COMMENT ON COLUMN list_events_effects.id_location IS 'v0.29.3 EFFECT: moves the recipients to this location - no checks, no energy cost';
