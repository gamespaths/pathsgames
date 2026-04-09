# Paths Games V1 - Step 10: Create Initial DB Schema

This document defines the **initial database schema** for **Paths Games**, covering table creation, primary keys, foreign keys, indexes, schema versioning with Flyway, and dual-database support (PostgreSQL + SQLite).

All naming conventions follow [Step 06 - Naming Conventions](./Step06_NamingConventions.md). The core data model is defined in [Step 09 - Design Core Data Model](./Step09_DesignCoreDataModel.md). The schema versioning strategy is defined in [Step 10 - Flyway](./Step10_Flyway.md).


  - ✅ Translate the data model into tables

  - ✅ Define primary keys

  - ✅ Define foreign keys

  - ✅ Define initial indexes

  - ✅ Version the schema



## 1. Translate the Data Model into Tables

The 52 entities defined in Step 09 have been translated into SQL `CREATE TABLE` statements, split across **13 versioned migration files** grouped by logical domain. Each file exists in two versions: one for **PostgreSQL** (production) and one for **SQLite** (development).


### 1.1 Migration File Summary

| File | Version | Category | Tables | Count |
|------|---------|----------|--------|-------|
| `V0.10.0__create_system_tables.sql` | V0.10.0 | System | `global_game_version`, `global_runtime_variables` | 2 |
| `V0.10.1__create_user_tables.sql` | V0.10.1 | User | `users`, `users_tokens` | 2 |
| `V0.10.2__create_story_core.sql` | V0.10.2 | Story (core) | `list_stories`, `list_stories_difficulty`, `list_keys`, `list_classes`, `list_classes_bonus`, `list_traits`, `list_character_templates` | 7 |
| `V0.10.3__create_story_locations_items.sql` | V0.10.3 | Story (locations & items) | `list_locations`, `list_locations_neighbors`, `list_items`, `list_items_effects`, `list_weather_rules` | 5 |
| `V0.10.4__create_story_events_choices.sql` | V0.10.4 | Story (events & choices) | `list_events`, `list_events_effects`, `list_choices`, `list_choices_conditions`, `list_choices_effects`, `list_global_random_events`, `list_missions`, `list_missions_steps` | 8 |
| `V0.10.5__create_story_content.sql` | V0.10.5 | Story (content) | `list_creator`, `list_cards`, `list_texts` | 3 |
| `V0.10.6__create_gaming_core.sql` | V0.10.6 | Gaming (core) | `gaming_match`, `gaming_character_instance`, `gaming_character_traits`, `gaming_backpack_resources`, `gaming_inventory_items` | 5 |
| `V0.10.7__create_gaming_state.sql` | V0.10.7 | Gaming (state) | `gaming_state_registry`, `gaming_state_locations`, `gaming_turn_queue`, `gaming_active_effects`, `gaming_active_choices`, `gaming_story_progress`, `gaming_temp_variables` | 7 |
| `V0.10.8__create_gaming_social.sql` | V0.10.8 | Gaming (social) | `gaming_trades`, `gaming_movement_invites`, `gaming_notification_queue`, `gaming_user_sessions`, `chat_messages` | 5 |
| `V0.10.9__create_log_tables.sql` | V0.10.9 | Log / audit | `log_events`, `log_movements`, `log_item_usage`, `log_weather`, `log_clock_history`, `log_lock_history`, `log_choices_executed` | 7 |
| `V0.10.10__create_snapshot.sql` | V0.10.10 | Snapshot | `system_snapshot` | 1 |
| `V0.10.11__create_indexes.sql` | V0.10.11 | Indexes & FKs | Deferred foreign keys + performance indexes | — |
| `V0.10.12__insert_seed_data.sql` | V0.10.12 | Seed data | `global_game_version`, `global_runtime_variables` initial rows | — |

**Total: 52 tables** (2 system + 2 user + 23 reference + 25 runtime/log)


### 1.2 Directory Structure

