# Paths Games V1 - Step 06: Naming Conventions

This document defines the **naming conventions** for all layers of the **Paths Games** backend and frontend, covering REST endpoints, WebSocket events, database objects, Java code, JSON payloads, and frontend components.

    - ✅ Define REST endpoint naming
    
    - ✅ Define WebSocket event naming
    
    - ✅ Define table and column naming
    
    - ✅ Define DTO and payload naming
    
    - ✅ Document the conventions

## 1. REST Endpoint Naming

### 1.1 General Rules
- All endpoints are prefixed with `/api/{version}/` where `{version}` follows the format `v1`, `v2`, `v1beta1`, etc.
- Current production version: **`v1`** — all V1 endpoints live under `/api/v1/`
- Path segments use **kebab-case** (lowercase, words separated by hyphens)
- Resource names are **plural nouns** (e.g., `/games`, `/stories`, `/players`)
- Identifiers appear as path variables: `/{id}` or `/{id_game}`, `/{id_player}`
- HTTP verbs define the action; avoid verb-in-URL patterns
  - `GET` → read/list
  - `POST` → create or trigger an action
  - `PUT` → full update (replace)
  - `PATCH` → partial update
  - `DELETE` → delete/cancel

### 1.2 API Versioning
- Version segment is **mandatory** immediately after `/api/`: `/api/v1/...`
- Version format: `v` + major number, optionally followed by stability label
  - Stable releases: `v1`, `v2`, `v3`
  - Beta / preview: `v1beta1`, `v2beta1`
  - Alpha / experimental: `v1alpha1`
- Only one version is active at a time in V1; future versions may coexist for backward compatibility
- The version appears **once** in the path, right after `/api/`
- The echo/health endpoint is the only exception: `/api/echo/status` (unversioned, always available)

### 1.3 Context Prefixes
Endpoints are grouped by functional context immediately after `/api/v1/`:

| Context prefix | Purpose |
|---|---|
| `/api/v1/auth/...` | Authentication & user management |
| `/api/v1/stories/...` | Story catalog (read-only reference data) |
| `/api/v1/games/...` | Match management (create, join, list) |
| `/api/v1/game/{id}/...` | In-match state access (read-heavy) |
| `/api/v1/gameplay/{id_game}/...` | In-match player actions (write-heavy, turn-locked) |
| `/api/v1/gamechat/{id_game}/...` | In-match chat and notifications |
| `/api/v1/admin/...` | Admin tools (restricted access) |
| `/api/echo/...` | Health check / internal diagnostics (unversioned) |

### 1.4 Endpoint Patterns by Context

