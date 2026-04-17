-- =============================================
-- Paths Games - Repeatable Migration
-- Story Seed Data (SQLite) — Two complete stories
-- Story 1: "DEMO — Learn to Play Paths Games" (tutorial)
-- Story 2: "Il Valvassore di Marca" (Veneto, 1200 AD)
-- =============================================
-- This file is re-executed whenever its content changes.
-- NEVER include this in production deployments.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved
-- =============================================

-- =============================================
-- Clean previous story seed data (id_story 9001, 9002)
-- =============================================

-- =============================================
-- Important note from dev-team: when you edit this file, 
-- make sure to update the corresponding file in the PHP backend and Python backend 
-- (database_seed_dev_data.sql and seed_stories.py respectively) as well, to keep them in sync.
-- The two files should have identical content, just adapted to their respective SQL dialects.
-- Without alling the three files, the story seed data will not work correctly in all environments.
-- ROBOT tests rely on this data being present and consistent across backends, so please be careful when editing!
-- =============================================

DELETE FROM list_missions_steps       WHERE id_story IN (9001, 9002);
DELETE FROM list_missions             WHERE id_story IN (9001, 9002);
DELETE FROM list_global_random_events WHERE id_story IN (9001, 9002);
DELETE FROM list_choices_effects      WHERE id_story IN (9001, 9002);
DELETE FROM list_choices_conditions   WHERE id_story IN (9001, 9002);
DELETE FROM list_choices              WHERE id_story IN (9001, 9002);
DELETE FROM list_events_effects       WHERE id_story IN (9001, 9002);
DELETE FROM list_events               WHERE id_story IN (9001, 9002);
DELETE FROM list_weather_rules        WHERE id_story IN (9001, 9002);
DELETE FROM list_items_effects        WHERE id_story IN (9001, 9002);
DELETE FROM list_items                WHERE id_story IN (9001, 9002);
DELETE FROM list_locations_neighbors  WHERE id_story IN (9001, 9002);
DELETE FROM list_locations            WHERE id_story IN (9001, 9002);
DELETE FROM list_character_templates  WHERE id_story IN (9001, 9002);
DELETE FROM list_traits               WHERE id_story IN (9001, 9002);
DELETE FROM list_classes_bonus        WHERE id_story IN (9001, 9002);
DELETE FROM list_classes              WHERE id_story IN (9001, 9002);
DELETE FROM list_keys                 WHERE id_story IN (9001, 9002);
DELETE FROM list_texts                WHERE id_story IN (9001, 9002);
DELETE FROM list_cards                WHERE id_story IN (9001, 9002);
DELETE FROM list_creator              WHERE id_story IN (9001, 9002);
DELETE FROM list_stories_difficulty   WHERE id_story IN (9001, 9002);
DELETE FROM list_stories              WHERE id IN (9001, 9002);


-- #############################################################################
-- #                                                                           #
-- #    STORY 1: DEMO — LEARN TO PLAY PATHS GAMES                             #
-- #    A guided tutorial that walks players through every game mechanic.      #
-- #    id_story = 9001, IDs 90001–90999                                       #
-- #                                                                           #
-- #############################################################################

INSERT INTO list_stories (id, uuid, author, version_min, clock_singular_description, clock_plural_description,
    category, "group", visibility, priority, peghi, id_text_title, id_text_description)
VALUES (9001, 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'PathsMaster', '0.14.0', 'turn', 'turns',
    'tutorial', 'tutorial', 'PUBLIC', 100, 0, 1, 2);