```
code/backend/java/
├── adapter-postgres/
│   └── src/main/resources/
│       └── db/migration/
│           ├── v0_10/
│           │   ├── V0.10.0__create_system_tables.sql
│           │   ├── V0.10.1__create_user_tables.sql
│           │   ├── V0.10.2__create_story_core.sql
│           │   ├── V0.10.3__create_story_locations_items.sql
│           │   ├── V0.10.4__create_story_events_choices.sql
│           │   ├── V0.10.5__create_story_content.sql
│           │   ├── V0.10.6__create_gaming_core.sql
│           │   ├── V0.10.7__create_gaming_state.sql
│           │   ├── V0.10.8__create_gaming_social.sql
│           │   ├── V0.10.9__create_log_tables.sql
│           │   ├── V0.10.10__create_snapshot.sql
│           │   ├── V0.10.11__create_indexes.sql
│           │   └── V0.10.12__insert_seed_data.sql
│           └── dev/
│               └── R__insert_dev_test_data.sql
│
├── adapter-sqlite/
│   └── src/main/resources/
│       └── db/migration/
│           ├── v0_10/
│           │   ├── V0.10.0__create_system_tables.sql
│           │   ├── V0.10.1__create_user_tables.sql
│           │   ├── V0.10.2__create_story_core.sql
│           │   ├── V0.10.3__create_story_locations_items.sql
│           │   ├── V0.10.4__create_story_events_choices.sql
│           │   ├── V0.10.5__create_story_content.sql
│           │   ├── V0.10.6__create_gaming_core.sql
│           │   ├── V0.10.7__create_gaming_state.sql
│           │   ├── V0.10.8__create_gaming_social.sql
│           │   ├── V0.10.9__create_log_tables.sql
│           │   ├── V0.10.10__create_snapshot.sql
│           │   ├── V0.10.11__create_indexes.sql
│           │   └── V0.10.12__insert_seed_data.sql
│           └── dev/
│               └── R__insert_dev_test_data.sql
```


### 1.3 Dialect Differences

Each adapter module contains migration files written in the native SQL dialect:

| Feature | PostgreSQL | SQLite |
|---------|------------|--------|
| Auto-increment PK | `BIGSERIAL PRIMARY KEY` | `INTEGER PRIMARY KEY AUTOINCREMENT` |
| String type | `VARCHAR(n)` | `TEXT` |
| Timestamp type | `TIMESTAMP` | `TEXT` |
| Default timestamp | `DEFAULT NOW()` | `DEFAULT (datetime('now'))` |
| Boolean type | `BOOLEAN` | `INTEGER` (0/1) |
| JSON type | `JSONB` | `TEXT` |
| Table existence guard | `CREATE TABLE` | `CREATE TABLE IF NOT EXISTS` |
| Foreign key enforcement | Enabled by default | Requires `PRAGMA foreign_keys = ON` |
| UUID type | `UUID` (native) | `TEXT` (generated via `randomblob()`) |
| UUID default | `DEFAULT gen_random_uuid()` | `DEFAULT (lower(hex(randomblob(4))\|\|'-'\|\|...))` |
| ALTER TABLE ADD CONSTRAINT | ✅ Supported | ❌ Not supported |
| COMMENT ON | ✅ Supported | ❌ Not supported |



## 2. Define Primary Keys

Every table has a primary key. Two strategies are used:

### 2.1 Surrogate Primary Keys (Auto-Increment)

The majority of tables use a **surrogate auto-increment integer PK** named `id`:

| PostgreSQL | SQLite |
|------------|--------|
| `id BIGSERIAL PRIMARY KEY` | `id INTEGER PRIMARY KEY AUTOINCREMENT` |

**Exception**: `list_character_templates` uses `id_tipo` as its PK name (preserving the domain-specific identifier from the data model).


### 2.2 Composite Primary Keys

Two tables use composite primary keys to represent unique combinations:

| Table | Primary Key | Rationale |
|-------|-------------|-----------|
| `gaming_state_locations` | `(id_match, id_location)` | Each location has exactly one state row per match |
| `gaming_turn_queue` | `(id_match, id_character_match)` | Each character appears at most once in the turn queue per match |


### 2.3 Primary Key Summary by Tier

| Tier | Tables | PK Strategy |
|------|--------|-------------|
| System (2) | `global_game_version`, `global_runtime_variables` | `id` auto-increment |
| User (2) | `users`, `users_tokens` | `id` auto-increment |
| Story (23) | All `list_*` tables | `id` auto-increment (except `list_character_templates` → `id_tipo`) |
| Runtime (25) | All `gaming_*`, `log_*`, `chat_*`, `system_*` | `id` auto-increment or composite |


