"""
Development seed data for Robot Framework integration tests.
Inserts DEMO_1 (tutorial) and DEMO_2 (valvassore) stories with all related entities.
Adapted from Java R__insert_story_seed_data.sql to Python/PHP column names.
"""
from sqlalchemy import text

SEED_SQL = """
-- =============================================
-- Story 1: DEMO — Learn to Play (id=9001)
-- Story 2: Il Valvassore di Marca (id=9002)
-- INSERT OR IGNORE ensures idempotency under concurrent workers
-- =============================================

INSERT OR IGNORE INTO list_stories (id, uuid, author, version_min, id_text_clock_singular, id_text_clock_plural,
    category, group_name, visibility, priority, peghi, id_text_title, id_text_description)
VALUES (9001, 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'PathsMaster', '0.14.0', 10, 11,
    'tutorial', 'tutorial', 'PUBLIC', 100, 0, 1, 2);

INSERT OR IGNORE INTO list_stories (id, uuid, author, version_min, id_text_clock_singular, id_text_clock_plural,
    category, group_name, visibility, priority, peghi, id_text_title, id_text_description)
VALUES (9002, 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'PathsMaster', '0.14.0', 10, 11,
    'fantasy', 'main', 'PUBLIC', 10, 5, 1, 2);

-- ── Story 1 Texts ───────────────────────────────────────────────
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90001, 9001, 1, 'en', 'TUTORIAL', 'Welcome to Paths Games! This guided tutorial will teach you every mechanic step by step.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90002, 9001, 1, 'it', 'TUTORIAL', 'Benvenuto in Paths Games! Questo tutorial guidato ti insegnerà ogni meccanica passo dopo passo.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90003, 9001, 2, 'en', 'A short training adventure in the Academy of Paths.', 'A short training adventure in the Academy of Paths. Learn movement, energy, items, choices, and missions in a safe environment.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90004, 9001, 2, 'it', 'Una breve avventura di addestramento.', 'Una breve avventura di addestramento nell''Accademia di Paths. Impara movimento, energia, oggetti, scelte e missioni in un ambiente sicuro.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90005, 9001, 100, 'en', 'Welcome Hall', 'A bright, welcoming hall with banners explaining the basics of Paths Games.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90006, 9001, 100, 'it', 'Sala di Benvenuto', 'Una sala luminosa e accogliente con stendardi.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90007, 9001, 101, 'en', 'Movement Training Room', 'A long corridor with colored tiles on the floor.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90008, 9001, 101, 'it', 'Sala Addestramento Movimento', 'Un lungo corridoio con mattonelle colorate.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90009, 9001, 102, 'en', 'Energy & Life Classroom', 'A cozy classroom with diagrams on a blackboard.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90010, 9001, 102, 'it', 'Aula Energia & Vita', 'Un''aula accogliente con diagrammi alla lavagna.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90011, 9001, 103, 'en', 'Item Workshop', 'A workshop filled with glowing potions and rusty swords.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90012, 9001, 103, 'it', 'Laboratorio Oggetti', 'Un laboratorio pieno di pozioni e spade.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90013, 9001, 104, 'en', 'Choice Arena', 'A circular arena with two doors: one gold, one red.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90014, 9001, 104, 'it', 'Arena delle Scelte', 'Un''arena circolare con due porte.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90015, 9001, 105, 'en', 'Weather Observatory', 'A tower with a glass dome revealing the sky.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90016, 9001, 105, 'it', 'Osservatorio Meteo', 'Una torre con una cupola di vetro.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90017, 9001, 106, 'en', 'Mission Board', 'A large board covered with quest notices.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90018, 9001, 106, 'it', 'Bacheca Missioni', 'Una grande bacheca coperta di avvisi di missioni.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90019, 9001, 107, 'en', 'Multiplayer Courtyard', 'An open courtyard where training dummies represent other players.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90020, 9001, 107, 'it', 'Cortile Multigiocatore', 'Un cortile aperto con manichini da allenamento.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90021, 9001, 108, 'en', 'Graduation Hall', 'A grand hall with a golden trophy at the center.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90022, 9001, 108, 'it', 'Sala della Laurea', 'Una sala maestosa con un trofeo dorato al centro.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90029, 9001, 200, 'en', 'Student', 'A balanced beginner. Good at everything, master of nothing.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90030, 9001, 200, 'it', 'Studente', 'Un principiante equilibrato.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90031, 9001, 201, 'en', 'Scholar', 'High intelligence, low constitution.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90032, 9001, 201, 'it', 'Erudito', 'Alta intelligenza, bassa costituzione.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90033, 9001, 202, 'en', 'Athlete', 'High dexterity and constitution, lower intelligence.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90034, 9001, 202, 'it', 'Atleta', 'Alta destrezza e costituzione.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90035, 9001, 300, 'en', 'Tutorial', 'The only difficulty available for the tutorial.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90036, 9001, 300, 'it', 'Tutorial', 'L''unica difficoltà disponibile per il tutorial.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90071, 9001, 700, 'en', 'Quick Learner', 'You absorb knowledge faster.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90072, 9001, 700, 'it', 'Apprendista Veloce', 'Assorbi conoscenza più rapidamente.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90073, 9001, 701, 'en', 'Curious Mind', 'Your curiosity leads you to discover hidden details.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90074, 9001, 701, 'it', 'Mente Curiosa', 'La tua curiosità ti porta a scoprire dettagli nascosti.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90075, 9001, 702, 'en', 'Resilient Spirit', 'You recover quickly from setbacks.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90076, 9001, 702, 'it', 'Spirito Resiliente', 'Ti riprendi rapidamente dalle avversità.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90096, 9001, 210, 'en', 'The Student', 'A well-rounded student with equal stats.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90097, 9001, 211, 'en', 'The Bookworm', 'A studious character with high intelligence.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90098, 9001, 212, 'en', 'The Gym Star', 'An athletic character with high dexterity.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES (90102, 9001, 10, 'en', 'turn', 'turn');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES (90103, 9001, 11, 'en', 'turns', 'turns');

-- ── Story 1 Difficulties ────────────────────────────────────────
INSERT OR IGNORE INTO list_stories_difficulty (id, id_story, id_text_description, exp_cost, max_weight, min_character, max_character, cost_help_coma, cost_max_characteristics, number_max_free_action) VALUES
(90001, 9001, 300, 1, 20, 1, 4, 1, 1, 3);

-- ── Story 1 Classes ─────────────────────────────────────────────
INSERT OR IGNORE INTO list_classes (id, id_story, id_text_name, id_text_description, weight_max, dexterity_base, intelligence_base, constitution_base) VALUES
(90001, 9001, 200, 200, 12, 3, 3, 3);
INSERT OR IGNORE INTO list_classes (id, id_story, id_text_name, id_text_description, weight_max, dexterity_base, intelligence_base, constitution_base) VALUES
(90002, 9001, 201, 201, 8, 2, 5, 2);
INSERT OR IGNORE INTO list_classes (id, id_story, id_text_name, id_text_description, weight_max, dexterity_base, intelligence_base, constitution_base) VALUES
(90003, 9001, 202, 202, 10, 5, 2, 4);

-- ── Story 1 Classes Bonus ───────────────────────────────────────
INSERT OR IGNORE INTO list_classes_bonus (id, id_story, id_class, bonus_type, bonus_value) VALUES
(90001, 9001, 90001, 'life', 3);
INSERT OR IGNORE INTO list_classes_bonus (id, id_story, id_class, bonus_type, bonus_value) VALUES
(90002, 9001, 90001, 'energy', 3);
INSERT OR IGNORE INTO list_classes_bonus (id, id_story, id_class, bonus_type, bonus_value) VALUES
(90003, 9001, 90001, 'exp', 2);
INSERT OR IGNORE INTO list_classes_bonus (id, id_story, id_class, bonus_type, bonus_value) VALUES
(90004, 9001, 90002, 'int', 3);
INSERT OR IGNORE INTO list_classes_bonus (id, id_story, id_class, bonus_type, bonus_value) VALUES
(90005, 9001, 90002, 'energy', 2);
INSERT OR IGNORE INTO list_classes_bonus (id, id_story, id_class, bonus_type, bonus_value) VALUES
(90006, 9001, 90002, 'exp', 3);
INSERT OR IGNORE INTO list_classes_bonus (id, id_story, id_class, bonus_type, bonus_value) VALUES
(90007, 9001, 90003, 'dex', 3);
INSERT OR IGNORE INTO list_classes_bonus (id, id_story, id_class, bonus_type, bonus_value) VALUES
(90008, 9001, 90003, 'life', 2);
INSERT OR IGNORE INTO list_classes_bonus (id, id_story, id_class, bonus_type, bonus_value) VALUES
(90009, 9001, 90003, 'energy', 4);

-- ── Story 1 Traits ──────────────────────────────────────────────
INSERT OR IGNORE INTO list_traits (id, id_story, id_text_name, id_text_description, cost_positive, cost_negative) VALUES
(90001, 9001, 700, 700, 1, 0);
INSERT OR IGNORE INTO list_traits (id, id_story, id_text_name, id_text_description, cost_positive, cost_negative) VALUES
(90002, 9001, 701, 701, 1, 0);
INSERT OR IGNORE INTO list_traits (id, id_story, id_text_name, id_text_description, cost_positive, cost_negative) VALUES
(90003, 9001, 702, 702, 1, 0);

-- ── Story 1 Character Templates ─────────────────────────────────
INSERT OR IGNORE INTO list_character_templates (id, id_story, id_tipo, id_text_name, id_text_description, life_max, energy_max, sad_max, dexterity_start, intelligence_start, constitution_start) VALUES
(90001, 9001, 90001, 210, 210, 12, 12, 8, 3, 3, 3);
INSERT OR IGNORE INTO list_character_templates (id, id_story, id_tipo, id_text_name, id_text_description, life_max, energy_max, sad_max, dexterity_start, intelligence_start, constitution_start) VALUES
(90002, 9001, 90002, 211, 211, 10, 10, 6, 2, 5, 2);
INSERT OR IGNORE INTO list_character_templates (id, id_story, id_tipo, id_text_name, id_text_description, life_max, energy_max, sad_max, dexterity_start, intelligence_start, constitution_start) VALUES
(90003, 9001, 90003, 212, 212, 11, 14, 7, 5, 2, 4);

-- ── Story 1 Keys ────────────────────────────────────────────────
INSERT OR IGNORE INTO list_keys (id, id_story, key_name, key_value, key_group, is_visible) VALUES
(90001, 9001, 'tutorial_progress', '0', 'tutorial', 1);
INSERT OR IGNORE INTO list_keys (id, id_story, key_name, key_value, key_group, is_visible) VALUES
(90002, 9001, 'items_collected', 'false', 'tutorial', 1);
INSERT OR IGNORE INTO list_keys (id, id_story, key_name, key_value, key_group, is_visible) VALUES
(90003, 9001, 'choice_made', 'false', 'tutorial', 1);

-- ── Story 1 Locations ───────────────────────────────────────────
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(90001, 9001, 100, 100, 1, 10);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(90002, 9001, 101, 101, 1, 10);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(90003, 9001, 102, 102, 1, 10);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(90004, 9001, 103, 103, 1, 10);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(90005, 9001, 104, 104, 1, 10);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(90006, 9001, 105, 105, 1, 10);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(90007, 9001, 106, 106, 1, 10);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(90008, 9001, 107, 107, 1, 10);

-- ── Story 1 Location Neighbors ──────────────────────────────────
INSERT OR IGNORE INTO list_locations_neighbors (id, id_story, id_location_from, id_location_to, direction, energy_cost) VALUES
(90001, 9001, 90001, 90002, 'NORTH', 0);
INSERT OR IGNORE INTO list_locations_neighbors (id, id_story, id_location_from, id_location_to, direction, energy_cost) VALUES
(90002, 9001, 90002, 90003, 'EAST', 0);
INSERT OR IGNORE INTO list_locations_neighbors (id, id_story, id_location_from, id_location_to, direction, energy_cost) VALUES
(90003, 9001, 90003, 90004, 'NORTH', 0);
INSERT OR IGNORE INTO list_locations_neighbors (id, id_story, id_location_from, id_location_to, direction, energy_cost) VALUES
(90004, 9001, 90004, 90005, 'EAST', 0);
INSERT OR IGNORE INTO list_locations_neighbors (id, id_story, id_location_from, id_location_to, direction, energy_cost) VALUES
(90005, 9001, 90005, 90006, 'NORTH', 1);
INSERT OR IGNORE INTO list_locations_neighbors (id, id_story, id_location_from, id_location_to, direction, energy_cost) VALUES
(90006, 9001, 90006, 90007, 'EAST', 0);
INSERT OR IGNORE INTO list_locations_neighbors (id, id_story, id_location_from, id_location_to, direction, energy_cost) VALUES
(90007, 9001, 90007, 90008, 'NORTH', 0);
INSERT OR IGNORE INTO list_locations_neighbors (id, id_story, id_location_from, id_location_to, direction, energy_cost) VALUES
(90008, 9001, 90001, 90008, 'EAST', 1);

-- ── Story 1 Items ───────────────────────────────────────────────
INSERT OR IGNORE INTO list_items (id, id_story, id_text_name, id_text_description, weight) VALUES
(90001, 9001, 400, 400, 1);
INSERT OR IGNORE INTO list_items (id, id_story, id_text_name, id_text_description, weight) VALUES
(90002, 9001, 401, 401, 2);
INSERT OR IGNORE INTO list_items (id, id_story, id_text_name, id_text_description, weight) VALUES
(90003, 9001, 402, 402, 1);
INSERT OR IGNORE INTO list_items (id, id_story, id_text_name, id_text_description, weight) VALUES
(90004, 9001, 403, 403, 1);

-- ── Story 1 Item Effects ────────────────────────────────────────
INSERT OR IGNORE INTO list_items_effects (id, id_story, id_item, effect_type, effect_value) VALUES
(90001, 9001, 90001, 'LIFE', 3);
INSERT OR IGNORE INTO list_items_effects (id, id_story, id_item, effect_type, effect_value) VALUES
(90002, 9001, 90003, 'EXP', 5);
INSERT OR IGNORE INTO list_items_effects (id, id_story, id_item, effect_type, effect_value) VALUES
(90003, 9001, 90004, 'ENERGY', 3);

-- ── Story 1 Weather Rules ───────────────────────────────────────
INSERT OR IGNORE INTO list_weather_rules (id, id_story, id_text_name, probability, delta_energy, is_active) VALUES
(90001, 9001, 800, 50, 0, 1);
INSERT OR IGNORE INTO list_weather_rules (id, id_story, id_text_name, probability, delta_energy, is_active) VALUES
(90002, 9001, 801, 35, 0, 1);
INSERT OR IGNORE INTO list_weather_rules (id, id_story, id_text_name, probability, delta_energy, is_active) VALUES
(90003, 9001, 802, 15, -1, 1);

-- ── Story 1 Events ──────────────────────────────────────────────
INSERT OR IGNORE INTO list_events (id, id_story, id_text_name, id_text_description, event_type, energy_cost, flag_end_time) VALUES
(90001, 9001, 500, 500, 'FIRST', 0, 0);
INSERT OR IGNORE INTO list_events (id, id_story, id_text_name, id_text_description, event_type, energy_cost, flag_end_time) VALUES
(90002, 9001, 501, 501, 'FIRST', 0, 0);
INSERT OR IGNORE INTO list_events (id, id_story, id_text_name, id_text_description, event_type, energy_cost, flag_end_time) VALUES
(90003, 9001, 502, 502, 'FIRST', 0, 0);
INSERT OR IGNORE INTO list_events (id, id_story, id_text_name, id_text_description, event_type, energy_cost, flag_end_time) VALUES
(90004, 9001, 503, 503, 'NORMAL', 1, 0);
INSERT OR IGNORE INTO list_events (id, id_story, id_text_name, id_text_description, event_type, energy_cost, flag_end_time) VALUES
(90005, 9001, 504, 504, 'AUTOMATIC', 0, 1);

-- ── Story 1 Event Effects ───────────────────────────────────────
INSERT OR IGNORE INTO list_events_effects (id, id_story, id_event, effect_type, effect_value) VALUES
(90001, 9001, 90001, 'exp', 2);
INSERT OR IGNORE INTO list_events_effects (id, id_story, id_event, effect_type, effect_value) VALUES
(90002, 9001, 90002, 'exp', 3);
INSERT OR IGNORE INTO list_events_effects (id, id_story, id_event, effect_type, effect_value) VALUES
(90003, 9001, 90003, 'exp', 3);
INSERT OR IGNORE INTO list_events_effects (id, id_story, id_event, effect_type, effect_value) VALUES
(90004, 9001, 90004, 'energy', -1);
INSERT OR IGNORE INTO list_events_effects (id, id_story, id_event, effect_type, effect_value) VALUES
(90005, 9001, 90005, 'exp', 15);

-- ── Story 1 Choices ─────────────────────────────────────────────
INSERT OR IGNORE INTO list_choices (id, id_story, id_event, priority, id_text_name, id_text_description, is_otherwise, is_progress) VALUES
(90001, 9001, 90004, 1, 600, 600, 0, 1);
INSERT OR IGNORE INTO list_choices (id, id_story, id_event, priority, id_text_name, id_text_description, is_otherwise, is_progress) VALUES
(90002, 9001, 90004, 2, 601, 601, 0, 1);
INSERT OR IGNORE INTO list_choices (id, id_story, id_event, priority, id_text_name, id_text_description, is_otherwise, is_progress) VALUES
(90003, 9001, 90003, 1, 602, 602, 0, 1);
INSERT OR IGNORE INTO list_choices (id, id_story, id_event, priority, id_text_name, id_text_description, is_otherwise, is_progress) VALUES
(90004, 9001, 90005, 1, 603, 603, 0, 1);

-- ── Story 1 Choice Conditions ───────────────────────────────────
INSERT OR IGNORE INTO list_choices_conditions (id, id_story, id_choice, condition_type, condition_key, condition_value, condition_operator) VALUES
(90001, 9001, 90003, 'statistics', 'int', '1', '>');

-- ── Story 1 Choice Effects ──────────────────────────────────────
INSERT OR IGNORE INTO list_choices_effects (id, id_story, id_choice, effect_type, effect_value) VALUES
(90001, 9001, 90001, 'exp', 5);
INSERT OR IGNORE INTO list_choices_effects (id, id_story, id_choice, effect_type, effect_value) VALUES
(90002, 9001, 90002, 'life', -1);
INSERT OR IGNORE INTO list_choices_effects (id, id_story, id_choice, effect_type, effect_value) VALUES
(90003, 9001, 90003, 'exp', 3);
INSERT OR IGNORE INTO list_choices_effects (id, id_story, id_choice, effect_type, effect_value) VALUES
(90004, 9001, 90004, 'exp', 10);

-- ── Story 1 Global Random Events ────────────────────────────────
INSERT OR IGNORE INTO list_global_random_events (id, id_story, probability) VALUES
(90001, 9001, 10);

-- ── Story 1 Missions ────────────────────────────────────────────
INSERT OR IGNORE INTO list_missions (id, id_story, condition_key, condition_value_from, condition_value_to, id_text_name, id_text_description) VALUES
(90001, 9001, 'tutorial_progress', '0', '3', 900, 900);
INSERT OR IGNORE INTO list_missions (id, id_story, condition_key, condition_value_to, id_text_name, id_text_description) VALUES
(90002, 9001, 'items_collected', 'true', 901, 901);
INSERT OR IGNORE INTO list_missions (id, id_story, condition_key, condition_value_to, id_text_name, id_text_description) VALUES
(90003, 9001, 'choice_made', 'gold', 902, 902);

-- ── Story 1 Mission Steps ───────────────────────────────────────
INSERT OR IGNORE INTO list_missions_steps (id, id_story, id_mission, step_order, condition_key, condition_value) VALUES
(90001, 9001, 90001, 1, 'visited_movement', 'true');
INSERT OR IGNORE INTO list_missions_steps (id, id_story, id_mission, step_order, condition_key, condition_value) VALUES
(90002, 9001, 90001, 2, 'visited_energy', 'true');
INSERT OR IGNORE INTO list_missions_steps (id, id_story, id_mission, step_order, condition_key, condition_value) VALUES
(90003, 9001, 90001, 3, 'visited_graduation', 'true');
INSERT OR IGNORE INTO list_missions_steps (id, id_story, id_mission, step_order, condition_key, condition_value) VALUES
(90004, 9001, 90002, 1, 'potion_collected', 'true');
INSERT OR IGNORE INTO list_missions_steps (id, id_story, id_mission, step_order, condition_key, condition_value) VALUES
(90005, 9001, 90002, 2, 'snack_used', 'true');
INSERT OR IGNORE INTO list_missions_steps (id, id_story, id_mission, step_order, condition_key, condition_value) VALUES
(90006, 9001, 90003, 1, 'entered_arena', 'true');
INSERT OR IGNORE INTO list_missions_steps (id, id_story, id_mission, step_order, condition_key, condition_value) VALUES
(90007, 9001, 90003, 2, 'door_chosen', 'true');

-- ── Story 1 Creator ─────────────────────────────────────────────
INSERT OR IGNORE INTO list_creator (id, id_story, creator_name, link) VALUES
(90001, 9001, 'PathsMaster', 'https://paths.games');

-- ── Story 1 Cards ───────────────────────────────────────────────
INSERT OR IGNORE INTO list_cards (id, id_story, awesome_icon, style_main) VALUES
(90001, 9001, 'fas fa-graduation-cap', 'tutorial');
INSERT OR IGNORE INTO list_cards (id, id_story, awesome_icon, style_main) VALUES
(90002, 9001, 'fas fa-book-open', 'learning');
INSERT OR IGNORE INTO list_cards (id, id_story, awesome_icon, style_main) VALUES
(90003, 9001, 'fas fa-lightbulb', 'tips');


-- #############################################################################
-- STORY 2: IL VALVASSORE DI MARCA (id=9002)
-- #############################################################################

-- ── Story 2 Texts ───────────────────────────────────────────────
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91001, 9002, 1, 'en', 'The Valvassor of the March', 'Veneto, 1243 AD. You are a valvassor serving under Ezzelino III da Romano.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91002, 9002, 1, 'it', 'Il Valvassore di Marca', 'Veneto, 1243. Sei un valvassore al servizio di Ezzelino III da Romano.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91003, 9002, 2, 'en', 'The Valvassor of the March', 'Travel across medieval Veneto to save your vassal from an unjust death.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91004, 9002, 2, 'it', 'Il Valvassore di Marca', 'Viaggia attraverso il Veneto medievale per salvare il tuo vassallo.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91005, 9002, 100, 'en', 'Castelfranco Veneto', 'Your small fortified town.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91006, 9002, 100, 'it', 'Castelfranco Veneto', 'La tua piccola città fortificata.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91029, 9002, 200, 'en', 'Knight', 'A minor noble trained in combat and horsemanship.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91030, 9002, 200, 'it', 'Cavaliere', 'Un piccolo nobile addestrato nel combattimento.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91031, 9002, 201, 'en', 'Cleric', 'A man of the cloth with access to monasteries.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91032, 9002, 201, 'it', 'Chierico', 'Un uomo di chiesa.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91033, 9002, 202, 'en', 'Merchant', 'A wealthy trader with connections in every city.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91034, 9002, 202, 'it', 'Mercante', 'Un ricco commerciante.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91035, 9002, 203, 'en', 'Scout', 'A nimble tracker at home in forests and marshes.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91036, 9002, 203, 'it', 'Esploratore', 'Un agile segugi.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91037, 9002, 300, 'en', 'Merciful Judge', 'Extra time and resources.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91038, 9002, 300, 'it', 'Giudice Misericordioso', 'Tempo e risorse extra.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91039, 9002, 301, 'en', 'Just Trial', 'Standard difficulty.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91040, 9002, 301, 'it', 'Giusto Processo', 'Difficoltà standard.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91041, 9002, 302, 'en', 'Iron Inquisition', 'Extreme difficulty.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91042, 9002, 302, 'it', 'Inquisizione di Ferro', 'Difficoltà estrema.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91073, 9002, 700, 'en', 'Feudal Authority', 'Your rank commands respect from peasants and minor lords.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91074, 9002, 700, 'it', 'Autorità Feudale', 'Il tuo rango impone rispetto.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91075, 9002, 701, 'en', 'Silver Tongue', 'A gift for persuasion.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91076, 9002, 701, 'it', 'Lingua d''Argento', 'Un dono per la persuasione.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91077, 9002, 702, 'en', 'Local Knowledge', 'Born and raised in the Marca Trevigiana.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91078, 9002, 702, 'it', 'Conoscenza del Territorio', 'Nato e cresciuto nella Marca Trevigiana.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91098, 9002, 210, 'en', 'The Loyal Valvassor', 'A steadfast minor lord who always honors his oaths.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91099, 9002, 211, 'en', 'The Cunning Notary', 'A sharp legal mind trained at the University of Padova.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91100, 9002, 212, 'en', 'The Veteran Sergeant', 'A battle-hardened soldier from Ezzelino''s campaigns.');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES (91104, 9002, 10, 'it', 'ora', 'ora');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES (91105, 9002, 11, 'it', 'ore', 'ore');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES (91106, 9002, 10, 'en', 'hour', 'hour');
INSERT OR IGNORE INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES (91107, 9002, 11, 'en', 'hours', 'hours');

-- ── Story 2 Difficulties ────────────────────────────────────────
INSERT OR IGNORE INTO list_stories_difficulty (id, id_story, id_text_description, exp_cost, max_weight, min_character, max_character, cost_help_coma, cost_max_characteristics, number_max_free_action) VALUES
(91001, 9002, 300, 3, 20, 1, 4, 2, 2, 3);
INSERT OR IGNORE INTO list_stories_difficulty (id, id_story, id_text_description, exp_cost, max_weight, min_character, max_character, cost_help_coma, cost_max_characteristics, number_max_free_action) VALUES
(91002, 9002, 301, 5, 12, 1, 4, 3, 3, 1);
INSERT OR IGNORE INTO list_stories_difficulty (id, id_story, id_text_description, exp_cost, max_weight, min_character, max_character, cost_help_coma, cost_max_characteristics, number_max_free_action) VALUES
(91003, 9002, 302, 8, 8, 2, 3, 5, 5, 0);

-- ── Story 2 Classes ─────────────────────────────────────────────
INSERT OR IGNORE INTO list_classes (id, id_story, id_text_name, id_text_description, weight_max, dexterity_base, intelligence_base, constitution_base) VALUES
(91001, 9002, 200, 200, 12, 3, 2, 4);
INSERT OR IGNORE INTO list_classes (id, id_story, id_text_name, id_text_description, weight_max, dexterity_base, intelligence_base, constitution_base) VALUES
(91002, 9002, 201, 201, 6, 1, 5, 2);
INSERT OR IGNORE INTO list_classes (id, id_story, id_text_name, id_text_description, weight_max, dexterity_base, intelligence_base, constitution_base) VALUES
(91003, 9002, 202, 202, 10, 2, 4, 2);
INSERT OR IGNORE INTO list_classes (id, id_story, id_text_name, id_text_description, weight_max, dexterity_base, intelligence_base, constitution_base) VALUES
(91004, 9002, 203, 203, 8, 5, 2, 2);

-- ── Story 2 Traits ──────────────────────────────────────────────
INSERT OR IGNORE INTO list_traits (id, id_story, id_text_name, id_text_description, cost_positive, cost_negative) VALUES
(91001, 9002, 700, 700, 3, 0);
INSERT OR IGNORE INTO list_traits (id, id_story, id_text_name, id_text_description, cost_positive, cost_negative) VALUES
(91002, 9002, 701, 701, 2, 0);
INSERT OR IGNORE INTO list_traits (id, id_story, id_text_name, id_text_description, cost_positive, cost_negative) VALUES
(91003, 9002, 702, 702, 2, 0);

-- ── Story 2 Character Templates ─────────────────────────────────
INSERT OR IGNORE INTO list_character_templates (id, id_story, id_tipo, id_text_name, id_text_description, life_max, energy_max, sad_max, dexterity_start, intelligence_start, constitution_start) VALUES
(91001, 9002, 91001, 210, 210, 12, 10, 8, 3, 3, 4);
INSERT OR IGNORE INTO list_character_templates (id, id_story, id_tipo, id_text_name, id_text_description, life_max, energy_max, sad_max, dexterity_start, intelligence_start, constitution_start) VALUES
(91002, 9002, 91002, 211, 211, 8, 8, 6, 1, 5, 2);
INSERT OR IGNORE INTO list_character_templates (id, id_story, id_tipo, id_text_name, id_text_description, life_max, energy_max, sad_max, dexterity_start, intelligence_start, constitution_start) VALUES
(91003, 9002, 91003, 212, 212, 14, 12, 10, 4, 1, 5);

-- ── Story 2 Locations ───────────────────────────────────────────
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(91001, 9002, 100, 100, 1, 10);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(91002, 9002, 101, 101, 1, 15);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(91003, 9002, 102, 102, 1, 20);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(91004, 9002, 103, 103, 0, 8);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(91005, 9002, 104, 104, 1, 6);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(91006, 9002, 105, 105, 1, 10);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(91007, 9002, 106, 106, 0, 4);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(91008, 9002, 107, 107, 0, 6);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(91009, 9002, 108, 108, 0, 4);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(91010, 9002, 109, 109, 0, 12);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(91011, 9002, 110, 110, 0, 6);
INSERT OR IGNORE INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, max_characters) VALUES
(91012, 9002, 111, 111, 1, 8);

-- ── Story 2 Events ──────────────────────────────────────────────
INSERT OR IGNORE INTO list_events (id, id_story, id_text_name, id_text_description, event_type, energy_cost, flag_end_time) VALUES
(91001, 9002, 500, 500, 'NORMAL', 2, 0);
INSERT OR IGNORE INTO list_events (id, id_story, id_text_name, id_text_description, event_type, energy_cost, flag_end_time) VALUES
(91002, 9002, 501, 501, 'NORMAL', 1, 0);
INSERT OR IGNORE INTO list_events (id, id_story, id_text_name, id_text_description, event_type, energy_cost, flag_end_time) VALUES
(91003, 9002, 502, 502, 'FIRST', 0, 0);
INSERT OR IGNORE INTO list_events (id, id_story, id_text_name, id_text_description, event_type, energy_cost, flag_end_time) VALUES
(91004, 9002, 503, 503, 'NORMAL', 1, 0);
INSERT OR IGNORE INTO list_events (id, id_story, id_text_name, id_text_description, event_type, energy_cost, flag_end_time) VALUES
(91005, 9002, 504, 504, 'AUTOMATIC', 0, 1);

-- ── Story 2 Items ───────────────────────────────────────────────
INSERT OR IGNORE INTO list_items (id, id_story, id_text_name, id_text_description, weight) VALUES
(91001, 9002, 400, 400, 1);
INSERT OR IGNORE INTO list_items (id, id_story, id_text_name, id_text_description, weight) VALUES
(91002, 9002, 401, 401, 1);
INSERT OR IGNORE INTO list_items (id, id_story, id_text_name, id_text_description, weight) VALUES
(91003, 9002, 402, 402, 2);
INSERT OR IGNORE INTO list_items (id, id_story, id_text_name, id_text_description, weight) VALUES
(91004, 9002, 403, 403, 1);
INSERT OR IGNORE INTO list_items (id, id_story, id_text_name, id_text_description, weight) VALUES
(91005, 9002, 404, 404, 1);

-- ── Story 2 Cards ───────────────────────────────────────────────
INSERT OR IGNORE INTO list_cards (id, id_story, awesome_icon, style_main) VALUES
(91001, 9002, 'fas fa-chess-rook', 'medieval');
INSERT OR IGNORE INTO list_cards (id, id_story, awesome_icon, style_main) VALUES
(91002, 9002, 'fas fa-scroll', 'evidence');
INSERT OR IGNORE INTO list_cards (id, id_story, awesome_icon, style_main) VALUES
(91003, 9002, 'fas fa-balance-scale', 'justice');

-- ── Story 2 Creator ─────────────────────────────────────────────
INSERT OR IGNORE INTO list_creator (id, id_story, creator_name, link) VALUES
(91001, 9002, 'PathsMaster', 'https://paths.games');
"""


def seed_dev_data(engine):
    """Insert seed/demo data for development. Idempotent via INSERT OR IGNORE."""
    from sqlalchemy import text as sql_text
    with engine.connect() as conn:
        # Execute each statement separately (SQLite doesn't support multi-statement exec)
        for statement in SEED_SQL.split(";"):
            stmt = statement.strip()
            if stmt and not stmt.startswith("--"):
                lines = [l for l in stmt.split("\n") if l.strip() and not l.strip().startswith("--")]
                if lines:
                    try:
                        conn.execute(sql_text(stmt))
                    except Exception:
                        pass  # OR IGNORE handles duplicates, unexpected errors are silently skipped
        conn.commit()
