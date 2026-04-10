-- =============================================
-- Paths Games - Repeatable Migration
-- Story Seed Data (SQLite) — Two complete stories
-- Story 1: "The Witcher — The Curse of Oxenfurt" (inspired by The Witcher)
-- Story 2: "Grand Line Adventures" (inspired by One Piece)
-- =============================================
-- This file is re-executed whenever its content changes.
-- NEVER include this in production deployments.
-- =============================================
-- (C) Paths Games 2042 - All rights reserved
-- =============================================

-- =============================================
-- Clean previous story seed data (id_story 9001, 9002)
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
-- #    STORY 1: THE WITCHER — THE CURSE OF OXENFURT                           #
-- #    id_story = 9001, IDs 90001–90999                                       #
-- #                                                                           #
-- #############################################################################

INSERT INTO list_stories (id, uuid, author, version_min, clock_singular_description, clock_plural_description,
    category, "group", visibility, priority, peghi, id_text_title, id_text_description)
VALUES (9001, 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'PathsMaster', '0.14.0', 'hour', 'hours',
    'dark_fantasy', 'main', 'PUBLIC', 10, 5, 1, 2);

-- ── Texts ───────────────────────────────────────────────────────
INSERT INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(90001, 9001, 1, 'en', 'The Curse of Oxenfurt', 'A dark mystery haunts the city of Oxenfurt. The renowned academy has been plagued by a series of disappearances, and whispers of an ancient curse spread through the cobblestone streets. Only a witcher — a mutant monster hunter — can unravel the truth behind these vanishings.'),
(90002, 9001, 1, 'it', 'La Maledizione di Oxenfurt', 'Un oscuro mistero perseguita la città di Oxenfurt. La rinomata accademia è stata funestata da una serie di sparizioni, e sussurri di un''antica maledizione si diffondono per le strade acciottolate. Solo un witcher — un cacciatore di mostri mutante — può svelare la verità dietro queste sparizioni.'),
(90003, 9001, 2, 'en', 'The Curse of Oxenfurt', 'Investigate the disappearances in Oxenfurt, brew potions, fight monsters, and decide the fate of those cursed by dark magic. Every choice carries consequences.'),
(90004, 9001, 2, 'it', 'La Maledizione di Oxenfurt', 'Indaga sulle sparizioni a Oxenfurt, prepara pozioni, combatti mostri e decidi il destino dei maledetti dalla magia oscura. Ogni scelta ha le sue conseguenze.'),
-- Location texts
(90005, 9001, 100, 'en', 'Oxenfurt Gates', 'The imposing stone gates of Oxenfurt, adorned with the crest of the academy. Guards eye you suspiciously as you approach.'),
(90006, 9001, 100, 'it', 'Porte di Oxenfurt', 'Le imponenti porte di pietra di Oxenfurt, adornate dallo stemma dell''accademia. Le guardie ti guardano con sospetto mentre ti avvicini.'),
(90007, 9001, 101, 'en', 'The Academy', 'The heart of Oxenfurt — a grand complex of libraries, lecture halls, and alchemical laboratories. Scholars hurry between buildings, whispering about recent events.'),
(90008, 9001, 101, 'it', 'L''Accademia', 'Il cuore di Oxenfurt — un grande complesso di biblioteche, aule e laboratori alchemici. Gli studiosi si affrettano tra gli edifici, sussurrando degli eventi recenti.'),
(90009, 9001, 102, 'en', 'The Alchemy Quarter', 'Colorful smoke rises from chimneys of herbalist shops and alchemists'' workshops. The air is thick with the scent of strange ingredients.'),
(90010, 9001, 102, 'it', 'Il Quartiere dell''Alchimia', 'Fumo colorato si alza dai camini di erboristerie e laboratori alchemici. L''aria è densa del profumo di strani ingredienti.'),
(90011, 9001, 103, 'en', 'The Sewers', 'Dark, fetid tunnels beneath the city. Rats scatter as you light your torch. Something larger lurks in the shadows.'),
(90012, 9001, 103, 'it', 'Le Fogne', 'Tunnel bui e fetidi sotto la città. I topi si disperdono quando accendi la torcia. Qualcosa di più grande si annida nelle ombre.'),
(90013, 9001, 104, 'en', 'The Hanged Man Tavern', 'A smoky tavern where mercenaries, spies, and scholars drink side by side. Information flows as freely as the ale.'),
(90014, 9001, 104, 'it', 'La Taverna dell''Impiccato', 'Una taverna fumosa dove mercenari, spie e studiosi bevono fianco a fianco. Le informazioni scorrono liberamente come la birra.'),
(90015, 9001, 105, 'en', 'The Cemetery', 'An ancient graveyard on the city outskirts. Several graves have been disturbed recently, the earth turned as if something clawed its way out.'),
(90016, 9001, 105, 'it', 'Il Cimitero', 'Un antico cimitero alla periferia della città. Diverse tombe sono state disturbate di recente, la terra rivoltata come se qualcosa si fosse fatto strada verso l''esterno.'),
(90017, 9001, 106, 'en', 'The Abandoned Manor', 'A crumbling estate on the hill overlooking Oxenfurt. Locals say it has been cursed for generations. Strange lights flicker in its windows at night.'),
(90018, 9001, 106, 'it', 'Il Maniero Abbandonato', 'Una tenuta fatiscente sulla collina che domina Oxenfurt. La gente del posto dice che è maledetta da generazioni. Strane luci tremolano alle finestre di notte.'),
(90019, 9001, 107, 'en', 'The River Docks', 'Wooden piers stretch into the Pontar river. Fishermen mend their nets while merchants unload exotic wares from distant lands.'),
(90020, 9001, 107, 'it', 'I Moli Fluviali', 'Moli di legno si protendono nel fiume Pontar. I pescatori riparano le reti mentre i mercanti scaricano merci esotiche da terre lontane.'),
(90021, 9001, 108, 'en', 'The Forest of Whispers', 'An ancient woodland where the trees seem to watch you. Elven ruins dot the undergrowth, and the wind carries distant voices.'),
(90022, 9001, 108, 'it', 'La Foresta dei Sussurri', 'Un bosco antico dove gli alberi sembrano osservarti. Rovine elfiche punteggiano il sottobosco e il vento trasporta voci lontane.'),
(90023, 9001, 109, 'en', 'The Witch''s Hut', 'A crooked cottage deep in the forest, surrounded by herb gardens and totems. The hedge-witch who lives here knows secrets others have forgotten.'),
(90024, 9001, 109, 'it', 'La Capanna della Strega', 'Una capanna storta nel profondo della foresta, circondata da giardini di erbe e totem. La strega che vive qui conosce segreti che gli altri hanno dimenticato.'),
(90025, 9001, 110, 'en', 'The Cursed Crypt', 'Ancient catacombs beneath the abandoned manor. The walls are carved with forgotten runes, and a cold magical presence fills the air.'),
(90026, 9001, 110, 'it', 'La Cripta Maledetta', 'Antiche catacombe sotto il maniero abbandonato. Le pareti sono scolpite con rune dimenticate e una fredda presenza magica riempie l''aria.'),
(90027, 9001, 111, 'en', 'The Market Square', 'The bustling commercial heart of Oxenfurt. Stalls sell everything from bread to rare manuscripts. A notice board stands at the center, covered in contracts.'),
(90028, 9001, 111, 'it', 'La Piazza del Mercato', 'Il vivace cuore commerciale di Oxenfurt. Le bancarelle vendono di tutto, dal pane ai manoscritti rari. Una bacheca si erge al centro, coperta di contratti.'),
-- Class texts
(90029, 9001, 200, 'en', 'Witcher', 'A mutant monster hunter trained from childhood in the art of combat, alchemy, and magic signs.'),
(90030, 9001, 200, 'it', 'Witcher', 'Un cacciatore di mostri mutante addestrato fin dall''infanzia nell''arte del combattimento, dell''alchimia e dei segni magici.'),
(90031, 9001, 201, 'en', 'Sorceress', 'A wielder of powerful magic, trained at Aretuza. Masters of elemental forces and illusion.'),
(90032, 9001, 201, 'it', 'Maga', 'Una utilizzatrice di magia potente, addestrata ad Aretuza. Maestra delle forze elementali e dell''illusione.'),
(90033, 9001, 202, 'en', 'Bard', 'A wandering poet and musician. What bards lack in combat prowess, they make up for in charm and cunning.'),
(90034, 9001, 202, 'it', 'Bardo', 'Un poeta e musicista errante. Ciò che i bardi mancano in abilità combattive lo compensano con fascino e astuzia.'),
-- Difficulty texts
(90035, 9001, 300, 'en', 'Just the Story', 'Reduced combat difficulty, more resources. Ideal for those who want to enjoy the narrative.'),
(90036, 9001, 300, 'it', 'Solo la Storia', 'Difficoltà di combattimento ridotta, più risorse. Ideale per chi vuole godersi la narrativa.'),
(90037, 9001, 301, 'en', 'Blood and Broken Bones', 'The standard witcher experience. Monsters hit hard, potions are essential.'),
(90038, 9001, 301, 'it', 'Sangue e Ossa Rotte', 'L''esperienza standard del witcher. I mostri colpiscono duro, le pozioni sono essenziali.'),
(90039, 9001, 302, 'en', 'Death March', 'Extreme difficulty. Every encounter can kill you. Only for veteran witchers.'),
(90040, 9001, 302, 'it', 'Marcia della Morte', 'Difficoltà estrema. Ogni incontro può ucciderti. Solo per witcher veterani.'),
-- Item texts
(90041, 9001, 400, 'en', 'Swallow Potion', 'A green potion that rapidly restores vitality. A witcher''s most trusted companion.'),
(90042, 9001, 400, 'it', 'Pozione Rondine', 'Una pozione verde che ripristina rapidamente la vitalità. Il compagno più fidato di un witcher.'),
(90043, 9001, 401, 'en', 'Silver Sword', 'A blade forged with silver — deadly against supernatural creatures, cursed beings, and specters.'),
(90044, 9001, 401, 'it', 'Spada d''Argento', 'Una lama forgiata in argento — letale contro creature soprannaturali, esseri maledetti e spettri.'),
(90045, 9001, 402, 'en', 'Thunderbolt Potion', 'A potent battle stimulant. Temporarily increases combat prowess but is toxic in high doses.'),
(90046, 9001, 402, 'it', 'Pozione Fulmine', 'Un potente stimolante da battaglia. Aumenta temporaneamente l''abilità combattiva ma è tossica in dosi elevate.'),
(90047, 9001, 403, 'en', 'Moon Dust Bomb', 'A silver-infused bomb that prevents shapeshifters from transforming and weakens wraiths.'),
(90048, 9001, 403, 'it', 'Bomba Polvere di Luna', 'Una bomba al''argento che impedisce ai mutaforma di trasformarsi e indebolisce gli spettri.'),
(90049, 9001, 404, 'en', 'Ancient Amulet', 'A mysterious medallion pulsing with faint magical energy. It reacts to the presence of curses.'),
(90050, 9001, 404, 'it', 'Amuleto Antico', 'Un misterioso medaglione che pulsa di una debole energia magica. Reagisce alla presenza di maledizioni.'),
-- Event texts
(90051, 9001, 500, 'en', 'Drowner Attack', 'Bloated corpse-creatures emerge from the water, claws outstretched and jaws agape!'),
(90052, 9001, 500, 'it', 'Attacco dei Drowner', 'Creature-cadavere gonfie emergono dall''acqua, con artigli protesi e fauci spalancate!'),
(90053, 9001, 501, 'en', 'The Scholar''s Warning', 'A terrified professor pulls you aside and tells you of strange symbols appearing on dormitory walls.'),
(90054, 9001, 501, 'it', 'L''Avvertimento dello Studioso', 'Un professore terrorizzato ti prende da parte e ti parla di strani simboli apparsi sui muri dei dormitori.'),
(90055, 9001, 502, 'en', 'Wraith Manifestation', 'The temperature drops. A translucent figure materializes, its wail cutting through the silence.'),
(90056, 9001, 502, 'it', 'Manifestazione dello Spettro', 'La temperatura cala. Una figura traslucida si materializza, il suo lamento squarcia il silenzio.'),
(90057, 9001, 503, 'en', 'The Alchemist''s Offer', 'An old alchemist offers to brew powerful potions for you — for a price.'),
(90058, 9001, 503, 'it', 'L''Offerta dell''Alchimista', 'Un vecchio alchimista si offre di prepararti pozioni potenti — a un prezzo.'),
(90059, 9001, 504, 'en', 'The Curse Revealed', 'You discover the source of the curse — a betrayed mage whose spirit was bound to the manor centuries ago.'),
(90060, 9001, 504, 'it', 'La Maledizione Rivelata', 'Scopri la fonte della maledizione — un mago tradito il cui spirito fu legato al maniero secoli fa.'),
-- Choice texts
(90061, 9001, 600, 'en', 'Fight the Drowners', 'Draw your sword and engage the creatures in combat.'),
(90062, 9001, 600, 'it', 'Combatti i Drowner', 'Sfodera la spada e affronta le creature in combattimento.'),
(90063, 9001, 601, 'en', 'Use Igni Sign', 'Channel the fire sign to burn the creatures before they close in.'),
(90064, 9001, 601, 'it', 'Usa il Segno Igni', 'Canalizza il segno del fuoco per bruciare le creature prima che si avvicinino.'),
(90065, 9001, 602, 'en', 'Investigate the Symbols', 'Study the arcane symbols on the walls to understand the curse.'),
(90066, 9001, 602, 'it', 'Indaga sui Simboli', 'Studia i simboli arcani sui muri per comprendere la maledizione.'),
(90067, 9001, 603, 'en', 'Lift the Curse', 'Perform the ritual to free the mage''s spirit and end the curse.'),
(90068, 9001, 603, 'it', 'Rimuovi la Maledizione', 'Esegui il rituale per liberare lo spirito del mago e porre fine alla maledizione.'),
(90069, 9001, 604, 'en', 'Destroy the Spirit', 'Use your silver sword and moon dust to banish the wraith permanently.'),
(90070, 9001, 604, 'it', 'Distruggi lo Spirito', 'Usa la spada d''argento e la polvere di luna per bandire lo spettro permanentemente.'),
-- Trait texts
(90071, 9001, 700, 'en', 'Cat Eyes', 'Enhanced night vision from witcher mutations. See clearly in the darkest dungeons.'),
(90072, 9001, 700, 'it', 'Occhi di Gatto', 'Visione notturna migliorata dalle mutazioni del witcher. Vedi chiaramente nei dungeon più bui.'),
(90073, 9001, 701, 'en', 'Silver Tongue', 'A gift for persuasion. Talk your way out of trouble or into locked rooms.'),
(90074, 9001, 701, 'it', 'Lingua d''Argento', 'Un dono per la persuasione. Parla per uscire dai guai o entrare in stanze chiuse.'),
(90075, 9001, 702, 'en', 'Alchemy Mastery', 'Deep knowledge of potions and decoctions. Craft superior alchemical concoctions.'),
(90076, 9001, 702, 'it', 'Maestria in Alchimia', 'Profonda conoscenza di pozioni e decotti. Crea miscugli alchemici superiori.'),
-- Weather texts
(90077, 9001, 800, 'en', 'Thunderstorm', 'Lightning splits the sky. Rain hammers the streets, driving most inside.'),
(90078, 9001, 800, 'it', 'Temporale', 'I fulmini squarciano il cielo. La pioggia martella le strade, costringendo quasi tutti a ripararsi.'),
(90079, 9001, 801, 'en', 'Fog', 'Thick mist rolls in from the river, reducing visibility. Monsters may be closer than you think.'),
(90080, 9001, 801, 'it', 'Nebbia', 'Una fitta nebbia arriva dal fiume, riducendo la visibilità. I mostri potrebbero essere più vicini di quanto pensi.'),
(90081, 9001, 802, 'en', 'Blood Moon', 'The moon glows red. Cursed creatures grow stronger and more aggressive.'),
(90082, 9001, 802, 'it', 'Luna di Sangue', 'La luna risplende di rosso. Le creature maledette diventano più forti e aggressive.'),
-- Mission texts
(90083, 9001, 900, 'en', 'The Missing Students', 'Find the three students who vanished from the academy dormitories.'),
(90084, 9001, 900, 'it', 'Gli Studenti Scomparsi', 'Trova i tre studenti scomparsi dai dormitori dell''accademia.'),
(90085, 9001, 901, 'en', 'The Alchemist''s Debt', 'Help the old alchemist collect rare ingredients from the forest and sewers.'),
(90086, 9001, 901, 'it', 'Il Debito dell''Alchimista', 'Aiuta il vecchio alchimista a raccogliere ingredienti rari dalla foresta e dalle fogne.'),
(90087, 9001, 902, 'en', 'Break the Curse', 'Discover the origin of the curse and find a way to lift it — or destroy it.'),
(90088, 9001, 902, 'it', 'Spezza la Maledizione', 'Scopri l''origine della maledizione e trova un modo per rimuoverla — o distruggerla.'),
-- Mission step texts
(90089, 9001, 910, 'en', 'Investigate the Academy', 'Search the academy for clues about the disappearances.'),
(90090, 9001, 911, 'en', 'Search the Sewers', 'Explore the tunnels below the academy looking for traces of the students.'),
(90091, 9001, 912, 'en', 'Confront the Creature', 'Track and confront whatever took the students.'),
(90092, 9001, 920, 'en', 'Collect Drowner Brains', 'Gather alchemical ingredients from drowners near the river.'),
(90093, 9001, 921, 'en', 'Find Specter Dust', 'Collect ectoplasm from the wraith in the cursed crypt.'),
(90094, 9001, 930, 'en', 'Find the Manor''s Secret', 'Search the abandoned manor for the curse''s origin.'),
(90095, 9001, 931, 'en', 'Perform the Ritual', 'Gather the components and perform the counter-curse ritual.'),
-- Character template texts
(90096, 9001, 210, 'en', 'Wolf School Witcher', 'A witcher of the Wolf School — balanced in combat, signs, and alchemy.'),
(90097, 9001, 211, 'en', 'Cat School Witcher', 'A witcher of the Cat School — agile and deadly, favoring speed over brute force.'),
(90098, 9001, 212, 'en', 'Bear School Witcher', 'A witcher of the Bear School — tough and resilient, built to endure punishment.'),
-- Key texts
(90099, 9001, 950, 'en', 'Academy Key', 'A brass key that opens the restricted wing of the Oxenfurt Academy.'),
(90100, 9001, 951, 'en', 'Crypt Seal', 'An ancient wax seal that must be broken to enter the cursed crypt.'),
(90101, 9001, 952, 'en', 'Witch''s Mark', 'A magical brand left by the hedge-witch. Shows you have her trust.');