**Authentication** (`/api/v1/auth/`)
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/google
GET    /api/v1/auth/me
POST   /api/v1/auth/me/change-password
POST   /api/v1/auth/me/change-data
```

**Stories / Reference data** (`/api/v1/stories/`)
```
GET    /api/v1/stories
GET    /api/v1/stories/{id}/characters
GET    /api/v1/stories/{id}/lingua/{lingua}/testo/{id_testo}
GET    /api/v1/stories/{id}/lingua/{lingua}/carta/{id_immagine}
```

**Match management** (`/api/v1/games/`)
```
GET    /api/v1/games/active
POST   /api/v1/games
POST   /api/v1/games/{id}/join
POST   /api/v1/games/{id}/start
POST   /api/v1/games/{id}/leave
GET    /api/v1/games/{id}/state
POST   /api/v1/games/{id}/select-character
DELETE /api/v1/games/{id}
```

**In-match state** (`/api/v1/game/{id}/`)
```
GET    /api/v1/game/{id}/players
GET    /api/v1/game/{id}/players/{playerId}/stats
GET    /api/v1/game/{id}/characters/{id}
GET    /api/v1/game/{id}/locations
GET    /api/v1/game/{id}/locations/{locationId}
GET    /api/v1/game/{id}/missions/active
GET    /api/v1/game/{id}/missions/{missionId}/progress
GET    /api/v1/game/{id}/turn-order
GET    /api/v1/game/{id}/events/history
GET    /api/v1/game/{id}/notifications
GET    /api/v1/game/{id}/notifications/unread
POST   /api/v1/game/{id}/notifications/{notificationId}/mark-read
```

**Gameplay actions** (`/api/v1/gameplay/{id_game}/`) — all turn-locked actions
```
POST   /api/v1/gameplay/{id_game}/movements/start
GET    /api/v1/gameplay/{id_game}/movements/pending
POST   /api/v1/gameplay/{id_game}/movements/confirm-movement-invite
GET    /api/v1/gameplay/{id_game}/inventory
POST   /api/v1/gameplay/{id_game}/inventory/use-item
POST   /api/v1/gameplay/{id_game}/inventory/send-drop-item
POST   /api/v1/gameplay/{id_game}/inventory/trade
DELETE /api/v1/gameplay/{id_game}/inventory/trade/{tradeId}
GET    /api/v1/gameplay/{id_game}/inventory/trades/pending
POST   /api/v1/gameplay/{id_game}/inventory/trade/{tradeId}/accept-reject
POST   /api/v1/gameplay/{id_game}/action/interact
POST   /api/v1/gameplay/{id_game}/action/choice
POST   /api/v1/gameplay/{id_game}/action/sleep
POST   /api/v1/gameplay/{id_game}/action/pass
POST   /api/v1/gameplay/{id_game}/action/ask-help
POST   /api/v1/gameplay/{id_game}/action/help-player
POST   /api/v1/gameplay/{id_game}/character/use-exp
GET    /api/v1/gameplay/{id_game}/events/{eventId}/details
```

**Admin** (`/api/v1/admin/`)
```
GET    /api/v1/admin/params
GET    /api/v1/admin/game/{id_game}/log
GET    /api/v1/admin/game/{id_game}/snapshot
PUT    /api/v1/admin/game/{id_game}/snapshot/{id}
GET    /api/v1/admin/game/{id_game}/replay
POST   /api/v1/admin/game/{id_game}/register
POST   /api/v1/admin/game/{id_game}/force-unlock
POST   /api/v1/admin/game/{id_game}/kick/{user_id}
```

**Health check** (unversioned)
```
GET    /api/echo/status
```

### 1.5 Query Parameters
- Use **camelCase** for query parameter names: `?limit=100`, `?before=timestamp`, `?playerId=42`
- Pagination: `?page=0&size=20`
- Filters: `?status=ACTIVE`, `?tempo=3`

### 1.6 Response Envelope
All endpoints return standard JSON. Success responses include the data directly at root level or wrapped in a `data` field only when pagination metadata is needed:
```json
{ "status": "OK", "timestamp": 1700000000000 }
```
Error responses always use:
```json
{ "error": "ERROR_CODE", "message": "Human-readable description", "timestamp": 1700000000000 }
```



## 2. WebSocket Event Naming

### 2.1 General Rules
- STOMP protocol over WebSocket
- Single topic per match: `/topic/v1/game/{id_game}`
- WebSocket topics are versioned the same way as REST: `/topic/{version}/game/{id_game}`
- Current version: **`v1`**
- Every message carries a `type` field using **SCREAMING_SNAKE_CASE**
- Message payloads use **camelCase** for all JSON field names

### 2.2 Outbound Message Types (Server → Client)

| Type constant | Trigger |
|---|---|
| `PLAYER_JOINED` | A new player enters the lobby |
| `PLAYER_LEFT` | A player leaves before match start |
| `PLAYER_DISCONNECTED` | A player's connection drops during match |
| `PLAYER_RECONNECTED` | A disconnected player reconnects |
| `TURN_UPDATE` | Turn changes, queue reorders, or pass occurs |
| `GAME_EVENT` | Any in-game event fires (weather, trap, etc.) |
| `DAY_END` | All characters slept; new time begins |
| `TRADE` | A trade proposal is sent to a player |
| `TRADE_EXPIRED` | A pending trade reaches its timeout |
| `CHAT` | A chat message is sent by a player |
| `SYSTEM_MESSAGE` | Server-generated informational message |
| `LOCK_EXPIRED` | A player lock expired and was force-released |
| `STATE_SYNC` | Full state resync (sent on reconnect) |
| `CHOICE_TIMEOUT_WARNING` | Countdown warning for pending player choice |
| `REGISTRY_UPDATED` | A registry key was modified |
| `MOVEMENT_INVITE` | Group movement invitation to follow |
| `MOVEMENT_INVITE_EXPIRED` | Group movement invite timed out |

### 2.3 Example Message Shapes
```json
// TURN_UPDATE
{
  "type": "TURN_UPDATE",
  "currentTurn": {
    "characterId": 101,
    "characterName": "Gandalf",
    "deadlineTimestamp": "2026-03-01T10:00:45Z"
  },
  "queueOrder": [101, 102, 103],
  "consecutivePasses": 2,
  "isStalemateWarning": false
}