### 2.4 UUID Column (Public API Identifier)

Every table includes a `uuid` column — a randomly generated UUID v4 value, created automatically on row insertion. The `uuid` is used as the **public-facing identifier** in all REST API endpoints, so that internal auto-increment `id` values are never exposed in HTTP requests or responses.

| Property | PostgreSQL | SQLite |
|----------|------------|--------|
| Type | `UUID` (native 128-bit) | `TEXT` (36-char string) |
| Default | `gen_random_uuid()` | `lower(hex(randomblob(4))\|\|'-'\|\|hex(randomblob(2))\|\|'-4'\|\|substr(hex(randomblob(2)),2)\|\|'-'\|\|substr('89ab',1+abs(random())%4,1)\|\|substr(hex(randomblob(2)),2)\|\|'-'\|\|hex(randomblob(6)))` |
| Constraint | `NOT NULL UNIQUE` | `NOT NULL UNIQUE` |
| Index | Implicit unique index | Implicit unique index |

**Why UUID for APIs?**

| Concern | Internal `id` | Public `uuid` |
|---------|---------------|---------------|
| Predictability | Sequential — easy to guess next value | Random — no way to guess |
| Enumeration attacks | Trivial (`/api/users/1`, `/api/users/2`, …) | Impossible (128-bit random) |
| Information leakage | Reveals total row count / creation order | Reveals nothing |
| Performance | Primary key — fastest for JOINs | Unique index — fast for single-row lookups |

**Usage pattern in REST API**:
```
GET  /api/matches/{uuid}          → lookup by uuid
POST /api/matches                  → returns uuid in response
GET  /api/users/{uuid}/profile     → user identified by uuid
```

**Internal queries** continue to use `id` for JOINs and foreign keys (best performance). The `uuid` is only used at the API boundary layer (controllers/adapters) for external communication.

> Note: The `uuid` column is placed immediately after the primary key column(s) in every table, including composite-PK tables (`gaming_state_locations`, `gaming_turn_queue`).


## 3. Define Foreign Keys

### 3.1 Inline Foreign Keys

Foreign keys are declared inline in the `CREATE TABLE` statement where the referenced table already exists at migration time. Standard pattern:

```sql
id_story BIGINT NOT NULL REFERENCES list_stories(id) ON DELETE CASCADE
```

**ON DELETE CASCADE** is used for:
- Child tables scoped by a parent (e.g., `list_classes.id_story → list_stories.id`)
- Runtime tables scoped by match (e.g., `gaming_character_instance.id_match → gaming_match.id`)
- Tokens linked to users (e.g., `users_tokens.id_user → users.id`)


### 3.2 Deferred Foreign Keys (PostgreSQL Only)

Circular references between tables created in different migration files cannot be declared inline. These are added via `ALTER TABLE` in `V0.10.11__create_indexes.sql`:

| Source Table | Column | → Target Table |
|---|---|---|
| `list_stories` | `id_card` | → `list_cards(id)` |
| `list_stories` | `id_location_start` | → `list_locations(id)` |
| `list_stories` | `id_location_all_player_coma` | → `list_locations(id)` |
| `list_stories` | `id_event_all_player_coma` | → `list_events(id)` |
| `list_stories` | `id_event_end_game` | → `list_events(id)` |
| `list_stories` | `id_creator` | → `list_creator(id)` |
| `list_locations` | `id_event_if_counter_zero` | → `list_events(id)` |
| `list_locations` | `id_event_if_character_start_time` | → `list_events(id)` |
| `list_locations` | `id_event_if_character_enter_first_time` | → `list_events(id)` |
| `list_locations` | `id_event_if_first_time` | → `list_events(id)` |
| `list_locations` | `id_event_not_first_time` | → `list_events(id)` |
| `list_weather_rules` | `id_event` | → `list_events(id)` |
| `gaming_match` | `id_character_current_turn` | → `gaming_character_instance(id)` |
| All `list_*` tables | `id_card` | → `list_cards(id)` |

**SQLite limitation**: `ALTER TABLE ADD CONSTRAINT` is not supported. Circular FK constraints are documented as logical references and enforced at the **application level** only.


### 3.3 Soft References (Text IDs)