-- ── Difficulties ────────────────────────────────────────────────
INSERT INTO list_stories_difficulty (id, id_story, id_text_description, exp_cost, max_weight, min_character, max_character, cost_help_coma, cost_max_characteristics, number_max_free_action) VALUES
(90001, 9001, 300, 3, 15, 1, 4, 2, 2, 2),
(90002, 9001, 301, 5, 10, 1, 4, 3, 3, 1),
(90003, 9001, 302, 8, 7, 2, 3, 5, 5, 0);

-- ── Classes ─────────────────────────────────────────────────────
INSERT INTO list_classes (id, id_story, id_text_name, id_text_description, weight_max, dexterity_base, intelligence_base, constitution_base) VALUES
(90001, 9001, 200, 200, 12, 3, 2, 3),
(90002, 9001, 201, 201, 8,  1, 5, 2),
(90003, 9001, 202, 202, 6,  2, 3, 1);

-- ── Classes Bonus ───────────────────────────────────────────────
INSERT INTO list_classes_bonus (id, id_story, id_class, statistic, value) VALUES
(90001, 9001, 90001, 'life',   5),
(90002, 9001, 90001, 'energy', 3),
(90003, 9001, 90001, 'dex',    2),
(90004, 9001, 90002, 'magic',  8),
(90005, 9001, 90002, 'int',    3),
(90006, 9001, 90002, 'energy', 5),
(90007, 9001, 90003, 'coin',   10),
(90008, 9001, 90003, 'sad',   -3),
(90009, 9001, 90003, 'int',    2);

