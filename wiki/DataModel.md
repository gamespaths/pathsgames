# Data Model

Shared reference for the Paths Games relational schema (Java reference implementation,
mirrored by Python) and its AWS DynamoDB single-table equivalent. This document is
version-independent and kept current; for the historical design rationale and step-by-step
evolution, see `documentation_v0/`.

## 1. Naming Prefixes

| Prefix | Tier | Meaning |
|---|---|---|
| `global_` | System | System-wide configuration and feature flags |
| `users`, `users_` | Identity | Accounts and refresh tokens |
| `list_` | Story content (reference) | Authored, story-scoped, read-only at runtime |
| `gaming_` | Match state | Per-match runtime state, mutated during play |
| `log_` | Audit | Append-only history of a running match |
| `chat_` | Match state | In-match chat |
| `system_` | System services | Snapshots |

Three tiers: **Identity** (4 tables), **Story content** (23 tables), **Game runtime**
(25 tables) = **52 tables total** on Java/PostgreSQL and SQLite. Every table also carries
three standard columns (§4). Python (SQLAlchemy, `code/backend/python/app/adapters/persistence/`)
mirrors the same table/column names 1:1 — verified against `story/models.py` and
`match/models.py`. AWS does not use these tables; see §9.

Full entity purpose text and every column: [Step09_DesignCoreDataModel.md](documentation_v0/Step09_DesignCoreDataModel.md).
Full DDL and migration-by-migration column history: [Step10_CreateDBschema.md](documentation_v0/Step10_CreateDBschema.md)
and the Flyway files themselves (§8).

## 2. Table Catalog

One line per table: purpose plus the columns that matter for understanding it, not every
column. `id_story` scoping on story-content tables and `id_match` scoping on runtime tables
is omitted below since it applies uniformly within each tier.

### 2.1 System (2)

| Table | Purpose / key columns |
|---|---|
| `global_game_version` | Known game versions: `version`, `description`. |
| `global_runtime_variables` | Feature flags / tunables: `type`, `key`, `string_value`, `int_value`, `min_value`/`max_value`, `min_version`/`max_version`. |

### 2.2 Identity (2)

| Table | Purpose / key columns |
|---|---|
| `users` | Account: `username`, `password_hash`, `email_address`, `google_id_sso`, role (`ADMIN`/`PLAYER`), `state` (§6.3), `language`, `guest_cookie_token`, `guest_expires_at`, `theme_selected`. |
| `users_tokens` | Refresh tokens: `id_user`, `refresh_token`, `expires_at`, `revoked`. |

### 2.3 Story Content — reference (23)

Authored by the story importer (§9 in [StoryFormat.md](./StoryFormat.md)); read-only during
gameplay.