-- ── Texts ───────────────────────────────────────────────────────
INSERT INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
-- Title & Description
(90001, 9001, 1, 'en', 'TUTORIAL', 'Welcome to Paths Games! This guided tutorial will teach you every mechanic step by step: moving between locations, managing energy and life, using items, making choices, checking the weather, and completing missions. No experience required — just curiosity!'),
(90002, 9001, 1, 'it', 'TUTORIAL', 'Benvenuto in Paths Games! Questo tutorial guidato ti insegnerà ogni meccanica passo dopo passo: muoversi tra le locazioni, gestire energia e vita, usare oggetti, fare scelte, controllare il meteo e completare missioni. Non serve esperienza — solo curiosità!'),
(90003, 9001, 2, 'en', 'A short training adventure in the Academy of Paths. Learn movement, energy, items, choices, and missions in a safe environment.', 'A short training adventure in the Academy of Paths. Learn movement, energy, items, choices, and missions in a safe environment. Perfect for new players.'),
(90004, 9001, 2, 'it', 'Una breve avventura di addestramento nell''Accademia di Paths.', 'Una breve avventura di addestramento nell''Accademia di Paths. Impara movimento, energia, oggetti, scelte e missioni in un ambiente sicuro. Perfetta per i nuovi giocatori.'),
-- Location texts (8 tutorial rooms)
(90005, 9001, 100, 'en', 'Welcome Hall', 'A bright, welcoming hall with banners explaining the basics of Paths Games. A friendly guide stands at the center, ready to explain how the game works. "Welcome, adventurer! Let''s start your training."'),
(90006, 9001, 100, 'it', 'Sala di Benvenuto', 'Una sala luminosa e accogliente con stendardi che spiegano le basi di Paths Games. Una guida amichevole sta al centro, pronta a spiegare come funziona il gioco. "Benvenuto, avventuriero! Iniziamo il tuo addestramento."'),
(90007, 9001, 101, 'en', 'Movement Training Room', 'A long corridor with colored tiles on the floor. Each tile represents a direction: NORTH, SOUTH, EAST, WEST. Signs on the walls explain: "Moving costs ENERGY. Safe locations cost less. Plan your route!"'),
(90008, 9001, 101, 'it', 'Sala Addestramento Movimento', 'Un lungo corridoio con mattonelle colorate sul pavimento. Ogni mattonella rappresenta una direzione: NORD, SUD, EST, OVEST. Cartelli sui muri spiegano: "Muoversi costa ENERGIA. Le locazioni sicure costano meno. Pianifica il tuo percorso!"'),
(90009, 9001, 102, 'en', 'Energy & Life Classroom', 'A cozy classroom with diagrams on a blackboard showing the four stats: LIFE, ENERGY, SADNESS, and EXPERIENCE. "When your energy reaches zero, you fall asleep. When sadness equals your life, you lose life points and collapse!"'),
(90010, 9001, 102, 'it', 'Aula Energia & Vita', 'Un''aula accogliente con diagrammi alla lavagna che mostrano le quattro statistiche: VITA, ENERGIA, TRISTEZZA ed ESPERIENZA. "Quando l''energia raggiunge zero, ti addormenti. Quando la tristezza eguaglia la vita, perdi punti vita e crolli!"'),
(90011, 9001, 103, 'en', 'Item Workshop', 'A workshop filled with glowing potions, rusty swords, and mysterious scrolls. A sign reads: "Items have WEIGHT. Your class determines how much you can carry. Some items are consumable — use them wisely!"'),
(90012, 9001, 103, 'it', 'Laboratorio Oggetti', 'Un laboratorio pieno di pozioni luminose, spade arrugginite e pergamene misteriose. Un cartello recita: "Gli oggetti hanno un PESO. La tua classe determina quanto puoi portare. Alcuni oggetti sono consumabili — usali con saggezza!"'),
(90013, 9001, 104, 'en', 'Choice Arena', 'A circular arena with two doors: one glowing gold, one glowing red. A voice booms: "In Paths Games, your CHOICES shape the story. Some choices require specific stats, items, or registry keys. Choose carefully — there may be no going back!"'),
(90014, 9001, 104, 'it', 'Arena delle Scelte', 'Un''arena circolare con due porte: una dorata, una rossa. Una voce tuona: "In Paths Games, le tue SCELTE plasmano la storia. Alcune scelte richiedono statistiche, oggetti o chiavi di registro specifiche. Scegli con attenzione — potrebbe non esserci ritorno!"'),
(90015, 9001, 105, 'en', 'Weather Observatory', 'A tower with a glass dome revealing the sky. Weather instruments line the walls. "Weather changes every Time Unit. Thunderstorms increase movement costs. Plan ahead!"'),
(90016, 9001, 105, 'it', 'Osservatorio Meteo', 'Una torre con una cupola di vetro che rivela il cielo. Strumenti meteorologici rivestono le pareti. "Il meteo cambia ogni Unità di Tempo. I temporali aumentano i costi di movimento. Pianifica in anticipo!"'),
(90017, 9001, 106, 'en', 'Mission Board', 'A large board covered with quest notices. Each mission has steps that update the State Registry. "Complete missions to progress the story. Check your registry to track progress!"'),
(90018, 9001, 106, 'it', 'Bacheca Missioni', 'Una grande bacheca coperta di avvisi di missioni. Ogni missione ha passaggi che aggiornano il Registro di Stato. "Completa le missioni per progredire nella storia. Controlla il tuo registro per tracciare i progressi!"'),
(90019, 9001, 107, 'en', 'Multiplayer Courtyard', 'An open courtyard where training dummies represent other players. Signs explain: "Players take turns based on a formula using DEX, INT, and COS. When ALL players sleep, a new Time Unit begins."'),
(90020, 9001, 107, 'it', 'Cortile Multigiocatore', 'Un cortile aperto dove manichini da allenamento rappresentano altri giocatori. Cartelli spiegano: "I giocatori agiscono in turno secondo una formula basata su DES, INT e COS. Quando TUTTI dormono, inizia una nuova Unità di Tempo."'),
(90021, 9001, 108, 'en', 'Graduation Hall', 'A grand hall with a golden trophy at the center. "Congratulations! You have completed the tutorial. You now know the fundamentals of Paths Games. Go forth and play a real story!"'),
(90022, 9001, 108, 'it', 'Sala della Laurea', 'Una sala maestosa con un trofeo dorato al centro. "Congratulazioni! Hai completato il tutorial. Ora conosci le basi di Paths Games. Vai e gioca una storia vera!"'),
-- Class texts
(90029, 9001, 200, 'en', 'Student', 'A balanced beginner. Good at everything, master of nothing. The ideal class to learn the game.'),
(90030, 9001, 200, 'it', 'Studente', 'Un principiante equilibrato. Buono in tutto, maestro di niente. La classe ideale per imparare il gioco.'),
(90031, 9001, 201, 'en', 'Scholar', 'High intelligence, low constitution. Relies on knowledge and clever choices rather than brute force.'),
(90032, 9001, 201, 'it', 'Erudito', 'Alta intelligenza, bassa costituzione. Si affida alla conoscenza e a scelte astute piuttosto che alla forza bruta.'),
(90033, 9001, 202, 'en', 'Athlete', 'High dexterity and constitution, lower intelligence. Excels at movement and physical challenges.'),
(90034, 9001, 202, 'it', 'Atleta', 'Alta destrezza e costituzione, intelligenza inferiore. Eccelle nel movimento e nelle sfide fisiche.'),
-- Difficulty texts
(90035, 9001, 300, 'en', 'Tutorial', 'The only difficulty available for the tutorial. Generous stats, no real danger. Focus on learning.'),
(90036, 9001, 300, 'it', 'Tutorial', 'L''unica difficoltà disponibile per la tutorial. Statistiche generose, nessun vero pericolo. Concentrati sull''apprendimento.'),
-- Item texts
(90041, 9001, 400, 'en', 'Training Potion', 'A mild potion that restores a small amount of life. Used to demonstrate how consumable items work.'),
(90042, 9001, 400, 'it', 'Pozione di Addestramento', 'Una pozione leggera che ripristina una piccola quantità di vita. Usata per dimostrare come funzionano gli oggetti consumabili.'),
(90043, 9001, 401, 'en', 'Practice Sword', 'A wooden sword used for training. It won''t win any real battles, but it teaches you about equipment and weight.'),
(90044, 9001, 401, 'it', 'Spada da Pratica', 'Una spada di legno usata per l''addestramento. Non vincerà battaglie vere, ma ti insegna equipaggiamento e peso.'),
(90045, 9001, 402, 'en', 'Guide Scroll', 'A scroll that explains game concepts. Reading it grants experience points as a tutorial reward.'),
(90046, 9001, 402, 'it', 'Pergamena Guida', 'Una pergamena che spiega i concetti del gioco. Leggerla conferisce punti esperienza come ricompensa del tutorial.'),
(90047, 9001, 403, 'en', 'Energy Snack', 'A quick bite that restores energy. Demonstrates consumable items that affect energy instead of life.'),
(90048, 9001, 403, 'it', 'Spuntino Energetico', 'Uno spuntino rapido che ripristina energia. Dimostra gli oggetti consumabili che influenzano l''energia invece della vita.'),
-- Event texts
(90051, 9001, 500, 'en', 'Welcome Event', 'The tutorial guide approaches you with a warm smile. "Welcome! I will teach you how to play Paths Games. Follow me through each room to learn all the mechanics."'),
(90052, 9001, 500, 'it', 'Evento di Benvenuto', 'La guida del tutorial si avvicina con un sorriso caloroso. "Benvenuto! Ti insegnerò come giocare a Paths Games. Seguimi in ogni stanza per imparare tutte le meccaniche."'),
(90053, 9001, 501, 'en', 'Movement Lesson', 'The guide points to the colored tiles. "Try moving to the next room! Moving costs energy. The cost depends on the location and the weather. Safe locations are cheaper."'),
(90054, 9001, 501, 'it', 'Lezione di Movimento', 'La guida indica le mattonelle colorate. "Prova a muoverti nella stanza successiva! Muoversi costa energia. Il costo dipende dalla locazione e dal meteo. Le locazioni sicure costano meno."'),
(90055, 9001, 502, 'en', 'Item Lesson', 'A glowing potion appears on a pedestal. "Pick it up! Items have weight — you can only carry as much as your class allows. Some items are consumable and vanish after use."'),
(90056, 9001, 502, 'it', 'Lezione sugli Oggetti', 'Una pozione luminosa appare su un piedistallo. "Raccoglila! Gli oggetti hanno peso — puoi portare solo quanto la tua classe consente. Alcuni oggetti sono consumabili e svaniscono dopo l''uso."'),
(90057, 9001, 503, 'en', 'Choice Lesson', 'Two doors appear before you. "This is a CHOICE event. Each option may require certain stats or items. If you meet the requirements, you can pick it. Some choices change the State Registry, affecting future events."'),
(90058, 9001, 503, 'it', 'Lezione sulle Scelte', 'Due porte appaiono davanti a te. "Questo è un evento SCELTA. Ogni opzione può richiedere certe statistiche o oggetti. Se soddisfi i requisiti, puoi sceglierla. Alcune scelte cambiano il Registro di Stato, influenzando eventi futuri."'),
(90059, 9001, 504, 'en', 'Graduation Ceremony', 'The guide applauds. "You have learned all the basics! You are now ready for a real adventure. Go to the Graduation Hall to complete the tutorial and earn your certificate!"'),
(90060, 9001, 504, 'it', 'Cerimonia di Laurea', 'La guida applaude. "Hai imparato tutte le basi! Ora sei pronto per un''avventura vera. Vai alla Sala della Laurea per completare il tutorial e guadagnare il tuo certificato!"'),
-- Choice texts
(90061, 9001, 600, 'en', 'Open the Gold Door', 'The gold door leads to a room with a reward chest. Choosing it demonstrates how positive choices work.'),
(90062, 9001, 600, 'it', 'Apri la Porta Dorata', 'La porta dorata conduce a una stanza con un forziere. Sceglierla dimostra come funzionano le scelte positive.'),
(90063, 9001, 601, 'en', 'Open the Red Door', 'The red door leads to a room with a training trap. Choosing it demonstrates how negative effects work — don''t worry, it''s safe!'),
(90064, 9001, 601, 'it', 'Apri la Porta Rossa', 'La porta rossa conduce a una stanza con una trappola di addestramento. Sceglierla dimostra come funzionano gli effetti negativi — non preoccuparti, è sicuro!'),
(90065, 9001, 602, 'en', 'Read the Scroll', 'Study the guide scroll to learn about the State Registry. Requires INT > 1.'),
(90066, 9001, 602, 'it', 'Leggi la Pergamena', 'Studia la pergamena guida per imparare il Registro di Stato. Richiede INT > 1.'),
(90067, 9001, 603, 'en', 'Accept Graduation', 'Step forward to accept your tutorial diploma and complete the demo.'),
(90068, 9001, 603, 'it', 'Accetta la Laurea', 'Fai un passo avanti per accettare il tuo diploma del tutorial e completare la demo.'),
-- Trait texts
(90071, 9001, 700, 'en', 'Quick Learner', 'You absorb knowledge faster. Bonus experience from tutorial events.'),
(90072, 9001, 700, 'it', 'Apprendista Veloce', 'Assorbi conoscenza più rapidamente. Bonus esperienza dagli eventi del tutorial.'),
(90073, 9001, 701, 'en', 'Curious Mind', 'Your curiosity leads you to discover hidden details. Bonus to intelligence checks.'),
(90074, 9001, 701, 'it', 'Mente Curiosa', 'La tua curiosità ti porta a scoprire dettagli nascosti. Bonus ai controlli di intelligenza.'),
(90075, 9001, 702, 'en', 'Resilient Spirit', 'You recover quickly from setbacks. Reduced sadness from negative events.'),
(90076, 9001, 702, 'it', 'Spirito Resiliente', 'Ti riprendi rapidamente dalle avversità. Riduzione della tristezza dagli eventi negativi.'),
-- Weather texts
(90077, 9001, 800, 'en', 'Clear Skies', 'A beautiful sunny day. Perfect weather for training. No movement penalties.'),
(90078, 9001, 800, 'it', 'Cielo Sereno', 'Una bella giornata di sole. Tempo perfetto per l''addestramento. Nessuna penalità di movimento.'),
(90079, 9001, 801, 'en', 'Light Rain', 'A gentle drizzle falls. Movement costs slightly increase in open areas. The guide explains: "Weather affects your travel costs!"'),
(90080, 9001, 801, 'it', 'Pioggia Leggera', 'Una pioggerella cade gentilmente. I costi di movimento aumentano leggermente nelle aree aperte. La guida spiega: "Il meteo influenza i costi di viaggio!"'),
(90081, 9001, 802, 'en', 'Training Storm', 'A simulated thunderstorm! The academy''s weather machine demonstrates how storms increase costs and drain energy. Don''t worry — it''s all controlled.'),
(90082, 9001, 802, 'it', 'Tempesta di Addestramento', 'Un temporale simulato! La macchina del meteo dell''accademia dimostra come le tempeste aumentano i costi e drenano energia. Non preoccuparti — è tutto controllato.'),
-- Mission texts
(90083, 9001, 900, 'en', 'Complete the Tutorial', 'Visit all the training rooms and learn every game mechanic.'),
(90084, 9001, 900, 'it', 'Completa il Tutorial', 'Visita tutte le stanze di addestramento e impara ogni meccanica del gioco.'),
(90085, 9001, 901, 'en', 'Collect Training Items', 'Pick up and use a training potion and an energy snack to learn about items.'),
(90086, 9001, 901, 'it', 'Raccogli Oggetti di Addestramento', 'Raccogli e usa una pozione di addestramento e uno spuntino energetico per imparare gli oggetti.'),
(90087, 9001, 902, 'en', 'Make Your First Choice', 'Enter the Choice Arena and pick a door to experience the choice system.'),
(90088, 9001, 902, 'it', 'Fai la Tua Prima Scelta', 'Entra nell''Arena delle Scelte e scegli una porta per sperimentare il sistema di scelte.'),
-- Mission step texts
(90089, 9001, 910, 'en', 'Visit the Movement Room', 'Go to the Movement Training Room to learn about navigation.'),
(90090, 9001, 911, 'en', 'Visit the Energy Classroom', 'Go to the Energy & Life Classroom to understand stats.'),
(90091, 9001, 912, 'en', 'Reach the Graduation Hall', 'Complete the tutorial by reaching the final room.'),
(90092, 9001, 920, 'en', 'Pick Up Training Potion', 'Collect the training potion from the Item Workshop.'),
(90093, 9001, 921, 'en', 'Use the Energy Snack', 'Consume the energy snack to see how consumable items work.'),
(90094, 9001, 930, 'en', 'Enter the Choice Arena', 'Go to the Choice Arena to face your first choice.'),
(90095, 9001, 931, 'en', 'Pick a Door', 'Choose either the gold or red door to experience the choice system.'),
-- Character template texts
(90096, 9001, 210, 'en', 'The Student', 'A well-rounded student with equal stats. The default template for learning the game.'),
(90097, 9001, 211, 'en', 'The Bookworm', 'A studious character with high intelligence. Great at solving puzzles and making smart choices.'),
(90098, 9001, 212, 'en', 'The Gym Star', 'An athletic character with high dexterity. Fast and agile, perfect for movement-heavy gameplay.'),
-- Key texts
(90099, 9001, 950, 'en', 'Tutorial Progress', 'Tracks how many tutorial rooms you have visited. Updated automatically as you explore.'),
(90100, 9001, 951, 'en', 'Items Collected', 'Tracks whether you have collected and used the training items.'),
(90101, 9001, 952, 'en', 'Choice Made', 'Records whether you have made your first choice in the Choice Arena.');