-- ── Traits ──────────────────────────────────────────────────────
INSERT INTO list_traits (id, id_story, id_text_name, id_text_description, cost_positive, cost_negative) VALUES
(90001, 9001, 700, 700, 3, 0),
(90002, 9001, 701, 701, 2, 0),
(90003, 9001, 702, 702, 4, 0);

-- ── Character Templates ─────────────────────────────────────────
INSERT INTO list_character_templates (id_tipo, id_story, id_text_name, id_text_description, life_max, energy_max, sad_max, dexterity_start, intelligence_start, constitution_start) VALUES
(90001, 9001, 210, 210, 12, 10, 8, 3, 2, 3),
(90002, 9001, 211, 211, 10, 12, 6, 5, 2, 2),
(90003, 9001, 212, 212, 15, 8, 10, 2, 1, 5);

-- ── Keys ────────────────────────────────────────────────────────
INSERT INTO list_keys (id, id_story, name, value, id_text_description, "group", priority, visibility) VALUES
(90001, 9001, 'academy_key',  'false', 950, 'items',   1, 'PUBLIC'),
(90002, 9001, 'crypt_sealed', 'true',  951, 'quest',   2, 'PUBLIC'),
(90003, 9001, 'witch_trust',  'false', 952, 'faction', 3, 'PUBLIC');

-- ── Locations (12) ─────────────────────────────────────────────
INSERT INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, cost_energy_enter, max_characters) VALUES
(90001, 9001, 100, 100, 1, 0, 10),   -- Oxenfurt Gates
(90002, 9001, 101, 101, 1, 0, 20),   -- Academy
(90003, 9001, 102, 102, 1, 1, 8),    -- Alchemy Quarter
(90004, 9001, 103, 103, 0, 2, 4),    -- Sewers
(90005, 9001, 104, 104, 1, 0, 15),   -- Hanged Man Tavern
(90006, 9001, 105, 105, 0, 1, 6),    -- Cemetery
(90007, 9001, 106, 106, 0, 2, 4),    -- Abandoned Manor
(90008, 9001, 107, 107, 1, 0, 10),   -- River Docks
(90009, 9001, 108, 108, 0, 2, 6),    -- Forest of Whispers
(90010, 9001, 109, 109, 1, 1, 3),    -- Witch's Hut
(90011, 9001, 110, 110, 0, 3, 4),    -- Cursed Crypt
(90012, 9001, 111, 111, 1, 0, 20);   -- Market Square

