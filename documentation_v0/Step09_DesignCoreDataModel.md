# Paths Games V1 - Step 09: Design the Core Data Model

This document defines the **core data model** for **Paths Games**, identifying all main entities, their relationships, data lifecycle (persistent vs transient), valid game states, invariant rules, and model validation through real gameplay scenarios.

All naming conventions follow [Step 06 - Naming Conventions](./Step06_NamingConventions.md). Database tables use **snake_case** with the prefixes established:

| Prefix | Category |
|--------|----------|
| `global_` | Global system configuration |
| `users` / `users_` | User account management |
| `list_` | Reference / story-authored data (static, read-only at runtime) |
| `gaming_` | Runtime game state (dynamic, per-match) |

### Standard Columns

Every table includes three standard columns that are **not** listed in the per-entity descriptions below:

| Column | Type | Purpose |
|--------|------|---------|
| `uuid` | UUID (PostgreSQL) / TEXT (SQLite) | Public identifier for REST API exposure. Auto-generated random UUID v4 on INSERT. **UNIQUE**. API methods use `uuid` to reference entities — the internal `id` (auto-increment PK) is never exposed in HTTP responses or request parameters. This prevents enumeration attacks and decouples the public API from internal database sequencing. |
| `ts_insert` | TIMESTAMP / TEXT | Row creation timestamp (auto-set by DEFAULT) |
| `ts_update` | TIMESTAMP / TEXT | Last modification timestamp (maintained by application layer) |



  - ✅ Identify main entities

  - ✅ Define relationships between entities

  - ✅ Identify persistent vs transient data

  - ✅ List valid game states

  - ✅ Define rules that must never be broken

  - ✅ Validate models with real cases



## 1. Identify Main Entities

The data model is organized into four tiers: **system**, **user**, **story** content (reference), and **runtime** game state.


### 1.1 System Entities

| Entity | Table | Purpose |
|--------|-------|---------|
| **GameVersion** | `global_game_version` | List of game versions (e.g., `v1.0.0`, `v1.42.5`, `v2.3.4`). Each row holds `id`, `version`, `description`. |
| **GlobalVariable** | `global_runtime_variables` | System-wide parameters and feature flags (e.g., `SystemStatus`, `MaxActiveMatches`). Each row holds `id`, `type`, `key`, `string_value`, `int_value`, `description`, `min_value`, `max_value`, `min_version`, `max_version`. |



### 1.2 User Entities

| Entity | Table | Purpose |
|--------|-------|---------|
| **User** | `users` | Registered player or admin account. Holds authentication data (`username`, `password_hash`, `email_address`, `google_id_sso`), role (`ADMIN`/`PLAYER`), `ts_registration`, `ts_last_access`, `nickname`, state (`1`=registration, `2`=active, `3`=blocked, `4`=banned, `5`=password, `6`=guest), `language`, `guest_cookie_token`, `guest_expires_at`, `theme_selected`. |
| **UserToken** | `users_tokens` | Refresh-token records for JWT sessions. Linked 1:N to a User. Each row holds `id`, `id_user`, `refresh_token`, `expires_at`, `revoked`. |


### 1.3 Story / Reference Entities (static — authored before a match starts)

These tables are populated by a story importer and are **read-only** during gameplay.

| Entity | Table | Description |
|--------|-------|-------------|
| **Story** | `list_stories` | A playable adventure: `id_card`, `id_text_title`, `id_text_description`, `author`, `version_min`, `version_max`, `id_location_start`, `id_image`, `id_location_all_player_coma`, `id_event_all_player_coma`, `clock_singular_description` (hour), `clock_plural_description` (hours), `id_event_end_game`, `id_text_copyright`, `link_copyright`, `id_creator`, `category`, `group`, `visibility`, `priority`, `peghi`. |
| **StoryDifficulty** | `list_stories_difficulty` | Per-story difficulty preset: `id_card`, `id_story`, `id_text_description`, `exp_cost`, `max_weight`, `min_character`, `max_character`, `cost_help_coma`, `cost_max_characteristics`, `number_max_free_action`. |
| **StoryKey** | `list_keys` | Registry key definitions for a story: `id_card`, `id_story`, `name`, `value`, `id_text_description`, `group`, `priority`, `visibility`. |
| **CharacterClass** | `list_classes` | Classes available in a story: `id_card`, `id_story`, `id_text_name`, `id_text_description`, `weight_max`, `dexterity_base`, `intelligence_base`, `constitution_base`. |
| **ClassBonus** | `list_classes_bonus` | Per-class recurring bonus applied at each time start: `id_card`, `id_story`, `id_class`, `statistic`, `value`, `id_text_name`, `id_text_description`. |
| **Trait** | `list_traits` | Selectable character traits: `id_card`, `id_story`, `id_class_permitted`, `id_class_prohibited`, `id_text_name`, `id_text_description`, `cost_positive`, `cost_negative`. |
| **CharacterTemplate** | `list_character_templates` | Pre-built character archetypes: PK is `id_tipo`, plus `id_card`, `id_story`, `id_text_name`, `id_text_description`, `life_max`, `energy_max`, `sad_max`, `dexterity_start`, `intelligence_start`, `constitution_start`. |
| **Location** | `list_locations` | A place on the game board: `id_card`, `id_story`, `id_text_name`, `id_text_description`, `id_text_narrative`, `id_image`, `is_safe`, `cost_energy_enter`, `counter_time`, `id_event_if_counter_zero`, `secure_param`, `id_event_if_character_start_time`, `id_event_if_character_enter_first_time`, `id_event_if_first_time`, `id_event_not_first_time`, `priority_automatic_event`, `id_audio`, `max_characters`. |
| **LocationNeighbor** | `list_locations_neighbors` | Directed edge between two locations: `id_story`, `id_location_from`, `id_location_to`, `direction` (NORTH/SOUTH/EAST/WEST/ABOVE/BELOW/SKY), `flag_back`, `condition_registry_key`, `condition_registry_value`, `energy_cost`, `id_text_go`, `id_text_back`. |
| **Item** | `list_items` | Item catalog: `id_card`, `id_story`, `id_text_name`, `id_text_description`, `weight`, `is_consumabile`, `id_class_permitted`, `id_class_prohibited`. |
| **ItemEffect** | `list_items_effects` | Effects applied when an item is used: `id_story`, `id_item`, `id_text_name`, `id_text_description`, `effect_code` (e.g., LIFE), `effect_value` (e.g., 2). |
| **WeatherRule** | `list_weather_rules` | Weather types with `id_card`, `id_story`, `id_text_name`, `id_text_description`, `probability`, `cost_move_safe_location`, `cost_move_not_safe_location`, `condition_key`, `condition_key_value`, `time_from`, `time_to`, `id_text`, `active`, `priority`, `delta_energy`, `id_event`. |
| **Event** | `list_events` | Event definitions: `id_card`, `id_story`, `id_specific_location`, `id_text_name`, `id_text_description`, `type` (AUTOMATIC/FIRST/NORMAL), `cost_enery`, `flag_end_time`, `characteristic_to_add`, `characteristic_to_remove`, `key_to_add`, `key_value_to_add`, `id_item_to_add`, `id_weather`, `id_event_next`, `coin_cost`. |
| **EventEffect** | `list_events_effects` | Granular effects: `id_card`, `id_story`, `id_event`, `statistics` (life/energy/exp/…), `value`, `target` (ALL/ONLY_ONE), `traits_to_add`, `traits_to_remove`, `target_class`, `id_item_target`, `item_action` (REMOVE/ADD). |
| **Choice** | `list_choices` | Options after an event or at a location: `id_card`, `id_story`, `id_event`, `id_location`, `priority`, `id_text_name`, `id_text_description`, `id_text_narrative`, `id_event_torun`, `limit_sad`, `limit_dex`, `limit_int`, `limit_cos`, `otherwise_flag`, `is_progress`, `logic_operator` (AND/OR). |
| **ChoiceCondition** | `list_choices_conditions` | Condition rules for a choice: `id_story`, `id_choices`, `type` (KEYS/ITEM/CLASS/LOCATION/ALL_IN_SAME_LOC/traits/statistics/statistics_SUM), `key`, `value`, `operator` (= > < !=), `id_text_name`, `id_text_description`. |
| **ChoiceEffect** | `list_choices_effects` | Stat deltas when selected: `id_story`, `id_choices`, `id_scelta`, `flag_group`, `statistics` (life/energy/sad/DEX/COS/INT), `value`, `id_text`, `key`, `value_to_add`, `value_to_remove`. |
| **GlobalRandomEvent** | `list_global_random_events` | Random events triggered at time start: `id_card`, `id_story`, `condition_key`, `condition_value`, `probability`, `id_text`, `id_event`. |
| **Mission** | `list_missions` | Mission definition: `id_card`, `id_story`, `condition_key`, `condition_value_from`, `condition_value_to`, `id_text_name`, `id_text_description`, `id_event_completed`. |
| **MissionStep** | `list_missions_steps` | Ordered mission steps: `id_card`, `id_story`, `id_mission`, `step`, `condition_key`, `condition_value_from`, `condition_value_to`, `id_text_name`, `id_text_description`, `id_event_completed`. |
| **Card** | `list_cards` | Visual card data: `id_story`, `id_card`, `url_immage`, `id_text_title`, `id_text_description`, `id_text_copyright`, `link_copyright`, `id_creator`, `alternative_image`, `awesome-icon`, `style_main`, `style_detail`. |
| **Text** | `list_texts` | Multi-language text catalog: `id_story`, `id_text`, `lang`, `short_text`, `long_text`, `id_text_copyright`, `link_copyright`, `id_creator`. |
| **Creator** | `list_creator` | Creator/author information: `id_story`, `id_text`, `link`, `url`, `url_image`, `url_emote`, `url_instagram`. |