Multi-language text references (e.g., `id_text_name`, `id_text_description`, `id_text_narrative`) point to `list_texts.id_text` values, which are looked up by `(id_story, id_text, lang)`. These are **not** formal FK constraints — they are resolved at query time by the application.



## 4. Define Initial Indexes

Performance indexes are created in `V0.10.11__create_indexes.sql`. They target columns used in:
- WHERE clauses (status filters, key lookups)
- JOIN conditions (foreign key columns)
- ORDER BY columns (priority, timestamps)

### 4.1 Index Categories

| Category | Index Count | Examples |
|----------|-------------|---------|
| User lookups | 5 | `username` (via UNIQUE), `email_address`, `google_id_sso`, `state` |
| Story scoping | 15 | `id_story` on all `list_*` tables |
| Event/Choice navigation | 8 | `id_event`, `id_location`, `id_choices` |
| Match state queries | 12 | `status`, `id_match` on all `gaming_*` tables |
| Turn management | 4 | `id_match` + `id_character_match` on turn queue, effects |
| Social features | 8 | `status` on trades, `state` on invites, `is_online` on sessions |
| Log queries | 10 | `id_match` + `id_character_match` on all `log_*` tables |
| Text/Content | 4 | `(id_story, id_text)`, `(id_story, lang)` |

### 4.2 Index Naming Convention

All indexes follow the pattern: `idx_{table_short_name}_{column(s)}`

```
idx_match_status          → gaming_match(status)
idx_char_inst_match       → gaming_character_instance(id_match)
idx_state_reg_key         → gaming_state_registry(id_match, key)
idx_texts_story_text      → list_texts(id_story, id_text)
```



## 5. Version the Schema

### 5.1 Flyway as Migration Tool

The project uses **Flyway** for database schema versioning. See [Step 10 - Flyway](./Step10_Flyway.md) for the full strategy document.

Key configuration:
- **Baseline version**: `"0"` — Flyway begins execution from `V0.10.0`
- **Migration location**: `classpath:db/migration`
- **History table**: `flyway_schema_history`
- Flyway scans subdirectories recursively (`v0_10/`, `dev/`)


### 5.2 Version Numbering Alignment with Roadmap

| Roadmap Step | Flyway Version Range | Description |
|---|---|---|
| Step 10 — Initial DB schema | `V0.10.0` – `V0.10.12` | Table creation, indexes, seed data |
| Step 11 — API versioning | `V0.11.0` – `V0.11.x` | DDL changes if required |
| Step 12 — Authentication | `V0.12.0` – `V0.12.x` | Auth-related schema changes |
| V1 Release | `V1.0.0` – `V1.0.x` | Final DDL adjustments |


### 5.3 Seed Data

**Production seed data** (`V0.10.12`): Inserted via versioned migration — executed exactly once. Contains:
- `global_game_version`: Initial version record (`v0.10.0`)
- `global_runtime_variables`: 16 system parameters covering timeouts, limits, WebSocket, JWT, and session configuration

**Development test data** (`R__insert_dev_test_data.sql`): Inserted via repeatable migration — re-executed when content changes. Contains:
- 4 test users (1 admin + 3 players) with BCrypt password hashes

### 5.4 Runtime Variables Inserted

| Key | Type | Value | Description |
|-----|------|-------|-------------|
| `SystemStatus` | STRING | `ONLINE` | Global system status |
| `MaxActiveMatches` | INTEGER | `10` | Max concurrent active matches |
| `TimeoutPlayerPass` | INTEGER | `60` | Base turn auto-pass timeout (seconds) |
| `TimeoutPlayerPassPerVolta` | INTEGER | `15` | Additional seconds per consecutive pass |
| `TimeoutTradesExpire` | INTEGER | `120` | Trade proposal expiry (seconds) |
| `TimeoutMovementFollow` | INTEGER | `30` | Group movement invite timeout (seconds) |
| `TimeoutChoice` | INTEGER | `45` | Active choice timeout (seconds) |
| `WebSocketHeartbeatInterval` | INTEGER | `30` | WebSocket heartbeat interval (seconds) |
| `DefaultInventoryCapacity` | INTEGER | `5` | Base inventory capacity |
| `TimeBetweenMessages` | INTEGER | `5` | Chat rate limiting (seconds) |
| `MaxConsecutivePassBeforeGameover` | INTEGER | `20` | Stalemate threshold |
| `SnapshotRetentionDays` | INTEGER | `30` | Automatic snapshot retention |
| `AFKCleanupTimeout` | INTEGER | `300` | AFK session cleanup (seconds) |
| `JWTAccessTokenExpiry` | INTEGER | `900` | JWT access token expiry (seconds) |
| `JWTRefreshTokenExpiry` | INTEGER | `604800` | JWT refresh token expiry (seconds) |
| `GuestSessionExpiry` | INTEGER | `86400` | Guest session duration (seconds) |



