# Documentation index — V0

Map of `documentation_v0/`: only the documents of version V0 (alpha). Shared documents and
the other versions are in the global index [wiki/INDEX.md](../INDEX.md).

**Read this before opening any Step file.** The Step files are large (Step28 is 118 KB ≈ 29k
tokens); the whole folder is ~4.2 MB ≈ 1M tokens and can never fit in a context window. V0 is
the current version; once launched, its files become frozen history (only `Hotfixes.md` changes).

Workflow: find the right file here → `grep -n` for the section → read only that range with
`Read(offset=…, limit=…)`. Never `cat` a Step file whole.

Every Step file follows the same skeleton, so grep for these headings:
`## 1. Scope` · `## 2. Endpoint APIs` · `## 3. DTOs and Domain Models` ·
`## 4. Roles and Authentication` · `## 5. Database Tables` · `## Test coverage`

| File | What is in it | Keywords |
|---|---|---|
| `Roadmap.md` | V0 plan: steps 1-39 done, alpha preparation (40-41), alpha launch (42) | roadmap, alpha, steps, next steps |
| `Hotfixes.md` | Urgent fixes released after the alpha launch as 0.42.z | hotfixes, alpha, patches |
| `Step01_StartProject.md` | Main game-design concept and rules | game rules, concept, design |
| `Step02_CreateTheRepository.md` | Repo creation | git |
| `Step03_DefineScope.md` | V1 mandatory vs excluded features, complexity limit, definition of done | scope, V1, out of scope |
| `Step04_TechnologyStack.md` | Chosen stack. **v0.39.1**: hosting cost hypotheses at 3 traffic tiers | stack, technology, hosting cost, cloudflare, ec2, fargate, dynamodb |
| `Step05_BackendStructure.md` | Hexagonal module split: domain, api, realtime, persistence, shared | hexagonal, modules, ports |
| `Step06_NamingConventions.md` | REST, WebSocket, DB table/column, Java, DTO/JSON naming | naming, kebab-case, conventions |
| `Step07_ConfigureWebsite.md` | Domains, AWS Terraform infra, CSP | terraform, website, DNS, CSP |
| `Step08_ConfigureMinimalCI.md` | Environments, CI, Docker image build/push | CI, docker, environments |
| `Step09_DesignCoreDataModel.md` | **Core data model.** Entities, relationships, persistent vs transient, valid game states, invariants; **v0.37.0**: Mission/MissionStep columns renamed to `condition_value`/`condition_values` | entities, data model, invariants, game state, condition_value, condition_values, mission |
| `Step10_CreateDBschema.md` | Tables, PKs, FKs, indexes, schema versioning. **v0.38.1**: PostgreSQL log-table id sequences | schema, flyway, DDL, indexes, log sequences, LogIdPort |
| `Step11_DefineAPIVersioning.md` | Versioning scheme, backward compat, deprecation | versioning, deprecation |
| `Step12_GuestLoginMethod.md` | Guest login, JWT token structure. v0.36.2: admin guest list paged; **v0.37.5**: AWS cookie resume reads GSI1, admin guest list reads GSI2. | guest, login, JWT, admin-guests, pagination, stale-purge, GSI1, GSI2 |
| `Step13_SessionTokenManagement.md` | Session/token management, auth filter | session, token, auth filter |
| `Step14_StoriesImportSystem.md` | Story import system and data seeding; **v0.37.0**: mission import fixes on Java (dropped fields) and Python (wrong array read) | import, seed, stories, missionSteps, save_mission_steps, align_schema, cascading delete |
| `Step15_StoryContentAPIs.md` | Story content APIs: categories and groups. **v0.37.5**: AWS listing reads GSI2 summary, not raw story item. | categories, groups, GSI2 |
| `Step15_StoryContentHowAddFiledIntoCard.md` | **How-to: add a field to the Card object** end-to-end (schema → DTO → read → write → all backends) | card, add field, howto |
| `Step16_ContentDetailAPIs.md` | Cards, texts, creators detail APIs | cards, texts, creators |
| `Step17_StoryAdminCRUD.md` | Admin CRUD for all story entities; **v0.35.8**: texts capped at 2000 chars. **v0.37.5**: AWS `POST /api/admin/cache/flush`, gzipped story items. | admin, CRUD, textLimits, cache flush, story cache, GSI2, gzip |
| `Step18_GameMainFrontend.md` | react-game frontend: structure, design system, API client + mock fallback, guest identity. | react-game, frontend, design system, GameBook, useBookView, useGameplayResults, PageRightMain, MatchHistoryCard |
| `Step19_SinglePlayerMatchCreation.md` | Single-player match creation. **§6.1 (v0.32.1)**: one active match per user/story, 409 `ACTIVE_MATCH_ALREADY_EXISTS`; **v0.37.5**: final GSI1/GSI2 layout, `repo.py` unit of work, sparse locations | match, create, ACTIVE_MATCH_ALREADY_EXISTS, RESUME_WITHOUT_MODAL, GSI1, GSI2, repo.py |
| `Step19_SinglePlayerMatchUtils.md` | Admin match control, match lifecycle | match lifecycle, stop, pause, resume |
| `Step20_GameWebSiteFirstRun.md` | First run + match end flow, cookie consent, Turnstile antibot, **react-game color palette / design system**. **v0.37.3**: server refusal diagnostics, client token lifecycle fix. | turnstile, cookie, end match, palette, styles, TURNSTILE_ENFORCED |
| `Step21_CharacterSelection.md` | Character template and class selection | character, class, template |
| `Step22_StoryValidation.md` | Story validation rule catalog + integrity checks; **v0.37.0**: new report-only `R10_MISSION_CONDITION` rule | validation, integrity, R10_MISSION_CONDITION |
| `Step23_CharacterStatsInitialization.md` | Character stats initialization, stat formula; class-filtered trait listing and strict trait validation (`TRAIT_NOT_FOUND`/`DUPLICATED`/`NOT_COMPATIBLE`/`COST_EXCEEDED`); **v0.35.2 (§5.3, §6.2, §9)**: `list_traits.hide_on_start_match` locks a trait out of selection at match create/join (`TRAIT_NOT_SELECTABLE`) while both trait projections keep returning it and an item/event can still grant it via `traits_to_add`; **v0.35.2 bugfix (§6.4)**: a trait's stat deltas now apply the moment it is granted/removed mid-match (event or item), not only at character creation; **v0.35.2 (§10.4)**: Robot `Step23Helper.py` splits `_is_selectable` (class gates) from `_is_pickable` (class gates + not hidden) | stats, formula, init, trait selection, hideOnStartMatch, hide_on_start_match, TRAIT_NOT_SELECTABLE, applyTraitStats, trait grant stats |
| `Step24_TurnCycleEngine.md` | Turn cycle engine (single-player) | turn, cycle |
| `Step25_TimeAdvancementClockCycle.md` | Time advancement and clock cycle (backends only) | clock, time, advance |
| `Step26_TimeStartRecovery.md` | Time-start recovery math, class bonuses, location counters | recovery, bonus, counters |
| `Step27_WeatherSystem.md` | Weather random selection algorithm and effects. v0.36.2: admin `rules[]` exposes `registryMet`/`conditionKey`/`conditionValue`/`conditionOperator`; `WeatherCard.jsx` gets a Registry column. | weather, registryMet, WeatherCard, registry-verdict |
| `Step28_MovementSystem.md` | **Biggest file.** Movement: adjacency, energy cost, fog-of-war, location cards, match logs timeline. **v0.37.5**: AWS logs are `LOG#`/`AUDIT#` rows, not embedded lists. | movement, adjacency, energy, fog-of-war, logs, MatchLogCard, LOG#, AUDIT#, executedEventIds |
| `Step29_NormalEvents.md` | Normal (player-triggered) events: check procedure, execution, `available` flag, logs; **v0.36.3**: AWS forced-move/time-end race fixed; **v0.37.5**: ONCE gating reads derived `executedEventIds` | events, execute-event, effects, executedEventIds |
| `Step30_EdgeStates.md` | Edge states: sadness overflow, coma, `clock_in_coma` stamp, all-players-in-coma story epilogue. | sadness, coma, edge state, game over, epilogue, coma recovery, wake, `COMA_RECOVERED` |
| `Step31_ChoiceEngine.md` | Choice engine: choice-owning events branch `execute-event` to `CHOICES_PENDING` + `pendingChoices[]`; cost/marker paid on open, idempotent re-fetch. **v0.37.5**: AWS cycle count reads `eventMarkers`. | choice, choice engine, execute-event, pendingChoices, CHOICES_PENDING, eventMarkers |
| `Step32_ChoiceResolution.md` | Choice resolution: `POST .../action/select-choice` applies `list_choices_effects` (stats, registry, items, forced movement, weather, inline events via new v0.32.0 columns), runs `id_event_torun`; **v0.36.3**: Java import bugfix | choice resolution, select-choice, list_choices_effects, flag_group, is_progress |
| `Step33_LocationEntryEvents.md` | Location entry events: triggers bind on five pre-existing `list_locations` columns; counter-zero finally executed (Step 26's dead end closed); `flag_visited` party-scoped visited state; **v0.36.3**: AWS/Python `execute-event` now answers `automaticEvents[]`. Start location is seeded `flag_visited=1`, so it never "arrives" — see [Step36 §14.1](./Step36_RegistrySystem.md) for the v0.37.1 fallout. | location entry, automatic trigger, counter zero, flag_visited, priority_automatic_event, cardEffects, cardLocation, AutomaticEvents |
| `Step34_InventoryAndResources.md` | Inventory (use-item, drop-item, listing) and resources (food/magic/coin, carried weight); `use-item` answers the execute-event payload through a shared `applyStandaloneEffects` door so items go through the Step-30 overflow/coma gate; **v0.36.3 bugfix**: `is_consumabile`'s default reverses to non-consumable, all three backends | inventory, use-item, drop-item, resources, carried weight, weightMax, item effects, traits_to_add, applyStandaloneEffects, OVERWEIGHT, is_consumable, isConsumabile, card_mapper |
| `Step35_ItemsResolution.md` | UX refinement of the Step 34 engine, plus (v0.35.1) the quantities the engine had always hardcoded; (v0.35.3, §12) food/magic/coin become a cost of acting — `list_events.coin_cost` renamed `cost_coin`, new `cost_food`/`cost_magic` on events and (edge-only) on `list_locations_neighbors`, reserved on `list_choices`; new refusal codes `NOT_ENOUGH_FOOD`/`NOT_ENOUGH_MAGIC`; see also [Step28_MovementSystem.md](./Step28_MovementSystem.md) and [Step29_NormalEvents.md](./Step29_NormalEvents.md). | items resolution, use-item UX, handleItemUsed, fallbackCard, item-effects form, ITEM_EFFECT_CODE_OPTIONS, EffectStatCodec, effects preview, ItemEffectPreview, preview_effects, flagShowEffects, flag_show_effects, showsEffects, itemRowForUuid, max_per_character, amount_drop, amount_use, NOT_ADDED, ITEM_NOT_ENOUGH, MatchLogsCard, MatchLogCard, BonusBadgeList |
| `Step36_RegistrySystem.md` | Registry becomes a system: one `RegistryService` (render/parse/evaluate) replaces eight readers and three writers, compared via ∃/∄/∀ operators (v0.36.1).| registry, RegistryService, evaluate, admin-edit, writeStartLocationEntry, includeHidden, REGISTRY_CHANGE |
| `Step37_MissionSystem.md` | Missions are a projection of the Step 36 registry: no operator, no state table, `condition_value`/`condition_values` (PIPE AND) drive an `AVAILABLE`→`ACTIVE`→`COMPLETED`/`FAILED` machine. New `/missions` endpoints, `missions[]` on `/info`, react-game bookmark live. | missions, MissionService, condition_values, MissionsCard, MISSION_CHANGE, EndGameBook, MatchHistoryCard |
| `Step38_ExperienceSystem.md` | `gaming_character_instance.exp`, written since Step 29, finally gets a spender: `use-exp` raises DEX/INT/COS by one at a difficulty-priced cost, and writes `use-exp`/`use-exp-<STAT>` registry keys for missions to watch. `is_safe` dropped for `secure_param`, `cost_max_characteristics` replaced by `exp_cost_base`/`max_stat_value`. | use-exp, exp_cost_base, max_stat_value, EXP_USE, ExperienceCard, secure_param, is_safe, registry |
| `Step39_RandomEvents.md` | At every time-start, after the weather, at most one `list_global_random_events` row fires: absolute-percentage pick, party-wide, no actor, trigger `RANDOM_EVENT`. Rides the sleep answer's `counterZero[]`; new `R11_RANDOM_EVENT` validation rule plus a `warnings[]` report array. | random events, RANDOM_EVENT, counterZero, probability, R11_RANDOM_EVENT, warnings, partyRun, registryValueOperatorCondition |

Note: there is no `Step20_AdminEndpoint.md` despite older references — the admin-port split
(8044) is described in `Step19_SinglePlayerMatchUtils.md` and `Step20_GameWebSiteFirstRun.md`.

`website_concepts_v0/` is 450 MB of images/concept art. Never read it.


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