-- ── Location Neighbors ──────────────────────────────────────────
INSERT INTO list_locations_neighbors (id, id_story, id_location_from, id_location_to, direction, flag_back, energy_cost) VALUES
(90001, 9001, 90001, 90012, 'NORTH', 1, 0),  -- Gates ↔ Market Square
(90002, 9001, 90012, 90002, 'NORTH', 1, 0),  -- Market ↔ Academy
(90003, 9001, 90012, 90005, 'EAST',  1, 0),  -- Market ↔ Tavern
(90004, 9001, 90012, 90003, 'WEST',  1, 0),  -- Market ↔ Alchemy Quarter
(90005, 9001, 90002, 90004, 'BELOW', 1, 1),  -- Academy ↔ Sewers
(90006, 9001, 90001, 90008, 'EAST',  1, 0),  -- Gates ↔ River Docks
(90007, 9001, 90001, 90006, 'WEST',  1, 1),  -- Gates ↔ Cemetery
(90008, 9001, 90006, 90007, 'NORTH', 1, 1),  -- Cemetery ↔ Abandoned Manor
(90009, 9001, 90007, 90011, 'BELOW', 1, 2),  -- Manor ↔ Cursed Crypt
(90010, 9001, 90008, 90009, 'SOUTH', 1, 1),  -- River Docks ↔ Forest
(90011, 9001, 90009, 90010, 'EAST',  1, 1),  -- Forest ↔ Witch's Hut
(90012, 9001, 90004, 90008, 'EAST',  1, 1);  -- Sewers ↔ River Docks

-- ── Items ───────────────────────────────────────────────────────
INSERT INTO list_items (id, id_story, id_text_name, id_text_description, weight, is_consumabile) VALUES
(90001, 9001, 400, 400, 1, 1),  -- Swallow Potion
(90002, 9001, 401, 401, 3, 0),  -- Silver Sword
(90003, 9001, 402, 402, 1, 1),  -- Thunderbolt Potion
(90004, 9001, 403, 403, 1, 1),  -- Moon Dust Bomb
(90005, 9001, 404, 404, 1, 0);  -- Ancient Amulet

-- ── Item Effects ────────────────────────────────────────────────
INSERT INTO list_items_effects (id, id_story, id_item, effect_code, effect_value) VALUES
(90001, 9001, 90001, 'LIFE',   5),
(90002, 9001, 90001, 'ENERGY', 2),
(90003, 9001, 90003, 'DEX',    3),
(90004, 9001, 90003, 'ENERGY',-2),
(90005, 9001, 90004, 'MAGIC',  2);

-- ── Weather Rules ───────────────────────────────────────────────
INSERT INTO list_weather_rules (id, id_story, id_text_name, id_text_description, probability, cost_move_safe_location, cost_move_not_safe_location, active, priority, delta_energy) VALUES
(90001, 9001, 800, 800, 20, 0, 1, 1, 1, -1),
(90002, 9001, 801, 801, 30, 0, 0, 1, 2,  0),
(90003, 9001, 802, 802, 10, 0, 2, 1, 3, -2);

-- ── Events ──────────────────────────────────────────────────────
INSERT INTO list_events (id, id_story, id_text_name, id_text_description, type, cost_enery, flag_end_time) VALUES
(90001, 9001, 500, 500, 'NORMAL',    2, 0),  -- Drowner Attack
(90002, 9001, 501, 501, 'FIRST',     0, 0),  -- Scholar's Warning
(90003, 9001, 502, 502, 'NORMAL',    3, 0),  -- Wraith Manifestation
(90004, 9001, 503, 503, 'NORMAL',    1, 0),  -- Alchemist's Offer
(90005, 9001, 504, 504, 'AUTOMATIC', 0, 1);  -- Curse Revealed (end)

-- ── Event Effects ───────────────────────────────────────────────
INSERT INTO list_events_effects (id, id_story, id_event, statistics, value, target) VALUES
(90001, 9001, 90001, 'life',   -3, 'ALL'),
(90002, 9001, 90001, 'energy', -1, 'ALL'),
(90003, 9001, 90001, 'exp',     5, 'ALL'),
(90004, 9001, 90003, 'life',   -5, 'ONLY_ONE'),
(90005, 9001, 90003, 'sad',     3, 'ALL'),
(90006, 9001, 90003, 'exp',     8, 'ALL'),
(90007, 9001, 90004, 'coin',   -5, 'ONLY_ONE'),
(90008, 9001, 90005, 'exp',    20, 'ALL');

-- ── Choices ─────────────────────────────────────────────────────
INSERT INTO list_choices (id, id_story, id_event, priority, id_text_name, id_text_description, otherwise_flag, is_progress, logic_operator) VALUES
(90001, 9001, 90001, 1, 600, 600, 0, 0, 'AND'),
(90002, 9001, 90001, 2, 601, 601, 0, 0, 'AND'),
(90003, 9001, 90002, 1, 602, 602, 0, 1, 'AND'),
(90004, 9001, 90005, 1, 603, 603, 0, 1, 'AND'),
(90005, 9001, 90005, 2, 604, 604, 0, 1, 'AND');

-- ── Choice Conditions ───────────────────────────────────────────
INSERT INTO list_choices_conditions (id, id_story, id_choices, type, key, value, operator) VALUES
(90001, 9001, 90002, 'CLASS',      NULL,           NULL,    '='),    -- Igni Sign: must be Witcher class
(90002, 9001, 90003, 'statistics', 'int',          '3',     '>'),    -- Investigate: needs INT > 3
(90003, 9001, 90004, 'KEYS',       'crypt_sealed', 'false', '=');    -- Lift Curse: crypt must be unsealed

-- ── Choice Effects ──────────────────────────────────────────────
INSERT INTO list_choices_effects (id, id_story, id_choices, statistics, value, key, value_to_add) VALUES
(90001, 9001, 90001, 'energy', -2, NULL, NULL),
(90002, 9001, 90002, 'energy', -3, NULL, NULL),
(90003, 9001, 90003, NULL,      0, 'symbols_found', 'true'),
(90004, 9001, 90004, 'exp',    25, 'curse_status', 'lifted'),
(90005, 9001, 90005, 'exp',    15, 'curse_status', 'destroyed');

-- ── Global Random Events ────────────────────────────────────────
INSERT INTO list_global_random_events (id, id_story, condition_key, condition_value, probability) VALUES
(90001, 9001, NULL,            NULL,    15),
(90002, 9001, 'curse_status',  NULL,    25),
(90003, 9001, 'time',          'night', 35);

-- ── Missions ────────────────────────────────────────────────────
INSERT INTO list_missions (id, id_story, condition_key, condition_value_from, condition_value_to, id_text_name, id_text_description) VALUES
(90001, 9001, 'students_found',  '0', '3', 900, 900),
(90002, 9001, 'alchemy_debt',    '0', '2', 901, 901),
(90003, 9001, 'curse_status',    NULL, 'lifted', 902, 902);

-- ── Mission Steps ───────────────────────────────────────────────
INSERT INTO list_missions_steps (id, id_story, id_mission, step, condition_key, condition_value_from, condition_value_to, id_text_name, id_text_description) VALUES
(90001, 9001, 90001, 1, 'academy_searched', NULL, 'true', 910, 910),
(90002, 9001, 90001, 2, 'sewers_explored',  NULL, 'true', 911, 911),
(90003, 9001, 90001, 3, 'students_found',   '0',  '3',    912, 912),
(90004, 9001, 90002, 1, 'drowner_brains',   '0',  '3',    920, 920),
(90005, 9001, 90002, 2, 'specter_dust',     '0',  '1',    921, 921),
(90006, 9001, 90003, 1, 'manor_searched',   NULL, 'true',  930, 930),
(90007, 9001, 90003, 2, 'ritual_performed', NULL, 'true',  931, 931);

-- ── Creator ─────────────────────────────────────────────────────
INSERT INTO list_creator (id, id_story, link, url, url_image) VALUES
(90001, 9001, 'PathsMaster', 'https://paths.games', 'https://paths.games/assets/logo.png');

-- ── Cards ───────────────────────────────────────────────────────
INSERT INTO list_cards (id, id_story, url_immage, awesome_icon, style_main) VALUES
(90001, 9001, NULL, 'fas fa-skull-crossbones', 'dark'),
(90002, 9001, NULL, 'fas fa-flask',            'alchemy'),
(90003, 9001, NULL, 'fas fa-ghost',            'cursed');


-- #############################################################################
-- #                                                                           #
-- #    STORY 2: GRAND LINE ADVENTURES (inspired by One Piece)                 #
-- #    id_story = 9002, IDs 91001–91999                                       #
-- #                                                                           #
-- #############################################################################