## 6. Flyway: Migration Tool Guide

### 6.1 What is Flyway?

Flyway is an open-source database migration tool that manages schema versioning through **incremental SQL files**. It tracks which migrations have been applied using a history table (`flyway_schema_history`) and executes only new, unapplied migrations on application startup.

**Core principle**: The database schema is treated as **versioned source code**. Every change is a numbered migration file committed to the repository.


### 6.2 Flyway vs Liquibase

| Criterion | Flyway | Liquibase |
|-----------|--------|-----------|
| **Migration format** | Pure SQL files | XML, YAML, JSON, or SQL |
| **Complexity** | Low — SQL is the only abstraction | Higher — changelog format adds a layer |
| **Learning curve** | Minimal — write SQL, number files | Moderate — learn changelog syntax |
| **Multi-database support** | Separate SQL files per dialect | Single changelog, database-agnostic |
| **Spring Boot integration** | Native: `spring-boot-starter-flyway` | Native: `spring-boot-starter-liquibase` |
| **Rollback** | Paid feature (Flyway Teams) | Built-in for many change types |
| **Diff/generate** | Not built-in | Can diff two databases |
| **Checksums** | MD5 per file — detects modifications | Per changeset |
| **Best for** | SQL-first teams, simple needs | Complex cross-database abstractions |

**Why Flyway for Paths Games**: The project requires dual-database support (PostgreSQL + SQLite) with dialect-specific DDL (`BIGSERIAL` vs `INTEGER PRIMARY KEY AUTOINCREMENT`). Pure SQL gives maximum control without an abstraction layer. The 52-table schema is well-defined and doesn't need Liquibase's cross-database abstraction.


### 6.3 How Flyway Works

```
Application Startup
        │
        ▼
┌─────────────────────────────────┐
│ Flyway scans migration folder   │
│ (classpath:db/migration)        │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│ Compare local files against     │
│ flyway_schema_history table     │
└───────────────┬─────────────────┘
                │
        ┌───────┴───────┐
        │               │
   New files?      All applied?
        │               │
        ▼               ▼
  Execute new       Skip — DB is
  migrations        up to date
  in version
  order
        │
        ▼
  Record in
  flyway_schema_history
```


### 6.4 File Naming Convention

**Versioned migrations** (executed once, tracked by checksum):
```
V{version}__{description}.sql

V0.10.0__create_system_tables.sql
V0.10.1__create_user_tables.sql
V2.0.0__add_story_rating.sql
```

**Repeatable migrations** (re-executed when content changes):
```
R__{description}.sql

R__insert_dev_test_data.sql
```

Rules:
- Version separator: **dot** (`.`)
- Description separator: **double underscore** (`__`)
- Description: **snake_case**
- One version = one file. Duplicate versions cause startup failure.


### 6.5 Spring Boot Configuration

**Development (SQLite)**:
```yaml
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true
    baseline-version: "0"
    validate-on-migrate: false
    repair-on-migrate: true
```

**Production (PostgreSQL)**:
```yaml
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true
    baseline-version: "0"
    validate-on-migrate: true
    repair-on-migrate: false
```

| Property | Dev | Prod | Purpose |
|----------|-----|------|---------|
| `validate-on-migrate` | `false` | `true` | Checksum validation (strict in prod) |
| `repair-on-migrate` | `true` | `false` | Auto-fix checksums (dev flexibility) |


### 6.6 Using Flyway for Future Features

When a future step requires a schema change, create a new versioned migration file:

**Step 1**: Write the SQL for both dialects
```sql
-- adapter-postgres: V0.12.0__add_auth_columns.sql
ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(255);

-- adapter-sqlite: V0.12.0__add_auth_columns.sql
ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN two_factor_secret TEXT;
```

