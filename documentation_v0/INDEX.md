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
| `Step09_DesignCoreDataModel.md` | **Core data model.** Entities, relationships, persistent vs transient, valid game states, invariants; **v0.35.8**: `list_texts.short_text` widened to `VARCHAR(2000)`, `is_consumabile` default unified across backends | entities, data model, invariants, game state, short_text, is_consumabile |
| `Step10_CreateDBschema.md` | Tables, PKs, FKs, indexes, schema versioning | schema, flyway, DDL, indexes |
| `Step11_DefineAPIVersioning.md` | Versioning scheme, backward compat, deprecation | versioning, deprecation |
| `Step12_GuestLoginMethod.md` | Guest login, JWT token structure | guest, login, JWT |
| `Step13_SessionTokenManagement.md` | Session/token management, auth filter | session, token, auth filter |
| `Step14_StoriesImportSystem.md` | Story import system and data seeding; **v0.35.8**: weather rules import before events, `linkDeferredReferences`/`link_deferred_references` second pass, Python top-level `locationNeighbors` import, `_make` coercion, matches-first cascading delete, `align_schema()` | import, seed, stories, linkDeferredReferences, link_deferred_references, deferred references, locationNeighbors, align_schema, cascading delete |
| `Step15_StoryContentAPIs.md` | Story content APIs: categories and groups | categories, groups |
| `Step15_StoryContentHowAddFiledIntoCard.md` | **How-to: add a field to the Card object** end-to-end (schema → DTO → read → write → all backends) | card, add field, howto |
| `Step16_ContentDetailAPIs.md` | Cards, texts, creators detail APIs | cards, texts, creators |
| `Step17_StoryAdminCRUD.md` | Admin CRUD for all story entities; **v0.35.8**: story texts capped at 2000 chars (`textLimits.js`, `TextLengthHint.jsx`) | admin, CRUD, textLimits, TextLengthHint, TEXT_MAX_LENGTH |
| `Step18_GameMainFrontend.md` | react-game frontend: structure, design system, API client + mock fallback, guest identity; **v0.35.5 (§2, §8)**: `GameBook.jsx` decomposed into `PageLeft`/`PageRight`/`PageRightMain`/`PageRightInfo` + hooks, gameplay `onPreview` now a single object arg; **v0.35.8**: `StoryCard.jsx` rewritten over shared `Card` (`variant="little"`), `matchesStatus`-gated footer button, `RESUME_WITHOUT_MODAL`/`ADD_COMING_SOON_STORIES` flags | react-game, frontend, design system, GameBook, gameplay, PageLeft, PageRight, useBookView, useMatchChrome, useGameplayResults, onPreview, StoryCard, story-netflix-card, RESUME_WITHOUT_MODAL, ADD_COMING_SOON_STORIES, findResumableMatch, comingSoonStories |
| `Step19_SinglePlayerMatchCreation.md` | Single-player match creation. **§6.1 (v0.32.1)**: one active match per user and story — 409 `ACTIVE_MATCH_ALREADY_EXISTS` (CREATED/RUNNING/**PAUSED**), checked last after every 404/400; react-game click gate + fail-closed match list; **v0.35.8**: opt-in `RESUME_WITHOUT_MODAL` flag skips the guest modal on Resume | match, create, duplicate match, ACTIVE_MATCH_ALREADY_EXISTS, 409, active statuses, RESUME_WITHOUT_MODAL, findResumableMatch |
| `Step19_SinglePlayerMatchUtils.md` | Admin match control, match lifecycle | match lifecycle, stop, pause, resume |
| `Step20_GameWebSiteFirstRun.md` | First run + match end flow, cookie consent, Turnstile antibot, **react-game color palette / design system** | turnstile, cookie, end match, palette, styles |
| `Step21_CharacterSelection.md` | Character template and class selection | character, class, template |
| `Step22_StoryValidation.md` | Story validation rule catalog + integrity checks | validation, integrity |
| `Step23_CharacterStatsInitialization.md` | Character stats initialization, stat formula; class-filtered trait listing and strict trait validation (`TRAIT_NOT_FOUND`/`DUPLICATED`/`NOT_COMPATIBLE`/`COST_EXCEEDED`); **v0.35.2 (§5.3, §6.2, §9)**: `list_traits.hide_on_start_match` locks a trait out of selection at match create/join (`TRAIT_NOT_SELECTABLE`) while both trait projections keep returning it and an item/event can still grant it via `traits_to_add`; **v0.35.2 bugfix (§6.4)**: a trait's stat deltas now apply the moment it is granted/removed mid-match (event or item), not only at character creation; **v0.35.2 (§10.4)**: Robot `Step23Helper.py` splits `_is_selectable` (class gates) from `_is_pickable` (class gates + not hidden) | stats, formula, init, trait selection, hideOnStartMatch, hide_on_start_match, TRAIT_NOT_SELECTABLE, applyTraitStats, trait grant stats |
| `Step24_TurnCycleEngine.md` | Turn cycle engine (single-player) | turn, cycle |
| `Step25_TimeAdvancementClockCycle.md` | Time advancement and clock cycle (backends only) | clock, time, advance |
| `Step26_TimeStartRecovery.md` | Time-start recovery math, class bonuses, location counters | recovery, bonus, counters |
| `Step27_WeatherSystem.md` | Weather random selection algorithm and effects | weather |
| `Step28_MovementSystem.md` | **Biggest file.** Movement: adjacency, energy cost formula, validation order, fog-of-war, location cards, match logs timeline; v0.35.4 adds `ITEM_ADD`/`ITEM_USE`/`ITEM_DROP` log entries and `*Gain` resource fields on every entry; **v0.35.8 bugfix**: Python's `/info` availability verdict was reading neighbors with no cost/condition fields (edges judged free and ungated) | movement, adjacency, energy, fog of war, logs, ITEM_ADD, ITEM_USE, ITEM_DROP, energyGain, foodGain, magicGain, coinGain, log_item_usage, itemAction, find_location_neighbors_by_story_id |
| `Step29_NormalEvents.md` | Normal (player-triggered) events: schema V0.29.0, check procedure, execution, `available` flag, logs | events, execute-event, effects |
| `Step30_EdgeStates.md` | Edge states: sadness overflow, coma, `clock_in_coma` stamp, all-players-in-coma story epilogue. | sadness, coma, edge state, game over, epilogue, coma recovery, wake, `COMA_RECOVERED` |
| `Step31_ChoiceEngine.md` | Choice engine: choice-owning events branch `execute-event` to `status: CHOICES_PENDING` + `pendingChoices[]` instead of applying effects; cost/marker paid on open, idempotent re-fetch. | choice, choice engine, execute-event, pendingChoices, CHOICES_PENDING, availability |
| `Step32_ChoiceResolution.md` | Choice resolution: `POST .../action/select-choice` applies `list_choices_effects` (stats, registry, items, forced movement, weather, inline events via new v0.32.0 columns), runs `id_event_torun` | choice resolution, select-choice, list_choices_effects, flag_group, is_progress |
| `Step33_LocationEntryEvents.md` | Location entry events: triggers bind on five pre-existing `list_locations` columns; counter-zero finally executed (Step 26's dead end closed); `flag_visited` party-scoped visited state; v0.33.1 widened `counterZero[]` items to `card`/`cardLocation`/`cardEffects` | location entry, automatic trigger, counter zero, flag_visited, priority_automatic_event, cardEffects, cardLocation, AutomaticEvents |
| `Step34_InventoryAndResources.md` | Inventory (use-item, drop-item, listing) and resources (food/magic/coin, carried weight); `use-item` answers the execute-event payload through a shared `applyStandaloneEffects` door so items go through the Step-30 overflow/coma gate; carried weight switches on the movement `OVERWEIGHT` refusal; **v0.35.8 bugfix**: AWS `is_consumable` no longer refuses a missing key, Python's `card_mapper.py` fixes empty item/event/character cards | inventory, use-item, drop-item, resources, carried weight, weightMax, item effects, traits_to_add, applyStandaloneEffects, OVERWEIGHT, is_consumable, isConsumabile, card_mapper |
| `Step35_ItemsResolution.md` | UX refinement of the Step 34 engine, plus (v0.35.1) the quantities the engine had always hardcoded; (v0.35.3, §12) food/magic/coin become a cost of acting — `list_events.coin_cost` renamed `cost_coin`, new `cost_food`/`cost_magic` on events and (edge-only) on `list_locations_neighbors`, reserved on `list_choices`; new refusal codes `NOT_ENOUGH_FOOD`/`NOT_ENOUGH_MAGIC`; see also [Step28_MovementSystem.md](./Step28_MovementSystem.md) and [Step29_NormalEvents.md](./Step29_NormalEvents.md). | items resolution, use-item UX, handleItemUsed, fallbackCard, item-effects form, ITEM_EFFECT_CODE_OPTIONS, EffectStatCodec, effects preview, ItemEffectPreview, preview_effects, flagShowEffects, flag_show_effects, showsEffects, itemRowForUuid, max_per_character, amount_drop, amount_use, NOT_ADDED, ITEM_NOT_ENOUGH, MatchLogsCard, MatchLogCard, BonusBadgeList |
| `Step36_RegistrySystem.md` | Registry becomes a system: one `RegistryService` (render/parse/evaluate) replaces eight readers and three writers. `GET /api/match/{uuid}/registry` reads `list_keys`-joined entries; new operator column widens conditions past `=`. | registry, RegistryService, render, parse, evaluate, REGISTRY_CHANGE, list_keys, includeHidden |

Note: there is no `Step20_AdminEndpoint.md` despite older references — the admin-port split
(8044) is described in `Step19_SinglePlayerMatchUtils.md` and `Step20_GameWebSiteFirstRun.md`.

`website_concepts_v0/` is 450 MB of images/concept art. Never read it.