INSERT INTO list_stories (id, uuid, author, version_min, clock_singular_description, clock_plural_description,
    category, "group", visibility, priority, peghi, id_text_title, id_text_description)
VALUES (9002, 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'PathsMaster', '0.14.0', 'watch', 'watches',
    'adventure', 'main', 'PUBLIC', 9, 4, 1, 2);

-- ── Texts ───────────────────────────────────────────────────────
INSERT INTO list_texts (id, id_story, id_text, lang, short_text, long_text) VALUES
(91001, 9002, 1, 'en', 'Grand Line Adventures', 'Set sail across the Grand Line — the most dangerous and wondrous sea in the world! Assemble a crew, discover mysterious islands, battle marine captains, and search for the legendary treasure that will make you King of the Pirates.'),
(91002, 9002, 1, 'it', 'Avventure nella Rotta Maggiore', 'Salpa attraverso la Rotta Maggiore — il mare più pericoloso e meraviglioso del mondo! Assembla un equipaggio, scopri isole misteriose, combatti capitani della marina e cerca il leggendario tesoro che ti renderà il Re dei Pirati.'),
(91003, 9002, 2, 'en', 'Grand Line Adventures', 'Navigate treacherous waters, recruit allies, eat Devil Fruits, and fight your way to the New World. Your dream awaits at the end of the Grand Line!'),
(91004, 9002, 2, 'it', 'Avventure nella Rotta Maggiore', 'Naviga acque insidiose, recluta alleati, mangia Frutti del Diavolo e combatti fino al Nuovo Mondo. Il tuo sogno ti aspetta alla fine della Rotta Maggiore!'),
-- Location texts (12 islands/locations)
(91005, 9002, 100, 'en', 'Foosha Village', 'A peaceful port village in the East Blue. The journey of a thousand leagues begins with a single step off the dock.'),
(91006, 9002, 100, 'it', 'Villaggio Foosha', 'Un tranquillo villaggio portuale nell''East Blue. Il viaggio di mille leghe inizia con un solo passo dal molo.'),
(91007, 9002, 101, 'en', 'Shells Town', 'A Marine base town ruled by a tyrannical captain. The townsfolk live in fear, and a famous swordsman is imprisoned here.'),
(91008, 9002, 101, 'it', 'Shells Town', 'Una città con base della Marina governata da un capitano tirannico. La gente vive nella paura e un famoso spadaccino è imprigionato qui.'),
(91009, 9002, 102, 'en', 'Baratie', 'A floating restaurant on the open sea, run by a fearsome chef. The food is magnificent, and the cooks can fight as well as any pirate.'),
(91010, 9002, 102, 'it', 'Baratie', 'Un ristorante galleggiante in mare aperto, gestito da uno chef temibile. Il cibo è magnifico e i cuochi sanno combattere come qualsiasi pirata.'),
(91011, 9002, 103, 'en', 'Arlong Park', 'The fortress of a ruthless fishman pirate. His tyranny over the local island must end — but his underwater strength is terrifying.'),
(91012, 9002, 103, 'it', 'Arlong Park', 'La fortezza di uno spietato pirata uomo-pesce. La sua tirannia sull''isola locale deve finire — ma la sua forza subacquea è terrificante.'),
(91013, 9002, 104, 'en', 'Loguetown', 'The town of the beginning and the end — where the Pirate King was born and executed. The gateway to the Grand Line.'),
(91014, 9002, 104, 'it', 'Loguetown', 'La città dell''inizio e della fine — dove il Re dei Pirati nacque e fu giustiziato. Il cancello per la Rotta Maggiore.'),
(91015, 9002, 105, 'en', 'Whiskey Peak', 'A seemingly welcoming island where the inhabitants celebrate all pirates. But beware — nothing is as it seems.'),
(91016, 9002, 105, 'it', 'Whiskey Peak', 'Un''isola apparentemente ospitale dove gli abitanti festeggiano tutti i pirati. Ma attenzione — nulla è come sembra.'),
(91017, 9002, 106, 'en', 'Drum Island', 'A snow-covered island with a castle on its peak. A brilliant but eccentric doctor lives here, and ancient medical knowledge awaits.'),
(91018, 9002, 106, 'it', 'Isola di Drum', 'Un''isola innevata con un castello sulla cima. Un medico brillante ma eccentrico vive qui e un''antica conoscenza medica attende.'),
(91019, 9002, 107, 'en', 'Alabasta', 'A vast desert kingdom on the brink of civil war. A shadowy organization manipulates events from behind the scenes.'),
(91020, 9002, 107, 'it', 'Alabasta', 'Un vasto regno desertico sull''orlo della guerra civile. Un''organizzazione oscura manipola gli eventi da dietro le quinte.'),
(91021, 9002, 108, 'en', 'Skypiea', 'An island in the sky, accessible only through the Knock-Up Stream. Angels and warriors guard a treasure of unimaginable worth.'),
(91022, 9002, 108, 'it', 'Skypiea', 'Un''isola nel cielo, accessibile solo attraverso il Knock-Up Stream. Angeli e guerrieri proteggono un tesoro di valore inimmaginabile.'),
(91023, 9002, 109, 'en', 'Water 7', 'The city of water, home to the greatest shipwrights in the world. Beautiful canals, masked assassins, and government secrets converge.'),
(91024, 9002, 109, 'it', 'Water 7', 'La città dell''acqua, patria dei migliori carpentieri navali del mondo. Splendidi canali, assassini mascherati e segreti governativi convergono.'),
(91025, 9002, 110, 'en', 'Thriller Bark', 'A massive ship disguised as an island, drifting in the Florian Triangle. Zombies, ghosts, and a mad surgeon fill its decks.'),
(91026, 9002, 110, 'it', 'Thriller Bark', 'Una nave enorme mascherata da isola, alla deriva nel Triangolo di Florian. Zombie, fantasmi e un chirurgo pazzo riempiono i suoi ponti.'),
(91027, 9002, 111, 'en', 'Sabaody Archipelago', 'A grove of enormous mangrove trees rising from the sea. Bubbles float everywhere. The rich buy slaves, and the Navy''s greatest forces gather here.'),
(91028, 9002, 111, 'it', 'Arcipelago Sabaody', 'Un boschetto di enormi mangrovie che si elevano dal mare. Bolle fluttuano ovunque. I ricchi comprano schiavi e le più grandi forze della Marina si radunano qui.'),
-- Class texts
(91029, 9002, 200, 'en', 'Swordsman', 'A master of bladed combat. Dreams of becoming the greatest swordsman in the world.'),
(91030, 9002, 200, 'it', 'Spadaccino', 'Un maestro del combattimento con lame. Sogna di diventare il più grande spadaccino del mondo.'),
(91031, 9002, 201, 'en', 'Navigator', 'An expert in weather, maps, and sea routes. Essential for surviving the unpredictable Grand Line.'),
(91032, 9002, 201, 'it', 'Navigatrice', 'Un''esperta di meteo, mappe e rotte marine. Essenziale per sopravvivere nella imprevedibile Rotta Maggiore.'),
(91033, 9002, 202, 'en', 'Cook', 'A fighting chef who can kick through steel. Feeds the crew and fights with devastating leg techniques.'),
(91034, 9002, 202, 'it', 'Cuoco', 'Uno chef combattente che può sfondare l''acciaio a calci. Nutre l''equipaggio e combatte con devastanti tecniche di gambe.'),
(91035, 9002, 203, 'en', 'Sniper', 'A long-range specialist with incredible aim and inventive ammunition. Courage... is a work in progress.'),
(91036, 9002, 203, 'it', 'Cecchino', 'Uno specialista a lungo raggio con mira incredibile e munizioni inventive. Il coraggio... è un lavoro in corso.'),
-- Difficulty texts
(91037, 9002, 300, 'en', 'East Blue', 'A calm sea for beginners. Enemies are weak and allies are plentiful.'),
(91038, 9002, 300, 'it', 'East Blue', 'Un mare calmo per principianti. I nemici sono deboli e gli alleati abbondano.'),
(91039, 9002, 301, 'en', 'Paradise', 'The first half of the Grand Line. Dangerous seas, powerful foes, and mysteries at every turn.'),
(91040, 9002, 301, 'it', 'Paradiso', 'La prima metà della Rotta Maggiore. Mari pericolosi, nemici potenti e misteri a ogni angolo.'),
(91041, 9002, 302, 'en', 'New World', 'The second half of the Grand Line. Only the strongest survive. Emperors rule these waters.'),
(91042, 9002, 302, 'it', 'Nuovo Mondo', 'La seconda metà della Rotta Maggiore. Solo i più forti sopravvivono. Gli Imperatori governano queste acque.'),
-- Item texts
(91043, 9002, 400, 'en', 'Meat on the Bone', 'A massive chunk of roasted meat. Restores energy and spirit — the captain''s favorite food.'),
(91044, 9002, 400, 'it', 'Carne con l''Osso', 'Un enorme pezzo di carne arrosto. Ripristina energia e spirito — il cibo preferito del capitano.'),
(91045, 9002, 401, 'en', 'Eternal Pose', 'A special compass that always points to a specific island. Essential for Grand Line navigation.'),
(91046, 9002, 401, 'it', 'Eternal Pose', 'Una bussola speciale che punta sempre a un''isola specifica. Essenziale per la navigazione nella Rotta Maggiore.'),
(91047, 9002, 402, 'en', 'Den Den Mushi', 'A snail-like creature used as a communication device. Can contact allies across vast distances.'),
(91048, 9002, 402, 'it', 'Den Den Mushi', 'Una creatura simile a una lumaca usata come dispositivo di comunicazione. Può contattare alleati a grandi distanze.'),
(91049, 9002, 403, 'en', 'Cola Barrel', 'A barrel of cola — the fuel that powers the Thousand Sunny''s special weapons and Coup de Burst.'),
(91050, 9002, 403, 'it', 'Barile di Cola', 'Un barile di cola — il carburante che alimenta le armi speciali della Thousand Sunny e il Coup de Burst.'),
(91051, 9002, 404, 'en', 'Gum-Gum Fruit', 'A Devil Fruit that grants rubber powers. The user''s body stretches like rubber but can never swim again.'),
(91052, 9002, 404, 'it', 'Frutto Gom Gom', 'Un Frutto del Diavolo che conferisce poteri di gomma. Il corpo dell''utente si allunga come gomma ma non potrà mai più nuotare.'),
-- Event texts
(91053, 9002, 500, 'en', 'Sea King Attack', 'A gigantic sea creature surfaces beside the ship! Its jaws could swallow the vessel whole!'),
(91054, 9002, 500, 'it', 'Attacco del Re del Mare', 'Una gigantesca creatura marina emerge accanto alla nave! Le sue fauci potrebbero inghiottire l''imbarcazione intera!'),
(91055, 9002, 501, 'en', 'Marine Ambush', 'A Marine battleship appears on the horizon. Cannons are aimed. Surrender is demanded.'),
(91056, 9002, 501, 'it', 'Imboscata della Marina', 'Una nave da guerra della Marina appare all''orizzonte. I cannoni sono puntati. La resa è richiesta.'),
(91057, 9002, 502, 'en', 'Island Festival', 'The islanders celebrate your arrival with a grand feast! Food, music, and laughter fill the night.'),
(91058, 9002, 502, 'it', 'Festa dell''Isola', 'Gli isolani celebrano il vostro arrivo con un grande banchetto! Cibo, musica e risate riempiono la notte.'),
(91059, 9002, 503, 'en', 'Bounty Hunters', 'A group of bounty hunters has recognized you. They want the price on your head!'),
(91060, 9002, 503, 'it', 'Cacciatori di Taglie', 'Un gruppo di cacciatori di taglie vi ha riconosciuto. Vogliono la taglia sulla vostra testa!'),
(91061, 9002, 504, 'en', 'Legendary Treasure Found', 'Deep in the ruins, you find a chamber filled with gold, jewels, and an ancient Poneglyph!'),
(91062, 9002, 504, 'it', 'Tesoro Leggendario Trovato', 'Nelle profondità delle rovine, trovate una camera piena d''oro, gioielli e un antico Poneglyph!'),
-- Choice texts
(91063, 9002, 600, 'en', 'Fire the Cannons', 'Open fire and engage the Sea King head-on!'),
(91064, 9002, 600, 'it', 'Fuoco coi Cannoni', 'Aprite il fuoco e affrontate il Re del Mare frontalmente!'),
(91065, 9002, 601, 'en', 'Evade at Full Speed', 'Use the wind to outrun the creature. Speed over strength!'),
(91066, 9002, 601, 'it', 'Evadi a Tutta Velocità', 'Usa il vento per seminare la creatura. Velocità prima della forza!'),
(91067, 9002, 602, 'en', 'Raise the Jolly Roger', 'Fly the pirate flag proudly and prepare to fight the Marines!'),
(91068, 9002, 602, 'it', 'Alza il Jolly Roger', 'Issa con orgoglio la bandiera pirata e preparati a combattere la Marina!'),
(91069, 9002, 603, 'en', 'Read the Poneglyph', 'Attempt to decipher the ancient stone. The Road to the final treasure may be written here.'),
(91070, 9002, 603, 'it', 'Leggi il Poneglyph', 'Tenta di decifrare la pietra antica. La strada verso il tesoro finale potrebbe essere scritta qui.'),
(91071, 9002, 604, 'en', 'Recruit the Bounty Hunters', 'Offer the hunters a place in your crew instead of a fight.'),
(91072, 9002, 604, 'it', 'Recluta i Cacciatori di Taglie', 'Offri ai cacciatori un posto nel tuo equipaggio invece di un combattimento.'),
-- Trait texts
(91073, 9002, 700, 'en', 'Conqueror''s Haki', 'The rare ability to dominate the will of others. Only one in a million is born with it.'),
(91074, 9002, 700, 'it', 'Haki del Re', 'La rara capacità di dominare la volontà degli altri. Solo uno su un milione nasce con essa.'),
(91075, 9002, 701, 'en', 'Iron Body', 'A martial art technique that hardens the body to the strength of iron.'),
(91076, 9002, 701, 'it', 'Corpo di Ferro', 'Una tecnica di arti marziali che indurisce il corpo alla resistenza del ferro.'),
(91077, 9002, 702, 'en', 'Grand Line Veteran', 'Experience sailing the Grand Line. Instinctive knowledge of weather patterns and sea currents.'),
(91078, 9002, 702, 'it', 'Veterano della Rotta Maggiore', 'Esperienza nel navigare la Rotta Maggiore. Conoscenza istintiva dei pattern meteorologici e delle correnti marine.'),
-- Weather texts
(91079, 9002, 800, 'en', 'Typhoon', 'A massive storm engulfs the seas. Waves taller than the mast crash over the deck!'),
(91080, 9002, 800, 'it', 'Tifone', 'Un''enorme tempesta inghiotte i mari. Onde più alte dell''albero maestro si schiantano sul ponte!'),
(91081, 9002, 801, 'en', 'Dead Calm', 'Not a breath of wind. The sea is a mirror. Supplies dwindle as you drift aimlessly.'),
(91082, 9002, 801, 'it', 'Calma Piatta', 'Non un alito di vento. Il mare è uno specchio. Le scorte diminuiscono mentre derivate senza meta.'),
(91083, 9002, 802, 'en', 'Knock-Up Stream', 'A massive underwater geyser erupts! Hold on tight — it can launch you into the sky!'),
(91084, 9002, 802, 'it', 'Knock-Up Stream', 'Un enorme geyser sottomarino erutta! Tenetevi forte — può lanciarvi nel cielo!'),
-- Mission texts
(91085, 9002, 900, 'en', 'Assemble the Crew', 'Recruit at least 4 crew members to sail the Grand Line.'),
(91086, 9002, 900, 'it', 'Assembla l''Equipaggio', 'Recluta almeno 4 membri dell''equipaggio per navigare la Rotta Maggiore.'),
(91087, 9002, 901, 'en', 'Free the Island', 'Liberate the island from the tyranny of the fishman pirate.'),
(91088, 9002, 901, 'it', 'Libera l''Isola', 'Libera l''isola dalla tirannia del pirata uomo-pesce.'),
(91089, 9002, 902, 'en', 'Reach Skypiea', 'Find the way to the sky island and claim its legendary treasure.'),
(91090, 9002, 902, 'it', 'Raggiungi Skypiea', 'Trova la strada per l''isola nel cielo e reclama il suo leggendario tesoro.'),
-- Mission step texts
(91091, 9002, 910, 'en', 'Find a Swordsman', 'Recruit a skilled swordsman from Shells Town.'),
(91092, 9002, 911, 'en', 'Find a Navigator', 'Convince a talented navigator to join your crew.'),
(91093, 9002, 912, 'en', 'Find a Cook', 'Recruit the fighting chef from the floating restaurant.'),
(91094, 9002, 920, 'en', 'Defeat the Fishman Officers', 'Take down the four strongest officers of the fishman crew.'),
(91095, 9002, 921, 'en', 'Destroy the Charts', 'Destroy the navigation charts being used to exploit the navigator.'),
(91096, 9002, 930, 'en', 'Ride the Knock-Up Stream', 'Catch the Knock-Up Stream geyser to reach Skypiea.'),
(91097, 9002, 931, 'en', 'Defeat the God of Skypiea', 'Battle the self-proclaimed god who rules the sky island with lightning.'),
-- Character template texts
(91098, 9002, 210, 'en', 'Rubber Captain', 'A stretchy captain with boundless energy and an iron will. Always hungry.'),
(91099, 9002, 211, 'en', 'Three-Sword Style', 'A swordsman who fights with three blades — one in each hand and one in the mouth.'),
(91100, 9002, 212, 'en', 'Black Leg', 'A gentleman cook who fights exclusively with kicks to protect his hands for cooking.'),
-- Key texts
(91101, 9002, 950, 'en', 'Log Pose', 'A special compass needed to navigate the Grand Line. Without it, you are hopelessly lost.'),
(91102, 9002, 951, 'en', 'Vivre Card', 'A fragment of a crew member''s life paper. It moves toward its owner and burns away if they are dying.'),
(91103, 9002, 952, 'en', 'Pirate Flag', 'Your crew''s Jolly Roger. It represents your dream and your bond as a crew.');

