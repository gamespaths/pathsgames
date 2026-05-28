-- =============================================
-- Paths Games - Database Schema V0.10.13
-- Add missing BaseStoryEntity columns (PostgreSQL)
-- =============================================
-- Adds nullable id_story, id_card, id_text_name, id_text_description
-- columns to tables that inherit from BaseStoryEntity but were
-- missing those columns in the original schema.
-- All columns are nullable BIGINT — they remain NULL when unused.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved
-- =============================================

-- list_stories (StoryEntity) — id_story and id_text_name missing
ALTER TABLE list_stories ADD COLUMN IF NOT EXISTS id_story BIGINT;
ALTER TABLE list_stories ADD COLUMN IF NOT EXISTS id_text_name BIGINT;

-- list_stories_difficulty (StoryDifficultyEntity) — id_card, id_text_name missing
ALTER TABLE list_stories_difficulty ADD COLUMN IF NOT EXISTS id_card BIGINT;
ALTER TABLE list_stories_difficulty ADD COLUMN IF NOT EXISTS id_text_name BIGINT;

-- list_keys (KeyEntity) — id_text_name missing
ALTER TABLE list_keys ADD COLUMN IF NOT EXISTS id_text_name BIGINT;

-- list_locations_neighbors (LocationNeighborEntity) — id_card, id_text_name, id_text_description missing
ALTER TABLE list_locations_neighbors ADD COLUMN IF NOT EXISTS id_card BIGINT;
ALTER TABLE list_locations_neighbors ADD COLUMN IF NOT EXISTS id_text_name BIGINT;
ALTER TABLE list_locations_neighbors ADD COLUMN IF NOT EXISTS id_text_description BIGINT;

-- list_items_effects (ItemEffectEntity) — id_card missing
ALTER TABLE list_items_effects ADD COLUMN IF NOT EXISTS id_card BIGINT;

-- list_events_effects (EventEffectEntity) — id_text_name, id_text_description missing
ALTER TABLE list_events_effects ADD COLUMN IF NOT EXISTS id_text_name BIGINT;
ALTER TABLE list_events_effects ADD COLUMN IF NOT EXISTS id_text_description BIGINT;

-- list_choices_conditions (ChoiceConditionEntity) — id_card missing
ALTER TABLE list_choices_conditions ADD COLUMN IF NOT EXISTS id_card BIGINT;

-- list_choices_effects (ChoiceEffectEntity) — id_card, id_text_name, id_text_description missing
ALTER TABLE list_choices_effects ADD COLUMN IF NOT EXISTS id_card BIGINT;
ALTER TABLE list_choices_effects ADD COLUMN IF NOT EXISTS id_text_name BIGINT;
ALTER TABLE list_choices_effects ADD COLUMN IF NOT EXISTS id_text_description BIGINT;

-- list_global_random_events (GlobalRandomEventEntity) — id_text_name, id_text_description missing
ALTER TABLE list_global_random_events ADD COLUMN IF NOT EXISTS id_text_name BIGINT;
ALTER TABLE list_global_random_events ADD COLUMN IF NOT EXISTS id_text_description BIGINT;

-- list_creator (CreatorEntity) — id_card, id_text_name, id_text_description missing
ALTER TABLE list_creator ADD COLUMN IF NOT EXISTS id_card BIGINT;
ALTER TABLE list_creator ADD COLUMN IF NOT EXISTS id_text_name BIGINT;
ALTER TABLE list_creator ADD COLUMN IF NOT EXISTS id_text_description BIGINT;

-- list_cards (CardEntity) — id_card, id_text_name missing
ALTER TABLE list_cards ADD COLUMN IF NOT EXISTS id_card BIGINT;
ALTER TABLE list_cards ADD COLUMN IF NOT EXISTS id_text_name BIGINT;

-- list_texts (TextEntity) — id_card, id_text_name, id_text_description missing
ALTER TABLE list_texts ADD COLUMN IF NOT EXISTS id_card BIGINT;
ALTER TABLE list_texts ADD COLUMN IF NOT EXISTS id_text_name BIGINT;
ALTER TABLE list_texts ADD COLUMN IF NOT EXISTS id_text_description BIGINT;
