# Paths Games V0 - Roadmap

This document is the plan of **Paths Games V0**, the single-player **alpha** version. Like every
version it has exactly **42 steps** (rules in [Version Template](../VersionTemplate.md));
step N is released as `0.N.0`. The map of all versions is the
[Global Roadmap](../Roadmap.md).

- **Steps 1-13**: start the project, define scope and technology stack, create prototypes, guest login and sessions.
- **Steps 14-39**: single-player game system with guest login: stories, match creation, game engine, mechanics, frontends.
- **Steps 40-41**: alpha preparation: tutorial and UX polish, logging and snapshots, security, admin protection, guest limits, KPI report, test certificate.
- **Step 42**: **launch of the alpha** single-player version on the AWS backend, released like a production environment.

Until v0.39 this file listed 101 steps; the old steps 43-101 moved to later versions as described
in the [Global Roadmap](../Roadmap.md) §3.


# Roadmap

|  | Step |  | Main goals |
| ---- | -- | ----- | ---------- |
| 1 | [Start the project](./Step01_StartProject.md) | ✅ | Write ideas on document and initial concepts, define steps to execute to start the project. |
| 2 | [Create the repository](./Step02_CreateTheRepository.md) | ✅ | Choose repository platform, initialize an empty repository and define basic access rules |
| 3 | [Define the V1 scope](./Step03_DefineScope.md) | ✅ | Define the V1 scope, list mandatory features, list excluded features |
| 4 | [Technology stack](./Step04_TechnologyStack.md) | ✅ | Select backend language, backend framework, primary database, frontend technology and deployment system |
| 5 | [Backend structure](./Step05_BackendStructure.md) | ✅ | Separate domain from infrastructure, define API and persistence modules, create backend project and first build |
| 6 | [Naming conventions](./Step06_NamingConventions.md) | ✅ | Define REST endpoint naming, WebSocket event naming, table and column naming and DTO and payload naming |
| 7 | [Configure website](./Step07_ConfigureWebsite.md) | ✅ | Buy domains [paths.games](http://paths.games/) & [pathsgames.com](http://pathsgames.com/), terraform template and deploy first version of website |
| 8 | [Configure CI](./Step08_ConfigureMinimalCI.md) | ✅ | Define environment-specific configurations with secrets, define pipelines (GitHub Actions) with master branch |
| 9 | [Design data model](./Step09_DesignCoreDataModel.md) | ✅ | Identify main entities, relationships between entities, persistent vs transient data |
| 10 | [Create DB schema](./Step10_CreateDBschema.md) | ✅ | Translate the data model into tables, define primary keys, define foreign keys, version the schema |
| 11 | [Define API versioning](./Step11_DefineAPIVersioning.md) | ✅ | Establish the API versioning scheme, Decide backward compatibility policy, Prepare structure for future versions |
| 12 | [Implement guest login](Step12_GuestLoginMethod.md) | ✅ | Define guest identity model, ceate guest session endpoint, store guest sessions in database | 
| 13 | [Sessions & tokens](Step13_SessionTokenManagement.md) | ✅ | Token refresh with rotation, logout, auth filter, admin authorization |
| 14 | [Stories management](Step14_StoriesImportSystem.md) | ✅ | Story import system and data seeding. Start test robot framework. |
| 15 | [Stories content APIs](./Step15_StoryContentAPIs.md) | ✅ | Story content APIs: categories, groups, enriched detail |
| 16 | [Content details APIs](./Step16_ContentDetailAPIs.md) | ✅ | Card, test and authors details APIs |
| 17 | [Story Admin Endpoints](./Step17_StoryAdminCRUD.md) | ✅ | Story admin CRUD endpoints, admin web interface |
| 18 | [Stories catalog](./Step18_GameMainFrontend.md) | ✅ | Story catalog page displaying stories |
| 19 | [Match creation](./Step19_SinglePlayerMatchCreation.md) | ✅ | Single player match creation & [Admin Match Utils](./Step19_SinglePlayerMatchUtils.md) |
| 20 | [Game first run](./Step20_GameWebSiteFirstRun.md) | ✅ | Game web site first run |
| 21 | [Character selection](./Step21_CharacterSelection.md) | ✅ | Character template & class selection (join, players, character detail) |
| 22 | [Story validation](./Step22_StoryValidation.md) | ✅ | Story integrity validator — import hard-fail, lenient CRUD, validate endpoint |
| 23 | [Character stats initialization](./Step23_CharacterStatsInitialization.md) | ✅ | Trait listing by class, trait cost budgets, strict trait validation on match create/join |
| 24 | [Turn cycle engine](./Step24_TurnCycleEngine.md) | ✅ | Priority formula, queue init on match start, pass action, turn-sequence query |
| 25 | [Time clock cycle](./Step25_TimeAdvancementClockCycle.md) | ✅ | Time Advancement & Clock Cycle: sleep action, time-end trigger, clock increment |
| 26 | [Time-start recovery](./Step26_TimeStartRecovery.md) | ✅ | Per-character stat recovery at time-start, class bonuses, location counter decrements; counter re-seed bugfix |
| 27 | [Weather System](./Step27_WeatherSystem.md) | ✅ | Weather System with random selection & effects | 
| 28 | [Movement System](./Step28_MovementSystem.md) | ✅ | Movement System with Adjacency, Energy Cost & Validation |
| 29 | [Normal events](./Step29_NormalEvents.md) | ✅ | Normal events, `available` flag on match-info, `execute-event` endpoint |
| 30 | [Edge states](./Step30_EdgeStates.md) | ✅ | Sadness overflow & coma rules, `clock_in_coma` stamp, all-players-in-coma story event |
| 31 | [Choice engine](./Step31_ChoiceEngine.md) | ✅ | Choice-owning events branch `execute-event` to `CHOICES_PENDING` & `ChoiceAvailabilityChecker`
| 32 | [Choice resolution](./Step32_ChoiceResolution.md) | ✅ | Select choice engine applies choices effects |
| 33 | [Location entry events](./Step33_LocationEntryEvents.md) | ✅ | Automatic triggers bind on columns; counter-zero finally executed; `flag_visited`  |
| 34 | [Inventory management](./Step34_InventoryAndResources.md) | ✅ | `use-item` / `drop-item` endpoints, item cards |
| 35 | [Resource management](./Step34_InventoryAndResources.md) | ✅ | Food/magic/coin on `/info`; carried weight (`Σ item.weight × amount`) |
| 36 | [Registry system](./Step36_RegistrySystem.md) | ✅ | RegistryService (render/parse/evaluate) & registry api &  operator column on events/edges/weather; v0.36.1 multi-value keys (SET semantics, ∃/∄/∀ operators); v0.36.2 case-insensitive trimmed value compare, locations write the registry on arrival, admin registry edit API |
| 37 | [Mission system](./Step37_MissionSystem.md) | ✅ | Missions are a projection of the registry: `condition_value`/`condition_values` (PIPE AND), AVAILABLE→ACTIVE→COMPLETED/FAILED, `/api/match/{uuid}/missions` and `missions[]` on `/info` |
| 38 | [Experience system](./Step38_ExperienceSystem.md) | ✅ | `use-exp` spends `gaming_character_instance.exp` to raise DEX/INT/COS by one at a difficulty-priced cost; `is_safe`→`secure_param`, `cost_max_characteristics`→`exp_cost_base`/`max_stat_value` |
| 39 | [Random events](./Step39_RandomEvents.md) | ✅ | At most one `list_global_random_events` row fires at time-start, after the weather; absolute-percentage pick, party-wide reach, `RANDOM_EVENT` trigger in `counterZero[]` |
| 40 | Alpha UX polish | | Tutorial tips on card pages, weather display fix, environment badge, resource logs check, match list restyle, roadmap book |
| 41 | Alpha preparation | | Logging and snapshots, security, admin IP protection, guest cleanup and limits, KPI report, test certificate |
| 42 | **Alpha launch** | | Backup and alarms, privacy check, alpha stage on AWS, alpha story, license, launch |


# Next steps

Each step is analysed and developed with the project agents (workflow in
[Version Template](../VersionTemplate.md) §6):
- `paths-games-new-feature` — analyses a step and writes the draft step file with a list of doubts.
- `paths-games-dev-feature` — develops an analysed step on every backend and frontend, with tests.
- `/doc-update` — aligns the documentation after a step.

## Steps 40-42 — Alpha preparation and launch

40. Alpha UX polish
    - Tips and tutorial on card pages: first-time hints explaining each card type and action (frontend)
    - Counter-zero events hide the new weather: when a counter-zero event fires at time-start, the new weather card must still be shown (backend, frontend)
    - Environment badge in the header: show dev, test, alpha, beta, … or nothing in prod, from a build/runtime parameter (frontend)
    - Verify that gaining items, food, coins and magic is written in the match logs, on every backend; fix the gaps (backend)
    - Restyle the match list in the user's book: clearer status, story, dates and actions (frontend)
    - Roadmap book in react-game, like the cookie-policy and footer-link books, showing the versions and their themes (frontend)
    - Write unit tests and Robot checks for the weather display, the logs and the new books (tests)
41. Alpha preparation — logging, security, protection, KPI
    - Logging gaps: log every remaining player action and automatic effect with match, character, clock and details; keep a check on log size (AWS `LOG#` rows) (backend)
    - Match snapshots: light snapshot at each time-end, admin list and restore endpoints, integrity check before restore (backend, frontend)
    - Residual security: security headers, dependency vulnerability scan, secrets review, CORS and `WebConfig` check (backend, frontend)
    - Admin IP allow-list on AWS: new parameter deciding whether an empty list means "everybody" or "nobody", default "nobody", on dev and test too; deploy scripts detect the caller's public IP (backend, infra)
    - Guests: periodic cleanup job for guests without matches, with a parametrised age (EventBridge on AWS, `@Scheduled` in Java, APScheduler in Python); guests with at least one match are never deleted; per-IP and per-guest creation limits from parameters with code defaults, blocking creation only (backend)
    - Basic KPI report without big changes: daily UTC counters per story (matches started and finished, completion rate, average duration, coma count every time a character falls, choice distribution, visited locations, mission status), light on DynamoDB; current state of active matches (location, life, players) through `/api/admin/matches` and `/info`; react-admin report page aggregating by day, month or total (backend, frontend)
    - Test ACM certificate: analysis written in [Environments](../Environments.md) (certificates, stages, env variables, future-proof) and implementation of the chosen solution (infra, docs)
    - Write unit tests and Robot suites for snapshots, allow-list parameter, cleanup job, limits and KPI endpoints (tests)
42. Alpha launch — single-player on AWS
    - Backup and alarms: DynamoDB point-in-time recovery, CloudWatch alarms (Lambda errors, throttling), AWS budget alert with notification (infra)
    - Privacy check: privacy policy, cookie consent, analytics consent, what guest data is stored and for how long (all)
    - New stage `alpha`: own AWS stack, bucket and site; domains `alpha.paths.games` and `alpha-api.paths.games`; admin API without paths.games DNS (infra)
    - Alpha story: the owner's complete story imported, validated and played from start to end; blocking bugs fixed (all)
    - Content license: CC BY-NC-ND 4.0 notice on story content, credits and license page (frontend, docs)
    - i18n check (EN, IT) and Robot suites green on all three backends; regression fixes (tests)
    - Release notes with features, known limitations and the social link used for feedback (docs)
    - Launch: deploy, smoke test (guest login, story choice, match creation, full gameplay cycle), announce (all)



# Version Control
- First version created with AI prompt:
    > Read "Start project" file and assume I want to create and to start developing it: give me 30 steps to follow, a simple list where the first is "start the project"; for each step give 5 subpoints.
- Second version created with AI prompt:
    > next step must be from 12 to 42, number 12 should be start develop login method to guess users, number 33 should be registrazion user, 34 single sign on with google, 42 is launch the game with v1 version. rewrite all point fron 12 to 42.
- Steps are developed with prompt:
    > read all documentation md files inside documentation_v0 folder, i wanna to run step XX: write all java backend code into code/backend project using JPA, complete all unit-test using mokito to cover 100% of branches-case, create a simple web example to use new interfaces inside new code/website/concepts_v0/v0.XX.0/ folder, write new md file inside documentation_v0 folder with all details, write a section with (endpoint apis, DTO, roles, tables, test cases and business logic). read code/website/html folder for last version of public website. don't look and don't change backend-python. write openapi documentation into /mnt/Dati4/Workspace/pathsgames/code/backend/adapter-rest/src/main/resources/openapi folder with new/changed api. let's go
- Update steps list with prompt:
    > ciao, read all "documentation_v0" for context, i wanna change my roadmap file, now I've 42 step, 13 already done and i started to work to step 14,  I wanna change my roadmap to be 101 step, 14 step should be stories management, from 14 to 42 should be single-player game system with only guess login, I would 42 step be "launch beta version with guess and single player game". since 43 to 84 "multiplayer game with credential login" with all multiplayer systems and game engine. since 85 to 101 test and launch system. all step with 7 subpoint , subpoint for backend and frontend too, add unit test into frontend and backend. 


- **Document Version**: 0.40.0
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.1.0 | first version of this document | February 3, 2026 |
	| 0.1.1 | added licence and version control sections, file renamed from "todolist" to "roadmap" | February 5, 2026 |
    | 0.1.2 | update "2. Define the V1 scope" and "3. Define the technology stack" sections | February 10, 2026 |
    | 0.40.0 | Roadmap rewritten: 42 steps per version, alpha launch | September 25, 2026 |

- **Last Updated**: September 25, 2026 (v0.40.0)
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