-- ── Difficulties ────────────────────────────────────────────────
INSERT INTO list_stories_difficulty (id, id_story, id_text_description, exp_cost, max_weight, min_character, max_character, cost_help_coma, cost_max_characteristics, number_max_free_action) VALUES
(91001, 9002, 300, 3, 20, 1, 6, 2, 2, 3),
(91002, 9002, 301, 5, 12, 2, 5, 3, 3, 1),
(91003, 9002, 302, 8, 8,  3, 4, 5, 5, 0);

-- ── Classes ─────────────────────────────────────────────────────
INSERT INTO list_classes (id, id_story, id_text_name, id_text_description, weight_max, dexterity_base, intelligence_base, constitution_base) VALUES
(91001, 9002, 200, 200, 10, 4, 1, 3),
(91002, 9002, 201, 201, 6,  2, 5, 1),
(91003, 9002, 202, 202, 8,  4, 2, 3),
(91004, 9002, 203, 203, 7,  3, 3, 1);

-- ── Classes Bonus ───────────────────────────────────────────────
INSERT INTO list_classes_bonus (id, id_story, id_class, statistic, value) VALUES
(91001, 9002, 91001, 'life',   8),
(91002, 9002, 91001, 'dex',    3),
(91003, 9002, 91001, 'energy', 5),
(91004, 9002, 91002, 'int',    5),
(91005, 9002, 91002, 'coin',   8),
(91006, 9002, 91002, 'sad',   -2),
(91007, 9002, 91003, 'life',   5),
(91008, 9002, 91003, 'dex',    4),
(91009, 9002, 91003, 'food',   3),
(91010, 9002, 91004, 'dex',    2),
(91011, 9002, 91004, 'int',    3),
(91012, 9002, 91004, 'energy', 2);

