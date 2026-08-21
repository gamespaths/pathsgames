# Documentation index

Map of `documentation_v0/`. **Read this before opening any Step file.** The Step files are
large (Step28 is 118 KB ≈ 29k tokens, Roadmap is 95 KB ≈ 24k tokens); the whole folder is
~4.2 MB ≈ 1M tokens and can never fit in a context window.

Workflow: find the right file here → `grep -n` for the section → read only that range with
`Read(offset=…, limit=…)`. Never `cat` a Step file whole.

Every Step file follows the same skeleton, so grep for these headings:
`## 1. Scope` · `## 2. Endpoint APIs` · `## 3. DTOs and Domain Models` ·
`## 4. Roles and Authentication` · `## 5. Database Tables` · `## Test coverage`

| File | What is in it | Keywords |
|---|---|---|
| `Roadmap.md` | Master todo-list. Phase 1 single-player (steps 14-42), Phase 2 multiplayer (43-84), Phase 3 testing/infra/V1 launch (85-101) | roadmap, phases, next steps, backlog |
| `Step01_StartProject.md` | Main game-design concept and rules | game rules, concept, design |
| `Step02_CreateTheRepository.md` | 4 | Repo creation | git |
| `Step03_DefineScope.md` | V1 mandatory vs excluded features, complexity limit, definition of done | scope, V1, out of scope |
| `Step04_TechnologyStack.md` | Chosen stack | stack, technology |
| `Step05_BackendStructure.md` | Hexagonal module split: domain, api, realtime, persistence, shared | hexagonal, modules, ports |
| `Step06_NamingConventions.md` | REST, WebSocket, DB table/column, Java, DTO/JSON naming | naming, kebab-case, conventions |
| `Step07_ConfigureWebsite.md` | Domains, AWS Terraform infra, CSP | terraform, website, DNS, CSP |
| `Step08_ConfigureMinimalCI.md` | Environments, CI, Docker image build/push | CI, docker, environments |
| `Step09_DesignCoreDataModel.md` | **Core data model.** Entities, relationships, persistent vs transient, valid game states, invariants | entities, data model, invariants, game state |
| `Step10_CreateDBschema.md` | Tables, PKs, FKs, indexes, schema versioning | schema, flyway, DDL, indexes |
| `Step11_DefineAPIVersioning.md` | Versioning scheme, backward compat, deprecation | versioning, deprecation |
| `Step12_GuestLoginMethod.md` | Guest login, JWT token structure | guest, login, JWT |
| `Step13_SessionTokenManagement.md` | Session/token management, auth filter | session, token, auth filter |
| `Step14_StoriesImportSystem.md` | Story import system and data seeding | import, seed, stories |
| `Step15_StoryContentAPIs.md` | Story content APIs: categories and groups | categories, groups |
| `Step15_StoryContentHowAddFiledIntoCard.md` | **How-to: add a field to the Card object** end-to-end (schema → DTO → read → write → all backends) | card, add field, howto |
| `Step16_ContentDetailAPIs.md` | Cards, texts, creators detail APIs | cards, texts, creators |
| `Step17_StoryAdminCRUD.md` | Admin CRUD for all story entities | admin, CRUD |
| `Step18_GameMainFrontend.md` | react-game frontend: structure, design system, API client + mock fallback, guest identity | react-game, frontend, design system |
| `Step19_SinglePlayerMatchCreation.md` | Single-player match creation. **§6.1 (v0.32.1)**: one active match per user and story — 409 `ACTIVE_MATCH_ALREADY_EXISTS` (CREATED/RUNNING/**PAUSED**), checked last after every 404/400; react-game click gate + fail-closed match list | match, create, duplicate match, ACTIVE_MATCH_ALREADY_EXISTS, 409, active statuses |
| `Step19_SinglePlayerMatchUtils.md` | Admin match control, match lifecycle | match lifecycle, stop, pause, resume |
| `Step20_GameWebSiteFirstRun.md` | First run + match end flow, cookie consent, Turnstile antibot, **react-game color palette / design system** | turnstile, cookie, end match, palette, styles |
| `Step21_CharacterSelection.md` | Character template and class selection | character, class, template |
| `Step22_StoryValidation.md` | Story validation rule catalog + integrity checks | validation, integrity |
| `Step23_CharacterStatsInitialization.md` | Character stats initialization, stat formula | stats, formula, init |
| `Step24_TurnCycleEngine.md` | Turn cycle engine (single-player) | turn, cycle |
| `Step25_TimeAdvancementClockCycle.md` | Time advancement and clock cycle (backends only) | clock, time, advance |
| `Step26_TimeStartRecovery.md` | Time-start recovery math, class bonuses, location counters | recovery, bonus, counters |
| `Step27_WeatherSystem.md` | Weather random selection algorithm and effects | weather |
| `Step28_MovementSystem.md` | **Biggest file.** Movement: adjacency, energy cost formula, validation order, fog-of-war, location cards, match logs timeline | movement, adjacency, energy, fog of war, logs |
| `Step29_NormalEvents.md` | Normal (player-triggered) events: schema V0.29.0, check procedure, execution, `available` flag, logs | events, execute-event, effects |
| `Step30_EdgeStates.md` | Edge states: sadness overflow, coma, `clock_in_coma` stamp, all-players-in-coma story epilogue. | sadness, coma, edge state, game over, epilogue, coma recovery, wake, `COMA_RECOVERED` |
| `Step31_ChoiceEngine.md` | Choice engine: choice-owning events branch `execute-event` to `status: CHOICES_PENDING` + `pendingChoices[]` instead of applying effects; cost/marker paid on open, idempotent re-fetch. | choice, choice engine, execute-event, pendingChoices, CHOICES_PENDING, availability |
| `Step32_ChoiceResolution.md` | Choice resolution: `POST .../action/select-choice` applies `list_choices_effects` (stats, registry, items, forced movement, weather, inline events via new v0.32.0 columns), runs `id_event_torun` | choice resolution, select-choice, list_choices_effects, flag_group, is_progress |
| `Step33_LocationEntryEvents.md` | Location entry events: triggers bind on five pre-existing `list_locations` columns; counter-zero finally executed (Step 26's dead end closed); `flag_visited` party-scoped visited state; v0.33.1 widened `counterZero[]` items to `card`/`cardLocation`/`cardEffects` | location entry, automatic trigger, counter zero, flag_visited, priority_automatic_event, cardEffects, cardLocation, AutomaticEvents |
| `Step34_InventoryAndResources.md` | Inventory (use-item, drop-item, listing) and resources (food/magic/coin, carried weight); `use-item` answers the execute-event payload through a shared `applyStandaloneEffects` door so items go through the Step-30 overflow/coma gate; carried weight switches on the movement `OVERWEIGHT` refusal | inventory, use-item, drop-item, resources, carried weight, weightMax, item effects, traits_to_add, applyStandaloneEffects, OVERWEIGHT |
| `Step35_ItemsResolution.md` | UX refinement of the Step 34 engine. **Part one**, react-game: using an item now closes the backpack before narrating (`handleItemUsed`); fallback narrative on the item's own card when no effect row carries one. react-admin: `item-effects` form gains `idCard` picker, `effectCode` becomes a closed select (`ITEM_EFFECT_CODE_OPTIONS`), `traitsToAdd`/`traitsToRemove` get the traits picker. **Part two**, no migration, no new endpoint: `items[]` gains an additive `effects: [{statistic, value}]` preview (both `.../inventory` and `/info`) so a player sees an item's promised effects before using it — java/python/AWS all touched (`ItemEffectPreview`, `preview_effects`), react-game's `ItemCard` shows it via `effectStatItems`. **Part three**: new `list_items.flag_show_effects` column (`V0.35.0` migration, both java dialects) lets an author hide that same preview per item while the effect still applies (`showsEffects`/`shows_effects`); react-admin gains a `flagShowEffects` checkbox; a `StoryCrudService.intVal` boolean-checkbox bug was found and fixed; react-game's received-item card now shows the item's own promise instead of the granting event's stat changes (`itemRowForUuid`); new Robot suite `effects_preview.robot` (6 tests) | items resolution, use-item UX, handleItemUsed, fallbackCard, item-effects form, ITEM_EFFECT_CODE_OPTIONS, EffectStatCodec, effects preview, ItemEffectPreview, preview_effects, flagShowEffects, flag_show_effects, showsEffects, itemRowForUuid |

Note: there is no `Step20_AdminEndpoint.md` despite older references — the admin-port split
(8044) is described in `Step19_SinglePlayerMatchUtils.md` and `Step20_GameWebSiteFirstRun.md`.

`website_concepts_v0/` is 450 MB of images/concept art. Never read it.