### 1.4 Runtime / Game-State Entities (dynamic — one set per active match)

| Entity | Table | Description |
|--------|-------|-------------|
| **Match** | `gaming_match` | Active match instance: `id_story`, `name`, `id_difficulty`, `exp_cost`, `status` (CREATED/RUNNING/PAUSED/ENDED/GAMEOVER), `current_clock`, `id_current_weather`, `id_user_creator`, `timestamp_start`, `timestamp_lock_expiration`, `timestamp_gameover`, `timestamp_end`, `id_character_current_turn`, `secure_location_param`, `counter_consecutive_pass`. |
| **CharacterInstance** | `gaming_character_instance` | A player's character within a match: `id_match`, `id_user`, `id_character_template`, `dexterity`, `intelligence`, `constitution`, `energy`, `life`, `sad`, `id_location`, `is_sleeping`, `is_coma`, `clock_in_coma`, `timestamp_last_pass`, `counter_consecutive_pass`. |
| **CharacterTraits** | `gaming_character_traits` | Traits assigned to a character instance: `id_match`, `id_character_match`, `id_traits`, `id_event`. |
| **BackpackResources** | `gaming_backpack_resources` | Per-character resources: `id_character_match`, `food`, `magic`, `coin`. |
| **InventoryItem** | `gaming_inventory_items` | Items held by a character: `id_character_match`, `id_item`, `amount`, `state`. |
| **StateRegistry** | `gaming_state_registry` | Key-value game registry for a match: `id_match`, `key`, `string_value`, `int_value`, `id_character`, `id_event`, `id_choice`, `clock`, `id_mission`, `id_mission_steps`. |
| **StateLocation** | `gaming_state_locations` | Per-match location state: `id_match`, `id_location`, `flag_already_actived`, `clock_counter`. |
| **TurnQueue** | `gaming_turn_queue` | Turn order for current time: `id_match`, `id_character_match`, `clock`, `timestamp_start`, `timestamp_end`, `pass_counter`, `priority`. |
| **ActiveEffect** | `gaming_active_effects` | Temporary effects on characters: `id_match`, `id_character_match`, `clock`, `id_choise`, `timestamp_start`, `timestamp_timeout`. |
| **ActiveChoice** | `gaming_active_choices` | Currently pending choice prompt: `id_match`, `clock`, `id_event`, `id_choise`. |
| **ChoiceExecuted** | `log_choices_executed` | History log of choices made: `id_match`, `clock`, `id_event`, `id_choise`, `log_message`. |
| **StoryProgress** | `gaming_story_progress` | Milestone tracker for narrative progression: `id_match`, `clock`, `id_event`, `id_choise`. |
| **LogEvent** | `log_events` | Audit log: `id_match`, `id_character_match`, `timestamp`, `id_event`, `id_choise`, `log_message`. |
| **LogMovement** | `log_movements` | Movement audit: `id_match`, `id_location_from`, `id_location_to`, `id_event`, `id_choise`, `log_message`, `energy`. |
| **LogItemUsage** | `log_item_usage` | Item usage audit: `id_match`, `id_character_match`, `id_item`, `counter`, `effects_json`, `timestamp`. |
| **LogWeather** | `log_weather` | Weather history per match time: `id_match`, `clock`, `id_weatcher`, `timestamp_start`, `timestamp_end`. |
| **ChatMessage** | `chat_messages` | In-match chat messages: `id_match`, `id_user`, `id_character_match`, `message`, `timestamp`, `counter`. |
| **UserSession** | `gaming_user_sessions` | Player online/offline tracking: `id_user`, `id_match`, `last_seen`, `is_online`, `client_id`, `ip`, `device`, `channel`. |
| **LockHistory** | `log_lock_history` | Concurrency lock records: `id_match`, `id_character_match`, `lock_start`, `lock_end`, `reason`, `message`. |
| **ClockHistory** | `log_clock_history` | Record per time-unit: `id_match`, `clock`, `wheater`, `timestamp_start`, `timestamp_end`, `id_event_start`, `id_event_end`. |
| **Trade** | `gaming_trades` | Item/resource trade proposals: `id_match`, `id_character_match_sender`, `id_character_match_dest`, `id_item`, `id_inventory_items`, `status`, `timeout`, `resource`, `amount`. |
| **NotificationQueue** | `gaming_notification_queue` | Server-side push notification queue: `id_match`, `id_chat`, `flag_system_push`, `timestamp`, `type`, `priority`. |
| **MovementInvite** | `gaming_movement_invites` | Group-movement follow invitations: `id_match`, `id_character_match_sender`, `id_character_match_friend`, `state` (PENDING/ACCEPTED/EXPIRED/CANCELLED), `timestamp_send`, `timestamp_timeout`, `timestamp_answer`, `energy_cost`. |
| **Snapshot** | `system_snapshot` | Match snapshots: `id_story`, `id_match`, `timestamp`, `type` (FULL/LIGHT), `jsonb_data`, `file_path`, `description`. |
| **TempVariable** | `gaming_temp_variables` | Per-character temporary variables: `id_match`, `id_character_match`, `key`, `value`, `type` (CLOCK/EVENT/LOCATION/RESOURCES/TRAITS/…), `timestamp`. |


## 2. Define Relationships Between Entities

### 2.1 Entity-Relationship Diagram (textual)