-- ── Traits ──────────────────────────────────────────────────────
INSERT INTO list_traits (id, id_story, id_text_name, id_text_description, cost_positive, cost_negative) VALUES
(91001, 9002, 700, 700, 5, 0),
(91002, 9002, 701, 701, 3, 0),
(91003, 9002, 702, 702, 2, 0);

-- ── Character Templates ─────────────────────────────────────────
INSERT INTO list_character_templates (id_tipo, id_story, id_text_name, id_text_description, life_max, energy_max, sad_max, dexterity_start, intelligence_start, constitution_start) VALUES
(91001, 9002, 210, 210, 14, 12, 6,  4, 1, 4),
(91002, 9002, 211, 211, 12, 10, 8,  5, 2, 3),
(91003, 9002, 212, 212, 11, 11, 7,  4, 2, 3);

-- ── Keys ────────────────────────────────────────────────────────
INSERT INTO list_keys (id, id_story, name, value, id_text_description, "group", priority, visibility) VALUES
(91001, 9002, 'log_pose',    'false', 950, 'navigation', 1, 'PUBLIC'),
(91002, 9002, 'vivre_card',  'false', 951, 'crew',       2, 'PUBLIC'),
(91003, 9002, 'jolly_roger', 'true',  952, 'crew',       3, 'PUBLIC');

-- ── Locations (12) ─────────────────────────────────────────────
INSERT INTO list_locations (id, id_story, id_text_name, id_text_description, is_safe, cost_energy_enter, max_characters) VALUES
(91001, 9002, 100, 100, 1, 0, 10),   -- Foosha Village
(91002, 9002, 101, 101, 0, 1, 8),    -- Shells Town
(91003, 9002, 102, 102, 1, 0, 12),   -- Baratie
(91004, 9002, 103, 103, 0, 2, 6),    -- Arlong Park
(91005, 9002, 104, 104, 1, 0, 15),   -- Loguetown
(91006, 9002, 105, 105, 0, 1, 8),    -- Whiskey Peak
(91007, 9002, 106, 106, 0, 2, 6),    -- Drum Island
(91008, 9002, 107, 107, 0, 2, 10),   -- Alabasta
(91009, 9002, 108, 108, 0, 3, 6),    -- Skypiea
(91010, 9002, 109, 109, 1, 1, 10),   -- Water 7
(91011, 9002, 110, 110, 0, 2, 8),    -- Thriller Bark
(91012, 9002, 111, 111, 0, 1, 15);   -- Sabaody Archipelago

-- ── Location Neighbors ──────────────────────────────────────────
INSERT INTO list_locations_neighbors (id, id_story, id_location_from, id_location_to, direction, flag_back, energy_cost) VALUES
(91001, 9002, 91001, 91002, 'EAST',  1, 1),  -- Foosha → Shells Town
(91002, 9002, 91002, 91003, 'SOUTH', 1, 1),  -- Shells Town → Baratie
(91003, 9002, 91003, 91004, 'EAST',  1, 1),  -- Baratie → Arlong Park
(91004, 9002, 91004, 91005, 'SOUTH', 1, 1),  -- Arlong Park → Loguetown
(91005, 9002, 91005, 91006, 'EAST',  1, 2),  -- Loguetown → Whiskey Peak (enters Grand Line)
(91006, 9002, 91006, 91007, 'NORTH', 1, 1),  -- Whiskey Peak → Drum Island
(91007, 9002, 91007, 91008, 'EAST',  1, 2),  -- Drum Island → Alabasta
(91008, 9002, 91008, 91009, 'SKY',   0, 3),  -- Alabasta → Skypiea (one-way up)
(91009, 9002, 91009, 91010, 'BELOW', 0, 2),  -- Skypiea → Water 7 (one-way down)
(91010, 9002, 91008, 91010, 'EAST',  1, 2),  -- Alabasta → Water 7 (sea route)
(91011, 9002, 91010, 91011, 'SOUTH', 1, 2),  -- Water 7 → Thriller Bark
(91012, 9002, 91011, 91012, 'EAST',  1, 1);  -- Thriller Bark → Sabaody