// REGISTRY_UPDATED
{
  "type": "REGISTRY_UPDATED",
  "key": "DoorOpen",
  "newValue": "YES"
}

// STATE_SYNC
{
  "type": "STATE_SYNC",
  "currentTurn": { ... },
  "myCharacter": { ... },
  "allCharacters": [ ... ],
  "lastEvents": [ ... ],
  "pendingChoice": { ... },
  "pendingTrades": [ ... ],
  "pendingMovementInvites": [ ... ]
}
```

### 2.4 Inbound Messages (Client → Server)
Clients send action requests via REST (not over WebSocket). WebSocket is **outbound-only** from the server. The only exception is the STOMP subscription handshake.



## 3. Database Table and Column Naming

### 3.1 General Rules
- All table names and column names: **snake_case**, lowercase
- No abbreviations unless universally understood (`id`, `ts`, `url`, `json`)
- Boolean columns: **`is_`** prefix (e.g., `is_active`, `is_consumable`, `is_bidirectional`)
- Foreign key columns: **`id_`** prefix followed by referenced entity (e.g., `id_match`, `id_character`, `id_story`)
- Timestamp columns: **`_timestamp`** or **`_ts`** suffix (e.g., `created_timestamp`, `lock_expiration_ts`)
    note: **`_ts`** suffix is not good, preferrend **`_timestamp`** suffix
- URL columns: **`_url`** suffix (e.g., `image_url`, `audio_background_url`)
- Text/label foreign keys (multi-language): **`_id_text`** suffix (e.g., `name_id_text`, `narrative_id_text`)

### 3.2 Table Prefix Convention

| Prefix | Category | Examples |
|---|---|---|
| `global_` | Global system configuration | `global_runtime_variables` |
| `users` | User account management | `users`, `users_tokens` |
| `list_` | Reference / story-authored data (static) | `list_stories`, `list_locations`, `list_events` |
| `gaming_` | Runtime game state (dynamic, per-match) | `gaming_match`, `gaming_state_registry`, `gaming_turn_queue` |

### 3.3 Reference Tables (`list_`)

| Old name (Italian) | New name (English) | Description |
|---|---|---|
| `elenco_storie` | `list_stories` | Story catalog |
| `elenco_storie_difficolta` | `list_stories_difficulty` | Difficulty settings per story |
| `elenco_chiavi` | `list_keys` | Story-specific registry key definitions |
| `elenco_classi` | `list_classes` | Character classes |
| `elenco_classi_bonus` | `list_classes_bonus` | Per-class stat bonuses |
| `elenco_caratteristiche` | `list_traits` | Selectable character traits |
| `elenco_personaggi_tipi_possibili` | `list_character_templates` | Character templates |
| `elenco_luoghi` | `list_locations` | Location definitions |
| `elenco_luoghi_vicini` | `list_locations_neighbors` | Location adjacency graph |
| `elenco_oggetti` | `list_items` | Item catalog |
| `elenco_oggetti_effetti` | `list_items_effects` | Item effect definitions |
| `elenco_meteo_regole` | `list_weather_rules` | Weather rules |
| `elenco_eventi` | `list_events` | Event definitions |
| `elenco_eventi_effetti` | `list_events_effects` | Event effect definitions |
| `elenco_scelte` | `list_choices` | Choice definitions |
| `elenco_scelte_condizioni` | `list_choices_conditions` | Choice condition rules |
| `elenco_scelte_effetti` | `list_choices_effects` | Choice effect definitions |
| `elenco_global_random_events` | `list_global_random_events` | Global random event definitions |
| `elenco_missioni` | `list_missions` | Mission definitions |
| `elenco_missioni_step` | `list_missions_steps` | Mission step definitions |
| `elenco_carta` | `list_cards` | Card definitions (multi-language) |
| `elenco_testi` | `list_texts` | Text/translation catalog |

### 3.4 Runtime Tables (`gaming_`)

| Old name (Italian) | New name (English) | Description |
|---|---|---|
| `gioco_partite` | `gaming_match` | Active matches |
| `gioco_personaggi_istanza` | `gaming_character_instance` | Character instances in a match |
| `gioco_personaggi_caratteristiche` | `gaming_character_traits` | Character trait assignments |
| `gioco_zaino_risorse` | `gaming_backpack_resources` | Character backpack (food/magic/coins) |
| `gioco_inventario_oggetti` | `gaming_inventory_items` | Character item inventory |
| `gioco_stato_registro` | `gaming_state_registry` | Match registry (key-value store) |
| `gioco_stato_luoghi` | `gaming_state_locations` | Location state per match (visited, counter) |
| `gioco_coda_turni` | `gaming_turn_queue` | Turn queue per match - Initiative Calculation |
| `gioco_effetti_attivi` | `gaming_active_effects` | Active temporary effects on characters |
| `gioco_scelte_attive` | `gaming_active_choices` | Pending choice prompts |
| `gioco_scelte_eseguite` | `gaming_choices_executed` | Choice execution history |
| `gioco_trama_progresso` | `gaming_story_progress` | Story progression milestones |
| `gioco_log_eventi` | `gaming_log_events` | Event audit log |
| `gioco_log_movimenti` | `gaming_log_movements` | Movement audit log |
| `gioco_log_oggetti_uso_log` | `gaming_log_item_usage` | Item usage audit log |
| `gioco_log_meteo` | `gaming_log_weather` | Weather history log |
| `gioco_chat_messages` | `gaming_chat_messages` | In-match chat messages |
| `gioco_utente_sessioni` | `gaming_user_sessions` | Player WebSocket session tracking |
| `gioco_lock_history` | `gaming_lock_history` | Concurrency lock history |
| `gioco_tempo_history` | `gaming_time_history` | Time-unit history |
| `gioco_scambi` | `gaming_trades` | Trade proposals between characters |
| `gioco_notification_queue` | `gaming_notification_queue` | Notification queue for push delivery |
| `gioco_movimenti_inviti` | `gaming_movement_invites` | Group movement invitations |
| `gioco_snapshot` | `gaming_snapshot` | Match snapshot records |
| `gioco_variabili_temporanee` | `gaming_temp_variables` | Temporary per-character variables (V2 ready) |


### 3.5 Column Naming Examples

```sql
-- Primary keys
id                         -- surrogate integer PK (always just "id")
id_card                    -- natural content key used alongside id