```
 SYSTEM TIER                USER TIER
┌───────────────────┐      ┌────────┐ 1    N ┌──────────────┐
│global_runtime_vars│      │ users  │───────►│ users_tokens │
│global_game_version│      └───┬────┘        └──────────────┘
└───────────────────┘          │ 1
                               │
         ┌─────────────────────┼──────────────────────┐
         │ (creator)           │ (player)             │
         ▼ N                   ▼ N                    │
   ┌──────────────┐   ┌────────────────────┐          │
   │ gaming_match │   │gaming_character_   │          │
   │              │◄──│    instance        │          │
   └──────┬───────┘   └────────┬───────────┘          │
          │ 1                  │ 1                    │
          │    ┌───────────────┼───────────────┐      │
          │    │               │               │      │
          │    ▼ N             ▼ N             ▼ N    │
          │ ┌─────────┐  ┌───────────┐  ┌──────────┐  │
          │ │gaming_  │  │gaming_    │  │gaming_   │  │
          │ │backpack_│  │inventory_ │  │character_│  │
          │ │resources│  │items      │  │traits    │  │
          │ └─────────┘  └───────────┘  └──────────┘  │
          │                                           │
          │  1                                        │
          ├────────►  gaming_state_registry (N)       │
          ├────────►  gaming_state_locations (N)      │
          ├────────►  gaming_turn_queue (N)           │
          ├────────►  gaming_active_effects (N)       │
          ├────────►  gaming_active_choices (N)       │
          ├────────►  gaming_trades (N)               │
          ├────────►  gaming_movement_invites (N)     │
          ├────────►  system_snapshot (N)             │
          ├────────►  gaming_notification_queue (N)   │
          ├────────►  log_events (N)                  │
          ├────────►  log_movements (N)                │
          ├────────►  log_item_usage (N)               │
          ├────────►  log_weather (N)                  │
          ├────────►  log_clock_history (N)            │
          ├────────►  log_lock_history (N)             │
          ├────────►  chat_messages (N)                │
          ├────────►  gaming_user_sessions (N)         │
          ├────────►  log_choices_executed (N)         │
          ├────────►  gaming_story_progress (N)        │
          └────────►  gaming_temp_variables (N)        │
                                                      │


 STORY / REFERENCE TIER (read-only at runtime)

  ┌──────────────┐ 1    N ┌──────────────────────────┐
  │ list_stories │───────►│ list_stories_difficulty  │
  │              │───────►│ list_keys                │
  │              │───────►│ list_classes             │──► list_classes_bonus
  │              │───────►│ list_traits              │
  │              │───────►│ list_character_templates │
  │              │───────►│ list_locations           │──► list_locations_neighbors
  │              │───────►│ list_items               │──► list_items_effects
  │              │───────►│ list_weather_rules       │
  │              │───────►│ list_events              │──► list_events_effects
  │              │───────►│ list_choices             │──► list_choices_conditions
  │              │        │                          │──► list_choices_effects
  │              │───────►│ list_global_random_events│
  │              │───────►│ list_missions            │──► list_missions_steps  
  │              │───────►│ list_cards               │
  │              │───────►│ list_texts               │
  └──────────────┘

  ┌──────────────┐
  │ list_creator │  (standalone — referenced by id_creator in stories, cards, texts)
  └──────────────┘
```

### 2.2 Key Relationships (Cardinality and Foreign Keys)

#### System & User Layer

| Relationship | FK column | Cardinality | Notes |
|---|---|---|---|
| User → UserToken | `users_tokens.id_user` → `users.id` | 1 : N | One user may have multiple active refresh tokens |
| Story → GameVersion | `version_min` / `version_max` | N : 1 | Story specifies compatible version range |

#### Story Layer (all scoped by `id_story`)

| Parent → Child | FK column | Cardinality | Notes |
|---|---|---|---|
| Story → StoryDifficulty | `id_story` | 1 : N | Each story offers one or more difficulty presets |
| Story → StoryKey | `id_story` | 1 : N | Registry key definitions for the story |
| Story → CharacterClass | `id_story` | 1 : N | Available classes within this story |
| CharacterClass → ClassBonus | `id_class` | 1 : N | Recurring stat bonuses per class |
| Story → Trait | `id_story` | 1 : N | Traits may be restricted to/excluded from certain classes via `id_class_permitted` / `id_class_prohibited` |
| Story → CharacterTemplate | `id_story` | 1 : N | Pre-built character archetypes |
| Story → Location | `id_story` | 1 : N | All locations in the story |
| Location ↔ Location | `list_locations_neighbors` (bridge) | N : M | Directed adjacency graph; `flag_back` indicates reverse edge |
| Story → Item | `id_story` | 1 : N | Item catalog; items may have `id_class_permitted` / `id_class_prohibited` |
| Item → ItemEffect | `id_item` | 1 : N | What happens when item is used |
| Story → WeatherRule | `id_story` | 1 : N | Possible weather types |
| Story → Event | `id_story` | 1 : N | Events defined for the story; each event has optional `id_location` |
| Event → EventEffect | `id_event` | 1 : N | Stat/position effects of the event |
| Event → Event (chain) | `id_event_next` | N : 1 | An event can chain to a follow-up event |
| Story → Choice | `id_story` | 1 : N | Choices linked to an event (`id_event`) or location (`id_location`) |
| Choice → ChoiceCondition | `id_choices` | 1 : N | Activation conditions (AND or OR within one choice, governed by `logic_operator`) |
| Choice → ChoiceEffect | `id_choices` | 1 : N | Stat deltas when chosen |
| Choice → Event (result) | `id_event_torun` | N : 1 | Choice triggers one follow-up event |
| Story → GlobalRandomEvent | `id_story` | 1 : N | Random events with probability |
| Story → Mission | `id_story` | 1 : N | Missions tied to registry values |
| Mission → MissionStep | `id_mission` | 1 : N | Ordered steps within a mission |
| Story → Card | `id_story` (implicit) | 1 : N | Visual card data (multi-language via `lang`) |
| Story → Text | `id_story` | 1 : N | Translation strings |
| Various → Creator | `id_creator` | N : 1 | Stories, cards, and texts reference the creator table |

All `list_` tables also carry `id_card` (FK to `list_cards.id`) for visual card representation.

#### Runtime Layer (all scoped by `id_match`)