**Step 2**: Place files in the appropriate adapter directory
```
adapter-postgres/src/main/resources/db/migration/v0_12/V0.12.0__add_auth_columns.sql
adapter-sqlite/src/main/resources/db/migration/v0_12/V0.12.0__add_auth_columns.sql
```

**Step 3**: Start the application — Flyway auto-applies the new migration

**Step 4**: Verify in `flyway_schema_history`
```sql
SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;
```

### 6.7 Rules for Production Migrations

| # | Rule |
|---|------|
| 1 | **Never** modify a versioned migration after it has been applied in production |
| 2 | Always create a **new** `V` file for every schema change |
| 3 | Write **both** PostgreSQL and SQLite versions of each migration |
| 4 | Test locally (SQLite) first, then validate in CI (PostgreSQL) |
| 5 | Use `R__` files for dev/test seed data only |
| 6 | Maintain **identical version numbers** across both adapter modules |
| 7 | Group tables by **logical domain** per file |



## 7. Table Reference

### 7.1 Table Prefix Convention

| Prefix | Category | Count |
|--------|----------|-------|
| `global_` | Global system configuration | 2 |
| `users` / `users_` | User account management | 2 |
| `list_` | Reference / story-authored data (static, read-only at runtime) | 23 |
| `gaming_` | Runtime game state (dynamic, per-match) | 18 |
| `log_` | Audit / history logs | 7 |
| `chat_` | In-match chat | 1 |
| `system_` | System services (snapshots) | 1 |

### 7.2 Complete Table List (52 tables)

| # | Table | PK | Migration |
|---|-------|-----|----------|
| 1 | `global_game_version` | `id` | V0.10.0 |
| 2 | `global_runtime_variables` | `id` | V0.10.0 |
| 3 | `users` | `id` | V0.10.1 |
| 4 | `users_tokens` | `id` | V0.10.1 |
| 5 | `list_stories` | `id` | V0.10.2 |
| 6 | `list_stories_difficulty` | `id` | V0.10.2 |
| 7 | `list_keys` | `id` | V0.10.2 |
| 8 | `list_classes` | `id` | V0.10.2 |
| 9 | `list_classes_bonus` | `id` | V0.10.2 |
| 10 | `list_traits` | `id` | V0.10.2 |
| 11 | `list_character_templates` | `id_tipo` | V0.10.2 |
| 12 | `list_locations` | `id` | V0.10.3 |
| 13 | `list_locations_neighbors` | `id` | V0.10.3 |
| 14 | `list_items` | `id` | V0.10.3 |
| 15 | `list_items_effects` | `id` | V0.10.3 |
| 16 | `list_weather_rules` | `id` | V0.10.3 |
| 17 | `list_events` | `id` | V0.10.4 |
| 18 | `list_events_effects` | `id` | V0.10.4 |
| 19 | `list_choices` | `id` | V0.10.4 |
| 20 | `list_choices_conditions` | `id` | V0.10.4 |
| 21 | `list_choices_effects` | `id` | V0.10.4 |
| 22 | `list_global_random_events` | `id` | V0.10.4 |
| 23 | `list_missions` | `id` | V0.10.4 |
| 24 | `list_missions_steps` | `id` | V0.10.4 |
| 25 | `list_creator` | `id` | V0.10.5 |
| 26 | `list_cards` | `id` | V0.10.5 |
| 27 | `list_texts` | `id` | V0.10.5 |
| 28 | `gaming_match` | `id` | V0.10.6 |
| 29 | `gaming_character_instance` | `id` | V0.10.6 |
| 30 | `gaming_character_traits` | `id` | V0.10.6 |
| 31 | `gaming_backpack_resources` | `id` | V0.10.6 |
| 32 | `gaming_inventory_items` | `id` | V0.10.6 |
| 33 | `gaming_state_registry` | `id` | V0.10.7 |
| 34 | `gaming_state_locations` | `(id_match, id_location)` | V0.10.7 |
| 35 | `gaming_turn_queue` | `(id_match, id_character_match)` | V0.10.7 |
| 36 | `gaming_active_effects` | `id` | V0.10.7 |
| 37 | `gaming_active_choices` | `id` | V0.10.7 |
| 38 | `gaming_story_progress` | `id` | V0.10.7 |
| 39 | `gaming_temp_variables` | `id` | V0.10.7 |
| 40 | `gaming_trades` | `id` | V0.10.8 |
| 41 | `gaming_movement_invites` | `id` | V0.10.8 |
| 42 | `gaming_notification_queue` | `id` | V0.10.8 |
| 43 | `gaming_user_sessions` | `id` | V0.10.8 |
| 44 | `chat_messages` | `id` | V0.10.8 |
| 45 | `log_events` | `id` | V0.10.9 |
| 46 | `log_movements` | `id` | V0.10.9 |
| 47 | `log_item_usage` | `id` | V0.10.9 |
| 48 | `log_weather` | `id` | V0.10.9 |
| 49 | `log_clock_history` | `id` | V0.10.9 |
| 50 | `log_lock_history` | `id` | V0.10.9 |
| 51 | `log_choices_executed` | `id` | V0.10.9 |
| 52 | `system_snapshot` | `id` | V0.10.10 |


