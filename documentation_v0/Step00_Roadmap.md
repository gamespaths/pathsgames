# Paths Games V0 - Roadmap & Todo-List

This document defines the **project plan** to build **Paths Games**, a playable web-based game, with detailed requirements and scope for the V1 release.

The file lists a **101-step development roadmap** (each with seven substeps covering backend, frontend and unit tests) organized into four phases:
- **Phase 1 (Steps 1-13)**: Start the project, define stope and tecnology stack, create prototypes
- **Phase 2 (Steps 14-42)**: Single-player game system with guest login only. Covers story management, match creation, game engine, mechanics, frontend UI, and beta launch.
- **Phase 3 (Steps 43-84)**: Multiplayer game system with credential login. Covers user registration, Google SSO, WebSocket real-time, lobby, multiplayer engine, trade, chat, admin tools and multiplayer frontend.
- **Phase 4 (Steps 85-101)**: Security, testing, performance, monitoring, production infrastructure, documentation, and V1 launch.


# Roadmap

|  | Step |  | Main goals |
| ---- | -- | ----- | ---------- |
| 1 | [Start the project](./Step01_StartProject.md) | ✅ | Write ideas on document and initial concepts, define steps to execute to start the project, a simple list and for each step give 5 subpoints. |
| 2 | [Create the repository](./Step02_CreateTheRepository.md) | ✅ | Choose repository platform, initialize an empty repository, set the main branch and define basic access rules |
| 3 | [Define the V1 scope](./Step03_DefineScope.md) | ✅ | Define the V1 scope, list mandatory features, list excluded features, define maximum complexity limit, establish what makes V1 "finished", freeze decisions until V2 |
| 4 | [Technology stack](./Step04_TechnologyStack.md) | ✅ | Select backend language, select backend framework, select primary database, select frontend technology, select deployment system |
| 5 | [Backend structure](./Step05_BackendStructure.md) | ✅ | Separate domain from infrastructure, define API module, define realtime module, define persistence module, define shared services module, create backend project and first build |
| 6 | [Naming conventions](./Step06_NamingConventions.md) | ✅ | Define REST endpoint naming, define WebSocket event naming, define table and column naming, define DTO and payload naming |
| 7 | [Configure website](./Step07_ConfigureWebsite.md) | ✅ | Define and buy domains [paths.games](http://paths.games/) & [pathsgames.com](http://pathsgames.com/), create terraform template, deploy terraform template into cloud system, create first version of website, deploy first version of website
| 8 | [Configure CI](./Step08_ConfigureCI.md) | ✅ | Define environment-specific configurations, separate credentials and secrets, choose CI system (GitHub Actions), define build pipelines (backend Docker + website S3), run automated tests, fail pipeline on errors, connect CI to the main branch |
| 9 | [Design core data model](./Step09_DesignCoreDataModel.md) | ✅ | Identify main entities, define relationships between entities, identify persistent vs transient data, list valid game states, define rules that must never be broken, validate models with real cases |
| 10 | [Create initial DB schema](./Step10_CreateDBschema.md) | ✅ | Translate the data model into tables, define primary keys, define foreign keys, version the schema |
| 11 | [Define API versioning](./Step11_DefineAPIVersioning.md) | ✅ | Establish the API versioning scheme, Decide backward compatibility policy, Prepare structure for future versions |
| 12 | [Implement guest login](Step12_GuestLoginMethod.md) | ✅ | Define guest identity model, ceate guest session endpoint, store guest sessions in database | 
| 13 | [Session & token management](Step13_SessionTokenManagement.md) | ✅ | Token refresh with rotation, logout, auth filter, admin authorization |
| 14 | [Stories management & import](Step14_StoriesImportSystem.md) | ✅ | Story import system and data seeding. Start test robot framework. |
| 15 | [Stories content APIs](./Step15_StoryContentAPIs.md) | ✅ | Story content APIs: categories, groups, enriched detail |
| 16 | [Content detail](./Step16_ContentDetailAPIs.md) | ✅ | Card, test and authors details APIs |


| Steps | Phase |
| -- | -- |
| 14-20 | Story management (import, content APIs, admin CRUD, validation, frontend) |
| 21-24 | Single-player match setup (create, character select, traits, frontend UI) |
| 25-27 | Core engine (turn cycle, time system, weather) |
| 28-32 | Game mechanics — movement, events, choices |
| 33-37 | Game mechanics — inventory, resources, registry, missions, experience |
| 38-40 | Edge states, logging, snapshots |
| 41 | Frontend: single-player game board and gameplay UI |
| 42 | **Launch beta version with guest and single-player game** |
| 43-48 | User registration, Google SSO, profile management, guest linking |
| 49-54 | WebSocket server, authentication, message types, real-time sync, reconnect |
| 55-60 | Multiplayer match lifecycle (create, lobby, character select, start, frontend) |
| 61-66 | Multiplayer turn engine (turn order, timeout, time advancement, stalemate) |
| 67-70 | Multiplayer movement and group follow system |
| 71-76 | Trade, chat, notifications, frontend UI |
| 77-80 | Admin tools (dashboard, match control, user management, frontend) |
| 81-84 | Frontend: multiplayer game board, turn UI, reconnection, integration testing |
| 85-87 | Security audit and hardening |
| 88-92 | End-to-end testing, playtesting, regression fixes |
| 93-95 | Performance and load testing, database optimization |
| 96-97 | Monitoring, logging aggregation, alerting |
| 98-99 | Production infrastructure, DNS, CDN, backup |
| 100-101 | Documentation and V1 Launch |


## Next steps
For next steps use this prompt
> Set Step/XX=16. read all documentation into "documentation_v0" folder to have all information about my project. i wanna to run step XX descripted into Step00_Roadmap file: write all java backend code into "code/backend/java" project using JPA, never add new module, complete all unit-test using mokito to cover 100% of branches-case. write new md file inside documentation_v0 folder with all details, write a section with (endpoint apis, DTO, roles, tables, test cases and business logic). add (or update) openapi documentation into "/code/backend/java/adapter-rest/src/main/resources/openapi" folder with new/changed api, if some api changed write me into md files. create a new simple web example to use new api-interfaces inside new "code/website/concepts_v0/v0.XX.0/" folder, if necessary create a new "code/website/concepts_v0/v0.XX.0-admin/" folder for dedicated admin web-site sections, for websites use componentes by code/website/html and others last concepts. add new folder inside "code/tests/robot/test" and write new robot-framework test to check all apis and new components are ok (launcing java backend with sqlite profile to test all). don't look and don't change "backend/python" , "backend/php" , "backend/aws" and others concepts folder into "website". to execute robot command remember to use ".venv". 

> Set Step/XX=16. read all documentation into "documentation_v0" folder to have all information about my project. i wanna to run step XX=000 for python and php backend. please read all changes about step XX and write php and python project code using react tecnologies defined into README.md file inside projects. I wanna all APIs are 100% compatibile with "code/backend/java/adapter-rest/src/main/resources/openapi" open-api documentation. For php and python i've sonar qube so complete all unit-test using phpunit and pytest to cover 100% of branches-case. never change files outside "code/backend/php" and "code/backend/python" folders. my robot "code/tests/robot" must works with python and php project, check it with script inside "code/script/dev/" folder. to execute python project and robot command remember to use ".venv". 

> Set Step/XX=16. read all documentation into "documentation_v0" folder to have all information about my project. i wanna to run step XX for aws backend version inside "code/backend/aws" folder. please read all changes about step XX from java and python versions and write into aws project new code using tecnologies defined into README.md file inside projects and previus code. I wanna all APIs are 100% compatibile with "code/backend/java/adapter-rest/src/main/resources/openapi" open-api documentation. never change files outside "code/backend/aws" folder. my robot "code/tests/robot" must works with new code, never change robot test code.

> Set Step/XX=16. read all documentation into "documentation_v0" folder to have all information about my project. read open-api documentation into "/code/backend/java/adapter-rest/src/main/resources/openapi" folder, i wanna to run step XX for frontend "react-admin" and "react-game" , add functionality inside project using react tecnologies defined into README.md file inside projects.

---

# PHASE 1 — Single-Player Game with Guest Login (Steps 14-42)


16. Story content APIs — cards, texts, and creators
    - Implement GET /content/{uuid_story}/cards/{uuid_card} endpoint returning card details for a story (backend)
    - Implement GET /content/{uuid_story}/text/{uuid_text}/lang/{lang} endpoint returning resolved text in requested language (backend)
    - Implement GET /content/{uuid_story}/creator/{uuid_creator} endpoint returning creator details (backend)
    - Implement text resolution service supporting multi-language text lookup with fallback to default language (backend)
    - Implement card and image resolution service linked to locations, stories, and characters (backend)
    - Write backend unit tests for all content endpoints, text resolution, card service, and data integrity validation (backend tests)
17. Story admin CRUD endpoints
    - Implement admin CRUD for stories (list_stories): create, update, delete with admin role check (backend)
    - Implement admin CRUD for story-related tables: list_stories_difficulty, list_locations, list_locations_neighbors, list_keys (backend)
    - Implement admin CRUD for events and effects: list_events, list_events_effects, list_choices, list_choices_conditions, list_choices_effects (backend)
    - Implement admin CRUD for items and weather: list_items, list_items_effects, list_weather_rules, list_global_random_events (backend)
    - Implement admin CRUD for characters: list_character_templates, list_classes, list_classes_bonus, list_traits (backend)
    - Implement admin CRUD for content: list_texts, list_cards, list_creator, list_missions, list_missions_steps (backend)
    - Write backend unit tests for all admin CRUD endpoints covering validation, authorization, and error cases (backend tests)
18. Frontend: Story catalog and detail pages
    - react con vite e bootstrap e Tailwind e font awesome
    - spiegami meglio Framer Motion e XState e TanStack Query e React-Hook-Form
    - Build story catalog page displaying available stories as cards with title, description, image, and difficulty badges (frontend)
    - Build story detail modal/page showing full description, available difficulties, character options, and location preview (frontend)
    - Implement story card component with category, author, and version compatibility indicators (frontend)
    - Implement difficulty selection component showing player limits, weight limits, and experience costs (frontend)
    - Implement responsive layout with Bootstrap 5 grid and medieval/fantasy card style (frontend)
    - Integrate story API client with Redux/state management for caching and loading states (frontend)
    - Write frontend unit tests for story catalog, detail, card components, and API integration mocks (frontend tests)
19. Frontend: Admin story management UI
    - Build admin story list page with search, filter, and CRUD actions (create, edit, delete) (frontend)
    - Build admin story editor with form for story metadata, difficulty levels, and version settings (frontend)
    - Build admin location editor with visual adjacency map showing directional connections (frontend)
    - Build admin event/choice editor with nested forms for effects, conditions, and linked entities (frontend)
    - Build admin item and weather editor with effect configuration and probability settings (frontend)
    - Implement form validation, error display, and confirmation dialogs for destructive actions (frontend)
    - Write frontend unit tests for all admin editor components, form validation, and CRUD operations (frontend tests)
20. Story validation and integrity checking
    - Implement story validator service checking referential integrity across all story entities (backend)
    - Validate all location neighbors reference existing locations with consistent directions (backend)
    - Validate all events reference valid locations, items, and choices; verify event chains have no cycles (backend)
    - Validate all choices have at least one option or an otherwise fallback; verify conditions reference valid keys (backend)
    - Validate character templates have valid stat ranges and classes have defined bonuses (backend)
    - Integrate validation into story import and admin CRUD operations to prevent saving invalid story data (backend)
    - Write backend unit tests for all validation rules covering valid stories, broken references, and edge cases (backend tests)
21. Single-player match creation
    - Implement POST /matches endpoint to create a new match with story and difficulty selection (and creator character select) (backend)
    - Validate story exists, difficulty is valid, user is not banned, and system is not in maintenance (backend)
    - Generate match UUID, set status to CREATED, persist gaming_match record with id_user_creator (backend)
    - Initialize gaming_state_locations for all story locations with default counters (backend)
    - Initialize gaming_state_registry with all story default key-value pairs (backend)
    - Implement GET /match/{uuid_match}/info endpoint returning match details, location, events, choices, and registry (backend)
    - Write backend unit tests for match creation covering validation, state initialization, and error scenarios (backend tests)
22. Character template and class selection
    - Implement GET /match/{uuid_match}/players endpoint listing players/characters with avatar, state, and classes (backend)
    - Implement GET /match/{uuid_match}/characters/{uuid_character} endpoint returning character details with all statistics (backend)
    - Validate character template belongs to the story and class is compatible with selected template (backend)
    - Create gaming_character_instance record with base stats from template, apply class stat bonuses (backend)
    - Initialize gaming_backpack_resources with default values from difficulty settings (backend)
    - Implement POST /matches/{uuid_match}/join endpoint to join a match and select character (backend)
    - Write backend unit tests for character selection covering template/class validation, stat calculations, and conflicts (backend tests)
23. Character traits and stats initialization
    - Implement trait listing for selected class filtered by id_class_permitted and id_class_prohibited (backend)
    - Assign traits during character creation (within POST /matches and POST /matches/{uuid_match}/join flow) (backend)
    - Validate trait cost limits based on difficulty (positive/negative cost budget) and class restrictions (backend)
    - Calculate final starting stats: base template + class bonuses + trait adjustments (backend)
    - Persist gaming_character_traits records and finalize gaming_character_instance with computed stats (backend)
    - Set character initial location to story start location and energy/life to maximum values (backend)
    - Write backend unit tests for trait selection, cost validation, stat computation, and initialization edge cases (backend tests)
24. Frontend: Match creation and character selection UI
    - Build match creation page with story selector, difficulty picker, and "Create Match" button (frontend)
    - Build character template selection screen displaying templates as collectible cards with stats preview (frontend)
    - Build class selection screen showing class bonuses, stat modifiers, and available traits (frontend)
    - Build trait selection screen with cost budget indicator, class compatibility filters, and stat preview (frontend)
    - Build character summary/confirmation screen showing final stats, inventory, and starting location (frontend)
    - Integrate match and character APIs with state management, handle loading and validation errors (frontend)
    - Write frontend unit tests for all selection screens, stat calculations display, and API integration (frontend tests)
25. Turn cycle engine for single-player
    - Implement turn priority calculation: (DES×3 + INT×2 + COS×1) × 1000 + LIFE×10 + CHARACTER_ID (backend)
    - Initialize gaming_turn_queue on match start with calculated priorities and timestamps (backend)
    - Implement POST /matches/{uuid_match}/start endpoint to transition match from CREATED to RUNNING (backend)
    - Implement turn state machine: WAITING → ACTIVE → COMPLETED, tracking current turn in gaming_match (backend)
    - Implement POST /gameplay/{uuid_match}/action/pass endpoint for voluntary turn pass without energy cost (backend)
    - Implement GET /match/{uuid_match}/turn-sequence endpoint returning turn queue with all details and status (backend)
    - Write backend unit tests for priority calculation, turn queue initialization, state transitions, and pass logic (backend tests)
26. Time advancement system — sleep, recovery, new time
    - Implement time advancement trigger: advance when character has zero energy or voluntarily sleeps (backend)
    - Implement POST /gameplay/{uuid_match}/action/sleep endpoint for voluntary sleep action (backend)
    - Apply time-start recovery: safe location gives DES+P energy, COS+P life, minus INT+P sadness; unsafe gives DES energy only (backend)
    - Apply class bonuses at time start from list_classes_bonus for each character (backend)
    - Decrement location time counters and trigger id_event_if_counter_zero when counter reaches zero (backend)
    - Update gaming_match.current_clock, create log_clock_history record, recalculate turn queue (backend)
    - Write backend unit tests for time advancement covering safe/unsafe recovery, class bonuses, counter events, and clock update (backend tests)
27. Weather system — random selection and effects
    - Implement weather selection algorithm using probability weights, registry conditions, and time range filters (backend)
    - Select weather at time start from list_weather_rules matching current conditions and active=true (backend)
    - Apply weather energy delta to characters at time start (delta_energy field) (backend)
    - Trigger weather-linked events when weather has id_event configured (backend)
    - Store weather in gaming_match.id_current_weather and create log_weather history record (backend)
    - Implement GET /matches/{uuid}/weather endpoint returning current weather with movement cost modifiers (backend)
    - Write backend unit tests for weather selection, probability distribution, condition filtering, and energy delta application (backend tests)
28. Movement system — adjacency, energy cost, validation
    - Implement POST /gameplay/{uuid_match}/movements/start endpoint accepting target location for character movement (backend)
    - Implement GET /match/{uuid_match}/locations endpoint returning list of already visited locations (backend)
    - Validate movement: target is neighbor, character has sufficient energy, weight does not exceed capacity (backend)
    - Check movement conditions: registry key/value requirements from list_locations_neighbors (backend)
    - Calculate total energy cost: base cost + location entry cost + weather modifier (safe/unsafe different costs) (backend)
    - Deduct energy from character, update gaming_character_instance.id_location, check location capacity limits (backend)
    - Write backend unit tests for movement validation, energy calculation, registry conditions, capacity limits, and weight checks (backend tests)
29. Location entry events — automatic triggers
    - Implement event trigger evaluation on location entry: AUTOMATIC_FIRST_ENTRY for first visit (backend)
    - Implement AUTOMATIC_SUBSEQUENT_ENTRY trigger for repeat visits using gaming_state_locations.flag_already_actived (backend)
    - Implement AUTOMATIC_FIRST_IN_LOCATION trigger when character enters empty location (no other characters present) (backend)
    - Execute event effects: modify stats, add/remove items, update registry, change character location (backend)
    - Handle event chaining via id_event_next with interrupt flag to stop subsequent events (backend)
    - Update gaming_state_locations to mark location as visited and log event execution in log_events (backend)
    - Write backend unit tests for all automatic trigger types, event effects, chaining, interrupts, and state updates (backend tests)
30. Optional events — player-triggered actions
    - List available optional events at current location via GET /match/{uuid_match}/info response (backend)
    - Implement POST /gameplay/{uuid_match}/action/execute-event endpoint to activate optional event (backend)
    - Validate event activation: character has sufficient energy, coin cost, and is not sleeping or comatose (backend)
    - Deduct energy and coins, apply event effects to character and match state (backend)
    - Apply stat modifications respecting limits: energy ≤ energy_max, life ≤ life_max, sadness ≤ sad_max, life ≥ 0 (backend)
    - Handle flag_end_time: if event causes time end, force all characters to sleep and advance time (backend)
    - Write backend unit tests for optional event activation, cost validation, effect application, and time-end trigger (backend tests)
31. Choice engine — conditions, validation, presentation
    - Return currently available choices within GET /match/{uuid_match}/info response for active character (backend)
    - Load choice options from list_choices for current event or location, ordered by priority (backend)
    - Evaluate choice conditions: sad limit, stat requirements (DES/INT/COS minimums), prohibited/required traits (backend)
    - Evaluate complex conditions: registry key checks, item possession, class checks, location checks, stat sum thresholds (backend)
    - Apply logic operator (AND/OR) across conditions to determine option availability (backend)
    - Filter and return only valid options to the player, include otherwise option if defined (backend)
    - Write backend unit tests for condition evaluation covering all condition types, AND/OR logic, and edge cases (backend tests)
32. Choice resolution — apply effects and outcomes
    - Implement POST /gameplay/{uuid_match}/action/select-choice endpoint to submit selected option (backend)
    - Validate selected option is still available and character can act (not sleeping, not comatose, has turn) (backend)
    - Apply choice effects: stat modifications (single or group based on flag_group), key updates, item changes (backend)
    - Execute linked event (id_event_torun) with its full effect chain based on choice result (backend)
    - Handle is_progress flag: insert into gaming_story_progress for narrative milestone tracking (backend)
    - Log choice execution in log_choices_executed with event, choice, and timestamp (backend)
    - Write backend unit tests for choice submission, effect application, event chaining, progress tracking, and error cases (backend tests)
33. Inventory and item management
    - Implement GET /gameplay/{uuid_match}/inventory endpoint listing active character items with weight and effects (backend)
    - Implement POST /gameplay/{uuid_match}/inventory/use-item endpoint to use a consumable item (backend)
    - Implement POST /gameplay/{uuid_match}/inventory/drop-item endpoint to discard or send an item (backend)
    - Validate item usage: character not sleeping/comatose, item exists in inventory, class restrictions met (backend)
    - Apply item effects from list_items_effects: modify life, energy, sadness, stats, add/remove traits (backend)
    - Create log_item_usage record with character, item, effects, and timestamp (backend)
    - Write backend unit tests for inventory listing, item usage, discard, class restrictions, effect application, and weight calculation (backend tests)
34. Resource management — food, magic, coins, weight
    - Implement GET /matches/{uuid}/characters/{uuid}/resources endpoint returning food, magic, coins, total weight (backend)
    - Implement resource modification through events and choices: add/subtract food, magic, coins respecting minimums (backend)
    - Calculate total weight: food + magic + sum(item_weights); validate coins have zero weight (backend)
    - Calculate maximum capacity: constitution + difficulty_parameter(max_weight) + default_backpack_capacity (backend)
    - Block movement when total weight exceeds maximum capacity (integrate with movement validation) (backend)
    - Build frontend resource display component showing food, magic, coins, weight bar, and capacity limit (frontend)
    - Write backend unit tests for resource modification, weight calculation, capacity formula, and movement blocking (backend tests)
35. Registry system — key-value game state tracking
    - Implement GET /matches/{uuid}/registry endpoint returning all visible registry entries grouped by category (backend)
    - Implement registry update service used by events, choices, and game engine to set/modify key-value pairs (backend)
    - Support registry value types: boolean (YES/NO) and numeric (integer values) (backend)
    - Implement registry-based game phase tracking (Chapter, Phase, Day keys) with progression validation (backend)
    - Implement registry query service for condition evaluation: check key existence, value comparison (=, >, <, !=) (backend)
    - Build frontend registry display component showing visible keys as card collection organized by group (frontend)
    - Write backend unit tests for registry CRUD, value types, condition queries, and phase tracking (backend tests)
36. Mission tracking and progression
    - Implement GET /match/{uuid_match}/missions/active endpoint listing active and completed missions (backend)
    - Implement GET /match/{uuid_match}/missions/{uuid_mission}/progress endpoint returning mission details with all steps (backend)
    - Implement mission activation service triggered by registry value changes (condition_key from → to) (backend)
    - Execute id_event_completed when mission step or full mission completes (rewards, items, stat changes) (backend)
    - Track mission status through registry: AVAILABLE → ACTIVE → step progression → COMPLETED/FAILED (backend)
    - Build frontend mission panel component showing active missions as cards with step progress indicators (frontend)
    - Write backend unit tests for mission activation, step progression, completion events, and status transitions (backend tests)
37. Experience and character advancement
    - Implement experience gain through events: add experience points to gaming_character_instance on eligible events (backend)
    - Implement POST /gameplay/{uuid_match}/action/use-exp endpoint to spend experience on stat increase (backend)
    - Validate advancement: character must be sleeping in safe location, have sufficient experience (backend)
    - Calculate experience cost per stat point based on difficulty exp_cost parameter (backend)
    - Apply stat increase (+1 DES, INT, or COS), deduct experience, update character instance (backend)
    - Build frontend advancement UI showing available stat upgrades, costs, and current experience (frontend)
    - Write backend unit tests for experience gain, advancement validation, cost calculation, and stat update (backend tests)
38. Edge states — coma, sadness overflow, game over
    - Implement sadness overflow: when sadness equals life, character loses COS life points, sadness resets to zero, forced sleep (backend)
    - Implement coma trigger: when life reaches zero or below, character enters coma state (is_coma=true, is_sleeping=true) (backend)
    - Implement POST /gameplay/{uuid_match}/action/ask-help endpoint to send help request to all characters (backend)
    - Implement POST /gameplay/{uuid_match}/action/help-player endpoint for coma rescue in same location (backend)
    - Implement group coma detection: when all characters are comatose, trigger story-defined group_coma event (backend)
    - Implement game over condition: match status transitions to GAMEOVER with timestamp when unrecoverable (backend)
    - Write backend unit tests for sadness overflow, coma trigger, ask-help, rescue mechanics, group coma, and game over transitions (backend tests)
39. Action logging and match history
    - Implement centralized logging service recording all player actions with match UUID, character, timestamp, and details (backend)
    - Log all events triggered (automatic and optional) in log_events with full context (backend)
    - Log all movements in log_movements with from/to, energy cost, and weather conditions (backend)
    - Log all item usage in log_item_usage with item, effects, and result (backend)
    - Log all weather changes in log_weather with clock, timestamps, and conditions (backend)
    - Implement GET /match/{uuid_match}/events/history/{page} endpoint returning paginated event history (backend)
    - Write backend unit tests for all logging services, history endpoint pagination, filtering, and data integrity (backend tests)
40. Match snapshots — save and restore
    - Implement automatic light snapshot creation at each time-end capturing current match state delta (backend)
    - Implement GET /admin/match/{uuid_match}/snapshot endpoint listing available snapshots with timestamps and types (backend)
    - Serialize full match state to JSONB: all gaming_* tables, registry, inventories, locations, turn queue (backend)
    - Implement PUT /admin/match/{uuid_match}/snapshot/{id} endpoint to restore match state from a snapshot (backend)
    - Validate snapshot integrity against current schema version before restoration (backend)
    - Build frontend admin snapshot viewer with list, details, and restore action (frontend)
    - Write backend unit tests for snapshot creation, serialization, restoration, integrity validation, and listing (backend tests)
41. Frontend: Single-player game board and gameplay UI
    - Build main game board layout: top (weather, clock, character card), center (location grid with actions), bottom (character book) (frontend)
    - Build location card component showing name, description, image, available events, and neighbor directions (frontend)
    - Build event/choice interaction modals displaying narrative text, options, and effect previews (frontend)
    - Build character stats panel showing energy, life, sadness, DES/INT/COS, experience, and trait badges (frontend)
    - Build inventory panel with item cards, resource counters, weight indicator, and use/discard actions (frontend)
    - Build mission sidebar showing active missions as cards with step indicators and registry highlights (frontend)
    - Write frontend unit tests for all game board components, interaction flows, stat displays, and state management (frontend tests)
42. Launch beta version with guest and single-player game
    - Verify all single-player features: match creation, character setup, full turn cycle, events, choices, inventory, missions (all)
    - Run complete playthrough of test story from start to finish, document and fix all blocking bugs (all)
    - Build and deploy backend Docker image with production configuration and database migrations (backend)
    - Deploy frontend build to S3/CDN with production API endpoint configuration (frontend)
    - Configure beta environment DNS, HTTPS, and basic monitoring health checks (infra)
    - Run smoke tests on beta environment: guest login, story selection, match creation, gameplay cycle (all)
    - Write release notes documenting beta features, known limitations, and feedback collection process (docs)


---

# PHASE 2 — Multiplayer Game with Credential Login (Steps 43-84)

43. User registration endpoint (email, username, password)
    - Implement POST /auth/register/new endpoint accepting email, username, and password (backend)
    - Validate input: email format, username length/characters, password strength rules (min length, complexity) (backend)
    - Hash password with BCrypt and persist user record with state=1 (registration pending) (backend)
    - Generate email verification token with expiration and store in users_tokens (backend)
    - Prevent duplicate registrations: check unique email and username constraints (backend)
    - Build frontend registration page with form validation, password strength indicator, and error display (frontend)
    - Write backend and frontend unit tests for registration validation, hashing, token generation, and duplicate handling (tests)
44. Email verification flow and account activation
    - Implement GET /auth/verify?token={token} endpoint to verify email and activate account (backend)
    - Validate verification token: exists, not expired, not already used (backend)
    - Transition user state from 1 (registration) to 2 (active) on successful verification (backend)
    - Implement POST /auth/verify/resend endpoint to regenerate verification token and resend email (backend)
    - Configure email service adapter (SMTP or external provider) for sending verification emails (backend)
    - Build frontend verification pending page and email verification success/error page (frontend)
    - Write backend and frontend unit tests for token validation, state transitions, resend logic, and email service mock (tests)
45. Google SSO integration
    - Configure Google OAuth 2.0 client with client_id and client_secret in application properties (backend)
    - Implement POST /auth/google endpoint accepting authorization code from frontend for SSO (backend)
    - Exchange authorization code with Google for access token and user profile (email, name, google_id) (backend)
    - Link Google account to existing user by email or create new user with state=2 and google_id_sso (backend)
    - Issue JWT access and refresh tokens after successful SSO authentication (backend)
    - Build frontend Google Sign-In button with OAuth redirect flow and callback handling (frontend)
    - Write backend and frontend unit tests for SSO flow, account linking, token exchange mocks, and error cases (tests)
46. Credential login and JWT token management
    - Implement POST /auth/login endpoint accepting username/email and password (backend)
    - Validate credentials against stored BCrypt hash and check user state is active (state=2) (backend)
    - Issue JWT access token (30 min) and refresh token (7 days), store refresh in users_tokens (backend)
    - Implement POST /auth/refresh endpoint for token rotation with old refresh token invalidation (backend)
    - Implement POST /auth/logout endpoint to revoke refresh token (backend)
    - Build frontend login page with remember-me option, token storage, and automatic refresh on 401 (frontend)
    - Write backend and frontend unit tests for login flow, token issuance, refresh rotation, logout, and auth interceptor (tests)
47. User profile and account management
    - Implement GET /auth/me endpoint returning user information and statistics (backend)
    - Implement POST /auth/convert/user endpoint to convert guest user to a normal user (backend)
    - Implement POST /auth/convert/google endpoint to convert guest user to google user with SSO (backend)
    - Maintain user statistics: total matches played, completed, abandoned, total play time (backend)
    - Implement user preference storage: language, theme, notification settings (backend)
    - Build frontend profile page showing user info, statistics, and session details (frontend)
    - Write backend and frontend unit tests for profile retrieval, statistics tracking, and guest conversion (tests)
48. Link guest sessions to registered accounts
    - Implement guest-to-registered linking via POST /auth/convert/user and POST /auth/convert/google endpoints (backend)
    - Transfer all match history, character instances, and statistics from guest user to registered account (backend)
    - Handle conflicts: if guest has active match, transfer ownership without interrupting gameplay (backend)
    - Invalidate guest user record and tokens after successful link (backend)
    - Preserve all game progress, registry entries, and logs under the new registered user ID (backend)
    - Build frontend prompt showing "Link your guest progress" option after registration/login (frontend)
    - Write backend and frontend unit tests for session linking, data transfer, conflict resolution, and invalidation (tests)
49. WebSocket server and STOMP broker configuration
    - Configure Spring WebSocket with STOMP broker using /ws endpoint (backend)
    - Define topic structure: /topic/match/{matchId} for match updates, /queue/user for personal notifications (backend)
    - Configure message broker with heartbeat intervals and session timeout parameters (backend)
    - Implement WebSocket handshake interceptor for origin validation and rate limiting (backend)
    - Configure CORS for WebSocket connections matching allowed frontend origins (backend)
    - Build frontend WebSocket client wrapper with STOMP.js, connection management, and auto-reconnect (frontend)
    - Write backend and frontend unit tests for WebSocket configuration, handshake interceptor, and client connection mocks (tests)
50. WebSocket JWT authentication and session mapping
    - Implement JWT validation in WebSocket handshake interceptor extracting user identity from token (backend)
    - Map authenticated WebSocket sessions to user and active match in gaming_user_sessions (backend)
    - Reject WebSocket connections with invalid, expired, or missing JWT tokens (backend)
    - Implement session registry tracking active connections per user with client_id, ip, and device (backend)
    - Handle token refresh for long-lived WebSocket connections without dropping the session (backend)
    - Build frontend token injection in STOMP connect headers with automatic re-auth on disconnect (frontend)
    - Write backend and frontend unit tests for JWT WebSocket auth, session mapping, rejection scenarios, and token refresh (tests)
51. WebSocket message types and payload definitions
    - Define message type enumeration: TURN_UPDATE, STATE_SYNC, EVENT_TRIGGERED, CHOICE_AVAILABLE, CHAT, NOTIFICATION, etc. (backend)
    - Design standardized message payload format: type, matchId, timestamp, senderId, data object (backend)
    - Implement message serialization service converting domain events to WebSocket payloads (backend)
    - Define match-specific topics: turn changes, weather, movement, events, choices, trade offers, chat (backend)
    - Define user-specific queues: personal notifications, trade proposals, movement invitations (backend)
    - Build frontend message dispatcher routing received messages to appropriate state handlers (frontend)
    - Write backend and frontend unit tests for message serialization, payload validation, and dispatcher routing (tests)
52. Real-time state sync — broadcast game actions
    - Broadcast turn change events to all match subscribers when active player changes (backend)
    - Broadcast movement events when any character moves to a new location (backend)
    - Broadcast event and choice notifications when triggered, including narrative text and options (backend)
    - Broadcast weather changes and time advancement to all connected match participants (backend)
    - Broadcast registry updates for visible keys so all players see game state changes (backend)
    - Update frontend state management to merge incoming WebSocket updates with local state (frontend)
    - Write backend and frontend unit tests for all broadcast scenarios, message delivery, and state merge logic (tests)
53. Client reconnection and desync recovery
    - Detect client disconnections via STOMP heartbeat timeout and update gaming_user_sessions.is_online (backend)
    - Allow safe reconnection within grace period (5 min) using existing JWT without creating new session (backend)
    - Send full match state snapshot to reconnecting client to resolve any missed updates (backend)
    - Implement state version counter on server to detect client desync via sequence comparison (backend)
    - Log all disconnect and reconnect events with timestamps and reason codes in gaming_user_sessions (backend)
    - Build frontend reconnection UI with progress indicator, retry logic, and state re-synchronization (frontend)
    - Write backend and frontend unit tests for disconnect detection, reconnection flow, snapshot delivery, and desync resolution (tests)
54. WebSocket lifecycle logging and monitoring
    - Log all WebSocket connection, disconnection, and error events with user, match, IP, and timestamp (backend)
    - Track active WebSocket connection count per match and system-wide for monitoring (backend)
    - Implement connection metrics: avg connection duration, message throughput, error rate (backend)
    - Log message delivery failures and retry attempts for critical game state updates (backend)
    - Expose WebSocket health endpoint: GET /admin/websocket/status with connection statistics (backend)
    - Build frontend connection status indicator showing online/offline/reconnecting state (frontend)
    - Write backend and frontend unit tests for lifecycle logging, metrics collection, and health endpoint (tests)
55. Multiplayer match creation endpoint
    - Implement POST /matches endpoint supporting multiplayer match creation with min/max player count (backend)
    - Validate multiplayer settings: player limits from difficulty, story compatibility, creator is authenticated user (backend)
    - Set match status to CREATED with timestamp_lock_expiration for lobby timeout (backend)
    - Initialize empty player slot list and set id_user_creator from authenticated user (backend)
    - Implement match visibility: public (joinable by anyone) vs private (invite link required) (backend)
    - Build frontend match creation form with multiplayer options: player limits, public/private toggle (frontend)
    - Write backend and frontend unit tests for multiplayer match creation, validation, visibility, and slot management (tests)
56. Match lobby and player joining
    - Implement GET /matches/active endpoint listing matches in status "wait for others players" (backend)
    - Implement GET /matches/list/{uuid_user}/{status} endpoint listing matches filtered by user and status (backend)
    - Implement POST /matches/{uuid_match}/join endpoint for player to join an existing match lobby (backend)
    - Validate: match accepting players, not full, player not already in another active match (if restricted) (backend)
    - Enforce maximum player count from selected difficulty.max_character (backend)
    - Build frontend match browser page showing available lobbies with player count, story, and difficulty (frontend)
    - Write backend and frontend unit tests for match listing, join validation, player count enforcement, and lobby display (tests)
57. Multiplayer character selection in lobby
    - Implement character selection flow for each player in lobby: template → class → traits (reuse single-player endpoints) (backend)
    - Validate no duplicate character templates in same match (prevent duplicate character setting) (backend)
    - Track selection status per player: NOT_SELECTED, TEMPLATE_CHOSEN, CLASS_CHOSEN, READY (backend)
    - Implement POST /matches/{uuid_match}/characters/{uuid_character}/ready endpoint to lock character selection (backend)
    - Broadcast character selection updates to all lobby members via WebSocket (backend)
    - Build frontend lobby character selection panel showing all players' selection progress in real-time (frontend)
    - Write backend and frontend unit tests for selection flow, duplicate prevention, ready locking, and broadcast (tests)
58. Lobby state sync and readiness tracking
    - Implement GET /matches/{uuid_match}/lobby endpoint returning full lobby state: players, characters, readiness (backend)
    - Track overall lobby readiness: all players must have status READY before match can start (backend)
    - Implement lobby countdown timer: auto-start after configurable delay when all players are ready (backend)
    - Implement POST /matches/{uuid_match}/leave endpoint for players to leave lobby before match start (backend)
    - Broadcast lobby events: player joined, player left, player ready, countdown started (backend)
    - Build frontend lobby page showing player list, character cards, readiness indicators, and countdown (frontend)
    - Write backend and frontend unit tests for lobby state, readiness tracking, countdown, leave, and broadcasts (tests)
59. Match start — validate players and initialize state
    - Implement POST /matches/{uuid_match}/start endpoint (creator-only or auto-trigger) for multiplayer start (backend)
    - Validate all players have selected and locked characters, minimum player count met (backend)
    - Initialize game state for all characters: positions at start location, full energy/life, empty backpacks (backend)
    - Calculate and persist turn queue with priority formula for all characters (backend)
    - Transition match status from CREATED to RUNNING, set timestamp_start (backend)
    - Broadcast MATCH_STARTED event to all connected players via WebSocket (backend)
    - Write backend unit tests for start validation, multi-character initialization, turn queue, and status transition (backend tests)
60. Frontend: Multiplayer lobby UI
    - Build full multiplayer lobby page with real-time player list updated via WebSocket (frontend)
    - Build character selection carousel for each player with live status badges (SELECTING, READY) (frontend)
    - Implement lobby chat/quick-message area for pre-game communication (frontend)
    - Build countdown overlay displayed when all players are ready (frontend)
    - Build match creator controls: start button, kick player, cancel match (frontend)
    - Implement responsive layout handling 2-10 player lobbies with scrollable player cards (frontend)
    - Write frontend unit tests for lobby components, real-time updates, creator controls, and responsive layouts (frontend tests)
61. Multiplayer turn cycle — turn order and active player
    - Extend turn engine to manage multiple characters with priority-based ordering in gaming_turn_queue (backend)
    - Track current active character in gaming_match.id_character_current_turn and broadcast changes (backend)
    - Implement turn advancement: move to next character in queue when current turn completes (backend)
    - Handle turn passing for multiplayer: player passes their character's turn, next in queue activates (backend)
    - Detect round completion: all characters have acted, prepare for next round or time advancement (backend)
    - Build frontend turn order panel showing all characters' queue position with active player highlight (frontend)
    - Write backend and frontend unit tests for multi-character turn ordering, advancement, passing, and round detection (tests)
62. Out-of-turn action blocking and validation
    - Implement action guard interceptor checking current turn character matches requesting user (backend)
    - Block movement, event triggers, choice submissions, and item usage when it's not the player's turn (backend)
    - Allow non-turn actions: view inventory, view map, read chat, view registry (read-only operations) (backend)
    - Return clear error response with current active player info when out-of-turn action attempted (backend)
    - Implement lock acquisition: only one action at a time per match to prevent race conditions (backend)
    - Build frontend UI disabling action buttons when not player's turn, showing "waiting for {player}" indicator (frontend)
    - Write backend and frontend unit tests for turn guard, action blocking, allowed read operations, and lock management (tests)
63. Turn timeout and automatic pass
    - Configure turn timeout duration per match from difficulty settings or global variable (backend)
    - Start countdown timer when character turn begins, stored in gaming_turn_queue.timestamp_end (backend)
    - Implement scheduled task checking for expired turns every 5 seconds (backend)
    - Auto-pass turn on timeout: skip character's action, advance to next in queue (backend)
    - Log timeout events in log_events and increment gaming_character_instance.counter_consecutive_pass (backend)
    - Build frontend countdown timer display with visual warning at 25% and 10% remaining time (frontend)
    - Write backend and frontend unit tests for timeout calculation, auto-pass trigger, consecutive counter, and timer display (tests)
64. Turn change notifications via WebSocket
    - Broadcast TURN_CHANGED message when active player switches, including new player ID and timeout deadline (backend)
    - Broadcast TURN_TIMEOUT message when a character's turn expires with auto-pass notification (backend)
    - Broadcast ROUND_COMPLETE message when all characters have acted in current round (backend)
    - Broadcast TIME_ADVANCING message when time unit progresses with new weather and recovery info (backend)
    - Send personal QUEUE notification to each player showing their position in upcoming turn order (backend)
    - Update frontend turn panel in real-time on receiving TURN_CHANGED and queue position updates (frontend)
    - Write backend and frontend unit tests for all broadcast message types, payload content, and UI updates (tests)
65. Multiplayer time advancement
    - Extend time advancement for multiplayer: advance only when ALL characters have zero energy or are sleeping (backend)
    - Apply time-start recovery individually per character based on their current location safety (backend)
    - Recalculate turn queue priorities for all characters at new time start (backend)
    - Handle mixed state: some characters sleeping voluntarily, others at zero energy (backend)
    - Apply global random events at time start using list_global_random_events conditions and probabilities (backend)
    - Broadcast TIME_STARTED message with new weather, recovery summary, and updated turn order (backend)
    - Write backend unit tests for multi-character time advancement, individual recovery, queue recalculation, and random events (backend tests)
66. Stalemate detection and consecutive pass handling
    - Track consecutive pass counter per character in gaming_character_instance.counter_consecutive_pass (backend)
    - Track match-level consecutive pass rounds in gaming_match.counter_consecutive_pass (backend)
    - Increment match counter when ALL characters pass in a single round with remaining energy (backend)
    - Trigger warning at configurable threshold (e.g., 3 consecutive pass rounds) broadcast to all players (backend)
    - Trigger game over (GAMEOVER) when counter exceeds maximum from difficulty settings (backend)
    - Build frontend stalemate warning banner displaying consecutive pass count and game over threshold (frontend)
    - Write backend and frontend unit tests for pass counting, threshold warnings, game over trigger, and counter reset (tests)
67. Multiplayer movement with real-time updates
    - Extend movement endpoint to broadcast PLAYER_MOVED message to all match subscribers (backend)
    - Include movement details in broadcast: character, from/to locations, remaining energy (backend)
    - Update all connected clients' location maps to reflect character position changes (backend)
    - Validate multiplayer-specific movement rules: location capacity with all characters considered (backend)
    - Handle concurrent movement attempts to same capacity-limited location (first-come-first-served with lock) (backend)
    - Update frontend location grid to show character tokens moving in real-time on WebSocket message (frontend)
    - Write backend and frontend unit tests for movement broadcast, capacity with multi-player, lock contention, and UI updates (tests)
68. Group movement — follow invitations
    - Trigger follow invitation as part of POST /gameplay/{uuid_match}/movements/start when group movement is requested (backend)
    - Create gaming_movement_invites record with sender, target, state=PENDING, energy cost, timeout (backend)
    - Send personal WebSocket notification to invited characters with movement details and accept button (backend)
    - Implement GET /gameplay/{uuid_match}/movements/pending endpoint listing pending movement invitations (backend)
    - Implement POST /gameplay/{uuid_match}/movements/confirm-movement-invite endpoint for accepting follow (backend)
    - Move accepting character to sender's new location with zero energy cost (free group movement) (backend)
    - Build frontend follow invitation popup with accept/decline buttons and countdown timer (frontend)
    - Write backend and frontend unit tests for invite creation, notification, pending list, accept/decline flow, timeout, and free movement (tests)
69. Movement invite timeout and expiration
    - Configure movement invite timeout from global variable (default 30 seconds) (backend)
    - Implement scheduled task checking for expired invitations, updating state to EXPIRED (backend)
    - Cancel pending invitations when match time advances or turn changes (backend)
    - Update gaming_movement_invites with timestamp_answer on accept, decline, or expiration (backend)
    - Broadcast INVITE_EXPIRED message to sender when timeout occurs (backend)
    - Build frontend auto-dismiss for expired invitations with visual countdown indicator (frontend)
    - Write backend and frontend unit tests for timeout expiration, cancellation triggers, state updates, and UI countdown (tests)
70. Frontend: Multiplayer movement and follow UI
    - Build location map showing all characters' positions with distinct token icons per player (frontend)
    - Build movement direction buttons (N/S/E/W/UP/DOWN/SKY) with energy cost preview and availability (frontend)
    - Build group movement invitation panel showing who is in your location and "Invite to follow" buttons (frontend)
    - Build incoming invitation popup with origin/destination, sender name, and accept/decline/timer (frontend)
    - Show movement animations or transitions when characters change locations (frontend)
    - Display location capacity warnings when approaching max_characters limit (frontend)
    - Write frontend unit tests for location map, movement buttons, invitation panels, and animations (frontend tests)
71. Trade system — propose, accept, reject
    - Implement POST /gameplay/{uuid_match}/inventory/trade-item endpoint to send a trade message to another character (backend)
    - Implement GET /gameplay/{uuid_match}/inventory/trades/pending endpoint listing all pending/active trade messages (backend)
    - Implement POST /gameplay/{uuid_match}/inventory/trade/{uuid_trade}/accept-reject endpoint for recipient to accept or reject trade (backend)
    - Implement DELETE /gameplay/{uuid_match}/inventory/trade/{uuid_trade} endpoint to undo/cancel a trade invitation (backend)
    - Validate both characters in same location, both awake and not comatose (backend)
    - Send personal WebSocket notification to trade recipient with proposal details (backend)
    - Write backend unit tests for trade creation, pending list, accept/reject, cancel, location validation, and WebSocket notification (backend tests)
72. Trade validation, timeout, and execution
    - Validate offered items exist in sender's inventory, requested items exist in recipient's inventory (backend)
    - Validate resource amounts: sender has enough food/magic/coins, no negative after trade (backend)
    - Configure trade timeout from global variable (default 60 seconds), auto-reject on expiration (backend)
    - Execute trade: transfer items and resources between characters, update both inventories atomically (backend)
    - Create gaming_trades record with status tracking: PENDING → ACCEPTED/REJECTED/EXPIRED (backend)
    - Broadcast TRADE_COMPLETED or TRADE_EXPIRED to both parties (backend)
    - Write backend unit tests for item/resource validation, timeout, atomic execution, status transitions, and broadcasts (backend tests)
73. In-game chat system
    - Implement POST /gamechat/{uuid_match}/chat endpoint to send a chat message (with spam check = TimeBetweenMessages) (backend)
    - Implement GET /gamechat/{uuid_match}/chat/{page} endpoint returning paginated chat history (backend)
    - Store messages in chat_messages with match, user, character, message, timestamp, counter (backend)
    - Broadcast chat messages via WebSocket /topic/match/{matchId}/chat to all match participants (backend)
    - Implement message rate limiting: minimum time between messages per user (configurable) (backend)
    - Build frontend chat panel with message list, input field, send button, and scroll-to-bottom (frontend)
    - Write backend and frontend unit tests for chat send, history, broadcast, rate limiting, and UI components (tests)
74. Chat moderation, filtering, and rate limiting
    - Implement basic word filter for offensive content using configurable word list (backend)
    - Implement message length limit and character sanitization to prevent XSS (backend)
    - Implement admin mute capability: POST /admin/match/{uuid_match}/users/{uuid_user}/mute (backend)
    - Log moderation actions: filtered messages, muted users, with timestamps and admin ID (backend)
    - Handle muted user: reject chat messages with clear error, maintain mute state per match (backend)
    - Build frontend muted state indicator and admin mute button in player list (frontend)
    - Write backend and frontend unit tests for word filtering, sanitization, mute flow, logging, and UI states (tests)
75. Notification queue and priority system
    - Implement gaming_notification_queue records for all system notifications: trade, invite, turn, events (backend)
    - Define notification priority levels: CRITICAL (turn change), HIGH (trade/invite), NORMAL (chat), LOW (system info) (backend)
    - Send queued notifications via WebSocket to connected users, persist for offline users (backend)
    - Implement GET /gamechat/{uuid_match}/notifications/{page} endpoint returning paginated notification list (backend)
    - Implement GET /gamechat/{uuid_match}/notifications/unread endpoint returning all unread notifications (backend)
    - Implement POST /gamechat/{uuid_match}/notifications/{uuid_notification}/mark-read endpoint to mark a notification as read (backend)
    - Build frontend notification center with badge count, priority sorting, and toast popups for critical items (frontend)
    - Write backend and frontend unit tests for notification queue, priority sorting, delivery, unread count, read marking, and UI (tests)
76. Frontend: Trade, chat, and notifications UI
    - Build trade proposal dialog: item/resource picker, quantity selectors, and send button (frontend)
    - Build incoming trade popup: proposed items/resources, accept/reject buttons, countdown timer (frontend)
    - Build chat interface matching card/book style: post-it note messages, sender character icons (frontend)
    - Build notification center panel with expandable items, priority badges, and clear-all button (frontend)
    - Integrate all trade, chat, and notification WebSocket streams with frontend state management (frontend)
    - Implement visual and audio indicators for new messages, trade proposals, and critical notifications (frontend)
    - Write frontend unit tests for trade dialogs, chat interface, notification center, and real-time integration (frontend tests)
77. Admin dashboard — match overview and player info
    - Implement GET /admin/matches/ endpoint listing all matches with status, player count, and timestamps (backend)
    - Implement GET /admin/params endpoint returning all parameter values from global_runtime_variables (backend)
    - Implement GET /admin/match/{uuid_match}/replay endpoint returning all match logs for replay (backend)
    - Implement GET /admin/match/{uuid_match}/log/{filter} endpoint returning filtered action logs (character, item, ...) (backend)
    - Add admin authorization check (ADMIN role) to all /admin/** endpoints (backend)
    - Build frontend admin dashboard page with match list, status badges, and player count indicators (frontend)
    - Write backend and frontend unit tests for admin endpoints, authorization checks, and dashboard components (tests)
78. Admin actions — force turn, end match, restore snapshot
    - Implement POST /admin/match/{uuid_match}/force-unlock endpoint to force new day and new turn queue on stuck/locked matches (backend)
    - Implement PATCH /admin/matches/{uuid_match} endpoint to delete/terminate a match (backend)
    - Implement POST /admin/match/{uuid_match}/pause and /resume endpoints for match state control (backend)
    - Implement PUT /admin/match/{uuid_match}/register endpoint to put a value into the match register (backend)
    - Implement POST /admin/system/export endpoint to export all database data into backup storage (backend)
    - Implement POST /admin/system/import endpoint to restore all database data from a backup file (backend)
    - Log all admin interventions in log_events with admin user ID, action type, and reason (backend)
    - Build frontend admin match control panel with action buttons, confirmation dialogs, and reason input (frontend)
    - Write backend and frontend unit tests for all admin actions, logging, state transitions, and confirmation flows (tests)
79. Admin user management — suspend, ban, unlock
    - Implement POST /admin/users/{uuid}/ban endpoint to ban user (state=4, remove from active matches) (backend)
    - Implement POST /admin/users/{uuid}/suspend endpoint to temporarily block user (state=3) (backend)
    - Implement POST /admin/users/{uuid}/unblock endpoint to restore user to active state (backend)
    - Implement GET /admin/users endpoint listing users with search, filter by state, and pagination (backend)
    - Implement POST /admin/match/{uuid_match}/kick/{uuid_user} endpoint to kick/ban a user and stop all match activity (backend)
    - Build frontend admin user management page with user list, search, and action buttons (frontend)
    - Write backend and frontend unit tests for ban/suspend/unblock flows, user listing, kick, and state transitions (tests)
80. Frontend: Admin tools dashboard
    - Build admin navigation with sections: Matches, Users, Stories, System, Monitoring (frontend)
    - Build match detail page showing full game state: characters, locations, registry, turn queue (frontend)
    - Build match replay viewer: scroll through action history showing state changes at each step (frontend)
    - Build user detail page showing profile, match history, admin action log, and session info (frontend)
    - Build system configuration page showing global_runtime_variables with edit capability (frontend)
    - Implement role-based UI: hide admin navigation and pages for non-admin users (frontend)
    - Write frontend unit tests for admin dashboard sections, replay viewer, config editor, and role guard (frontend tests)
81. Frontend: Multiplayer game board with real-time updates
    - Extend single-player game board to show all characters' positions, stats, and actions (frontend)
    - Build multi-character top bar showing all players as cards with active turn indicator (frontend)
    - Update location grid to show multiple character tokens with distinct colors/icons (frontend)
    - Implement real-time location updates: characters appear/disappear as they move (frontend)
    - Show other players' event/choice notifications as spectator view (narrative text without spoiling options) (frontend)
    - Handle concurrent UI updates: debounce rapid state changes, resolve display conflicts (frontend)
    - Write frontend unit tests for multi-character board, token display, real-time updates, and spectator view (frontend tests)
82. Frontend: Turn indicators, timeout warnings, player panels
    - Build prominent "Your Turn" / "Waiting for {player}" banner with active player's character card (frontend)
    - Build visual countdown timer: circular progress bar matching turn timeout duration (frontend)
    - Build player panels showing all characters: name, class, energy/life bars, location, and sleep/coma status (frontend)
    - Implement timeout warning animations at 25%, 10%, and 5% remaining time (frontend)
    - Build turn history sidebar showing recent actions by all players in chronological order (frontend)
    - Handle turn transitions smoothly: animate banner change, play sound on your-turn activation (frontend)
    - Write frontend unit tests for turn banners, countdown timer, player panels, and warning animations (frontend tests)
83. Frontend: Reconnection UI, WebSocket status, error handling
    - Build connection status indicator: green (connected), yellow (reconnecting), red (disconnected) (frontend)
    - Build reconnection overlay with progress bar, retry counter, and manual reconnect button (frontend)
    - Implement automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s) (frontend)
    - Build error toast system for API errors, WebSocket failures, and game rule violations (frontend)
    - Handle stale state detection: show "sync required" banner when local state diverges from server (frontend)
    - Build offline mode indicator: disable actions, queue inputs, sync on reconnect (frontend)
    - Write frontend unit tests for connection states, reconnection logic, error toasts, and offline mode (frontend tests)
84. Multiplayer end-to-end integration testing
    - Test complete multiplayer match lifecycle: create lobby → join → select characters → start → play → end (all)
    - Test WebSocket scenarios: connect, receive updates, disconnect, reconnect, receive missed state (all)
    - Test concurrent actions: simultaneous movement, trade during turn, chat during gameplay (backend)
    - Test edge cases: player leaves mid-match, all players disconnect, timeout cascade, stalemate (backend)
    - Test trade full cycle: propose → accept → verify inventory changes, propose → timeout → verify expiration (backend)
    - Run automated integration tests with multiple simulated clients against running backend instance (all)
    - Write integration test report documenting scenarios, results, and remaining issues (docs)


---

# PHASE 3 — Testing, Infrastructure, and V1 Launch (Steps 85-101)

85. Security audit — input validation, CORS, rate limiting
    - Audit all REST endpoints for input validation: SQL injection, XSS, path traversal, oversized payloads (backend)
    - Configure CORS policy: restrict origins to known frontend domains, block credentials for unknown origins (backend)
    - Implement API rate limiting: per-user request quotas with configurable thresholds and 429 responses (backend)
    - Validate all UUID parameters against UUID format, reject malformed identifiers (backend)
    - Audit JWT implementation: verify algorithm, key strength, token expiration, claim validation (backend)
    - Implement Content Security Policy headers and X-Frame-Options for frontend (frontend)
    - Write security-focused unit tests for injection attempts, CORS violations, rate limit triggers, and CSP headers (tests)
86. Security hardening — HTTPS, headers, CSRF, XSS prevention
    - Enforce HTTPS for all API and WebSocket connections in production configuration (backend)
    - Configure security headers: Strict-Transport-Security, X-Content-Type-Options, X-XSS-Protection (backend)
    - Implement CSRF protection for state-changing endpoints (POST/PUT/DELETE) (backend)
    - Sanitize all user-generated content: chat messages, usernames, display names (backend)
    - Implement request signing or nonce for critical operations (match creation, trades) (backend)
    - Audit frontend for XSS vulnerabilities: sanitize rendered HTML, escape dynamic content (frontend)
    - Write security hardening tests for HTTPS redirect, header presence, CSRF tokens, and content sanitization (tests)
87. Authentication and authorization penetration testing
    - Test JWT bypass attempts: token manipulation, algorithm confusion, key brute force (backend)
    - Test role escalation: guest accessing admin endpoints, player accessing other player's data (backend)
    - Test session hijacking: token replay, refresh token theft, concurrent session limits (backend)
    - Test guest isolation: verify guest cannot access registered-user-only features (backend)
    - Test OAuth flow: redirect URI manipulation, state parameter validation, token exchange replay (backend)
    - Test WebSocket auth: connect without token, connect with expired token, impersonate another user (backend)
    - Document all findings with severity, reproduction steps, and applied fixes (docs)
88. Write complete test story — 30-60 min gameplay
    - Design minimal story plot with beginning, middle, and branching endings (all)
    - Create 15-30 locations with adjacency map, varied safety levels, and capacity limits (all)
    - Create 30-50 events with triggers, effects, and chaining covering all event types (all)
    - Create 20-40 choices with diverse conditions: stat checks, registry, items, class-specific (all)
    - Create 10-15 items with varied effects, weights, and class restrictions (all)
    - Create 3-5 missions with multi-step progression and completion rewards (all)
    - Validate story completability: verify at least one path from start to ending with no dead ends (all)
89. End-to-end single-player playtest
    - Play complete test story from guest login through character creation to story completion (all)
    - Test all event types: automatic first entry, subsequent entry, time start, optional triggers (all)
    - Test all choice condition types: stat requirements, registry checks, item possession, traits (all)
    - Test inventory management: acquire items, use items, discard, weight limits, movement blocking (all)
    - Test edge states: reach coma, trigger sadness overflow, attempt movement while overweight (all)
    - Test mission progression: activate missions, advance steps, complete missions, receive rewards (all)
    - Document all bugs with reproduction steps, expected vs actual behavior, and severity rating (docs)
90. End-to-end multiplayer playtest — 4+ players
    - Play complete test story with 4+ players from lobby creation through match completion (all)
    - Test turn rotation: verify turn order calculation, timeout auto-pass, consecutive pass detection (all)
    - Test multiplayer interactions: trade items/resources, group movement, all-in-same-location events (all)
    - Test WebSocket reliability: simultaneous actions, message ordering, no duplicates, no missed updates (all)
    - Test player disconnection: disconnect mid-turn, reconnect, verify state consistency (all)
    - Test chat and notifications: send messages, receive notifications, verify rate limiting (all)
    - Document all multiplayer-specific bugs with player count, timing, and network conditions (docs)
91. Edge case testing — disconnects, timeouts, coma, stalemate
    - Test simultaneous disconnection of all players and server state preservation (backend)
    - Test timeout cascade: all players AFK, verify auto-pass chain and eventual time advancement (backend)
    - Test coma scenarios: single player coma, group coma, rescue mechanics, coma during trade (backend)
    - Test stalemate: all players pass repeatedly until stalemate threshold triggers game over (backend)
    - Test concurrent operations: trade + movement, choice + timeout, chat + turn change (backend)
    - Test data integrity: verify no orphaned records, no inconsistent state after each edge case (backend)
    - Write automated edge case tests covering all documented scenarios with assertions (backend tests)
92. Regression testing and bug fixing
    - Run all backend unit tests and verify 100% pass rate with coverage reports (backend)
    - Run all frontend unit tests and verify 100% pass rate with coverage reports (frontend)
    - Fix all critical and high-severity bugs documented during playtesting phases (all)
    - Re-test all fixed bugs to verify resolution without introducing new regressions (all)
    - Run full integration test suite with all edge case scenarios (all)
    - Update unit tests to cover any newly discovered code paths from bug fixes (tests)
    - Generate final test coverage report and document known issues with workarounds (docs)
93. Performance testing — API response times and thresholds
    - Define performance targets: API response <2s (p95), WebSocket delivery <500ms, page load <3s (all)
    - Measure all REST endpoint response times under normal load (1 concurrent match, 4 players) (backend)
    - Identify slow endpoints and optimize: add database indexes, optimize queries, reduce payload size (backend)
    - Test frontend rendering performance: component mount times, re-render frequency, memory usage (frontend)
    - Profile backend memory usage and garbage collection patterns during extended gameplay (backend)
    - Optimize JSON serialization and WebSocket message size for high-frequency updates (backend)
    - Write performance benchmark tests with threshold assertions that fail on regression (tests)
94. Load testing — concurrent matches and WebSocket connections
    - Define load targets: 100 concurrent matches, 10 players per match, sustained for 30 minutes (all)
    - Simulate concurrent user load with automated test clients (JMeter, Gatling, or k6) (all)
    - Test WebSocket connection handling: 1000 concurrent connections, message broadcast latency (backend)
    - Measure database performance under load: connection pool utilization, query times, lock contention (backend)
    - Identify bottlenecks in turn processing, event evaluation, and state synchronization (backend)
    - Optimize connection pooling, thread management, and async processing for peak load (backend)
    - Generate load test report with throughput, latency percentiles, error rates, and resource utilization (docs)
95. Database optimization — queries, indexes, connection pooling
    - Analyze slow query logs and identify top 10 most expensive database operations (backend)
    - Add composite indexes for common query patterns: match lookups, character queries, registry searches (backend)
    - Optimize JPA fetch strategies: lazy vs eager loading, batch fetching, DTO projections (backend)
    - Configure connection pool sizes for PostgreSQL: min/max connections, timeout, idle eviction (backend)
    - Implement query result caching for frequently accessed read-only data (stories, items, locations) (backend)
    - Optimize Flyway migration execution and validate production migration performance (backend)
    - Write database performance tests comparing optimized vs baseline query execution times (backend tests)
96. Monitoring — health checks, metrics, dashboards
    - Implement Spring Boot Actuator health checks: database, WebSocket broker, disk space, custom game metrics (backend)
    - Expose Prometheus-compatible metrics: request count, error rate, response time, active matches, connections (backend)
    - Configure Grafana dashboards: API performance, WebSocket status, match activity, error trends (infra)
    - Implement custom game metrics: active matches, concurrent players, turn processing time, event throughput (backend)
    - Configure alerting rules: API error rate >5%, response time >5s, WebSocket disconnection spike (infra)
    - Build frontend status page showing system health and maintenance notices (frontend)
    - Write unit tests for health check endpoints, metric collection, and custom game metric calculations (tests)
97. Logging aggregation and alerting
    - Configure structured logging (JSON format) for all backend services with correlation IDs (backend)
    - Set up log aggregation pipeline: application logs → centralized store (ELK, CloudWatch, or similar) (infra)
    - Configure log levels per environment: DEBUG for dev, INFO for prod, ERROR alerts (backend)
    - Implement request tracing: unique request ID from REST through service to database and WebSocket (backend)
    - Configure alert notifications: critical errors → team chat/email, warning thresholds → dashboard (infra)
    - Implement frontend error logging: capture and report JavaScript errors to backend endpoint (frontend)
    - Write tests for structured log format, correlation ID propagation, and log level configuration (tests)
98. Production infrastructure — Terraform, Kubernetes, cloud deploy
    - Write Terraform modules for production environment: VPC, subnets, security groups, load balancer (infra)
    - Configure Kubernetes deployment manifests: backend pods, resource limits, auto-scaling, health probes (infra)
    - Configure PostgreSQL production instance: RDS/managed database, encryption, backup schedule (infra)
    - Configure Docker image build pipeline: multi-stage build, vulnerability scanning, registry push (infra)
    - Implement zero-downtime deployment strategy: rolling update with readiness/liveness probes (infra)
    - Configure environment variables and secrets management (Kubernetes secrets or AWS Secrets Manager) (infra)
    - Write infrastructure tests: Terraform plan validation, Kubernetes manifest linting, connectivity checks (tests)
99. DNS, CDN, SSL certificates, backup, and disaster recovery
    - Configure production DNS: api.v1.paths.games pointing to load balancer (infra)
    - Configure CDN (CloudFront or similar) for frontend static assets with cache invalidation (infra)
    - Provision and configure SSL/TLS certificates with auto-renewal (Let's Encrypt or ACM) (infra)
    - Implement database backup strategy: daily full backup, hourly incremental, off-site replication (infra)
    - Document and test disaster recovery procedure: database restore, infrastructure rebuild, DNS failover (infra)
    - Configure WebSocket-compatible load balancer with sticky sessions or connection draining (infra)
    - Write runbook for production incidents: escalation path, rollback procedure, communication template (docs)
100. Technical and operational documentation
    - Document all REST API endpoints with request/response examples and error codes (OpenAPI/Swagger) (docs)
    - Document all WebSocket message types, topic structure, and payload schemas (docs)
    - Document database schema with ER diagrams, table descriptions, and migration procedures (docs)
    - Document game rules: turn mechanics, stat formulas, event/choice system, and edge state handling (docs)
    - Document deployment architecture: infrastructure diagram, component interactions, and scaling strategy (docs)
    - Document admin operations: match management, user moderation, snapshot restore, and monitoring (docs)
    - Write developer onboarding guide: local setup, project structure, coding conventions, and PR workflow (docs)
101. V1 Launch — deploy, final smoke test, announce
    - Deploy production backend with all migrations and seed data to Kubernetes/EBS cluster (infra)
    - Deploy production frontend to S3/CDN with production API endpoint and cache configuration (infra)
    - Run final smoke test suite: guest login, registration, SSO, match creation, single-player game, multiplayer game (all)
    - Verify monitoring and alerting: confirm dashboards load, test alert triggers, verify log collection (infra)
    - Run production load test at 50% target capacity to verify stability (all)
    - Configure production feature flags and global_runtime_variables for V1 settings (backend)
    - Announce V1 launch: update website, publish release notes, open public access at paths.games (all)


# Version Control
- First version created with AI prompt:
    > Read "Start project" file and assume I want to create and to start developing it: give me 30 steps to follow, a simple list where the first is "start the project"; for each step give 5 subpoints.
- Second version created with AI prompt:
    > next step must be from 12 to 42, number 12 should be start develop login method to guess users, number 33 should be registrazion user, 34 single sign on with google, 42 is launch the game with v1 version. rewrite all point fron 12 to 42.
- Steps are developed with prompt:
    > read all documentation md files inside documentation_v0 folder, i wanna to run step XX: write all java backend code into code/backend project using JPA, complete all unit-test using mokito to cover 100% of branches-case, create a simple web example to use new interfaces inside new code/website/concepts_v0/v0.XX.0/ folder, write new md file inside documentation_v0 folder with all details, write a section with (endpoint apis, DTO, roles, tables, test cases and business logic). read code/website/html folder for last version of public website. don't look and don't change backend-python and backend-php. write openapi documentation into /mnt/Dati4/Workspace/pathsgames/code/backend/adapter-rest/src/main/resources/openapi folder with new/changed api. let's go
- Update steps list with prompt:
    > ciao, read all "documentation_v0" for context, i wanna change my roadmap file, now I've 42 step, 13 already done and i started to work to step 14,  I wanna change my roadmap to be 101 step, 14 step should be stories management, from 14 to 42 should be single-player game system with only guess login, I would 42 step be "launch beta version with guess and single player game". since 43 to 84 "multiplayer game with credential login" with all multiplayer systems and game engine. since 85 to 101 test and launch system. all step with 7 subpoint , subpoint for backend and frontend too, add unit test into frontend and backend. 


- **Document Version**: 0.14.1 (here only due changes)
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.1.0 | first version of this document | February 3, 2026 |
	| 0.1.1 | added licence and version control sections, file renamed from "todolist" to "roadmap" | February 5, 2026 |
    | 0.1.2 | update "2. Define the V1 scope" and "3. Define the technology stack" sections | February 10, 2026 |
    | 0.6 | step 04, step 05, step 06 | February 26, 2026 |
    | 0.7 | step 07: configure website | February 27, 2026 |
    | 0.8 | step 08: configure CI | March 5, 2026 |
    | 0.9 | step 09: design core data model | March 9, 2026 |
    | 0.10.12 | step 10: create initial DB schema | March 19, 2026 |
    | 0.11.1 | expanded roadmap from 30 to 42 steps, Version 1 launch at step number 42 | March 24, 2026 |
    | 0.14.1 | expanded roadmap from 42 to 101 steps with 3 phases: single-player beta (42), multiplayer (43-84), testing and V1 launch (85-101). All steps now have 7 subpoints covering backend, frontend, and unit tests | April 9, 2026 |
- **Last Updated**: April 9, 2026
- **Status**: In progress




# &lt; Paths Games /&gt;
All source code and informations in this repository are the result of careful and patient development work by developer team, who has made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.

Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.

For all details, in-depth information, or requests for clarification, please visit [Paths.Games](https://paths.games/) website



## License
Made with ❤️ by <a href="https://github.com/gamespaths/pathsgames">paths.games dev team</a>
&bull; 
Public projects 
<a href="https://www.gnu.org/licenses/gpl-3.0"  valign="middle"> <img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=plastic" alt="GPL v3" valign="middle" /></a>
*Free Software!*


The software is distributed under the terms of the GNU General Public License v3.0. Use, modification, and redistribution are permitted, provided that any copy or derivative work is released under the same license. The content is provided "as is", without any warranty, express or implied.


Narrative Content & Assets: The story, dialogues, characters, sounds, musics, paint, all artist contents and world-building (located on /data folder) are NOT open source. They are licensed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 (CC BY-NC-ND 4.0).


(ITA) Il software è distribuito secondo i termini della GNU General Public License v3.0. L'uso, la modifica e la ridistribuzione sono consentiti, a condizione che ogni copia o lavoro derivato sia rilasciato con la stessa licenza. Il contenuto è fornito "così com'è", senza alcuna garanzia, esplicita o implicita.







