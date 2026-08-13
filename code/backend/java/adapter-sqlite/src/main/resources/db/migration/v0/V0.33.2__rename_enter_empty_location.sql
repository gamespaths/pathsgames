-- V0.33.2 — rename the occupancy trigger column to say what it actually means.
--
-- id_event_if_character_enter_first_time never had anything to do with a first time. The
-- engine fires it when countOtherCharactersAtLocation(...) == 0 — the arriving character
-- found NOBODY ELSE there. In singleplayer that is every arrival; in multiplayer it can
-- fire on the tenth visit if the room happens to be empty. The old name collided with
-- id_event_if_first_time, which IS the history axis (gaming_state_locations.flag_visited,
-- party-scoped), and the two were repeatedly confused when authoring stories.
--
-- The trigger the API emits was renamed with it: FIRST_IN_LOCATION -> MOVE_INTO_EMPTY_LOCATION.
--
-- RENAME COLUMN needs SQLite >= 3.25; it rewrites the references the schema holds.
ALTER TABLE list_locations
    RENAME COLUMN id_event_if_character_enter_first_time TO id_event_if_character_enter_empty_location;