-- ── Difficulties ────────────────────────────────────────────────
INSERT INTO list_stories_difficulty (id, id_story, id_text_description, exp_cost, max_weight, min_character, max_character, cost_help_coma, cost_max_characteristics, number_max_free_action) VALUES
(90001, 9001, 300, 1, 20, 1, 4, 1, 1, 3);

-- ── Classes ─────────────────────────────────────────────────────
INSERT INTO list_classes (id, id_story, id_text_name, id_text_description, weight_max, dexterity_base, intelligence_base, constitution_base) VALUES
(90001, 9001, 200, 200, 12, 3, 3, 3),
(90002, 9001, 201, 201, 8,  2, 5, 2),
(90003, 9001, 202, 202, 10, 5, 2, 4);

-- ── Classes Bonus ───────────────────────────────────────────────
INSERT INTO list_classes_bonus (id, id_story, id_class, statistic, value) VALUES
(90001, 9001, 90001, 'life',   3),
(90002, 9001, 90001, 'energy', 3),
(90003, 9001, 90001, 'exp',    2),
(90004, 9001, 90002, 'int',    3),
(90005, 9001, 90002, 'energy', 2),
(90006, 9001, 90002, 'exp',    3),
(90007, 9001, 90003, 'dex',    3),
(90008, 9001, 90003, 'life',   2),
(90009, 9001, 90003, 'energy', 4);

-- ── Traits ──────────────────────────────────────────────────────
INSERT INTO list_traits (id, id_story, id_text_name, id_text_description, cost_positive, cost_negative) VALUES
(90001, 9001, 700, 700, 1, 0),
(90002, 9001, 701, 701, 1, 0),
(90003, 9001, 702, 702, 1, 0);

-- ── Character Templates ─────────────────────────────────────────
INSERT INTO list_character_templates (id_tipo, id_story, id_text_name, id_text_description, life_max, energy_max, sad_max, dexterity_start, intelligence_start, constitution_start) VALUES
(90001, 9001, 210, 210, 12, 12, 8, 3, 3, 3),
(90002, 9001, 211, 211, 10, 10, 6, 2, 5, 2),
(90003, 9001, 212, 212, 11, 14, 7, 5, 2, 4);

-- ── Keys ────────────────────────────────────────────────────────
INSERT INTO list_keys (id, id_story, name, value, id_text_description, "group", priority, visibility) VALUES
(90001, 9001, 'tutorial_progress', '0',     950, 'tutorial', 1, 'PUBLIC'),
(90002, 9001, 'items_collected',   'false', 951, 'tutorial', 2, 'PUBLIC'),
(90003, 9001, 'choice_made',       'false', 952, 'tutorial', 3, 'PUBLIC');

-- ── Locations (8 training rooms) ────────────────────────────────
INSERT INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, cost_energy_enter, max_characters) VALUES
(90001, 9001, 100, 100, 1, 0, 10),   -- Welcome Hall (start)
(90002, 9001, 101, 101, 1, 1, 10),   -- Movement Training Room
(90003, 9001, 102, 102, 1, 0, 10),   -- Energy & Life Classroom
(90004, 9001, 103, 103, 1, 0, 10),   -- Item Workshop
(90005, 9001, 104, 104, 1, 1, 10),   -- Choice Arena
(90006, 9001, 105, 105, 1, 0, 10),   -- Weather Observatory
(90007, 9001, 106, 106, 1, 0, 10),   -- Mission Board
(90008, 9001, 107, 107, 1, 0, 10);   -- Multiplayer Courtyard