-- Foreign keys
id_match                   -- references gaming_match.id
id_character_instance      -- references gaming_character_instance.id
id_story                   -- references list_stories.id
id_location                -- references list_locations.id

-- Boolean flags
is_safe_location
is_bidirectional
is_consumable
is_otherwise
is_progress
is_active

-- Timestamps
registration_date          -- date only
last_access_date
created_timestamp
lock_expiration_timestamp
gameover_timestamp
turn_deadline_ts           -- abbreviated when used heavily

-- Localised text references
name_text_id
narrative_text_id
description_text_id
title_text_id

-- URLs / media
image_url
audio_background_url
```


## 4. Java Code Naming

### 4.1 Package Structure
Root package: `games.paths`

| Sub-package | Layer |
|---|---|
| `games.paths.core.port.in` | Inbound ports (interfaces) |
| `games.paths.core.port.out` | Outbound ports (interfaces) |
| `games.paths.core.service` | Domain services |
| `games.paths.core.model` | Domain entities / value objects |
| `games.paths.adapterrest.controller` | REST controllers |
| `games.paths.adapterrest.dto` | Request/Response DTOs |
| `games.paths.adapterwebsocket.handler` | WebSocket handlers |
| `games.paths.adapterwebsocket.dto` | WebSocket message DTOs |
| `games.paths.adapterpostgres.repository` | PostgreSQL repositories |
| `games.paths.adaptersqlite.repository` | SQLite repositories |
| `games.paths.adaptermongo.repository` | MongoDB repositories |
| `games.paths.adapterkafka.producer` | Kafka producers |
| `games.paths.adapterkafka.consumer` | Kafka consumers |
| `games.paths.adapterauth.security` | Security/JWT components |
| `games.paths.adapteradmin.controller` | Admin REST controllers |
| `games.paths.launcher.config` | Spring Boot configuration beans |

### 4.2 Class Naming by Layer

| Suffix | Layer | Example |
|---|---|---|
| `Port` | Inbound port (interface) | `EchoPort`, `MatchPort`, `PlayerActionPort` |
| `OutPort` | Outbound port (interface) | `MatchRepositoryOutPort`, `NotificationOutPort` |
| `Service` | Domain service (implements Port) | `EchoService`, `MatchService`, `TurnService` |
| `Controller` | REST adapter | `EchoController`, `MatchController`, `GameplayController` |
| `Handler` | WebSocket adapter | `GameWebSocketHandler`, `NotificationHandler` |
| `Repository` | Persistence adapter | `MatchPostgresRepository`, `RegistrySqliteRepository` |
| `Adapter` | External service adapter | `KafkaNotificationAdapter`, `MongoSnapshotAdapter` |
| `Config` | Spring configuration | `CoreConfig`, `SecurityConfig`, `WebSocketConfig` |
| `DTO` | Data Transfer Object (generic) | `CharacterDTO`, `LocationDTO` |
| `Request` | Inbound REST body | `CreateMatchRequest`, `JoinMatchRequest` |
| `Response` | Outbound REST body | `MatchStateResponse`, `TurnUpdateResponse` |
| `Message` | WebSocket outbound envelope | `TurnUpdateMessage`, `GameEventMessage` |
| `Test` | JUnit test class | `EchoServiceTest`, `MatchControllerTest` |

### 4.3 Method Naming

Service methods use **camelCase** and follow these verb prefixes:

| Verb prefix | Intent | Examples |
|---|---|---|
| `get` | Single entity lookup | `getServerStatus()`, `getMatchById()` |
| `find` | Optional lookup (may return null/empty) | `findActiveMatch()` |
| `list` | Collection retrieval | `listActiveMatches()`, `listCharacters()` |
| `create` / `add` | Create or insert | `createMatch()`, `addPlayerToMatch()` |
| `update` | Modify existing | `updateRegistryKey()` |
| `remove` / `delete` | Remove entity | `removeCharacterEffect()` |
| `check` | Validate state, return boolean | `checkIfAllCharactersSleeping()`, `checkCharacterWeight()` |
| `exec` | Execute a game rule action | `execEvent()`, `execChoice()`, `execStartNewTime()` |
| `calc` | Pure computation, no side effects | `calcTurnOrder()`, `calcWeatherForTime()` |
| `send` | Dispatch notification or message | `sendWebSocketMessage()`, `sendTradeProposal()` |
| `schedule` | Scheduled/background method | Annotated with `@Scheduled`, name starts with context |

Examples from the service catalog:
```java
// Match services
matchCreate(id_story, difficult, id_user_creator)
matchAddPlayer(id_match, id_character_type, id_character_class)
matchStart(id_match)
matchAcquireLock(id_match, id_character)
matchReleaseLock(id_match, id_character)
matchPass(id_match, id_character)

