-- =============================================
-- Paths Games - Database Schema V0.10.13
-- Add missing BaseStoryEntity columns (SQLite)
-- =============================================
-- Adds nullable id_story, id_card, id_text_name, id_text_description
-- columns to tables that inherit from BaseStoryEntity but were
-- missing those columns in the original schema.
-- All columns are nullable INTEGER — they remain NULL when unused.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved
-- =============================================

-- list_stories (StoryEntity) — id_story and id_text_name missing
ALTER TABLE list_stories ADD COLUMN id_story INTEGER;
ALTER TABLE list_stories ADD COLUMN id_text_name INTEGER;

-- list_stories_difficulty (StoryDifficultyEntity) — id_text_name missing
ALTER TABLE list_stories_difficulty ADD COLUMN id_text_name INTEGER;

-- list_keys (KeyEntity) — id_text_name missing
ALTER TABLE list_keys ADD COLUMN id_text_name INTEGER;

-- list_locations_neighbors (LocationNeighborEntity) — id_card, id_text_name, id_text_description missing
ALTER TABLE list_locations_neighbors ADD COLUMN id_card INTEGER;
ALTER TABLE list_locations_neighbors ADD COLUMN id_text_name INTEGER;
ALTER TABLE list_locations_neighbors ADD COLUMN id_text_description INTEGER;

-- list_items_effects (ItemEffectEntity) — id_card missing
ALTER TABLE list_items_effects ADD COLUMN id_card INTEGER;

-- list_events_effects (EventEffectEntity) — id_text_name, id_text_description missing
ALTER TABLE list_events_effects ADD COLUMN id_text_name INTEGER;
ALTER TABLE list_events_effects ADD COLUMN id_text_description INTEGER;

-- list_choices_conditions (ChoiceConditionEntity) — id_card missing
ALTER TABLE list_choices_conditions ADD COLUMN id_card INTEGER;

-- list_choices_effects (ChoiceEffectEntity) — id_card, id_text_name, id_text_description missing
ALTER TABLE list_choices_effects ADD COLUMN id_card INTEGER;
ALTER TABLE list_choices_effects ADD COLUMN id_text_name INTEGER;
ALTER TABLE list_choices_effects ADD COLUMN id_text_description INTEGER;

-- list_global_random_events (GlobalRandomEventEntity) — id_text_name, id_text_description missing
ALTER TABLE list_global_random_events ADD COLUMN id_text_name INTEGER;
ALTER TABLE list_global_random_events ADD COLUMN id_text_description INTEGER;

-- list_creator (CreatorEntity) — id_card, id_text_name, id_text_description missing
ALTER TABLE list_creator ADD COLUMN id_card INTEGER;
ALTER TABLE list_creator ADD COLUMN id_text_name INTEGER;
ALTER TABLE list_creator ADD COLUMN id_text_description INTEGER;

-- list_cards (CardEntity) — id_card, id_text_name missing
ALTER TABLE list_cards ADD COLUMN id_card INTEGER;
ALTER TABLE list_cards ADD COLUMN id_text_name INTEGER;

-- list_texts (TextEntity) — id_card, id_text_name, id_text_description missing
ALTER TABLE list_texts ADD COLUMN id_card INTEGER;
ALTER TABLE list_texts ADD COLUMN id_text_name INTEGER;
ALTER TABLE list_texts ADD COLUMN id_text_description INTEGER;