-- ── Location Neighbors ──────────────────────────────────────────
INSERT INTO list_locations_neighbors (id, id_story, id_location_from, id_location_to, direction, flag_back, energy_cost) VALUES
(90001, 9001, 90001, 90002, 'NORTH', 1, 0),   -- Welcome ↔ Movement Room
(90002, 9001, 90002, 90003, 'EAST',  1, 0),   -- Movement ↔ Energy Classroom
(90003, 9001, 90003, 90004, 'NORTH', 1, 0),   -- Energy ↔ Item Workshop
(90004, 9001, 90004, 90005, 'EAST',  1, 0),   -- Items ↔ Choice Arena
(90005, 9001, 90005, 90006, 'NORTH', 1, 1),   -- Choice ↔ Weather Observatory
(90006, 9001, 90006, 90007, 'EAST',  1, 0),   -- Weather ↔ Mission Board
(90007, 9001, 90007, 90008, 'NORTH', 1, 0),   -- Mission ↔ Multiplayer Courtyard
(90008, 9001, 90001, 90008, 'EAST',  1, 1);   -- Welcome ↔ Multiplayer (shortcut)

-- ── Items ───────────────────────────────────────────────────────
INSERT INTO list_items (id, id_story, id_text_name, id_text_description, weight, is_consumabile) VALUES
(90001, 9001, 400, 400, 1, 1),  -- Training Potion
(90002, 9001, 401, 401, 2, 0),  -- Practice Sword
(90003, 9001, 402, 402, 1, 1),  -- Guide Scroll
(90004, 9001, 403, 403, 1, 1);  -- Energy Snack

-- ── Item Effects ────────────────────────────────────────────────
INSERT INTO list_items_effects (id, id_story, id_item, effect_code, effect_value) VALUES
(90001, 9001, 90001, 'LIFE',   3),
(90002, 9001, 90003, 'EXP',    5),
(90003, 9001, 90004, 'ENERGY', 3);

-- ── Weather Rules ───────────────────────────────────────────────
INSERT INTO list_weather_rules (id, id_story, id_text_name, id_text_description, probability, cost_move_safe_location, cost_move_not_safe_location, active, priority, delta_energy) VALUES
(90001, 9001, 800, 800, 50, 0, 0, 1, 1,  0),   -- Clear Skies (common, no penalty)
(90002, 9001, 801, 801, 35, 0, 1, 1, 2,  0),   -- Light Rain (mild penalty)
(90003, 9001, 802, 802, 15, 0, 1, 1, 3, -1);   -- Training Storm (demonstrates weather effect)

-- ── Events ──────────────────────────────────────────────────────
INSERT INTO list_events (id, id_story, id_text_name, id_text_description, type, cost_enery, flag_end_time) VALUES
(90001, 9001, 500, 500, 'FIRST',     0, 0),  -- Welcome Event (triggers once)
(90002, 9001, 501, 501, 'FIRST',     0, 0),  -- Movement Lesson
(90003, 9001, 502, 502, 'FIRST',     0, 0),  -- Item Lesson
(90004, 9001, 503, 503, 'NORMAL',    1, 0),  -- Choice Lesson
(90005, 9001, 504, 504, 'AUTOMATIC', 0, 1);  -- Graduation Ceremony (end)

-- ── Event Effects ───────────────────────────────────────────────
INSERT INTO list_events_effects (id, id_story, id_event, statistics, value, target) VALUES
(90001, 9001, 90001, 'exp',     2,  'ALL'),       -- Welcome: small XP
(90002, 9001, 90002, 'exp',     3,  'ALL'),       -- Movement lesson: XP reward
(90003, 9001, 90003, 'exp',     3,  'ALL'),       -- Item lesson: XP reward
(90004, 9001, 90004, 'energy', -1,  'ONLY_ONE'),  -- Choice lesson: small energy cost
(90005, 9001, 90005, 'exp',    15,  'ALL');        -- Graduation: big XP reward

-- ── Choices ─────────────────────────────────────────────────────
INSERT INTO list_choices (id, id_story, id_event, priority, id_text_name, id_text_description, otherwise_flag, is_progress, logic_operator) VALUES
(90001, 9001, 90004, 1, 600, 600, 0, 1, 'AND'),  -- Gold Door
(90002, 9001, 90004, 2, 601, 601, 0, 1, 'AND'),  -- Red Door
(90003, 9001, 90003, 1, 602, 602, 0, 1, 'AND'),  -- Read Scroll
(90004, 9001, 90005, 1, 603, 603, 0, 1, 'AND');   -- Accept Graduation

-- ── Choice Conditions ───────────────────────────────────────────
INSERT INTO list_choices_conditions (id, id_story, id_choices, type, key, value, operator) VALUES
(90001, 9001, 90003, 'statistics', 'int', '1', '>');  -- Read Scroll: needs INT > 1

-- ── Choice Effects ──────────────────────────────────────────────
INSERT INTO list_choices_effects (id, id_story, id_choices, statistics, value, key, value_to_add) VALUES
(90001, 9001, 90001, 'exp',     5,  'choice_made', 'gold'),
(90002, 9001, 90002, 'life',   -1,  'choice_made', 'red'),
(90003, 9001, 90003, 'exp',     3,  'items_collected', 'true'),
(90004, 9001, 90004, 'exp',    10,  'tutorial_complete', 'true');

-- ── Global Random Events ────────────────────────────────────────
INSERT INTO list_global_random_events (id, id_story, condition_key, condition_value, probability) VALUES
(90001, 9001, NULL, NULL, 10);

-- ── Missions ────────────────────────────────────────────────────
INSERT INTO list_missions (id, id_story, condition_key, condition_value_from, condition_value_to, id_text_name, id_text_description) VALUES
(90001, 9001, 'tutorial_progress',  '0', '3', 900, 900),
(90002, 9001, 'items_collected',    NULL, 'true', 901, 901),
(90003, 9001, 'choice_made',        NULL, 'gold', 902, 902);

-- ── Mission Steps ───────────────────────────────────────────────
INSERT INTO list_missions_steps (id, id_story, id_mission, step, condition_key, condition_value_from, condition_value_to, id_text_name, id_text_description) VALUES
(90001, 9001, 90001, 1, 'visited_movement',  NULL, 'true', 910, 910),
(90002, 9001, 90001, 2, 'visited_energy',    NULL, 'true', 911, 911),
(90003, 9001, 90001, 3, 'visited_graduation', NULL, 'true', 912, 912),
(90004, 9001, 90002, 1, 'potion_collected',  NULL, 'true', 920, 920),
(90005, 9001, 90002, 2, 'snack_used',        NULL, 'true', 921, 921),
(90006, 9001, 90003, 1, 'entered_arena',     NULL, 'true', 930, 930),
(90007, 9001, 90003, 2, 'door_chosen',       NULL, 'true', 931, 931);

-- ── Creator ─────────────────────────────────────────────────────
INSERT INTO list_creator (id, id_story, link, url, url_image) VALUES
(90001, 9001, 'PathsMaster', 'https://paths.games', 'https://paths.games/assets/logo.png');

-- ── Cards ───────────────────────────────────────────────────────
INSERT INTO list_cards (id, id_story, url_immage, awesome_icon, style_main) VALUES
(90001, 9001, NULL, 'fas fa-graduation-cap', 'tutorial'),
(90002, 9001, NULL, 'fas fa-book-open',      'learning'),
(90003, 9001, NULL, 'fas fa-lightbulb',      'tips');


-- #############################################################################
-- #                                                                           #
-- #    STORY 2: IL VALVASSORE DI MARCA                                        #
-- #    Veneto, 1200 AD — A valvassore must save his vassal's life.            #
-- #    id_story = 9002, IDs 91001–91999                                       #
-- #                                                                           #
-- #############################################################################

INSERT INTO list_stories (id, uuid, author, version_min, clock_singular_description, clock_plural_description,
    category, "group", visibility, priority, peghi, id_text_title, id_text_description)
VALUES (9002, 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'PathsMaster', '0.14.0', 'ora', 'ore',
    'fantasy', 'main', 'PUBLIC', 10, 5, 1, 2);