// Character services
personaggioAddValues(id_match, id_character, energy, life, ...)
personaggioAddTraint(id_match, id_character, id_trait) //ex ITA=caratteristiche
personaggioSpendExp(id_match, id_character, dexterity, intelligence, constitution) //ex ITA=des, intel, cos

// Registry services
registryAdd(id_match, key, value)
registryList(id_match)

// Inventory services
inventoryAdd(id_match, id_character, id_item, food, coins, magic)
inventoryUse(id_match, id_character, id_item)
inventoryTrade(id_match, id_character_sender, id_character_dest, id_item)

// Time services
timeStart(id_match, new_time)
timeEnd(id_match)
timeInitiativeCalculation(id_match) //_turn_queue

// Snapshot services
snapshotCreate(id_match, tipo, nome)
snapshotRestore(id_match, snapshotId)
```

### 4.4 Variable and Field Naming
- Local variables and method parameters: **camelCase**
- Constants: **SCREAMING_SNAKE_CASE**
- Spring bean fields: **camelCase**, injected via constructor (no `@Autowired` on fields)
- Boolean fields use `is` prefix only when semantically needed: `isSleeping`, `isComatose`

```java
// Constants
public static final String STATUS_ACTIVE = "ACTIVE";
public static final int MAX_LOCATION_CAPACITY_DEFAULT = 4;

