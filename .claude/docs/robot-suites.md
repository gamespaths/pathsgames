# Robot Framework suites, seeds and reports

Loaded on demand. Read only when working on E2E tests.

## Suite catalog — `code/tests/robot/tests/`

| Suite | Coverage |
|-------|----------|
| `01_smoke` | Basic connectivity |
| `12_auth` | Guest login, session management |
| `13_session_token` | Session token validation |
| `14_admin` | Admin guest management |
| `14_stories` | Story catalog |
| `15_story_content` | Story content APIs |
| `16_content_detail` | Content detail APIs |
| `17_admin_crud` | Admin CRUD for all story entities |
| `19_match` | Match creation and end flow |
| `20_admin_match` | Admin match control (stop/pause/resume) |
| `20_website` | Website/Turnstile captcha flow |
| `21_character_selection` | Character join, stat formula, backpack/traits |
| `22_story_validation` | Story import validation rules |
| `23_trait_selection` | Trait selection with class/cost/compatibility checks |
| `24_turn_cycle` | Full turn cycle gameplay |
| `25_time_clock` | Active location seeding and time clock |
| `26_time_recovery` | Time-start stat recovery, counter re-seed, i18n lang on match info, i18n regression on `/api/stories?lang=` |
| `27_weather` | Weather system: random selection, effects, clock-linked roll, log |
| `28_movement` | Movement system (see breakdown below) |
| `29_events` | Step 29 normal events (see breakdown below) |

### `28_movement` breakdown

Adjacency validation, energy cost formula, visited locations, admin locations. Plus:

- `location_cards.robot` (v0.28.5) — full location/neighbor `card` resolution + `?lang=` on `GET /locations`
- `location_fog_of_war.robot` (v0.28.6) — fog-of-war hides neighbor `card`/`idCard` for never-visited destinations on `/locations` and `/info`
- `match_info_visited_locations.robot` (v0.28.6) — `/info` `locations[]` visited-only (admin keeps all); no synthetic `name`/`currentLocationName`/`locationName`; neighbor `cardLocationFrom`/`cardLocationTo` gated per endpoint
- `neighbor_card_back.robot` — neighbor return card `idCardBack`
- `event_location.robot` — event-to-location binding `idSpecificLocation`; guards the AWS stale-alias and Python column-name bugs
- `match_logs.robot` — consolidated match log timeline (`GET /api/matches/{uuid}/logs`): WEATHER / MOVEMENT / SLEEP / CLOCK_ADVANCE / RECOVERY / EVENT entries, cursor pagination, card enrichment

**There is no `29_match_logs` directory.** `match_logs.robot`, `neighbor_card_back.robot` and
`event_location.robot` all live inside `tests/28_movement/`.

### `29_events` breakdown

`events.robot` — the `available`/`reason` flag on `/info` events;
`POST /api/gameplay/{uuid}/action/execute-event` (every error code, every effect type, every
`target` mode); the `id_event_next` chain; `ONCE` per-match consumption; `flag_end_time`; coma; `?lang=`.

## Seed data and reports per backend

| Backend | Seed file | Run script | Report |
|---|---|---|---|
| Java / SQLite | `code/backend/java/adapter-sqlite/src/main/resources/db/migration/dev/R__insert_story_seed_data.sql` | `code/scripts/dev/run_robots/run_robot_with_local_java.sh` | `code/tests/robot/reports-local-java/report.html` |
| Java / Postgres | `code/backend/java/adapter-postgres/src/main/resources/db/migration/dev/R__insert_dev_test_data.sql` | `code/scripts/dev/run_robots/run_robot_with_local_java_postgres.sh` | `code/tests/robot/reports-local-java-postgres/report.html` |
| Python | `code/backend/python/scripts/seed_stories.py` | `code/scripts/dev/run_robots/run_robot_with_local_python.sh` | `code/tests/robot/reports-local-python/report.html` |
| AWS | `code/backend/aws/lambda/seed/handler.py` | `code/scripts/dev/run_robots/run_robot_with_aws_serverless.sh` | `code/tests/robot/reports-aws/report.html` |

When a suite is added or a seed changes, keep all four backends in sync — the Robot suites
validate any backend interchangeably via `variables/dev.yaml`.