-- ── Texts ───────────────────────────────────────────────────────
INSERT INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
-- Title & Description
(91001, 9002, 1, 'en', 'The Valvassor of the March', 'Veneto, 1243 AD. You are a valvassor — a minor feudal lord — serving under the powerful Ezzelino III da Romano, lord of the Marca Trevigiana. Your most loyal vassal, Martino the blacksmith, has been falsely accused of heresy by a rival lord and sentenced to burn at the stake. You have three days to prove his innocence, gather allies, and challenge the accusation before the Bishop''s tribunal in Padova.'),
(91002, 9002, 1, 'it', 'Il Valvassore di Marca', 'Veneto, 1243. Sei un valvassore — un piccolo signore feudale — al servizio del potente Ezzelino III da Romano, signore della Marca Trevigiana. Il tuo più fidato vassallo, Martino il fabbro, è stato falsamente accusato di eresia da un signore rivale e condannato al rogo. Hai tre giorni per dimostrare la sua innocenza, radunare alleati e contestare l''accusa davanti al tribunale del Vescovo a Padova.'),
(91003, 9002, 2, 'en', 'The Valvassor of the March', 'Travel across medieval Veneto to save your vassal from an unjust death. Navigate feudal politics, gather evidence, recruit allies, and face the Inquisition. Every hour counts.'),
(91004, 9002, 2, 'it', 'Il Valvassore di Marca', 'Viaggia attraverso il Veneto medievale per salvare il tuo vassallo da una morte ingiusta. Naviga la politica feudale, raccogli prove, recluta alleati e affronta l''Inquisizione. Ogni ora conta.'),
-- Location texts (12 medieval Veneto locations)
(91005, 9002, 100, 'en', 'Castelfranco Veneto', 'Your small fortified town, surrounded by the imposing walls built by Treviso. The main square buzzes with rumors about Martino''s arrest. Your manor stands at the northern gate.'),
(91006, 9002, 100, 'it', 'Castelfranco Veneto', 'La tua piccola città fortificata, circondata dalle imponenti mura costruite da Treviso. La piazza principale ronza di voci sull''arresto di Martino. Il tuo maniero si trova alla porta nord.'),
(91007, 9002, 101, 'en', 'Treviso', 'The proud walled city, seat of the Podestà. The Sile river flows through its center. Merchants and nobles crowd the Piazza dei Signori. The prison where Martino is held lies beneath the Palazzo Comunale.'),
(91008, 9002, 101, 'it', 'Treviso', 'L''orgogliosa città murata, sede del Podestà. Il fiume Sile scorre nel centro. Mercanti e nobili affollano la Piazza dei Signori. La prigione dove Martino è detenuto si trova sotto il Palazzo Comunale.'),
(91009, 9002, 102, 'en', 'Padova', 'The ancient university city and seat of the Bishop''s tribunal. The Basilica del Santo rises above the rooftops. Here the trial will take place — and here you must present your evidence.'),
(91010, 9002, 102, 'it', 'Padova', 'L''antica città universitaria e sede del tribunale del Vescovo. La Basilica del Santo si erge sopra i tetti. Qui si terrà il processo — e qui devi presentare le tue prove.'),
(91011, 9002, 103, 'en', 'Bassano del Grappa', 'A strategic mountain town on the Brenta river, famous for its wooden bridge. Ezzelino''s stronghold looms on the hill above. His captain may grant you an audience — if you are bold enough.'),
(91012, 9002, 103, 'it', 'Bassano del Grappa', 'Una strategica città di montagna sul fiume Brenta, famosa per il suo ponte di legno. La roccaforte di Ezzelino incombe sulla collina. Il suo capitano potrebbe concederti udienza — se sei abbastanza audace.'),
(91013, 9002, 104, 'en', 'Asolo', 'A hilltop jewel with sweeping views of the plain below. The countess of Asolo, a woman of great influence and learning, holds court here. She is known to sympathize with the accused.'),
(91014, 9002, 104, 'it', 'Asolo', 'Un gioiello collinare con ampie vedute sulla pianura sottostante. La contessa di Asolo, donna di grande influenza e cultura, tiene corte qui. È nota per simpatizzare con gli accusati.'),
(91015, 9002, 105, 'en', 'Cittadella', 'A perfectly circular walled town, built as a rival to Castelfranco. The garrison commander here owes you a favor from the last campaign. He may lend you soldiers for the road to Padova.'),
(91016, 9002, 105, 'it', 'Cittadella', 'Una città murata perfettamente circolare, costruita come rivale di Castelfranco. Il comandante della guarnigione ti deve un favore dall''ultima campagna. Potrebbe prestarti soldati per la strada verso Padova.'),
(91017, 9002, 106, 'en', 'Monastero di Campese', 'A Benedictine monastery nestled in the foothills of the Grappa. The monks preserve ancient records. Brother Anselmo, the archivist, may have documents proving the accuser''s own crimes.'),
(91018, 9002, 106, 'it', 'Monastero di Campese', 'Un monastero benedettino adagiato ai piedi del Grappa. I monaci conservano antichi documenti. Frate Anselmo, l''archivista, potrebbe avere atti che provano i crimini dell''accusatore stesso.'),
(91019, 9002, 107, 'en', 'Marostica', 'A town with two castles — upper and lower — connected by defensive walls. The local lord, a secret enemy of Ezzelino, may be the one who orchestrated the false accusation.'),
(91020, 9002, 107, 'it', 'Marostica', 'Una città con due castelli — superiore e inferiore — collegati da mura difensive. Il signore locale, un nemico segreto di Ezzelino, potrebbe essere colui che ha orchestrato la falsa accusa.'),
(91021, 9002, 108, 'en', 'Le Paludi del Sile', 'Misty marshlands along the Sile river. Bandits and refugees hide among the reeds. A fugitive witness — a monk who saw the truth — is rumored to be hiding here.'),
(91022, 9002, 108, 'it', 'Le Paludi del Sile', 'Paludi nebbiose lungo il fiume Sile. Briganti e rifugiati si nascondono tra le canne. Si dice che un testimone in fuga — un monaco che ha visto la verità — si nasconda qui.'),
(91023, 9002, 109, 'en', 'Vicenza', 'A wealthy commune where Guelph and Ghibelline factions clash openly. The notary guild here can authenticate documents. But entering the city as a vassal of Ezzelino is dangerous.'),
(91024, 9002, 109, 'it', 'Vicenza', 'Un ricco comune dove le fazioni guelfe e ghibelline si scontrano apertamente. La corporazione dei notai qui può autenticare documenti. Ma entrare in città come vassallo di Ezzelino è pericoloso.'),
(91025, 9002, 110, 'en', 'Il Bosco del Montello', 'A dense oak forest on the hills above the Piave. Charcoal burners and hermits live here. An old healer knows remedies that could save Martino if he falls ill in prison.'),
(91026, 9002, 110, 'it', 'Il Bosco del Montello', 'Una densa foresta di querce sulle colline sopra il Piave. Carbonai ed eremiti vivono qui. Un vecchio guaritore conosce rimedi che potrebbero salvare Martino se si ammala in prigione.'),
(91027, 9002, 111, 'en', 'Ponte di Piave', 'The only bridge crossing the Piave in the area. A toll station and a small inn serve travelers. Messengers from Padova pass through here — you might intercept vital news.'),
(91028, 9002, 111, 'it', 'Ponte di Piave', 'L''unico ponte sul Piave nella zona. Una stazione di pedaggio e una piccola locanda servono i viaggiatori. Messaggeri da Padova passano di qui — potresti intercettare notizie vitali.'),
-- Class texts
(91029, 9002, 200, 'en', 'Knight', 'A minor noble trained in combat and horsemanship. Strong and respected, but not always welcome in church courts.'),
(91030, 9002, 200, 'it', 'Cavaliere', 'Un piccolo nobile addestrato nel combattimento e nell''equitazione. Forte e rispettato, ma non sempre ben visto nei tribunali ecclesiastici.'),
(91031, 9002, 201, 'en', 'Cleric', 'A man of the cloth with access to monasteries and church officials. Physically frail but politically astute.'),
(91032, 9002, 201, 'it', 'Chierico', 'Un uomo di chiesa con accesso a monasteri e funzionari ecclesiastici. Fisicamente fragile ma politicamente astuto.'),
(91033, 9002, 202, 'en', 'Merchant', 'A wealthy trader with connections in every city. Can bribe, negotiate, and procure rare goods. Money opens many doors.'),
(91034, 9002, 202, 'it', 'Mercante', 'Un ricco commerciante con contatti in ogni città. Può corrompere, negoziare e procurare beni rari. Il denaro apre molte porte.'),
(91035, 9002, 203, 'en', 'Scout', 'A nimble tracker at home in forests and marshes. Fast, stealthy, and skilled at finding hidden paths and people.'),
(91036, 9002, 203, 'it', 'Esploratore', 'Un agile segugi a suo agio in foreste e paludi. Veloce, furtivo e abile nel trovare sentieri e persone nascoste.'),
-- Difficulty texts
(91037, 9002, 300, 'en', 'Merciful Judge', 'Extra time and resources. The tribunal is lenient. Ideal for experiencing the story without pressure.'),
(91038, 9002, 300, 'it', 'Giudice Misericordioso', 'Tempo e risorse extra. Il tribunale è clemente. Ideale per vivere la storia senza pressione.'),
(91039, 9002, 301, 'en', 'Just Trial', 'Standard difficulty. Time is limited, resources are scarce. Every choice matters.'),
(91040, 9002, 301, 'it', 'Giusto Processo', 'Difficoltà standard. Il tempo è limitato, le risorse scarse. Ogni scelta conta.'),
(91041, 9002, 302, 'en', 'Iron Inquisition', 'Extreme difficulty. The tribunal is hostile, roads are dangerous, and your enemies have spies everywhere.'),
(91042, 9002, 302, 'it', 'Inquisizione di Ferro', 'Difficoltà estrema. Il tribunale è ostile, le strade pericolose e i tuoi nemici hanno spie ovunque.'),
-- Item texts
(91043, 9002, 400, 'en', 'Bread and Cheese', 'Simple traveler''s food. Restores energy for the long rides between towns.'),
(91044, 9002, 400, 'it', 'Pane e Formaggio', 'Semplice cibo da viaggiatore. Ripristina energia per i lunghi tragitti tra le città.'),
(91045, 9002, 401, 'en', 'Sealed Letter', 'A letter bearing Ezzelino''s seal. It grants safe passage through Ghibelline territories but may anger Guelphs.'),
(91046, 9002, 401, 'it', 'Lettera Sigillata', 'Una lettera con il sigillo di Ezzelino. Garantisce passaggio sicuro nei territori ghibellini ma potrebbe irritare i guelfi.'),
(91047, 9002, 402, 'en', 'Monastery Records', 'Copies of ancient documents from the Campese archives proving the accuser dealt with known heretics himself.'),
(91048, 9002, 402, 'it', 'Atti del Monastero', 'Copie di antichi documenti dagli archivi di Campese che provano che l''accusatore stesso trattò con eretici noti.'),
(91049, 9002, 403, 'en', 'Healing Herbs', 'Medicinal plants gathered from the Montello forest. Can cure illness or be used to help Martino survive prison.'),
(91050, 9002, 403, 'it', 'Erbe Curative', 'Piante medicinali raccolte nella foresta del Montello. Possono curare malattie o essere usate per aiutare Martino a sopravvivere in prigione.'),
(91051, 9002, 404, 'en', 'Silver Coins', 'A pouch of silver denari. Useful for bribes, tolls, and purchasing favors. Money speaks louder than swords in the courts.'),
(91052, 9002, 404, 'it', 'Monete d''Argento', 'Una borsa di denari d''argento. Utili per corruzione, pedaggi e acquisto di favori. Il denaro parla più forte delle spade nei tribunali.'),
-- Event texts
(91053, 9002, 500, 'en', 'Bandit Ambush', 'A group of desperate outlaws blocks the road! They demand your money or your life. The forests of Veneto are not safe for lone travelers.'),
(91054, 9002, 500, 'it', 'Imboscata dei Briganti', 'Un gruppo di fuorilegge disperati blocca la strada! Chiedono il denaro o la vita. Le foreste del Veneto non sono sicure per i viaggiatori solitari.'),
(91055, 9002, 501, 'en', 'The Accuser''s Spy', 'A hooded figure has been following you since Treviso. The rival lord knows you are gathering evidence. You must act before his agents destroy the proof.'),
(91056, 9002, 501, 'it', 'La Spia dell''Accusatore', 'Una figura incappucciata ti segue da Treviso. Il signore rivale sa che stai raccogliendo prove. Devi agire prima che i suoi agenti distruggano le prove.'),
(91057, 9002, 502, 'en', 'The Monk''s Testimony', 'You find Brother Giacomo hiding in the marshes. He witnessed the accuser planting false evidence against Martino. He will testify — but only if you guarantee his safety.'),
(91058, 9002, 502, 'it', 'La Testimonianza del Monaco', 'Trovi Frate Giacomo nascosto nelle paludi. Ha visto l''accusatore fabbricare false prove contro Martino. Testimonierà — ma solo se garantisci la sua sicurezza.'),
(91059, 9002, 503, 'en', 'Audience with the Countess', 'The Countess of Asolo receives you in her garden. She listens intently and offers a letter of recommendation to the Bishop of Padova. Her word carries great weight.'),
(91060, 9002, 503, 'it', 'Udienza dalla Contessa', 'La Contessa di Asolo ti riceve nel suo giardino. Ascolta attentamente e offre una lettera di raccomandazione per il Vescovo di Padova. La sua parola ha grande peso.'),
(91061, 9002, 504, 'en', 'The Trial of Martino', 'The Bishop''s tribunal convenes in the great hall of the Palazzo della Ragione in Padova. The accuser presents his case. Now it is your turn to present the evidence you have gathered.'),
(91062, 9002, 504, 'it', 'Il Processo di Martino', 'Il tribunale del Vescovo si riunisce nella grande sala del Palazzo della Ragione a Padova. L''accusatore presenta il suo caso. Ora tocca a te presentare le prove che hai raccolto.'),
-- Choice texts
(91063, 9002, 600, 'en', 'Fight the Bandits', 'Draw your sword and scatter these highwaymen. A show of force may clear the road.'),
(91064, 9002, 600, 'it', 'Combatti i Briganti', 'Sfodera la spada e disperdi questi briganti. Una dimostrazione di forza potrebbe sgombrare la strada.'),
(91065, 9002, 601, 'en', 'Pay the Toll', 'Hand over some silver coins. Your mission is too urgent to waste time fighting.'),
(91066, 9002, 601, 'it', 'Paga il Pedaggio', 'Consegna alcune monete d''argento. La tua missione è troppo urgente per perdere tempo a combattere.'),
(91067, 9002, 602, 'en', 'Present the Monastery Records', 'Show the ancient documents proving the accuser''s own dealings with known heretics.'),
(91068, 9002, 602, 'it', 'Presenta gli Atti del Monastero', 'Mostra gli antichi documenti che provano i rapporti dell''accusatore stesso con eretici noti.'),
(91069, 9002, 603, 'en', 'Call Brother Giacomo to Testify', 'Bring the monk before the tribunal as a living witness to the falsehood.'),
(91070, 9002, 603, 'it', 'Chiama Frate Giacomo a Testimoniare', 'Porta il monaco davanti al tribunale come testimone vivente della falsità.'),
(91071, 9002, 604, 'en', 'Plead to the Bishop''s Mercy', 'Without enough evidence, appeal to the Bishop''s sense of justice and mercy. It''s a long shot.'),
(91072, 9002, 604, 'it', 'Appella alla Misericordia del Vescovo', 'Senza prove sufficienti, appella al senso di giustizia e misericordia del Vescovo. È un tentativo disperato.'),
-- Trait texts
(91073, 9002, 700, 'en', 'Feudal Authority', 'Your rank commands respect from peasants and minor lords. Guards and soldiers are more willing to listen.'),
(91074, 9002, 700, 'it', 'Autorità Feudale', 'Il tuo rango impone rispetto a contadini e signori minori. Guardie e soldati sono più disposti ad ascoltare.'),
(91075, 9002, 701, 'en', 'Silver Tongue', 'A gift for persuasion. You can charm, negotiate, and convince where others would need force.'),
(91076, 9002, 701, 'it', 'Lingua d''Argento', 'Un dono per la persuasione. Puoi incantare, negoziare e convincere dove altri avrebbero bisogno della forza.'),
(91077, 9002, 702, 'en', 'Local Knowledge', 'Born and raised in the Marca Trevigiana. You know every back road, every ford, and every shortcut through the hills.'),
(91078, 9002, 702, 'it', 'Conoscenza del Territorio', 'Nato e cresciuto nella Marca Trevigiana. Conosci ogni strada secondaria, ogni guado e ogni scorciatoia tra le colline.'),
-- Weather texts
(91079, 9002, 800, 'en', 'Autumn Sun', 'Warm sunlight breaks through the clouds. The roads are dry and travel is easy. A good day for the Marca.'),
(91080, 9002, 800, 'it', 'Sole d''Autunno', 'Caldo sole filtra tra le nuvole. Le strade sono asciutte e viaggiare è facile. Una buona giornata per la Marca.'),
(91081, 9002, 801, 'en', 'Fog from the Plains', 'Dense fog rolls in from the Venetian plain. Visibility drops to a few paces. Easy to get lost — or to hide.'),
(91082, 9002, 801, 'it', 'Nebbia dalla Pianura', 'Fitta nebbia arriva dalla pianura veneta. La visibilità scende a pochi passi. Facile perdersi — o nascondersi.'),
(91083, 9002, 802, 'en', 'Autumn Storm', 'Heavy rain lashes the countryside. Rivers swell, roads turn to mud. Movement becomes exhausting and dangerous.'),
(91084, 9002, 802, 'it', 'Temporale d''Autunno', 'Pioggia battente flagella la campagna. I fiumi si gonfiano, le strade diventano fango. Muoversi diventa estenuante e pericoloso.'),
-- Mission texts
(91085, 9002, 900, 'en', 'Save Martino', 'Gather enough evidence and allies to acquit Martino at the Bishop''s tribunal in Padova.'),
(91086, 9002, 900, 'it', 'Salva Martino', 'Raccogli prove e alleati sufficienti per assolvere Martino al tribunale del Vescovo a Padova.'),
(91087, 9002, 901, 'en', 'Unmask the Accuser', 'Find the monastery records and the monk''s testimony to expose the rival lord''s plot.'),
(91088, 9002, 901, 'it', 'Smaschera l''Accusatore', 'Trova gli atti del monastero e la testimonianza del monaco per smascherare il complotto del signore rivale.'),
(91089, 9002, 902, 'en', 'Secure the Road to Padova', 'Recruit soldiers from Cittadella and secure safe passage to the tribunal.'),
(91090, 9002, 902, 'it', 'Metti in Sicurezza la Strada per Padova', 'Recluta soldati da Cittadella e assicura un passaggio sicuro verso il tribunale.'),
-- Mission step texts
(91091, 9002, 910, 'en', 'Visit the Monastery', 'Travel to the Monastero di Campese and find Brother Anselmo.'),
(91092, 9002, 911, 'en', 'Find the Monk', 'Search the marshes of the Sile for Brother Giacomo.'),
(91093, 9002, 912, 'en', 'Present Evidence at Trial', 'Reach Padova and present your evidence at the Bishop''s tribunal.'),
(91094, 9002, 920, 'en', 'Obtain the Records', 'Convince Brother Anselmo to hand over the incriminating documents.'),
(91095, 9002, 921, 'en', 'Protect the Witness', 'Ensure Brother Giacomo reaches Padova alive and willing to testify.'),
(91096, 9002, 930, 'en', 'Recruit Soldiers', 'Convince the commander of Cittadella to lend you an armed escort.'),
(91097, 9002, 931, 'en', 'Clear the Road', 'Defeat or disperse bandits on the road between Cittadella and Padova.'),
-- Character template texts
(91098, 9002, 210, 'en', 'The Loyal Valvassor', 'A steadfast minor lord who always honors his oaths. Balanced in combat and diplomacy.'),
(91099, 9002, 211, 'en', 'The Cunning Notary', 'A sharp legal mind trained at the University of Padova. Weak in combat but deadly in court.'),
(91100, 9002, 212, 'en', 'The Veteran Sergeant', 'A battle-hardened soldier from Ezzelino''s campaigns. Tough and brave, but distrusted by churchmen.'),
-- Key texts
(91101, 9002, 950, 'en', 'Monastery Records', 'Indicates whether you have obtained the incriminating documents from the Campese archives.'),
(91102, 9002, 951, 'en', 'Monk''s Testimony', 'Indicates whether Brother Giacomo has agreed to testify at the trial.'),
(91103, 9002, 952, 'en', 'Countess''s Letter', 'A letter of recommendation from the Countess of Asolo addressed to the Bishop of Padova.');