// Fields
private final MatchPort matchPort;
private final String serverStatus;
private final Map<String, String> serverProperties;
```

### 4.5 Maven Module Naming
All modules in `code/backend/` follow **kebab-case**:

```
core                  – Pure domain logic
ms-launcher           – Spring Boot main application
adapter-rest          – REST controllers
adapter-auth          – JWT / security
adapter-admin         – Admin-specific REST
adapter-websocket     – WebSocket handlers
adapter-postgres      – PostgreSQL persistence
adapter-sqlite        – SQLite persistence (dev/light)
adapter-mongo         – MongoDB (snapshots/documents)
adapter-kafka         – Kafka messaging (optional)
```
note: others adapter should be added in future



## 5. DTO and JSON Payload Naming

### 5.1 JSON Field Names
All JSON fields (both REST and WebSocket) use **camelCase**:
```json
{
  "characterId": 101,
  "characterName": "Gandalf",
  "currentEnergy": 6,
  "maxLife": 10,
  "isSleeping": false,
  "locationId": 3,
  "deadlineTimestamp": "2026-03-01T10:00:45Z"
}
```

### 5.2 Enum / Status Values in JSON
Enum-like string constants in JSON use **SCREAMING_SNAKE_CASE**:
```json
{ "state": "IN_PROGRESS" }
{ "characterState": "SLEEPING" }
{ "tradeState": "PENDING_VALIDATION" }
{ "userRole": "PLAYER" }
```

### 5.3 DTO Naming Pattern
| Purpose | Suffix | Example |
|---|---|---|
| REST request body | `Request` | `CreateMatchRequest`, `JoinMatchRequest` |
| REST response body | `Response` | `MatchStateResponse`, `CharacterStatsResponse` |
| Internal data transfer | `DTO` | `CharacterDTO`, `LocationDTO`, `WeatherDTO` |
| WebSocket outbound | `Message` | `TurnUpdateMessage`, `TradeMessage` |

### 5.4 Match / Game State Enum Values
```
Match states:     CREATED | IN_PROGRESS | PAUSED | ENDED | ENDED_GAMEOVER
Character states: ACTIVE  | SLEEPING    | COMA
User states:      REGISTERED | ACTIVE | BLOCKED | PASSWORD_EXPIRED
User roles:       ADMIN | PLAYER
Trade states:     PENDING_VALIDATION | ACCEPTED | REFUSED | FAILED_INVALID | EXPIRED
Snapshot types:   FULL | LIGHT
Effect triggers:  ON_TIME_START
Direction values: NORTH | SOUTH | EAST | WEST | UP | DOWN | SKY
```

---

## 6. Frontend Component Naming (React)

### 6.1 General Rules
- React component files: **PascalCase** with `.jsx` or `.tsx` extension
- Component names: **PascalCase** matching the file name
- Custom hooks: **camelCase** starting with `use`
- Redux slices / stores: **camelCase** file names, e.g., `matchSlice.js`
- CSS module files: `ComponentName.module.css`
- Utility/helper files: **camelCase**, e.g., `dateUtils.js`, `apiClient.js`

### 6.2 Component Naming Patterns
Components follow a descriptive noun + optional modifier pattern:

| Category pattern | Examples |
|---|---|
| `{Entity}Card` | `CharacterCard`, `LocationCard`, `MissionCard`, `LogEventCard` |
| `{Entity}Panel` | `InventoryPanel`, `ActionPanel`, `CharacterStatsPanel` |
| `{Entity}Modal` | `LocationDetailModal`, `TradeProposalModal`, `ConfirmModal` |
| `{Entity}Form` | `LoginForm`, `RegisterForm`, `GameCreationForm` |
| `{Entity}List` | `ChatMessageList`, `ConsumableList`, `PendingTradesList` |
| `{Entity}Button` | `PassButton`, `SleepButton`, `UseItemButton`, `ForceUnlockButton` |
| `{Entity}Viewer` | `RegistryViewer`, `GameLogViewer`, `ReplayViewer` |
| `{Entity}Indicator` | `WeatherIndicator`, `WeightIndicator`, `WebSocketStatusIndicator` |
| `{Entity}Timer` | `TurnTimer`, `ChoiceTimeoutIndicator` |

### 6.3 Custom Hooks
```js
useWebSocket(gameId)       // Manages WebSocket connection and dispatch
useMatchState(gameId)      // Polls or subscribes to match state
useCharacterStats()        // Current character statistics
useTurnQueue()             // Subscribes to turn order updates
useNotifications()         // Reads notification queue
```

---

## 7. Git Branch Naming

Branches follow a tiered naming scheme established in Step 02:

| Branch | Owner | Purpose |
|---|---|---|
| `master` | CI/CD | Production deployments |
| `developer` | DevTeam / Agent | Main integration branch |
| `feature/{kebab-name}` | DevTeam / Agent | New feature work |
| `release/{semver}` | CI | Release candidates (e.g., `release/1.0.0`) |
| `hotfix/{kebab-name}` | DevTeam | Critical production fixes |

---

## 8. Configuration and Environment Variables

- Environment variable names: **SCREAMING_SNAKE_CASE**
- Spring property keys: **kebab-case** under namespaced prefixes
- Profile names: `dev`, `prod` (lowercase)

```yaml
# application.yml pattern
paths-game:
  server-status: OK
  max-active-matches: 10
  timeout-player-pass: 60
  timeout-trades-expire: 120
  timeout-movement-follow: 30
  timeout-choices: 45
  time-between-messages: 5