| Parent → Child | FK column | Cardinality | Notes |
|---|---|---|---|
| Match → CharacterInstance | `id_match` | 1 : N (max = difficulty's `max_character`) | Each player controls one character per match |
| CharacterInstance → User | `id_user` | N : 1 | One user per character; one user can play different matches |
| CharacterInstance → CharacterTemplate | `id_character_template` | N : 1 | Links to the story template used (FK to `list_character_templates.id_tipo`) |
| CharacterInstance → CharacterTraits | `id_character_match` | 1 : N | Traits assigned to this character; `id_event` tracks the event that granted/removed the trait |
| CharacterInstance → BackpackResources | `id_character_match` | 1 : 1 | One backpack per character (food, magic, coin) |
| CharacterInstance → InventoryItem | `id_character_match` | 1 : N | Items in the backpack |
| InventoryItem → Item | `id_item` | N : 1 | Links to the item catalog |
| Match → StateRegistry | `id_match` | 1 : N | Game registry entries (key + string_value + int_value) |
| Match → StateLocation | `id_match` + `id_location` | 1 : N | Per-location runtime state (flag_already_actived, clock_counter) |
| Match → TurnQueue | `id_match` | 1 : N | Turn order for current time |
| CharacterInstance → ActiveEffect | `id_character_match` | 1 : N | Temporary effects (clock, id_choise, timestamps) |
| Match → ActiveChoice | `id_match` | 1 : N | Pending player choices |
| Match → Trade | `id_match` | 1 : N | Active trade proposals |
| Match → MovementInvite | `id_match` | 1 : N | Pending follow invitations |
| Match → Snapshot | `id_match` | 1 : N | Saved snapshots |
| Match → all log tables | `id_match` | 1 : N | Event, movement, item-usage, weather, chat, lock logs |
| Match → TurnQueue → CharacterInstance | `id_character_match` | N : 1 | Queue entry references a character |

#### Cross-Tier References

| Runtime Entity | → Story Entity | FK | Notes |
|---|---|---|---|
| Match | → Story | `id_story` | Which story is being played |
| Match | → StoryDifficulty | `id_difficulty` | Which difficulty preset; `exp_cost` is also stored directly on match |
| Match | → WeatherRule | `id_current_weather` | Current weather condition |
| CharacterInstance | → Location | `id_location` | Character's current position on the board |
| CharacterInstance | → CharacterTemplate | `id_character_template` | Links to `list_character_templates.id_tipo` |
| StateLocation | → Location | `id_location` | Links runtime state to story location |
| InventoryItem | → Item | `id_item` | Links runtime inventory to item catalog |
| TurnQueue | → CharacterInstance | `id_character_match` | Turn entry references a character |


## 3. Identify Persistent vs Transient Data

### 3.1 Persistent Data (survives server restart — stored in database)

| Category | Tables | Lifecycle |
|----------|--------|-----------|
| **System config** | `global_game_version`, `global_runtime_variables` | Lives forever; editable by admin |
| **User accounts** | `users`, `users_tokens` | Lives until account deletion or token expiration |
| **Story content** | All `list_*` tables (including `list_creator`) | Immutable during gameplay; updated only by story importer |
| **Match state** | All `gaming_*` tables | Lives for match duration (CREATED → ENDED/GAMEOVER); archived after match completion |
| **Audit logs** | All `log_*` tables (`log_events`, `log_movements`, `log_item_usage`, `log_weather`, `log_clock_history`, `log_lock_history`, `log_choices_executed`) | Permanent — preserved for replay, analytics, and debugging |
| **Chat history** | `chat_messages` | Lives for match duration + retention period |
| **Snapshots** | `system_snapshot` | Manual snapshots permanent; automatic snapshots rotated |


### 3.2 Transient Data (short-lived — may exist only in memory or expire quickly)

| Entity | Table / Location | TTL / Lifecycle | Notes |
|--------|-----------------|-----------------|-------|
| **Active trades** | `gaming_trades` | `TimeoutTradesExpire` seconds | Cleaned by `@Scheduled cleanExpiredTrades` |
| **Movement invites** | `gaming_movement_invites` | `TimeoutMovementFollow` seconds | Cleaned by `@Scheduled matchCleanExpiredMovementInvites` |
| **Active choices** | `gaming_active_choices` | `TimeoutChoice` seconds | Cleaned by `@Scheduled checkTimeoutChoise` — defaults to "otherwise" option |
| **Notification queue** | `gaming_notification_queue` | Until delivered via WebSocket | Cleaned by `@Scheduled matchSendPendingNotifications` after delivery |
| **User sessions** | `gaming_user_sessions` | Until disconnect + grace period | Stale sessions cleaned by `@Scheduled checkTimeCleanUpAFKPlayers` |
| **Concurrency locks** | `log_lock_history` (active record) | `timestamp_lock_expiration` on `gaming_match` | Released by action completion or `@Scheduled matchCheckLockExpiration` |
| **WebSocket connections** | In-memory (Spring WebSocket session map) | Connection lifetime | Not persisted; reconnect triggers `STATE_SYNC` |
| **Turn timer** | `gaming_turn_queue.timestamp_end` | `TimeoutPlayerPass + TimeoutPlayerPassPerVolta × pass_counter` | Enforced by `@Scheduled matchcharacterPassTimeout` |
| **JWT access tokens** | In-memory / client-side | Token expiration (short-lived) | Not stored in DB; refresh tokens are persisted in `users_tokens` |
| **Computed turn order** | `gaming_turn_queue` | Recalculated every time-start | Previous entries deleted when new time begins |


### 3.3 Derived / Computed Data (calculated at runtime, not stored independently)

| Data | Computed From | When Recalculated |
|------|--------------|-------------------|
| Turn order value | `(DES×3 + INT×2 + COS×1) × 1000 + LIFE×10 + CHARACTER_ID` | Every `timeStart()` via `timeCalculateCharactersSort()` |
| Current carrying weight | `food + magic + Σ(item.weight × amount)` | Every inventory mutation |
| Max carrying capacity | `constitution + difficulty.max_weight + DefaultInventoryCapacity` | On stat/difficulty change |
| Available choices | `list_choices` filtered by conditions vs character state + registry | On event/location request |
| Mission progress | `gaming_state_registry` values vs `list_missions_steps` conditions | On registry change via `checkMissionProgress()` |
| Shortest path | Dijkstra on `list_locations_neighbors` graph | On demand via `spaceFindShortestPath()` |




## 4. List Valid Game States

### 4.1 Match States

As defined in `gaming_match.status`:

| State | Value | Description | Allowed Transitions |
|-------|-------|-------------|---------------------|
| **CREATED** | `CREATED` | Match created, waiting for players to join and select characters | → `RUNNING`, → `ENDED` (admin cancel) |
| **RUNNING** | `RUNNING` | Match is actively being played | → `PAUSED`, → `ENDED`, → `GAMEOVER` |
| **PAUSED** | `PAUSED` | Match temporarily suspended (admin action) | → `RUNNING`, → `ENDED` |
| **ENDED** | `ENDED` | Match completed normally (story completion event triggered) | Terminal state |
| **GAMEOVER** | `GAMEOVER` | Match ended by game-over condition (all in coma, or counter_consecutive_pass > threshold) | Terminal state |

```
         ┌──────────┐
         │ CREATED  │
         └────┬─────┘
              │ matchStart()
              ▼
      ┌───────────────┐ ◄───── matchChangeStatus()
      │   RUNNING     │◄──────────────┐
      └───┬───────┬───┘               │
          │       │                   │
 admin    │       │ game-over         │ matchChangeStatus()
 pause    │       │ condition         │
          ▼       ▼                   │
    ┌─────────┐  ┌──────────┐         │
    │ PAUSED  │──┘ GAMEOVER │         │
    └────┬────┘  └──────────┘         │
         │                            │
         │ admin/story end            │
         ▼                            │
    ┌─────────┐                       │
    │  ENDED  │◄──────────────────────┘
    └─────────┘  (story completion or admin force-end)
```


### 4.2 Character States

Stored as explicit boolean columns in `gaming_character_instance`: `is_sleeping` and `is_coma`.

| State | Columns | Description | Allowed Transitions |
|-------|---------|-------------|---------------------|
| **ACTIVE** | `is_sleeping=false, is_coma=false` | Character is awake, can perform actions | → `SLEEPING`, → `COMA` |
| **SLEEPING** | `is_sleeping=true, is_coma=false` | Character is asleep (zero energy or voluntary) | → `ACTIVE` (at time start) |
| **COMA** | `is_sleeping=true, is_coma=true` | Character is in coma (life ≤ 0). Also counts as sleeping. `clock_in_coma` tracks duration. | → `ACTIVE` (rescued by another character or item) |

```
                  ┌──────────┐
         ┌───────►│  ACTIVE  │◄──── time start (wake up)
         │        └──┬───┬───┘       or rescue from coma
         │           │   │
         │  zero     │   │  life ≤ 0
         │  energy   │   │  OR sadness=life trigger
         │  OR sleep │   │
         │           ▼   ▼
         │    ┌──────────┐   ┌──────┐
         │    │ SLEEPING │   │ COMA │  (is_sleeping=true, is_coma=true)
         │    └──────────┘   └──┬───┘
         │                      │
         └──────────────────────┘
              characterHelpCOMA() or item restores life > 0
```


### 4.3 User Account States

As defined in `users.state`:

| State | Value | Description | Allowed Transitions |
|-------|-------|-------------|---------------------|
| **Registration** | `1` | User registered, pending activation | → `2` (email verification or first login) |
| **Active** | `2` | User active, can play | → `3`, → `4`, → `5` |
| **Blocked** | `3` | User temporarily blocked by admin | → `2` (admin unblock) |
| **Banned** | `4` | User permanently banned | Terminal (admin can reverse) |
| **Password** | `5` | User must reset password | → `2` (password reset) |
| **Guest** | `6` | Anonymous guest user with cookie-based session. No email/password. Can be upgraded to a full account | → `2` (account upgrade via registration or Google SSO) |


### 4.4 Trade States

| State | Value | Allowed Transitions |
|-------|-------|---------------------|
| **PENDING_VALIDATION** | `PENDING_VALIDATION` | → `ACCEPTED`, → `REFUSED`, → `FAILED_INVALID`, → `EXPIRED` |
| **ACCEPTED** | `ACCEPTED` | Terminal |
| **REFUSED** | `REFUSED` | Terminal |
| **FAILED_INVALID** | `FAILED_INVALID` | Terminal (validation failure, e.g., item no longer available) |
| **EXPIRED** | `EXPIRED` | Terminal (timeout reached via `TimeoutTradesExpire`) |


### 4.5 Movement Invite States

| State | Value | Allowed Transitions |
|-------|-------|---------------------|
| **PENDING** | `PENDING` | → `ACCEPTED`, → `EXPIRED`, → `CANCELLED` |
| **ACCEPTED** | `ACCEPTED` | Terminal |
| **EXPIRED** | `EXPIRED` | Terminal (via `TimeoutMovementFollow`) |
| **CANCELLED** | `CANCELLED` | Terminal |


### 4.6 Event Types

As defined in `list_events.type`:

| Type | Value | When triggered | Energy cost |
|------|-------|----------------|-------------|
| **AUTOMATIC** | `AUTOMATIC` | System-triggered events (first entry, subsequent entry, first in location, time start). The specific trigger is determined by the location columns (`id_event_if_character_enter_first_time`, `id_event_if_first_time`, `id_event_not_first_time`, `id_event_if_character_start_time`). | Zero |
| **FIRST** | `FIRST` | First player entering triggers this | Zero |
| **NORMAL** | `NORMAL` | Character voluntarily triggers the event (optional interaction) | Defined per event (`cost_enery`) |

Note: The distinction between automatic sub-types (first entry, subsequent entry, first-in-location, time-start) is handled by the **location columns** that reference specific events, not by the event type enum itself.


### 4.7 Time Lifecycle

```
TIME N                                                      TIME N+1
┌─────────────────────────────────────────────────────┐    ┌──────────
│ All characters wake up (is_sleeping=false)          │    │
│ Weather determined (timeCalculateNewWeather)        │    │
│ Class bonuses applied (timeAddBonusClasse)          │    │
│ Location safety bonuses applied                     │    │
│   (timeAddBonusLuogoInizioGiornata)                 │    │
│ Time-start events fired                             │    │
│   (timeStartDayEventiNeiLuoghi)                     │    │
│ Random events checked                               │    │
│   (list_global_random_events)                       │    │
│ Turn queue calculated (timeCalculateCharactersSort) │    │
│                                                     │    │
│   ┌─── TURN LOOP ──────────────────────────────┐    │    │
│   │ Active character performs actions:         │    │    │
│   │   - Move / Interact / Choice / Use item    │    │    │
│   │   - Pass / Sleep                           │    │    │
│   │ Next character in queue                    │    │    │
│   │ Repeat until all characters are sleeping   │    │    │
│   └────────────────────────────────────────────┘    │    │
│                                                     │    │
│ timeEnd() → all sleeping → execStartNewTime()       │───►│ ...
└─────────────────────────────────────────────────────┘    └──────────
```




## 5. Define Rules That Must Never Be Broken (Invariants)

These are **system invariants** — conditions that must hold true at all times during gameplay. If any invariant is violated, the system is in an invalid state and must be corrected immediately.


### 5.1 Character Stat Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| **INV-01** | `0 ≤ energy ≤ energy_max` (from character template) | `characterAddValues()` clamps to boundaries |
| **INV-02** | `0 ≤ life ≤ life_max` (from character template) | `characterAddValues()` clamps to boundaries |
| **INV-03** | `0 ≤ sadness ≤ life_max` (sadness max equals life max from template) | `characterAddValues()` clamps to boundaries |
| **INV-04** | `energy ≤ life` — energy cannot exceed current life | Enforced after every stat mutation |
| **INV-05** | `sadness ≤ life` — if sadness reaches life: `life -= COS`, `sadness = 0`, character sleeps immediately | `checkIfcharacterSad()` |
| **INV-06** | `DES ≥ 1`, `INT ≥ 1`, `COS ≥ 1` — stats never drop below 1 | `characterAddValues()` floors at 1 |
| **INV-07** | `food ≥ 0`, `magic ≥ 0`, `coin ≥ 0` — resources never go negative | `inventoryAdd()` / `inventoryRemove()` validate before applying |
| **INV-08** | Total weight ≤ max carrying capacity (`constitution + max_weight + DefaultInventoryCapacity`) OR character cannot move | `spaceMoveIntoCheck()` blocks movement when overweight |
| **INV-09** | `energy = 0 → character must be SLEEPING` (`is_sleeping=true`) | `checkIfcharacterExhausted()` enforces immediately |
| **INV-10** | `life ≤ 0 → character must be in COMA` (`is_coma=true`, `is_sleeping=true`) | `checkIfcharacterComa()` enforces immediately |


### 5.2 Turn and Concurrency Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| **INV-11** | Exactly **one character** holds the active turn at any time during RUNNING match | `matchAquireLock()` + `id_character_current_turn` in `gaming_match` |
| **INV-12** | Only the active-turn character can perform turn-locked actions (`*(1)` APIs) | All `gameplay/*` endpoints verify `id_character_current_turn` |
| **INV-13** | A concurrency lock must be acquired before any state-mutating action | `matchAquireLock()` with expiration via `timestamp_lock_expiration`; `matchReleaseLock()` after completion |
| **INV-14** | Lock must expire automatically if not released within timeout | `@Scheduled matchCheckLockExpiration` |
| **INV-15** | Turn timeout must auto-pass if player does not act | `@Scheduled matchcharacterPassTimeout` |


### 5.3 Time and Flow Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| **INV-16** | Time advances **only** when all characters are sleeping (energy=0 or voluntary sleep) | `timeEnd()` checks `checkStatocharacters()` |
| **INV-17** | Turn order is recalculated at **every** time start using the formula: `(DES×3 + INT×2 + COS×1) × 1000 + LIFE×10 + ID` | `timeCalculateCharactersSort()` wipes and repopulates `gaming_turn_queue` |
| **INV-18** | Weather is determined **once** at time start and remains fixed for the entire time | `timeCalculateNewWeather()` runs only in `execStartNewTime()` |
| **INV-19** | A sleeping character **cannot** perform any actions (except being rescued) | All action endpoints check `is_sleeping=false` and `is_coma=false` |
| **INV-20** | A comatose character **cannot** wake up alone — requires external rescue (another character spends energy based on `cost_help_coma` from difficulty, or an item restores life) | `characterHelpCOMA()` validates rescuer is in same location, awake, has energy |


### 5.4 Movement Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| **INV-21** | Movement is only possible to **adjacent** locations as defined in `list_locations_neighbors` | `spaceMoveIntoCheck()` validates adjacency |
| **INV-22** | Movement requires meeting **registry conditions** if defined on the edge | `spaceMoveIntoCheck()` verifies `condition_registry_key` / `condition_registry_value` |
| **INV-23** | Movement cost = base location `cost_energy_enter` + weather cost (`cost_move_safe_location` or `cost_move_not_safe_location`) + edge `energy_cost`. Character must have sufficient energy | `spaceMoveIntoCheck()` computes total cost and verifies energy |
| **INV-24** | Location capacity must not be exceeded (`max_characters`) | `spaceMoveInto()` checks against `max_characters` |
| **INV-25** | Group movement (follow) is **free** (zero energy) and is the **only** action allowed out of turn | Follow action handled separately from turn-locked actions via `spaceMoveFollow()` |
| **INV-26** | Character **cannot** move if total inventory weight exceeds max carrying capacity | `spaceMoveIntoCheck()` calculates and verifies weight |


### 5.5 Event and Choice Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| **INV-27** | An event affects **all characters** in the location (unless `target` in `list_events_effects` restricts to `ONLY_ONE` or `target_class`) | `execEvent()` iterates over characters in location; `EventEffect.target` controls scope |
| **INV-28** | An event with `flag_end_time = true` **forces all characters to sleep** and ends the current time | `execEvent()` checks `flag_end_time` after applying effects |
| **INV-29** | A choice with `otherwise_flag = true` has **no activation conditions** — it is always selectable | `execChoice()` skips condition validation for otherwise option |
| **INV-30** | Each choice resolves to at most **one** result event via `id_event_torun` | Choice → `id_event_torun` is N:1 |
| **INV-31** | Choice conditions use **all AND** or **all OR** logic — no mixed operators within a single choice | `logic_operator` field enforced on `list_choices` |
| **INV-32** | An event cannot execute if character lacks required energy or coins | `execEvent()` step 91b validates energy and coins before proceeding |


### 5.6 Registry Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| **INV-33** | Registry keys are scoped to a single match (`id_match`) | All registry operations include `id_match` in queries |
| **INV-34** | Registry values are either string (e.g., YES/NO) or numeric (integer) | `gaming_state_registry` has both `string_value` and `int_value` columns |


### 5.7 Match Lifecycle Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| **INV-35** | Once a match is ENDED or GAMEOVER, **no further game actions** are allowed | All action endpoints check `match.status = RUNNING` |
| **INV-36** | Players cannot join or leave once the match is RUNNING | `matchAddPlayer()` checks status = CREATED |
| **INV-37** | Number of active matches cannot exceed `MaxActiveMatches` global parameter | `matchCreate()` checks count before creating |
| **INV-38** | Number of players in a match cannot exceed the difficulty's `max_character` | `matchAddPlayer()` checks current count vs limit |
| **INV-39** | All characters in coma simultaneously → trigger `id_event_all_player_coma` from the story | `checkIfAllComa()` evaluates after every state change |
| **INV-40** | If `counter_consecutive_pass` exceeds threshold → match ends with GAMEOVER | `matchPass()` increments counter; `execStartNewTime()` checks in step 93d |


### 5.8 Inventory and Trade Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| **INV-41** | Items can only be used/traded/discarded by **awake, non-comatose** characters | All inventory endpoints check character state |
| **INV-42** | Trading requires both characters in the **same location**, both awake and not comatose | `inventoryTradingCreate()` validates location equality and states |
| **INV-43** | An item can only be added to inventory if there is **sufficient weight capacity** | `inventoryCheckSufficientCapacity()` |
| **INV-44** | Discarded items are **permanently removed** from the game | `inventoryDiscardItem()` removes the item (no recovery) |


---


## 6. Validate Models with Real Cases

To validate the data model, we walk through complete gameplay scenarios and verify that every state transition, entity interaction, and invariant is correctly supported.


### 6.1 Scenario: Match Creation and Character Setup

**Actors**: User "Alice" (id=1), User "Bob" (id=2)
**Story**: "The Lost Kingdom" (id=10), Difficulty "Normal" (id=20, max_character=4, exp_cost=5)

| Step | Action | Tables Affected | Invariants Checked |
|------|--------|-----------------|--------------------|  
| 1 | Alice creates a match | INSERT `gaming_match` (status=CREATED, id_story=10, id_difficulty=20, exp_cost=5) | INV-37: count active matches < MaxActiveMatches |
| 2 | Alice selects character "Warrior" (template id_tipo=5, class id=3) | INSERT `gaming_character_instance` (id_match, id_user=1, id_character_template=5, stats from template+class) + INSERT `gaming_backpack_resources` (food=0, magic=0, coin=0) + INSERT `gaming_character_traits` | INV-38: player count < max_character(4) |
| 3 | Bob joins and selects "Mage" (template id_tipo=7, class id=1) | INSERT `gaming_character_instance` (id_user=2) + backpack + traits | INV-38 |
| 4 | Alice starts the match | UPDATE `gaming_match` status=RUNNING, current_clock=1. Calculate weather, turn queue, fire initial events | INV-36: no more joins allowed |

**Registry initialized**: INSERT `gaming_state_registry` rows from `list_keys` defaults for this story.
**Locations initialized**: INSERT `gaming_state_locations` for all `list_locations` (flag_already_actived=false, clock_counter from `counter_time`).
**Validation**: All character stats set from template + class bonuses, energy ≤ life (INV-04), DES/INT/COS ≥ 1 (INV-06).


### 6.2 Scenario: A Complete Turn Cycle

**Context**: Match id=100, Time=3, Weather="Rain" (extra movement cost=2). Alice (Warrior, energy=6, DES=4, location=Castle) acts first.

| Step | Action | Tables Affected | Invariants Checked |
|------|--------|-----------------|--------------------|
| 1 | Alice's turn begins | UPDATE `gaming_turn_queue` (timestamp_start, timestamp_end = now + timeout) | INV-11: exactly one active character |
| 2 | Alice moves Castle → Forest (base cost=2, rain cost=2, total=4) | UPDATE `gaming_character_instance` energy=2, id_current_location=Forest. INSERT `log_movements`. UPDATE `gaming_state_locations` (Forest visited=true) | INV-21 (adjacent), INV-23 (energy ≥ cost), INV-26 (weight OK) |
| 3 | Forest has AUTOMATIC_FIRST_ENTRY event (id=50): "You find a knife" | `execEvent()`: INSERT `gaming_inventory_items` (knife), INSERT `log_events` | INV-43 (weight capacity check), INV-27 (affects all in location) |
| 4 | Alice interacts with optional event (id=60, cost=1): "Search bushes" → triggers choice | UPDATE energy=1. INSERT `gaming_active_choices`. WebSocket GAME_EVENT + choice options | INV-32 (energy check) |
| 5 | Alice selects option B (requires INT ≥ 3, Alice has INT=4) → leads to event 70 | `execChoice()`: validate conditions → `execEvent(70)`. INSERT `log_choices_executed` | INV-31 (AND/OR logic) |
| 6 | Event 70 modifies registry: "TreasureFound=YES" | INSERT/UPDATE `gaming_state_registry`. WebSocket REGISTRY_UPDATED | INV-33, INV-34 |
| 7 | Alice passes turn (energy=1 remaining) | UPDATE `gaming_turn_queue`, increment pass count. WebSocket TURN_UPDATE | INV-15 (timeout mechanism active for next player) |
| 8 | Bob acts (moves, uses item, passes) | Similar flow | — |
| 9 | Alice acts again (energy=1), optional event costs 1, energy → 0 | energy=0 → is_sleeping=true | INV-09: energy=0 → must sleep |
| 10 | Bob passes, then sleeps voluntarily | All sleeping → `timeEnd()` → `execStartNewTime()` | INV-16: time advances only when all sleeping |

**Validation**: Turn queue correctly cycles. Energy boundaries respected. Events chain properly. Registry updated atomically.


### 6.3 Scenario: Coma, Rescue, and Group Coma

**Context**: Match id=100, current_clock=5. Alice (life=3, COS=2), Bob (life=8, energy=4), both in Cave.

| Step | Action | Validation |
|------|--------|------------|
| 1 | Event deals -4 life to all in Cave (via `list_events_effects` with target=ALL) | Alice: life = 3-4 = -1 → is_coma=true, is_sleeping=true, clock_in_coma=5 (INV-10). Bob: life = 8-4 = 4 → OK |
| 2 | Bob uses `characterHelpCOMA(Alice)`: spends energy based on `cost_help_coma` from difficulty, gives COS(=2) life to Alice | Alice: life = -1+2 = 1, is_coma=false, is_sleeping=false → ACTIVE (INV-20: external rescue required) |
| 3 | Event deals -5 life to all | Alice: life = 1-5 = -4 → COMA. Bob: life = 4-5 = -1 → COMA |
| 4 | `checkIfAllComa()`: All in coma → trigger story's `id_event_all_player_coma` | INV-39: group coma event fires |

**Validation**: Coma state correctly assigned via is_coma/is_sleeping. Rescue mechanic works. Group coma event triggered when all characters are comatose.


### 6.4 Scenario: Sadness Reaching Life

**Context**: Alice (life=6, sadness=4, COS=3). Event adds +2 sadness via `list_events_effects`.

| Step | Result | Invariant |
|------|--------|-----------|
| 1 | sadness = 4+2 = 6 = life | INV-05 triggers |
| 2 | `checkIfcharacterSad()`: life = 6-3(COS) = 3, sadness = 0, character sleeps immediately | INV-05, INV-09 |

**Validation**: Sadness=Life trigger works. Life reduced by COS, sadness reset, sleep enforced.


### 6.5 Scenario: Movement with Registry Condition and Group Follow

**Context**: current_clock=7. Alice (energy=5) and Bob (energy=3) both in Corridor. Edge Corridor→Bedroom in `list_locations_neighbors` has `condition_registry_key="DoorOpen"`, `condition_registry_value="YES"`. Currently `gaming_state_registry` has DoorOpen=NO.

| Step | Action | Validation |
|------|--------|------------|
| 1 | Alice tries to move Corridor → Bedroom | `spaceMoveIntoCheck()`: registry condition fails → movement denied (INV-22) |
| 2 | Alice interacts with event "Pick the lock" (type=NORMAL) → sets key_to_add="DoorOpen", key_value_to_add="YES" in registry (cost_enery=1) | energy=4. Registry updated. WebSocket REGISTRY_UPDATED |
| 3 | Alice moves Corridor → Bedroom (cost_energy_enter + weather cost = 2) | energy=2. Movement succeeds (INV-22 now satisfied). INSERT `gaming_movement_invites` (state=PENDING) for Bob |
| 4 | Bob receives MovementInvite via WebSocket TURN_UPDATE. Clicks "Follow" within `TimeoutMovementFollow` | Bob moves to Bedroom for FREE via `spaceMoveFollow()` (INV-25). No energy cost. UPDATE `gaming_movement_invites` state=ACCEPTED |
| 5 | Bedroom has automatic first entry event for Alice (via `id_event_if_character_enter_first_time`) | Event fires for Alice (first visit). Bob entered via follow, separate event handling |

**Validation**: Registry-gated movement works. Group follow is free. Events fire correctly for first entry.


### 6.6 Scenario: Trade Between Characters

**Context**: Alice (food=5, coin=10, location=Market) and Bob (has "Magic Potion" in `gaming_inventory_items`, location=Market). Both awake (is_sleeping=false, is_coma=false).

| Step | Action | Validation |
|------|--------|------------|
| 1 | Alice proposes trade: offer 3 coins for Bob's Magic Potion | INSERT `gaming_trades` (status=PENDING_VALIDATION, id_character_match_sender=Alice, id_character_match_dest=Bob). WebSocket TRADE to Bob | INV-42: same location, both awake |
| 2 | Bob accepts within timeout | UPDATE `gaming_trades` status=ACCEPTED. Transfer: Alice coin=7, receives potion in `gaming_inventory_items`. Bob coin+=3, loses potion | INV-41, INV-43 (weight check for Alice) |
| 3 | Alternative: Bob doesn't respond within `TimeoutTradesExpire` | `@Scheduled cleanExpiredTrades`: UPDATE status=EXPIRED. WebSocket TRADE_EXPIRED | Transient data cleanup |

**Validation**: Trade proposal, acceptance, timeout all work. Both characters validated for location and state.


### 6.7 Scenario: Weather, Time Start, and Location Timers

**Context**: current_clock=9 ending. Location "Burning Cabin" has `counter_time=3` initially, currently `gaming_state_locations.clock_counter=1`.

| Step | Action | Validation |
|------|--------|------------|
| 1 | `execStartNewTime(current_clock=10)` | Weather calculated via `timeCalculateNewWeather()`. Turn queue rebuilt via `timeCalculateCharactersSort()` (INV-17, INV-18) |
| 2 | Characters wake up (is_sleeping=false). Safe-location characters gain DES+P energy, COS+P life, lose INT+P sadness (P=secure_param) via `timeAddBonusLuogoInizioGiornata()` | INV-01, INV-02, INV-03 boundaries enforced |
| 3 | Location counter: Burning Cabin clock_counter 1→0. Triggers `id_event_if_counter_zero` | Event fires: "The cabin collapses!" All characters inside take damage |
| 4 | Global random event check via `list_global_random_events`: "BanditRaid" (probability=20%, condition_key "Chapter" condition_value ≥ 3 met) → dice roll: 15 → fires | `execEvent()` for bandit raid |
| 5 | Class bonus: Mage recovers +2 magic at time start (from `list_classes_bonus`) via `timeAddBonusClasse()` | UPDATE `gaming_backpack_resources` |

**Validation**: Time-start sequence complete. Location timers expire correctly. Random events fire based on probability and conditions. Class bonuses applied.


### 6.8 Scenario: Choice with Multiple Conditions (AND/OR)

**Context**: Location "Dragon's Lair". Event presents choice (`list_choices`) with 3 options:
- Option A: "Negotiate" — `limit_int=5` AND trait "Beautiful" required (logic_operator=AND, conditions in `list_choices_conditions`)
- Option B: "Attack" — `limit_dex=4` OR has item "Magic Sword" (logic_operator=OR, conditions in `list_choices_conditions`)
- Option C: "Flee" — `otherwise_flag=true` (always available)

Alice: INT=3, DES=5, no "Beautiful" trait, has "Magic Sword" in `gaming_inventory_items`.

| Step | Check | Result |
|------|-------|--------|
| 1 | Option A: limit_int≥5? NO (Alice INT=3) | NOT available (AND: first condition fails) |
| 2 | Option B: limit_dex≥4? YES, OR has Magic Sword? YES | Available (OR: first condition passes) |
| 3 | Option C: otherwise_flag=true | Always available (INV-29) |
| 4 | Alice selects Option B → triggers event via `id_event_torun` (Dragon Fight) | `execChoice()` validates, `execEvent()` fires, INSERT `log_choices_executed` |

**Validation**: AND/OR condition logic works correctly. Otherwise option always available. Choice resolves to single event (INV-30).


### 6.9 Scenario: Stalemate Prevention

**Context**: current_clock=12. Alice (energy=3), Bob (energy=2). Both pass multiple times.

| Step | Action | Validation |
|------|--------|------------|
| 1 | Alice passes (matchPass) | UPDATE `gaming_turn_queue` pass_counter++. UPDATE `gaming_match` counter_consecutive_pass=1. UPDATE `gaming_character_instance` counter_consecutive_pass++ |
| 2 | Bob passes | counter_consecutive_pass=2. Timeout extended: `TimeoutPlayerPass + TimeoutPlayerPassPerVolta × 2` |
| 3 | Alice passes again | counter_consecutive_pass=3 |
| ... | Both keep passing until counter > threshold | counter_consecutive_pass > PARAMETER → status=GAMEOVER (INV-40) |

**Validation**: Pass counter increments correctly. Timeout increases with each pass. Game over triggered at threshold.


### 6.10 Scenario: Snapshot and Restore

**Context**: Admin wants to restore match id=100 to current_clock=5.

| Step | Action | Tables Affected |
|------|--------|-----------------|
| 1 | `snapshotList(100, tempo_da, tempo_a)` → returns snapshots | SELECT from `system_snapshot` WHERE id_match=100 |
| 2 | Admin selects snapshot id=500 (current_clock=5, type=FULL) | — |
| 3 | `snapshotRestore(100, 500)`: first creates a new safety snapshot (`snapshotCreate`), then deletes all runtime rows for id_match=100, then inserts rows from snapshot `jsonb_data` | All `gaming_*` and `log_*` tables for id_match=100 are wiped and restored |
| 4 | Match resumes from current_clock=5 state | All invariants re-validated by `checkVerifyIntegrity()` |

**Validation**: Snapshot contains all runtime state. Restore is atomic. Integrity check runs after restore.



## Appendix A: Complete Table Summary

Total tables: **52** (2 system + 2 user + 23 reference + 25 runtime/log)

### A.1 System (2)

| # | Table | PK |
|---|-------|----|  
| 0 | `global_game_version` | `id` |
| 1 | `global_runtime_variables` | `id` |

### A.2 User (2)

| # | Table | PK |
|---|-------|----|
| 2 | `users` | `id` |
| 3 | `users_tokens` | `id` |

### A.3 Reference / Story (23)

| # | Table | PK | Scoped by |
|---|-------|----|-----------|
| 4 | `list_stories` | `id` | — |
| 5 | `list_stories_difficulty` | `id` | `id_story` |
| 6 | `list_keys` | `id` | `id_story` |
| 7 | `list_classes` | `id` | `id_story` |
| 8 | `list_classes_bonus` | `id` | `id_story`, `id_class` |
| 9 | `list_traits` | `id` | `id_story` |
| 10 | `list_character_templates` | `id_tipo` | `id_story` |
| 11 | `list_locations` | `id` | `id_story` |
| 12 | `list_locations_neighbors` | `id` | `id_story` |
| 13 | `list_items` | `id` | `id_story` |
| 14 | `list_items_effects` | `id` | `id_story`, `id_item` |
| 15 | `list_weather_rules` | `id` | `id_story` |
| 16 | `list_events` | `id` | `id_story` |
| 17 | `list_events_effects` | `id` | `id_story`, `id_event` |
| 18 | `list_choices` | `id` | `id_story` |
| 19 | `list_choices_conditions` | `id` | `id_story`, `id_choices` |
| 20 | `list_choices_effects` | `id` | `id_story`, `id_choices` |
| 21 | `list_global_random_events` | `id` | `id_story` |
| 22 | `list_missions` | `id` | `id_story` |
| 23 | `list_missions_steps` | `id` | `id_story`, `id_mission` |
| 24 | `list_cards` | `id` | — (referenced by `id_card` across tables) |
| 25 | `list_texts` | `id` | `id_story` |
| 26 | `list_creator` | `id` | — (referenced by `id_creator` across tables) |

### A.4 Runtime / Game-State (25)

| # | Table | PK | Scoped by |
|---|-------|----|-----------|
| 27 | `gaming_match` | `id` | `id_story` |
| 28 | `gaming_character_instance` | `id` | `id_match` |
| 29 | `gaming_character_traits` | `id` | `id_match`, `id_character_match` |
| 30 | `gaming_backpack_resources` | `id` | `id_character_match` |
| 31 | `gaming_inventory_items` | `id` | `id_character_match` |
| 32 | `gaming_state_registry` | `id` | `id_match` |
| 33 | `gaming_state_locations` | composite (`id_match`, `id_location`) | `id_match` |
| 34 | `gaming_turn_queue` | composite (`id_match`, `id_character_instance`) | `id_match` |
| 35 | `gaming_active_effects` | `id` | `id_match`, `id_character` |
| 36 | `gaming_active_choices` | `id` | `id_match` |
| 37 | `log_choices_executed` | `id` | `id_match` |
| 38 | `gaming_story_progress` | `id` | `id_match` |
| 39 | `log_events` | `id` | `id_match` |
| 40 | `log_movements` | `id` | `id_match` |
| 41 | `log_item_usage` | `id` | `id_match` |
| 42 | `log_weather` | `id` | `id_match` |
| 43 | `chat_messages` | `id` | `id_match` |
| 44 | `gaming_user_sessions` | `id` | `id_match` |
| 45 | `log_lock_history` | `id` | `id_match` |
| 46 | `log_clock_history` | `id` | `id_match` |
| 47 | `gaming_trades` | `id` | `id_match` |
| 48 | `gaming_notification_queue` | `id` | `id_match` |
| 49 | `gaming_movement_invites` | `id` | `id_match` |
| 50 | `system_snapshot` | `id` | `id_match` |
| 51 | `gaming_temp_variables` | `id` | `id_match`, `id_character` |



## Appendix B: Entity Classification by Domain Area

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DOMAIN AREAS                                │
├─────────────────┬───────────────────┬───────────────────────────────┤
│  IDENTITY       │  STORY CONTENT    │  GAME RUNTIME                 │
│                 │  (Reference)      │  (Per-Match State)            │
├─────────────────┼───────────────────┼───────────────────────────────┤
│ User            │ Story             │ Match                         │
│ UserToken       │ StoryDifficulty   │ CharacterInstance             │
│ GlobalVariable  │ StoryKey          │ CharacterTraits               │
│ GameVersion     │ CharacterClass    │ BackpackResources             │
│                 │ ClassBonus        │ InventoryItem                 │
│                 │ Trait             │ StateRegistry                 │
│                 │ CharacterTemplate │ StateLocation                 │
│                 │ Location          │ TurnQueue                     │
│                 │ LocationNeighbor  │ ActiveEffect                  │
│                 │ Item              │ ActiveChoice                  │
│                 │ ItemEffect        │ ChoiceExecuted                │
│                 │ WeatherRule       │ StoryProgress                 │
│                 │ Event             │ Trade                         │
│                 │ EventEffect       │ MovementInvite                │
│                 │ Choice            │ Snapshot                      │
│                 │ ChoiceCondition   │ TempVariable                  │
│                 │ ChoiceEffect      │ NotificationQueue             │
│                 │ GlobalRandomEvent │ ChatMessage                   │
│                 │ Mission           │ UserSession                   │
│                 │ MissionStep       │ ClockHistory                  │
│                 │ Card              │ LogEvent / LogMovement /      │
│                 │ Text              │ LogItemUsage / LogWeather     │
│                 │ Creator           │                               │
├─────────────────┴───────────────────┴───────────────────────────────┤
│  4 entities       23 entities         25 entities    = 52 total     │
└─────────────────────────────────────────────────────────────────────┘
```



# Version Control
- First version created with AI prompt:
    > Read all documentation_v0 content and create Step09 — Design the core data model: Identify main entities, Define relationships between entities, Identify persistent vs transient data, List valid game states, Define rules that must never be broken, Validate models with real cases  
    
    > Reload Step01 file and update the document with new tables
- **Document Version**: 0.10.12
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.9.0 | first version of document | March 9, 2026 |
    | 0.9.1 | aligned all entity definitions, states, column names, and enums to match Step01 Point 6 as source of truth | March 13, 2026 |
    | 0.9.2 | aligned to Step0 file v0.9.2: added guest user state, guest columns, theme_selected, list_stories, ... | March 17, 2026 |
    | 0.10.12 | added `uuid` as standard column on all 52 tables — public API identifier to avoid exposing internal auto-increment IDs | March 19, 2026 |
- **Last Updated**: March 19, 2026
- **Status**: Complete ✅


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




