# Documentation index

Map of `documentation_v0/`. **Read this before opening any Step file.** The Step files are
large (Step28 is 118 KB ≈ 29k tokens, Roadmap is 95 KB ≈ 24k tokens); the whole folder is
~4.2 MB ≈ 1M tokens and can never fit in a context window.

Workflow: find the right file here → `grep -n` for the section → read only that range with
`Read(offset=…, limit=…)`. Never `cat` a Step file whole.

Every Step file follows the same skeleton, so grep for these headings:
`## 1. Scope` · `## 2. Endpoint APIs` · `## 3. DTOs and Domain Models` ·
`## 4. Roles and Authentication` · `## 5. Database Tables` · `## Test coverage`

| File | KB | What is in it | Keywords |
|---|---|---|---|
| `Roadmap.md` | 95 | Master todo-list. Phase 1 single-player (steps 14-42), Phase 2 multiplayer (43-84), Phase 3 testing/infra/V1 launch (85-101) | roadmap, phases, next steps, backlog |
| `Step01_StartProject.md` | 71 | Main game-design concept and rules | game rules, concept, design |
| `Step02_CreateTheRepository.md` | 4 | Repo creation | git |
| `Step03_DefineScope.md` | 32 | V1 mandatory vs excluded features, complexity limit, definition of done | scope, V1, out of scope |
| `Step04_TechnologyStack.md` | 9 | Chosen stack | stack, technology |
| `Step05_BackendStructure.md` | 11 | Hexagonal module split: domain, api, realtime, persistence, shared | hexagonal, modules, ports |
| `Step06_NamingConventions.md` | 29 | REST, WebSocket, DB table/column, Java, DTO/JSON naming | naming, kebab-case, conventions |
| `Step07_ConfigureWebsite.md` | 19 | Domains, AWS Terraform infra, CSP | terraform, website, DNS, CSP |
| `Step08_ConfigureMinimalCI.md` | 17 | Environments, CI, Docker image build/push | CI, docker, environments |
| `Step09_DesignCoreDataModel.md` | 71 | **Core data model.** Entities, relationships, persistent vs transient, valid game states, invariants | entities, data model, invariants, game state |
| `Step10_CreateDBschema.md` | 32 | Tables, PKs, FKs, indexes, schema versioning | schema, flyway, DDL, indexes |
| `Step11_DefineAPIVersioning.md` | 30 | Versioning scheme, backward compat, deprecation | versioning, deprecation |
| `Step12_GuestLoginMethod.md` | 15 | Guest login, JWT token structure | guest, login, JWT |
| `Step13_SessionTokenManagement.md` | 19 | Session/token management, auth filter | session, token, auth filter |
| `Step14_StoriesImportSystem.md` | 30 | Story import system and data seeding | import, seed, stories |
| `Step15_StoryContentAPIs.md` | 24 | Story content APIs: categories and groups | categories, groups |
| `Step15_StoryContentHowAddFiledIntoCard.md` | 13 | **How-to: add a field to the Card object** end-to-end (schema → DTO → read → write → all backends) | card, add field, howto |
| `Step16_ContentDetailAPIs.md` | 25 | Cards, texts, creators detail APIs | cards, texts, creators |
| `Step17_StoryAdminCRUD.md` | 33 | Admin CRUD for all story entities | admin, CRUD |
| `Step18_GameMainFrontend.md` | 36 | react-game frontend: structure, design system, API client + mock fallback, guest identity | react-game, frontend, design system |
| `Step19_SinglePlayerMatchCreation.md` | 34 | Single-player match creation | match, create |
| `Step19_SinglePlayerMatchUtils.md` | 18 | Admin match control, match lifecycle | match lifecycle, stop, pause, resume |
| `Step20_GameWebSiteFirstRun.md` | 71 | First run + match end flow, cookie consent, Turnstile antibot, **react-game color palette / design system** | turnstile, cookie, end match, palette, styles |
| `Step21_CharacterSelection.md` | 32 | Character template and class selection | character, class, template |
| `Step22_StoryValidation.md` | 13 | Story validation rule catalog + integrity checks | validation, integrity |
| `Step23_CharacterStatsInitialization.md` | 26 | Character stats initialization, stat formula | stats, formula, init |
| `Step24_TurnCycleEngine.md` | 32 | Turn cycle engine (single-player) | turn, cycle |
| `Step25_TimeAdvancementClockCycle.md` | 77 | Time advancement and clock cycle (backends only) | clock, time, advance |
| `Step26_TimeStartRecovery.md` | 43 | Time-start recovery math, class bonuses, location counters | recovery, bonus, counters |
| `Step27_WeatherSystem.md` | 29 | Weather random selection algorithm and effects | weather |
| `Step28_MovementSystem.md` | 118 | **Biggest file.** Movement: adjacency, energy cost formula, validation order, fog-of-war, location cards, match logs timeline | movement, adjacency, energy, fog of war, logs |
| `Step29_NormalEvents.md` | 13 | Normal (player-triggered) events: schema V0.29.0, check procedure, execution, `available` flag, logs | events, execute-event, effects |
| `Step30_EdgeStates.md` | 23 | Edge states: sadness overflow, coma, `clock_in_coma` stamp, all-players-in-coma story epilogue; v0.30.1 waking from coma on safe-location rest. No new endpoint, no migration | sadness, coma, edge state, game over, epilogue, coma recovery, wake, `COMA_RECOVERED` |
| `Step31_ChoiceEngine.md` | 12 | Choice engine: choice-owning events branch `execute-event` to `status: CHOICES_PENDING` + `pendingChoices[]` instead of applying effects; cost/marker paid on open, idempotent re-fetch; `ChoiceAvailabilityChecker` (limits + 8 condition types, AND/OR); `R8_CHOICE_EVENT` validation; choices never nested into `/info`. No new endpoint, no migration | choice, choice engine, execute-event, pendingChoices, CHOICES_PENDING, availability |

Note: there is no `Step20_AdminEndpoint.md` despite older references — the admin-port split
(8044) is described in `Step19_SinglePlayerMatchUtils.md` and `Step20_GameWebSiteFirstRun.md`.

`website_concepts_v0/` is 450 MB of images/concept art. Never read it.