-- ── Difficulties ────────────────────────────────────────────────
INSERT INTO list_stories_difficulty (id, id_story, id_text_description, exp_cost, max_weight, min_character, max_character, cost_help_coma, cost_max_characteristics, number_max_free_action) VALUES
(91001, 9002, 300, 3, 20, 1, 4, 2, 2, 3),
(91002, 9002, 301, 5, 12, 1, 4, 3, 3, 1),
(91003, 9002, 302, 8, 8,  2, 3, 5, 5, 0);

-- ── Classes ─────────────────────────────────────────────────────
INSERT INTO list_classes (id, id_story, id_text_name, id_text_description, weight_max, dexterity_base, intelligence_base, constitution_base) VALUES
(91001, 9002, 200, 200, 12, 3, 2, 4),   -- Knight
(91002, 9002, 201, 201, 6,  1, 5, 2),   -- Cleric
(91003, 9002, 202, 202, 10, 2, 4, 2),   -- Merchant
(91004, 9002, 203, 203, 8,  5, 2, 2);   -- Scout

-- ── Classes Bonus ───────────────────────────────────────────────
INSERT INTO list_classes_bonus (id, id_story, id_class, statistic, value) VALUES
(91001, 9002, 91001, 'life',   5),
(91002, 9002, 91001, 'dex',    2),
(91003, 9002, 91001, 'energy', 3),
(91004, 9002, 91002, 'int',    4),
(91005, 9002, 91002, 'sad',   -3),
(91006, 9002, 91002, 'energy', 2),
(91007, 9002, 91003, 'coin',  10),
(91008, 9002, 91003, 'int',    2),
(91009, 9002, 91003, 'energy', 3),
(91010, 9002, 91004, 'dex',    4),
(91011, 9002, 91004, 'energy', 4),
(91012, 9002, 91004, 'life',   2);