-- ── Items ───────────────────────────────────────────────────────
INSERT INTO list_items (id, id_story, id_text_name, id_text_description, weight, is_consumabile) VALUES
(91001, 9002, 400, 400, 1, 1),  -- Meat on the Bone
(91002, 9002, 401, 401, 1, 0),  -- Eternal Pose
(91003, 9002, 402, 402, 2, 0),  -- Den Den Mushi
(91004, 9002, 403, 403, 3, 1),  -- Cola Barrel
(91005, 9002, 404, 404, 1, 1);  -- Gum-Gum Fruit

-- ── Item Effects ────────────────────────────────────────────────
INSERT INTO list_items_effects (id, id_story, id_item, effect_code, effect_value) VALUES
(91001, 9002, 91001, 'LIFE',    5),
(91002, 9002, 91001, 'ENERGY',  3),
(91003, 9002, 91001, 'SADNESS',-2),
(91004, 9002, 91004, 'ENERGY',  5),
(91005, 9002, 91005, 'DEX',     5),
(91006, 9002, 91005, 'COS',     3);

-- ── Weather Rules ───────────────────────────────────────────────
INSERT INTO list_weather_rules (id, id_story, id_text_name, id_text_description, probability, cost_move_safe_location, cost_move_not_safe_location, active, priority, delta_energy) VALUES
(91001, 9002, 800, 800, 20, 1, 3, 1, 1, -2),
(91002, 9002, 801, 801, 25, 0, 0, 1, 2, -1),
(91003, 9002, 802, 802,  5, 0, 0, 1, 3,  0);

-- ── Events ──────────────────────────────────────────────────────
INSERT INTO list_events (id, id_story, id_text_name, id_text_description, type, cost_enery, flag_end_time) VALUES
(91001, 9002, 500, 500, 'NORMAL',    3, 0),  -- Sea King Attack
(91002, 9002, 501, 501, 'NORMAL',    2, 0),  -- Marine Ambush
(91003, 9002, 502, 502, 'FIRST',     0, 0),  -- Island Festival
(91004, 9002, 503, 503, 'NORMAL',    2, 0),  -- Bounty Hunters
(91005, 9002, 504, 504, 'AUTOMATIC', 0, 1);  -- Treasure Found (end)

-- ── Event Effects ───────────────────────────────────────────────
INSERT INTO list_events_effects (id, id_story, id_event, statistics, value, target) VALUES
(91001, 9002, 91001, 'life',   -5, 'ALL'),
(91002, 9002, 91001, 'energy', -2, 'ALL'),
(91003, 9002, 91001, 'exp',     8, 'ALL'),
(91004, 9002, 91002, 'life',   -3, 'ALL'),
(91005, 9002, 91002, 'exp',     5, 'ALL'),
(91006, 9002, 91003, 'life',    3, 'ALL'),
(91007, 9002, 91003, 'sad',    -5, 'ALL'),
(91008, 9002, 91003, 'energy',  5, 'ALL'),
(91009, 9002, 91004, 'life',   -4, 'ONLY_ONE'),
(91010, 9002, 91004, 'exp',     6, 'ALL'),
(91011, 9002, 91005, 'coin',   50, 'ALL'),
(91012, 9002, 91005, 'exp',    30, 'ALL');

-- ── Choices ─────────────────────────────────────────────────────
INSERT INTO list_choices (id, id_story, id_event, priority, id_text_name, id_text_description, otherwise_flag, is_progress, logic_operator) VALUES
(91001, 9002, 91001, 1, 600, 600, 0, 0, 'AND'),
(91002, 9002, 91001, 2, 601, 601, 0, 0, 'AND'),
(91003, 9002, 91002, 1, 602, 602, 0, 0, 'AND'),
(91004, 9002, 91005, 1, 603, 603, 0, 1, 'AND'),
(91005, 9002, 91004, 1, 604, 604, 0, 0, 'OR');

-- ── Choice Conditions ───────────────────────────────────────────
INSERT INTO list_choices_conditions (id, id_story, id_choices, type, key, value, operator) VALUES
(91001, 9002, 91002, 'statistics', 'dex',      '3',     '>'),    -- Evade: needs DEX > 3
(91002, 9002, 91003, 'statistics', 'cos',      '2',     '>'),    -- Fight Marines: needs COS > 2
(91003, 9002, 91004, 'KEYS',       'log_pose', 'true',  '=');    -- Read Poneglyph: needs Log Pose

-- ── Choice Effects ──────────────────────────────────────────────
INSERT INTO list_choices_effects (id, id_story, id_choices, statistics, value, key, value_to_add) VALUES
(91001, 9002, 91001, 'energy', -3, NULL, NULL),
(91002, 9002, 91002, 'energy', -1, NULL, NULL),
(91003, 9002, 91003, 'energy', -4, NULL, NULL),
(91004, 9002, 91004, NULL,      0, 'poneglyph_read', 'true'),
(91005, 9002, 91005, NULL,      0, 'crew_members',   'bounty_hunters');

-- ── Global Random Events ────────────────────────────────────────
INSERT INTO list_global_random_events (id, id_story, condition_key, condition_value, probability) VALUES
(91001, 9002, NULL,         NULL,    20),
(91002, 9002, 'sea_zone',   'grand_line', 30),
(91003, 9002, NULL,         NULL,    10);

-- ── Missions ────────────────────────────────────────────────────
INSERT INTO list_missions (id, id_story, condition_key, condition_value_from, condition_value_to, id_text_name, id_text_description) VALUES
(91001, 9002, 'crew_count',   '0', '4', 900, 900),
(91002, 9002, 'arlong_status', NULL, 'defeated', 901, 901),
(91003, 9002, 'skypiea',      NULL, 'reached',  902, 902);

-- ── Mission Steps ───────────────────────────────────────────────
INSERT INTO list_missions_steps (id, id_story, id_mission, step, condition_key, condition_value_from, condition_value_to, id_text_name, id_text_description) VALUES
(91001, 9002, 91001, 1, 'swordsman_recruited', NULL, 'true',     910, 910),
(91002, 9002, 91001, 2, 'navigator_recruited', NULL, 'true',     911, 911),
(91003, 9002, 91001, 3, 'cook_recruited',      NULL, 'true',     912, 912),
(91004, 9002, 91002, 1, 'officers_defeated',   '0',  '4',        920, 920),
(91005, 9002, 91002, 2, 'charts_destroyed',    NULL, 'true',     921, 921),
(91006, 9002, 91003, 1, 'knock_up_stream',     NULL, 'ridden',   930, 930),
(91007, 9002, 91003, 2, 'sky_god_defeated',    NULL, 'true',     931, 931);

-- ── Creator ─────────────────────────────────────────────────────
INSERT INTO list_creator (id, id_story, link, url, url_image) VALUES
(91001, 9002, 'PathsMaster', 'https://paths.games', 'https://paths.games/assets/logo.png');

-- ── Cards ───────────────────────────────────────────────────────
INSERT INTO list_cards (id, id_story, url_immage, awesome_icon, style_main) VALUES
(91001, 9002, NULL, 'fas fa-anchor',     'ocean'),
(91002, 9002, NULL, 'fas fa-ship',       'adventure'),
(91003, 9002, NULL, 'fas fa-skull-crossbones', 'pirate');

-- =============================================
-- END OF STORY SEED DATA
-- =============================================