| Table | Purpose / key columns |
|---|---|
| `list_stories` | The story: `id_location_start`, `id_location_all_player_coma`, `id_event_all_player_coma`, `id_event_end_game`, `version_min`/`version_max`, `category`, `group`, `visibility`, `priority`, `id_card`, `id_creator`. |
| `list_stories_difficulty` | Difficulty preset: `exp_cost`, `max_weight`, `min_character`/`max_character`, `cost_help_coma`, `exp_cost_base`, `max_stat_value` (replaced `cost_max_characteristics` in v0.38.0), `trait_cost_positive_budget`/`trait_cost_negative_budget` (v0.23.1), `number_max_free_action`, plus base stats `life`/`energy`/`sad`/`dexterity`/`intelligence`/`constitution`/`weight` (v0.19.7). |
| `list_keys` | Registry key definition (documentation for authors): `name`, `value`, `group`, `priority`, `visibility`. |
| `list_classes` | Character class: `weight_max`, `dexterity_base`/`intelligence_base`/`constitution_base`. |
| `list_classes_bonus` | Recurring per-time-start bonus for a class: `id_class`, `statistic` (free text; only `energy`/`life`/`sad` are actually applied), `value`. |
| `list_traits` | Selectable trait: `id_class_permitted`/`id_class_prohibited`, signed stat deltas `life`/`energy`/`sad`/`dexterity`/`intelligence`/`constitution`/`weight` (v0.19.6), `cost_positive`/`cost_negative`, `hide_on_start_match` (v0.35.2 — not offered at character creation, still grantable via effects). |
| `list_character_templates` | Pre-built archetype. PK is `id_tipo`, not `id`. `life_max`/`energy_max`/`sad_max`, `dexterity_start`/`intelligence_start`/`constitution_start`, `id_class_permitted`/`id_class_prohibited`. |
| `list_locations` | Board location: `cost_energy_enter`, `counter_time`, `secure_param` (the only "safe location" signal the engine reads — `is_safe` was dropped in v0.38.0), `max_characters`, five trigger columns `id_event_if_counter_zero`/`id_event_if_character_start_time`/`id_event_if_character_enter_empty_location`/`id_event_if_first_time`/`id_event_not_first_time`, `priority_automatic_event`. |
| `list_locations_neighbors` | Directed edge between two locations: `id_location_from`/`id_location_to`, `direction`, `flag_back`, `energy_cost`, `condition_registry_key`/`condition_registry_value`, `id_card_back` (v0.28.2), `cost_food`/`cost_magic`/`cost_coin` (v0.35.3, edge-only). |
| `list_items` | Item catalog: `weight`, `is_consumabile` (default reads as NOT consumable since v0.36.3), `id_class_permitted`/`id_class_prohibited`, `flag_show_effects` (v0.35.0), `max_per_character`/`amount_drop`/`amount_use` (v0.35.1). |
| `list_items_effects` | Effect applied on use: `id_item`, `effect_code` (life/energy/exp/sad/dex/int/cos/food/magic/coin), `effect_value`, `traits_to_add`/`traits_to_remove` (v0.34.0, CSV of trait ids). |
| `list_weather_rules` | Weather type: `probability`, `cost_move_safe_location`/`cost_move_not_safe_location`, `condition_key`/`condition_key_value`, `time_from`/`time_to`, `active`, `priority`, `delta_energy`, `id_event`. |
| `list_events` | Event condition side (v0.29.0): `type` (AUTOMATIC/FIRST/NORMAL/ONCE), `cost_enery`, `cost_coin` (renamed from `coin_cost` in v0.35.3), `cost_food`/`cost_magic` (v0.35.3), `flag_end_time`, `id_event_next`, condition columns `id_specific_location`/`id_weather`/`registry_key_condition`/`registry_value_condition`/`id_item_condition`/`id_class_condition`. `id_item_to_add` is deprecated. |
| `list_events_effects` | Event effect side (v0.29.0): `id_event`, `statistics`, `value`, `target` (ALL/ONLY_ONE), `target_class`, `traits_to_add`/`traits_to_remove`, `id_item_target`/`item_action`, `id_weather` (sets weather), `key_to_add`/`key_value_to_add`, `characteristic_to_add`/`characteristic_to_remove`, `id_location` (v0.29.3, forces movement). |
| `list_choices` | Option group owned by an event (v0.31.0): `id_event` (mandatory), `id_location` (deprecated, unused), `priority`, `id_event_torun`, `limit_sad`/`limit_dex`/`limit_int`/`limit_cos`, `otherwise_flag`, `is_progress`, `logic_operator` (AND/OR), reserved `cost_food`/`cost_magic`/`cost_coin` (v0.35.3, not yet read). |
| `list_choices_conditions` | Activation condition for a choice: `type` (KEYS/ITEM/CLASS/LOCATION/ALL_IN_SAME_LOC/traits/statistics/statistics_SUM), `key`, `value`, `operator`. |
| `list_choices_effects` | What a selected option does (v0.32.0): `flag_group` (1 = every character in the actor's location, INV-46), `statistics`, `value`, `key`/`value_to_add`/`value_to_remove`, `id_event`, `id_location`, `id_weather`, `id_item_target`/`item_action`. |
| `list_global_random_events` | Time-start random event (Step39): `condition_key`/`condition_value`, `registry_value_operator_condition` (v0.39.0, default `=`), `probability`, `id_event`. |
| `list_missions` | Mission (Step37, registry-projected): `condition_key`, `condition_value`, `condition_values` (v0.37.0, PIPE-separated AND, wins over `condition_value`), `id_event_completed`. Comparison is always `=`. |
| `list_missions_steps` | Ordered mission step: `id_mission`, `step`, same `condition_key`/`condition_value`/`condition_values` as Mission, `id_event_completed`. Unique index on `(id_story, id_mission, step)` since v0.37.0. |
| `list_cards` | Visual card: `url_immage`, `id_text_title`/`id_text_description`, `alternative_image`, `awesome-icon`, `style_main`/`style_detail`, `style_image_little`/`style_image_medium`/`style_image_large` (v0.19.3), `card_type` (v0.19.4). |
| `list_texts` | Multi-language string: `id_text`, `lang`, `short_text` (`VARCHAR(2000)` on PostgreSQL since v0.35.8), `long_text` (unbounded). |
| `list_creator` | Author metadata: `link`, `url`, `url_image`, `url_emote`, `url_instagram`. |

### 2.4 Game Runtime — per match (25)

| Table | Purpose / key columns |
|---|---|
| `gaming_match` | Match instance: `id_story`, `status` (§6.1), `current_clock`, `id_current_weather`, `id_character_current_turn`, `single_player`, `character_template_uuid`/`class_uuid`/`trait_uuids` (v0.19.9), `rng_seed` (v0.27.0). |
| `gaming_character_instance` | Player character: `id_user`, `id_character_template`, `dexterity`/`intelligence`/`constitution`/`energy`/`life`/`sad`, `id_location`, `is_sleeping`/`is_coma`, `exp`, `characteristics` (CSV, v0.29.0), `life_max`/`energy_max`/`sad_max`/`weight_max` (v0.25.0), `id_class` (v0.26.0). |
| `gaming_character_traits` | Trait assigned to a character: `id_character_match`, `id_traits`, `id_event` (grantor). |
| `gaming_backpack_resources` | Per-character resources: `id_character_match`, `food`, `magic`, `coin`. |
| `gaming_inventory_items` | Held items: `id_character_match`, `id_item`, `amount`, `state`. One row per (character, item) since v0.35.1 (`uq_inventory_char_item`). |
| `gaming_state_registry` | Match key/value registry: `key`, `string_value`, `int_value`, `id_character`/`id_event`/`id_choice`/`clock`/`id_mission`/`id_mission_steps`. `(id_match, key)` unique since v0.36.0. |
| `gaming_state_locations` | Per-match location state: `id_location`, `flag_already_actived`, `clock_counter`. Composite PK `(id_match, id_location)`. |
| `gaming_turn_queue` | Turn order: `id_character_match`, `clock`, `timestamp_start`/`timestamp_end`, `pass_counter`, `priority`, `status` (v0.24.0). Composite PK `(id_match, id_character_match)`. |
| `gaming_active_effects` | Temporary character effect: `id_character_match`, `clock`, `id_choise`, `timestamp_start`/`timestamp_timeout`. |
| `gaming_active_choices` | Pending choice prompt: `clock`, `id_event`, `id_choise`. |
| `log_choices_executed` | History of resolved choices: `clock`, `id_event`, `id_choise`, `log_message`. |
| `gaming_story_progress` | Milestone tracker, written only when a resolved choice has `is_progress=1`: `clock`, `id_event`, `id_choise`. |
| `log_events` | Event execution audit: `id_character_match`, `timestamp`, `id_event`, `id_choise`, `log_message`, cost columns `energy`/`food`/`magic`/`coin` and gain columns `energy_gain`/`food_gain`/`magic_gain`/`coin_gain` (v0.35.3/v0.35.4), `clock` (v0.28.7). |
| `log_movements` | Movement audit: `id_location_from`/`id_location_to`, `id_event`/`id_choise`, `log_message`, `energy`, `food`/`magic`/`coin` (v0.35.3). |
| `log_item_usage` | Item action audit: `id_character_match`, `id_item`, `counter`, `effects_json`, `action` (ADD/USE/DROP/REMOVE, v0.35.4), `id_event`, `energy`/`food`/`magic`/`coin` deltas. |
| `log_weather` | Weather history: `clock`, `id_weatcher`, `timestamp_start`/`timestamp_end`. |
| `chat_messages` | In-match chat: `id_user`, `id_character_match`, `message`, `timestamp`, `counter`. |
| `gaming_user_sessions` | Online/offline tracking: `id_user`, `last_seen`, `is_online`, `client_id`, `ip`, `device`, `channel`. |
| `log_lock_history` | Concurrency lock record: `id_character_match`, `lock_start`/`lock_end`, `reason`, `message`. |
| `log_clock_history` | Record per time unit: `clock`, `wheater`, `timestamp_start`/`timestamp_end`, `id_event_start`/`id_event_end`. |
| `gaming_trades` | Trade proposal: `id_character_match_sender`/`id_character_match_dest`, `id_item`/`id_inventory_items`, `status` (§6.4), `timeout`, `resource`, `amount`. |
| `gaming_notification_queue` | Server push queue: `id_chat`, `flag_system_push`, `timestamp`, `type`, `priority`. |
| `gaming_movement_invites` | Group-follow invitation: `id_character_match_sender`/`id_character_match_friend`, `state` (§6.5), `timestamp_send`/`timestamp_timeout`/`timestamp_answer`, `energy_cost`. |
| `system_snapshot` | Match snapshot: `id_story`, `timestamp`, `type` (FULL/LIGHT), `jsonb_data`, `file_path`, `description`. |
| `gaming_temp_variables` | Per-character scratch variable: `id_character_match`, `key`, `value`, `type` (CLOCK/EVENT/LOCATION/RESOURCES/TRAITS/…), `timestamp`. |

## 3. Main Relationships

- `list_stories` is the root of the story tier: 1:N to every other `list_*` table via
  `id_story`, plus `id_location_start`, `id_event_end_game`, etc. as direct FKs.
- `list_locations` ↔ `list_locations` via `list_locations_neighbors` (N:M directed graph).
- `list_events` → `list_events_effects` (1:N, condition/effect split, v0.29.0) and
  `list_events.id_event_next` self-chains.
- `list_choices` belongs to exactly one `list_events` row (`id_choices.id_event`, mandatory
  since v0.31.0) and has its own conditions (`list_choices_conditions`) and effects
  (`list_choices_effects`).
- `list_missions` → `list_missions_steps` (1:N, ordered by `step`).
- `gaming_match` is the root of the runtime tier: 1:N to every `gaming_*`/`log_*`/`chat_*`
  table via `id_match`; also → `list_stories` (`id_story`), → `list_stories_difficulty`
  (`id_difficulty`), → `list_weather_rules` (`id_current_weather`).
- `gaming_character_instance` → `users` (`id_user`), → `list_character_templates`
  (`id_character_template`), → `list_locations` (`id_location`); 1:1 to
  `gaming_backpack_resources`; 1:N to `gaming_inventory_items` and `gaming_character_traits`.
- All `list_*` tables carry `id_card` (FK to `list_cards`) for their visual representation.

Full ER diagram (textual) and the complete cardinality table:
[Step09_DesignCoreDataModel.md §2](documentation_v0/Step09_DesignCoreDataModel.md#2-define-relationships-between-entities).

## 4. Standard Columns

Every one of the 52 tables carries, in addition to its primary key:

| Column | Purpose |
|---|---|
| `uuid` | Public API identifier (random v4), auto-generated on INSERT. Internal auto-increment `id`/`id_tipo` is never exposed. |
| `ts_insert` | Row creation timestamp, DB default. |
| `ts_update` | Last modification timestamp — DB sets the initial value only; the application layer must maintain it on update. |

## 5. Match and Character Statuses

**Match** (`gaming_match.status`): `CREATED` → `RUNNING` → (`PAUSED` ↔ `RUNNING`) →
`ENDED` | `GAMEOVER`. `ENDED`/`GAMEOVER` are terminal; no game action is allowed once
reached.

**Character** (`gaming_character_instance.is_sleeping`/`is_coma`): `ACTIVE`
(both false) → `SLEEPING` (`is_sleeping=true`, zero energy or voluntary) → `COMA`
(`is_sleeping=true, is_coma=true`, `life ≤ 0`). Coma clears passively at time-start on a
safe-location rest (v0.30.1) or actively via rescue/item.

**User account** (`users.state`): `1` registration, `2` active, `3` blocked, `4` banned,
`5` password-reset required, `6` guest.

**Trade** (`gaming_trades.status`): `PENDING_VALIDATION` → `ACCEPTED` | `REFUSED` |
`FAILED_INVALID` | `EXPIRED` (all terminal).

**Movement invite** (`gaming_movement_invites.state`): `PENDING` → `ACCEPTED` | `EXPIRED` |
`CANCELLED` (all terminal).

Full transition diagrams: [Step09_DesignCoreDataModel.md §4](documentation_v0/Step09_DesignCoreDataModel.md#4-list-valid-game-states).

## 6. Key Invariants

A short selection of the rules enforced at all times; the full catalog (46 numbered
invariants, INV-01…INV-46) is in
[Step09_DesignCoreDataModel.md §5](documentation_v0/Step09_DesignCoreDataModel.md#5-define-rules-that-must-never-be-broken-invariants).

- **INV-01…03**: `0 ≤ energy ≤ energy_max`, `0 ≤ life ≤ life_max`, `0 ≤ sadness ≤ life_max`.
- **INV-09/10**: `energy = 0` forces `is_sleeping=true`; `life ≤ 0` forces `is_coma=true`.
- **INV-11**: exactly one character holds the active turn during a `RUNNING` match.
- **INV-16**: time advances only when every character is sleeping.
- **INV-21/23**: movement only to adjacent locations, at the sum of location entry cost,
  weather cost and edge `energy_cost`.
- **INV-27**: an event affects all characters in the location unless `target`/`target_class`
  narrows it.
- **INV-33** *(registry)*: `(id_match, key)` is unique in `gaming_state_registry` — enforced
  as a real DB constraint since v0.36.0. (Note: `INV-33` is also used, in the same document,
  for an unrelated ONCE-event rule — a pre-existing numbering collision in the source, not
  fixed here.)
- **INV-45/46**: a choice always belongs to an event, never a location; a `ChoiceEffect`'s
  `flag_group=1` targets every character in the actor's location, not the whole match.

## 7. Flyway Versioning Convention

- Migration files: `V<major>.<minor>.<patch>__<name>.sql`, one file per schema change,
  under `code/backend/java/adapter-{postgres,sqlite}/src/main/resources/db/migration/v0/`.
  PostgreSQL and SQLite carry parallel files at the **same version number** for the same
  logical change (syntax may differ — e.g. SQLite must `DROP INDEX` before `DROP COLUMN`).
- The version number matches the app version that introduced the change (`V0.35.3` ships
  with app `0.35.3`), not a separate schema-only counter.
- `db/migration/dev/` holds seed data (demo stories, tutorial story) loaded only under the
  dev profile — never mixed with the `v0/` schema migrations.
- Flyway runs automatically on startup in both adapters; there is no manual migration step.
- Python has no Flyway. It reads the same tables via SQLAlchemy models kept in sync by hand
  (`app/adapters/persistence/{story,match,auth}/models.py`) and replays known drifts
  idempotently at startup via `align_schema()` (`app/adapters/persistence/database.py`).

Full guide: [Step10_CreateDBschema.md §5–§6](documentation_v0/Step10_CreateDBschema.md).

## 8. AWS DynamoDB Single-Table Layout

AWS is serverless (API Gateway → Lambda → DynamoDB) and does not use the 52-table schema
above; it stores the equivalent data in **one table** keyed by a prefixed Partition
Key (PK) / Sort Key (SK), plus two sparse GSIs. Source: `code/backend/aws/README.md`
("Data Mapping" / "Why one table?") and `code/backend/aws/template.yaml`.

| Entity | PK | SK | GSI1_PK | GSI2_PK / GSI2_SK |
|---|---|---|---|---|
| User / Guest | `USER#<uuid>` | `METADATA` | `GUEST_TOKEN#<token>` (guest only) | `GUEST_LIST` / `USER#<uuid>` |
| Story | `STORY#<uuid>` | `METADATA` | — | `STORY_LIST` / `STORY#<uuid>` |
| Card | `CARD#<id>` | `METADATA` | — | — |
| Match | `MATCH#<uuid>` | `METADATA` | `USER_MATCHES#<uuid>` | `MATCH` / `{tsInsert:020d}#{uuid}` |
| Character | `MATCH#<uuid>` | `CHARACTER#<uuid>` | — | — |
| Turn | `MATCH#<uuid>` | `TURN#<characterUuid>` | — | — |
| Log entry | `MATCH#<uuid>` | `LOG#{ts_ms:013d}#{seq:06d}` | — | — |
| Audit row (one per request) | `MATCH#<uuid>` | `AUDIT#{ts_ms:013d}#{seq:06d}` | — | — |
| Cache stamp | `SYSTEM#cache` | `METADATA` | — | — |

Design notes (v0.28.1 / v0.37.5):

- **GSI1** = "by owner" (a user's own matches, guest cookie resume). **GSI2** = "by type"
  (admin match list newest-first, story list, guest list) — both **INCLUDE** projections,
  never `ALL`, capped at 20 non-key attributes.
- Match logs are individual `LOG#` rows, not an embedded ever-growing list; entries the
  timeline never shows are packed into one `AUDIT#` item per request.
- Story items are stored gzipped (one Binary `_gz` attribute) and served from a per-container
  in-memory cache (`STORY_CACHE_TTL_SECONDS`), invalidated by a stamp on `SYSTEM#cache`;
  `POST /api/admin/cache/flush` bumps it.
- Derived state lives on the match METADATA item instead of being recomputed by scanning:
  `executedEventIds` (ONCE gating), `eventMarkers` (open-choice cycle), `visitedLocationIds`
  (fog of war). Location state rows are sparse — only the start location and locations with
  a counter get a row.
- Dev/test rows tagged by the Robot suites (`robottest…` guests/matches) carry a DynamoDB
  `ttl` attribute (v0.39.1, `ROBOT_TEST_DATA_TTL_HOURS`) so they self-expire without a manual
  purge, on top of the existing `purge_robot_test_data.py` script.

Full cost/design writeup and every changelog entry:
[code/backend/aws/README.md](../code/backend/aws/README.md).

## 9. Known Documentation Drift

`documentation_v0/Step09_DesignCoreDataModel.md` is pinned at document version 0.37.0 and
predates the v0.38.0 schema change (`list_locations.is_safe` dropped;
`list_stories_difficulty.cost_max_characteristics` replaced by `exp_cost_base`/
`max_stat_value`) and the v0.39.0 `list_global_random_events.registry_value_operator_condition`
addition — its per-entity column lists (§1.3) still mention the old columns. This document
(§2.3) reflects the current schema, verified against the Flyway SQL and the Python models
directly; Step09 remains the source for full rationale and history.

# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First version of the shared data model reference | September 25, 2026 |

- **Last Updated**: September 25, 2026 (v0.40.0)

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
