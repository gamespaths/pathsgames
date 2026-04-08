# Paths Games V0 - Roadmap & Todo-List

This document defines the **project plan** to build a **Paths Games**, an playable web-based game, with detailed requirements and scope for create the V1 release.

The file lists a 42-step development roadmap (each with five substeps) covering repo setup, V1 scope, tech stack, backend modules, environments, CI, naming conventions, and API versioning. It specifies core gameplay systems: data model, game state, turn cycle, timeouts, WebSocket sync, movement, choices, event handling, inventory, trade, logging, snapshots, admin tools, and testing/playtest. Authentication progresses from guest login (step 12) through user registration (step 33) and Google SSO (step 34). Frontend covers a minimal playable UI and gameplay interface. The roadmap concludes with performance testing, documentation, and V1 launch (step 42).


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


| Steps | Phase |
| -- | -- |
| 14-17	| Match lifecycle (create, join, character select, start) |
| 18-22	| Core gameplay engine (turns, WebSocket, reconnect, timeouts) |
| 23-27 | Game mechanics (movement, choices, events, inventory, trade) |
| 28-30 | Logging, snapshots, error handling
| 31-32	| Frontend (minimal playable UI + gameplay UI)
| 33-34 | User registration, Single sign-on with Google
| 35-38	| Profile management, admin tools, test story, in-game chat
| 39-41	| End-to-end playtest, load testing, documentation
| 42	| Launch the game with V1 version


## Next steps
For next steps use this prompt 
> read all documentation md files inside documentation_v0 folder, i wanna to run step XX: write all java backend code into code/backend project using JPA, complete all unit-test using mokito to cover 100% of branches-case, create a simple web example to use new interfaces inside new code/website/concepts_v0/v0.XX.0/ folder. write new md file inside documentation_v0 folder with all details, write a section with (endpoint apis, DTO, roles, tables, test cases and business locig). read code/website/html folder for last version of public website. don't look and don't change backend-python and backend-php. write openapi documentation into /mnt/Dati4/Workspace/pathsgames/code/backend/adapter-rest/src/main/resources/openapi folder with new/changed api. let's go

14. Implement match creation endpoint
    - Create REST endpoint to get all stories (/stories/.../ apis, root api method /stories/ is deprecated)
    - Create REST endpoint to create a match (with character select)
    - Validate story and difficulty selection
    - Generate match UUID and initial state
    - Persist match to database (creating all tables: _match, _state_registry, _state_locations, _user_sessions... )
    - Return match details to creator
    - Business validation (check story exist, diffult corret, version compatiblity, users not banned, system not in manteinance)
    - Create endpoint to start the match (for singleplayer )
15. Implement match joining and lobby
    - Create endpoint to get all existing match not started
    - Create endpoint to join an existing match
    - Validate match state allows joining
    - Enforce maximum player count
    - Expose lobby state via API
    - Notify connected clients when a player joins
16. Implement character selection
    - Create endpoint for character selection
    - Validate character availability per story
    - Prevent duplicate character selection
    - Lock selections when all players have chosen
    - Broadcast selection updates to lobby
    - Business validation (check story exist, diffult corret, version compatiblity, users not banned, system not in manteinance)
17. Implement match start and initial state
    - Create endpoint to start the match (for multiplayer matches)
    - Validate all players have selected characters
    - Initialize game state (positions, inventories, turn order)
    - Persist initial state snapshot
    - Notify all players the match has started
18. Implement basic turn cycle
    - Define turn order from match configuration
    - Manage active turn and current player
    - Block out-of-turn API actions
    - Handle turn passing and end-of-turn logic
    - Notify all players of turn changes
19. Implement WebSocket connection and authentication
    - Configure WebSocket endpoint and STOMP broker
    - Authenticate WebSocket handshake with JWT
    - Map connections to active match sessions
    - Handle connect and disconnect events
    - Log WebSocket lifecycle events
20. Implement real-time state sync
    - Define WebSocket message types and payloads
    - Send state updates on every game action
    - Broadcast turn changes to all match participants
    - Send event and choice notifications in real time
    - Validate message delivery consistency
21. Handle reconnect and client desync
    - Detect client disconnections via heartbeat
    - Allow safe reconnects with existing token
    - Send full state snapshot on reconnect
    - Resolve state conflicts between client and server
    - Log desync events for debugging
22. Implement time and timeout management
    - Define configurable turn duration
    - Start countdown timer on turn begin
    - Handle automatic turn expiration
    - Apply default action on timeout (pass turn)
    - Notify all clients on timeout events
23. Implement movement and locations
    - Define location structure and adjacency graph
    - Create endpoint for player movement
    - Validate movement against adjacency rules
    - Apply movement cost (action points, items)
    - Trigger location entry events
24. Implement choices and resolution
    - Define choice data structure (options, conditions)
    - Create endpoint to present available choices
    - Validate choice selection against game rules
    - Resolve choice effects on game state
    - Notify players of choice outcomes