### 7.3 Standard Columns (Present on Every Table)

Every table includes three standard columns in addition to the primary key:

| Column | PostgreSQL | SQLite | Purpose |
|--------|------------|--------|--------|
| `uuid` | `UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE` | `TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))...))` | Public API identifier — random UUID v4 |
| `ts_insert` | `TIMESTAMP NOT NULL DEFAULT NOW()` | `TEXT NOT NULL DEFAULT (datetime('now'))` | Row creation timestamp |
| `ts_update` | `TIMESTAMP NOT NULL DEFAULT NOW()` | `TEXT NOT NULL DEFAULT (datetime('now'))` | Last modification timestamp |

> Note: `ts_update` must be maintained by the application layer (Spring Boot `@PreUpdate` or equivalent). The database default only sets the initial value.
> Note: `uuid` is auto-generated on INSERT — no application code is needed to populate it.



## 8. Maven Dependencies

The following dependencies are required in `ms-launcher/pom.xml`:

```xml
<dependencies>
    <!-- Flyway Core -->
    <dependency>
        <groupId>org.flywaydb</groupId>
        <artifactId>flyway-core</artifactId>
    </dependency>
    <!-- Flyway PostgreSQL dialect support -->
    <dependency>
        <groupId>org.flywaydb</groupId>
        <artifactId>flyway-database-postgresql</artifactId>
    </dependency>
</dependencies>
```



## 9. Running Migrations

### 9.1 Development (SQLite)

```bash
cd code/backend/java
mvn spring-boot:run -pl ms-launcher -Dspring-boot.run.profiles=dev
```

Flyway will:
1. Create `flyway_schema_history` table if it doesn't exist
2. Apply all `V0.10.x` migrations from `adapter-sqlite` classpath
3. Apply repeatable `R__` migrations if changed
4. Log applied migrations to console

### 9.2 Production (PostgreSQL)

The Docker container starts with the `prod` profile, and Flyway applies migrations automatically:

```bash
mvn spring-boot:run -pl ms-launcher \
  -Dspring-boot.run.profiles=prod \
  -Dspring.datasource.url=jdbc:postgresql://localhost:5432/pathsgames \
  -Dspring.datasource.username=pathsgames \
  -Dspring.datasource.password=secret
```

### 9.3 Verifying Migrations

```sql
-- Check applied migrations
SELECT version, description, installed_on, success
FROM flyway_schema_history
ORDER BY installed_rank;
```



# Version Control
- First version created with AI prompt:
    > Read all files into documentation_v0 folder to have project overview. Create SQL files for PostgreSQL and SQLite, one file per table category. Write Step10_CreateDBschema.md documentation with Flyway description and usage guide.

    > Now i wanna add uuid item in all tables , the value will be a generated with a randon value when a row is added in a table, the uuid value will be used in API method (to avoid use ID value in public http api)
- **Document Version**: 0.14.1
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.10.0 | Initial version: 52 tables, 13 migration files per dialect, indexes, seed data, Flyway guide | March 19, 2026 |
    | 0.10.12 | Added UUID column to all 52 tables for public API identifiers (gen_random_uuid / randomblob) | March 19, 2026 |
    | 0.14.1 | Manage projects structure and 101 steps definition | April 09, 2026 |
- **Last Updated**: April 09, 2026
- **Status**: Complete ✅



# < Paths Games />
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