```

```bash
# Environment variable equivalents
PATHS_GAME_SERVER_STATUS=OK
PATHS_GAME_MAX_ACTIVE_MATCHES=10
PATHS_GAME_TIMEOUT_PLAYER_PASS=60
DATABASE_URL=jdbc:postgresql://localhost:5432/pathsgame
DATABASE_USERNAME=pathsgame
DATABASE_PASSWORD=secret
JWT_SECRET=...
```

---

## 9. Quick Reference Summary

| Layer | Convention | Example |
|---|---|---|
| REST endpoints | `/api/v1/{context}/{resource}/{id}` kebab-case | `/api/v1/gameplay/{id}/action/pass` |
| WebSocket message type | SCREAMING_SNAKE_CASE | `TURN_UPDATE` |
| WebSocket topic | `/topic/v1/game/{id_game}` | `/topic/v1/game/42` |
| DB table name | snake_case with prefix (English) | `gaming_turn_queue` |
| DB column name | snake_case (English) | `id_character_instance` |
| DB boolean column | `is_` prefix | `is_safe_location` |
| DB FK column | `id_` prefix | `id_match` |
| DB timestamp column | `_timestamp` / `_ts` suffix | `lock_expiration_timestamp` |
| Java package | lowercase dot-separated | `games.paths.core.service` |
| Java class | PascalCase + role suffix | `MatchService`, `GameplayController` |
| Java method | camelCase + verb prefix | `calcTurnOrder()`, `execEvent()` |
| Java constant | SCREAMING_SNAKE_CASE | `STATUS_IN_PROGRESS` |
| Maven module | kebab-case | `adapter-rest`, `ms-launcher` |
| JSON field | camelCase | `characterId`, `isSleeping` |
| JSON enum value | SCREAMING_SNAKE_CASE | `"state": "IN_PROGRESS"` |
| React component | PascalCase | `CharacterCard`, `TurnTimer` |
| React hook | camelCase `use` prefix | `useWebSocket()` |
| React file | PascalCase.jsx/.tsx | `CharacterCard.jsx` |
| Git branch | kebab-case with prefix | `feature/turn-timeout` |
| Env variable | SCREAMING_SNAKE_CASE | `PATHS_GAME_TIMEOUT_PLAYER_PASS` |
| Spring property | kebab-case namespaced | `paths-game.timeout-player-pass` |


# Version Control
- First version created with AI prompt:
    > hi, read all files into documentation_v1 and complete the step06 file with naming convention you find in others documents and complete with your suggestions  
    > add api and websocket endpoint the software versione "v1" / "v2" / "v1beta1"..., change reference table from italian language to english language (example "lista" to "list")
- **Document Version**: 1.1
    - 1.0 first version of document (February 26, 2026)
    - 1.1 added API versioning (v1/v2/v1beta1), renamed tables from Italian to English: elenco_ → list_, gioco_ → gaming_, partite → match (February 26, 2026)
- **Last Updated**: February 26, 2026
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