25. Implement automatic events and triggers
    - Define event trigger conditions (turn, location, timer)
    - Evaluate triggers after each game action
    - Apply event effects to match state
    - Chain events when conditions cascade
    - Notify players of triggered events
26. Implement inventory and item management
    - Define item structure and storage model
    - Create endpoints to view and use items
    - Validate item usage rules and conditions
    - Apply item effects on game state
    - Handle item acquisition from events and locations
27. Implement trade between players
    - Define trade proposal structure
    - Create endpoints to propose, accept, and reject trades
    - Validate trade items availability
    - Execute trade and update both inventories
    - Notify involved players of trade result
28. Implement match registry and action logging
    - Define registry structure for all match actions
    - Log every player action with timestamp
    - Log system events (timeouts, auto-events)
    - Link all logs to match UUID
    - Expose action history via API
29. Implement match snapshots
    - Define snapshot format (full state serialization)
    - Create automatic snapshots at key moments
    - Create manual snapshot via admin endpoint
    - Implement restore from snapshot
    - Validate restore integrity against current schema
30. Handle errors and edge states
    - Handle duplicate or conflicting actions
    - Handle out-of-time submissions gracefully
    - Detect and resolve stuck matches
    - Handle inconsistent data with rollback
    - Return clear error messages to clients
31. Implement minimal playable frontend
    - Implement guest login screen
    - Implement match lobby (create, join, character select)
    - Display match state and current turn
    - Show player positions on location map
    - Handle real-time updates via WebSocket
32. Implement gameplay UI
    - Display events and narrative text
    - Show available choices and actions
    - Implement inventory and trade UI
    - Implement in-match chat interface
    - Handle timeout warnings and turn indicators
33. Implement user registration
    - Create registration endpoint (email, username, password)
    - Validate input and enforce password rules
    - Store hashed credentials in database
    - Send verification email
    - Handle email verification flow and account activation
34. Implement single sign-on with Google
    - Configure Google OAuth 2.0 client
    - Create SSO login endpoint
    - Exchange authorization code for user profile
    - Link Google account to existing or new user
    - Issue JWT token after successful SSO
35. Implement user profile and account management
    - Create endpoint to view user profile
    - Implement change password flow
    - Implement change display name and avatar
    - Link guest sessions to registered accounts
    - Handle account deletion and data cleanup
36. Implement admin tools
    - View active match states and player info
    - Force turn advancement on stuck matches
    - End or cancel problematic matches
    - Restore matches from snapshots
    - Manage and suspend problematic users
37. Write a complete test story
    - Define a minimal plot with beginning, middle, and end
    - Define initial locations and adjacency map
    - Define main events, triggers, and choices
    - Define items, rewards, and trade opportunities
    - Verify the story is completable end-to-end
38. Implement in-game chat
    - Define chat message structure
    - Create endpoints to send and retrieve messages
    - Broadcast messages via WebSocket in real time
    - Handle chat moderation and filtering
    - Persist chat history per match
39. Run end-to-end technical playtest
    - Test full match lifecycle (create → play → end)
    - Test disconnects, reconnects, and desync recovery
    - Test timeouts and automatic event triggers
    - Test concurrent matches and multi-player scenarios
    - Document bugs and regressions
40. Performance and load testing
    - Define performance targets (response time, concurrency)
    - Simulate concurrent matches and WebSocket connections
    - Identify and resolve bottlenecks
    - Optimize database queries and indexes
    - Validate system stability under sustained load
41. Write technical and operational documentation
    - Document API endpoints and contracts
    - Document WebSocket message types and flows
    - Document deployment and infrastructure setup
    - Document admin tools and operational procedures
    - Prepare developer onboarding guide
42. Launch the game with V1 version
    - Verify all V1 features are complete and stable
    - Deploy production infrastructure (DNS, CDN, DB, containers)
    - Configure `api.v1.paths.games` DNS and routing
    - Run final smoke tests on production environment
    - Announce V1 launch and open public access



# Version Control
- First version created with AI prompt:
    > Read "Start project" file and assume I want to create and to start developing it: give me 30 steps to follow, a simple list where the first is "start the project"; for each step give 5 subpoints.
- Second version created with AI prompt:
    > next step must be from 12 to 42, number 12 should be start develop login method to guess users, number 33 should be registrazion user, 34 single sign on with google, 42 is launch the game with v1 version. rewrite all point fron 12 to 42.
- Steps are developed with prompt:
    > read all documentation md files inside documentation_v0 folder, i wanna to run step XX: write all java backend code into code/backend project using JPA, complete all unit-test using mokito to cover 100% of branches-case, create a simple web example to use new interfaces inside new code/website/concepts_v0/v0.XX.0/ folder, write new md file inside documentation_v0 folder, read code/website/html folder for last version of public website. don't look and don't change backend-python and backend-php. write openapi documentation into /mnt/Dati4/Workspace/pathsgames/code/backend/adapter-rest/src/main/resources/openapi folder with new/changed api. let's go

- **Document Version**: 0.11.0 (here only due changes)
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
- **Last Updated**: March 24, 2026
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







