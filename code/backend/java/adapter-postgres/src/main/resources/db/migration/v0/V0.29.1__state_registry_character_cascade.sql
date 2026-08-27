-- =============================================
-- Paths Games - Database Schema V0.29.1 (PostgreSQL)
-- gaming_state_registry.(id_character, id_match) referenced gaming_character_instance without
-- ON DELETE CASCADE, while its id_match FK to gaming_match had one. Deleting a match therefore
-- cascaded into the characters and stopped there: any registry row an event had written for a
-- character (Step 29 writes them) held the character back, and the delete failed with
-- "violates foreign key constraint gaming_state_registry_id_character_id_match_fkey".
-- The registry row is state OF the character, so it dies with it.
-- =============================================

ALTER TABLE gaming_state_registry
    DROP CONSTRAINT IF EXISTS gaming_state_registry_id_character_id_match_fkey;

ALTER TABLE gaming_state_registry
    ADD CONSTRAINT gaming_state_registry_id_character_id_match_fkey
    FOREIGN KEY (id_character, id_match)
    REFERENCES gaming_character_instance (id, id_match)
    ON DELETE CASCADE;