-- ── Traits ──────────────────────────────────────────────────────
INSERT INTO list_traits (id, id_story, id_text_name, id_text_description, cost_positive, cost_negative) VALUES
(91001, 9002, 700, 700, 3, 0),
(91002, 9002, 701, 701, 2, 0),
(91003, 9002, 702, 702, 2, 0);

-- ── Character Templates ─────────────────────────────────────────
INSERT INTO list_character_templates (id_tipo, id_story, id_text_name, id_text_description, life_max, energy_max, sad_max, dexterity_start, intelligence_start, constitution_start) VALUES
(91001, 9002, 210, 210, 12, 10, 8,  3, 3, 4),
(91002, 9002, 211, 211, 8,  8,  6,  1, 5, 2),
(91003, 9002, 212, 212, 14, 12, 10, 4, 1, 5);

-- ── Keys ────────────────────────────────────────────────────────
INSERT INTO list_keys (id, id_story, name, value, id_text_description, "group", priority, visibility) VALUES
(91001, 9002, 'monastery_records', 'false', 950, 'evidence',  1, 'PUBLIC'),
(91002, 9002, 'monk_testimony',    'false', 951, 'evidence',  2, 'PUBLIC'),
(91003, 9002, 'countess_letter',   'false', 952, 'diplomacy', 3, 'PUBLIC');

-- ── Locations (12) ─────────────────────────────────────────────
INSERT INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, cost_energy_enter, max_characters) VALUES
(91001, 9002, 100, 100, 1, 0, 10),   -- Castelfranco Veneto (start)
(91002, 9002, 101, 101, 1, 1, 15),   -- Treviso
(91003, 9002, 102, 102, 1, 1, 20),   -- Padova
(91004, 9002, 103, 103, 0, 2, 8),    -- Bassano del Grappa
(91005, 9002, 104, 104, 1, 1, 6),    -- Asolo
(91006, 9002, 105, 105, 1, 1, 10),   -- Cittadella
(91007, 9002, 106, 106, 0, 2, 4),    -- Monastero di Campese
(91008, 9002, 107, 107, 0, 2, 6),    -- Marostica
(91009, 9002, 108, 108, 0, 2, 4),    -- Paludi del Sile
(91010, 9002, 109, 109, 0, 2, 12),   -- Vicenza
(91011, 9002, 110, 110, 0, 2, 6),    -- Bosco del Montello
(91012, 9002, 111, 111, 1, 0, 8);    -- Ponte di Piave

-- ── Location Neighbors ──────────────────────────────────────────
INSERT INTO list_locations_neighbors (id, id_story, id_location_from, id_location_to, direction, flag_back, energy_cost) VALUES
(91001, 9002, 91001, 91002, 'EAST',  1, 1),   -- Castelfranco ↔ Treviso
(91002, 9002, 91001, 91006, 'WEST',  1, 1),   -- Castelfranco ↔ Cittadella
(91003, 9002, 91001, 91005, 'NORTH', 1, 1),   -- Castelfranco ↔ Asolo
(91004, 9002, 91002, 91003, 'SOUTH', 1, 2),   -- Treviso ↔ Padova
(91005, 9002, 91002, 91009, 'EAST',  1, 1),   -- Treviso ↔ Paludi del Sile
(91006, 9002, 91002, 91012, 'NORTH', 1, 1),   -- Treviso ↔ Ponte di Piave
(91007, 9002, 91005, 91004, 'NORTH', 1, 2),   -- Asolo ↔ Bassano del Grappa
(91008, 9002, 91004, 91007, 'EAST',  1, 1),   -- Bassano ↔ Monastero di Campese
(91009, 9002, 91004, 91008, 'SOUTH', 1, 1),   -- Bassano ↔ Marostica
(91010, 9002, 91006, 91003, 'SOUTH', 1, 1),   -- Cittadella ↔ Padova
(91011, 9002, 91003, 91010, 'WEST',  1, 2),   -- Padova ↔ Vicenza
(91012, 9002, 91012, 91011, 'WEST',  1, 1);   -- Ponte di Piave ↔ Bosco del Montello

-- ── Items ───────────────────────────────────────────────────────
INSERT INTO list_items (id, id_story, id_text_name, id_text_description, weight, is_consumabile) VALUES
(91001, 9002, 400, 400, 1, 1),  -- Bread and Cheese
(91002, 9002, 401, 401, 1, 0),  -- Sealed Letter
(91003, 9002, 402, 402, 2, 0),  -- Monastery Records
(91004, 9002, 403, 403, 1, 1),  -- Healing Herbs
(91005, 9002, 404, 404, 1, 1);  -- Silver Coins

-- ── Item Effects ────────────────────────────────────────────────
INSERT INTO list_items_effects (id, id_story, id_item, effect_code, effect_value) VALUES
(91001, 9002, 91001, 'ENERGY',  3),
(91002, 9002, 91001, 'LIFE',    1),
(91003, 9002, 91004, 'LIFE',    4),
(91004, 9002, 91004, 'SAD',    -2),
(91005, 9002, 91005, 'COIN',    5);

-- ── Weather Rules ───────────────────────────────────────────────
INSERT INTO list_weather_rules (id, id_story, id_text_name, id_text_description, probability, cost_move_safe_location, cost_move_not_safe_location, active, priority, delta_energy) VALUES
(91001, 9002, 800, 800, 40, 0, 0, 1, 1,  0),   -- Autumn Sun
(91002, 9002, 801, 801, 35, 0, 1, 1, 2,  0),   -- Fog
(91003, 9002, 802, 802, 25, 1, 2, 1, 3, -1);   -- Storm

-- ── Events ──────────────────────────────────────────────────────
INSERT INTO list_events (id, id_story, id_text_name, id_text_description, type, cost_enery, flag_end_time) VALUES
(91001, 9002, 500, 500, 'NORMAL',    2, 0),  -- Bandit Ambush
(91002, 9002, 501, 501, 'NORMAL',    1, 0),  -- The Accuser's Spy
(91003, 9002, 502, 502, 'FIRST',     0, 0),  -- The Monk's Testimony
(91004, 9002, 503, 503, 'NORMAL',    1, 0),  -- Audience with the Countess
(91005, 9002, 504, 504, 'AUTOMATIC', 0, 1);  -- The Trial of Martino (end)

-- ── Event Effects ───────────────────────────────────────────────
INSERT INTO list_events_effects (id, id_story, id_event, statistics, value, target) VALUES
(91001, 9002, 91001, 'life',   -3, 'ALL'),          -- Bandit ambush: life damage
(91002, 9002, 91001, 'energy', -1, 'ALL'),          -- Bandit ambush: energy drain
(91003, 9002, 91001, 'exp',     4, 'ALL'),          -- Bandit ambush: XP reward
(91004, 9002, 91002, 'sad',     3, 'ONLY_ONE'),     -- Spy: increases sadness
(91005, 9002, 91002, 'exp',     3, 'ALL'),          -- Spy: XP
(91006, 9002, 91003, 'exp',     8, 'ALL'),          -- Monk testimony: major XP
(91007, 9002, 91004, 'sad',    -3, 'ALL'),          -- Countess: reduces sadness
(91008, 9002, 91004, 'exp',     5, 'ALL'),          -- Countess: XP
(91009, 9002, 91005, 'exp',    25, 'ALL');           -- Trial: massive XP

-- ── Choices ─────────────────────────────────────────────────────
INSERT INTO list_choices (id, id_story, id_event, priority, id_text_name, id_text_description, otherwise_flag, is_progress, logic_operator) VALUES
(91001, 9002, 91001, 1, 600, 600, 0, 0, 'AND'),    -- Fight bandits
(91002, 9002, 91001, 2, 601, 601, 0, 0, 'AND'),    -- Pay toll
(91003, 9002, 91005, 1, 602, 602, 0, 1, 'AND'),    -- Present monastery records
(91004, 9002, 91005, 2, 603, 603, 0, 1, 'AND'),    -- Call Brother Giacomo
(91005, 9002, 91005, 3, 604, 604, 1, 0, 'AND');    -- Plead mercy (otherwise)

-- ── Choice Conditions ───────────────────────────────────────────
INSERT INTO list_choices_conditions (id, id_story, id_choices, type, key, value, operator) VALUES
(91001, 9002, 91001, 'statistics', 'dex',               '3', '>'),    -- Fight: needs DEX > 3
(91002, 9002, 91003, 'KEYS',       'monastery_records', 'true', '='), -- Present records: must have them
(91003, 9002, 91004, 'KEYS',       'monk_testimony',    'true', '='); -- Call monk: must have testimony

-- ── Choice Effects ──────────────────────────────────────────────
INSERT INTO list_choices_effects (id, id_story, id_choices, statistics, value, key, value_to_add) VALUES
(91001, 9002, 91001, 'energy', -3, NULL, NULL),                              -- Fight: costs energy
(91002, 9002, 91002, 'coin',   -5, NULL, NULL),                              -- Pay: costs coins
(91003, 9002, 91003, 'exp',    20, 'trial_result', 'records_presented'),     -- Present records
(91004, 9002, 91004, 'exp',    20, 'trial_result', 'monk_testified'),        -- Monk testifies
(91005, 9002, 91005, 'exp',     5, 'trial_result', 'mercy_plea');            -- Plead mercy

-- ── Global Random Events ────────────────────────────────────────
INSERT INTO list_global_random_events (id, id_story, condition_key, condition_value, probability) VALUES
(91001, 9002, NULL,              NULL,    15),   -- Random bandits anywhere
(91002, 9002, 'monk_testimony', 'false',  20),   -- Spy events while monk not found
(91003, 9002, NULL,              NULL,    10);   -- Minor random encounters

-- ── Missions ────────────────────────────────────────────────────
INSERT INTO list_missions (id, id_story, condition_key, condition_value_from, condition_value_to, id_text_name, id_text_description) VALUES
(91001, 9002, 'trial_result',      NULL, 'records_presented', 900, 900),
(91002, 9002, 'monastery_records', NULL, 'true',              901, 901),
(91003, 9002, 'escort_secured',    NULL, 'true',              902, 902);

-- ── Mission Steps ───────────────────────────────────────────────
INSERT INTO list_missions_steps (id, id_story, id_mission, step, condition_key, condition_value_from, condition_value_to, id_text_name, id_text_description) VALUES
(91001, 9002, 91001, 1, 'visited_monastery', NULL,  'true',              910, 910),
(91002, 9002, 91001, 2, 'monk_found',        NULL,  'true',              911, 911),
(91003, 9002, 91001, 3, 'trial_result',      NULL,  'records_presented', 912, 912),
(91004, 9002, 91002, 1, 'met_anselmo',       NULL,  'true',              920, 920),
(91005, 9002, 91002, 2, 'monk_testimony',    NULL,  'true',              921, 921),
(91006, 9002, 91003, 1, 'soldiers_recruited', NULL, 'true',              930, 930),
(91007, 9002, 91003, 2, 'road_cleared',      NULL,  'true',              931, 931);

-- ── Creator ─────────────────────────────────────────────────────
INSERT INTO list_creator (id, id_story, link, url, url_image) VALUES
(91001, 9002, 'PathsMaster', 'https://paths.games', 'https://paths.games/assets/logo.png');

-- ── Cards ───────────────────────────────────────────────────────
INSERT INTO list_cards (id, id_story, url_immage, awesome_icon, style_main) VALUES
(91001, 9002, NULL, 'fas fa-chess-rook',    'medieval'),
(91002, 9002, NULL, 'fas fa-scroll',        'evidence'),
(91003, 9002, NULL, 'fas fa-balance-scale', 'justice');

-- =============================================
-- END OF STORY SEED DATA
-- =============================================
