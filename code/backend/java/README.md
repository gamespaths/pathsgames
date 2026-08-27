# Paths Games - Backend Java

Java 21 + Spring Boot 3.4 multi-module backend using **Hexagonal Architecture** (Ports and Adapters).


[Sonar Qube report](https://sonarcloud.io/project/overview?id=paths-game-backend-java): [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=bugs)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=coverage)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=paths-game-backend-java&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=paths-game-backend-java)


## Project Structure

```
code/backend/java/
├── pom.xml                  # Parent POM (reactor)
├── core/                    # Pure domain: ports, services, entities (no Spring)
├── adapter-rest/            # REST API controllers (Spring MVC)
├── adapter-auth/            # Authentication & JWT adapter
├── adapter-admin/           # Admin API adapter
├── adapter-websocket/       # WebSocket real-time adapter
├── adapter-postgres/        # PostgreSQL persistence adapter (production)
├── adapter-sqlite/          # SQLite persistence adapter (development)
├── adapter-mongo/           # MongoDB document storage adapter
├── adapter-kafka/           # Kafka messaging adapter
└── ms-launcher/             # Spring Boot application entry point
```

## Module Descriptions

| Module | Package | Description |
|--------|---------|-------------|
| **adapter-rest** | `games.paths.adapters.rest` | REST controllers exposing domain ports as HTTP endpoints. |
| **adapter-auth** | `games.paths.adapters.auth` | JWT authentication, Google SSO, Spring Security. |
| **adapter-admin** | `games.paths.adapters.admin` | Admin management REST endpoints. |
| **adapter-websocket** | `games.paths.adapters.websocket` | WebSocket channels for real-time game state sync. |
| **adapter-postgres** | `games.paths.adapters.postgres` | PostgreSQL repositories for production. |
| **adapter-sqlite** | `games.paths.adapters.sqlite` | SQLite repositories for local development. |
| **adapter-mongo** | `games.paths.adapters.mongo` | MongoDB adapter for document registries. |
| **adapter-kafka** | `games.paths.adapters.kafka` | Kafka producer/consumer for async messaging. |
| **core** | `games.paths.core` | Domain logic, ports (`EchoPort`), services (`EchoService`). No framework dependencies. |
| **ms-launcher** | `games.paths.launcher` | Spring Boot `@SpringBootApplication`, wires all modules. |

## Profiles

| Profile | File | Port | Database | Description |
|---------|------|------|----------|-------------|
| **dev** (default) | `application-dev.yml` | 8042 | SQLite | Local development |
| **prod** | `application-prod.yml` | 8080 | PostgreSQL | Production environment |

## Database & Flyway

Both profiles use **Flyway** for automatic schema migration. Migrations run on every application startup — only new, unapplied versions are executed.
- SQLite (dev): The database file is created automatically at startup. Default path: `~/.paths.games/database.sqlite`. Override with a JVM property:
    ```bash
    mvn -pl ms-launcher spring-boot:run -Dgame.database.path=/custom/path/mydb.sqlite
    ```
- PostgreSQL (prod): Configure via environment variables (defaults shown):
    | Variable | Default | Description |
    |----------|---------|-------------|
    | `DB_HOST` | `localhost` | PostgreSQL host |
    | `DB_PORT` | `5432` | PostgreSQL port |
    | `DB_NAME` | `pathsgames` | Database name |
    | `DB_USERNAME` | `pathsgames` | Database user |
    | `DB_PASSWORD` | `pathsgames` | Database password |


## Quick Start
- Prerequisites: **Java 21+** & **Maven 3.9+**
- Build
    ```bash
    cd code/backend/java
    mvn clean install -DskipTests
    ```
- Run (dev profile)
    ```bash
    mvn -pl ms-launcher spring-boot:run
    ```
- Run (prod profile)
    ```bash
    mvn -pl ms-launcher spring-boot:run -P prod -Dspring-boot.run.profiles=prod
    ```
    - **Note**: `-P prod` activates the Maven profile (puts `adapter-postgres` on the classpath);
        - `-Dspring-boot.run.profiles=prod` activates the Spring profile (loads `application-prod.yml`).
        - Both flags are required — omitting `-P prod` causes `Cannot load driver class: org.postgresql.Driver`.
    - Run database postgres on docker:
        ```bash
        docker run --name pathsgames-postgres -p 5432:5432  -e POSTGRES_DB=pathsgames -e POSTGRES_USER=pathsgames -e POSTGRES_PASSWORD=pathsgames -d postgres:latest
        ```
- Run Tests
    ```bash
    mvn clean test
    ```
- For sonar scan run command
    ```bash
    mvn clean package && mvn sonar:sonar -Dsonar.login=<TOKEN>
    ```
- Echo API
    ```bash
    curl -s http://localhost:8042/api/echo/status | python3 -m json.tool
    ```
    - Response:
        ```json
        {
            "status": "OK",
            "timestamp": 1740049200000,
            "properties": {
                "env": "development",
                "version": "X.Y.Z-SNAPSHOT",
                "applicationName": "paths-game-backend",
                "port": "8042",
                "javaVersion": "21.0.x"
            }
        }
        ```
- API Endpoints
    | Method | Endpoint | Description |
    |--------|----------|-------------|
    | GET | `/api/echo/status` | Server status, timestamp, and properties |
    | POST | `/api/matches` | Create a new single-player match |
    | GET | `/api/matches` | List matches owned by the authenticated user |
    | GET | `/api/match/{uuid}/info` | Match runtime state (summary, location/registry state) |
    | GET | `/api/admin/matches` | List all matches on the platform (ADMIN only) — paged envelope `{items, nextCursor, limit}`; query params: `limit`, `cursor`, `status`, `userUuid`, `storyUuid`, `sinceDays` |

## Recent Fixes (Step 17 CRUD)

- **SQLite CRUD create fix**: Step 17 single-entity create endpoints now auto-assign missing scoped numeric `id` values (`id` + `id_story`) before persist. This fixes `NOT NULL` errors on create for entities like choices and missions.
- **PostgreSQL Flyway compatibility fix**: migrations `V0.10.6` → `V0.10.9` remove FK constraints that referenced non-globally-unique `list_* .id` columns after scoped-key adoption.
- **PostgreSQL JPA mapping fix**: shared `id_story` mapping in `BaseStoryEntity` is now read-only by default to avoid duplicate insert bindings in `@IdClass` entities; non-`@IdClass` entities explicitly override it.

### Validation Status (May 2026)

- Core module tests: **711 passed / 0 failed** (`mvn -pl core test -DskipITs`).
- End-to-end Robot suite (local Java + PostgreSQL): **185 passed / 0 failed** (`run_robot_with_local_java_postgres.sh`).
- End-to-end Robot suite (local Java + SQLite): **185 passed / 0 failed** (`run_robot_with_local_java.sh`).
- Step 17 admin CRUD subset in PostgreSQL run: **29 passed / 0 failed**.

### Verification Commands

- Core tests:
    ```bash
    cd code/backend/java
    mvn -pl core test -DskipITs
    ```
- Robot (SQLite / local Java):
    ```bash
    cd code/tests/robot
    python -m robot --variablefile variables/dev.yaml tests/17_admin_crud
    ```
- Robot (PostgreSQL / local Java + Docker):
    ```bash
    cd code/scripts/dev/run_robots
    ./run_robot_with_local_java_postgres.sh
    ```

## Architecture

```
┌────────────────────────────────────────────┐
│              ms-launcher                   │
│   (Spring Boot App + Configuration)        │
├────────────┬───────────┬───────────────────┤
│adapter-rest│adapter-ws │ adapter-auth      │
│ (REST API) │(WebSocket)│ (JWT/SSO)         │
├────────────┴───────────┴───────────────────┤
│                  core                      │
│        (Ports + Domain Services)           │
├────────────┬───────────┬───────────────────┤
│adapter-pg  │adapter-sql│ adapter-mongo     │
│(PostgreSQL)│ (SQLite)  │ (MongoDB)         │
└────────────┴───────────┴───────────────────┘
```




# Version Control
- Starting from 0.5.0 version, code is created with AI prompt:
    > Paths Games V1 - Step 05: Define backend module structure

- **Document Version**: 0.28.6
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.5.0 | Step 05: Define backend module structure | Feb 26, 2026 |
    | 0.10.12 | Create initial DB schema | Mar 25, 2026 |
    | 0.14.1 | Manage projects structure and 101 steps definition | April 09, 2026 |
    | 0.17.1 | Step 17 CRUD SQLite/PostgreSQL stabilization and validation | May 03, 2026 |
    | 0.19.3 | list_cards: added style_image_little/medium/large columns (Flyway V0.19.3, CardEntity, CardInfo, CardInfoResponse, OpenAPI v0.14-0.16) | May 14, 2026 |
    | 0.19.4 | list_cards: added card_type column (Flyway V0.19.4 on both adapters; CardEntity, CardInfo, CardInfoResponse, ContentController, StoryController, ContentQueryService, StoryQueryService, StoryImportService, StoryCrudService; OpenAPI v0.14-0.16) | May 14, 2026 |
    | 0.19.4 | AWS backend FK consistency: difficulties/classes/traits now persist idTextName+idTextDescription on import, matching Java BaseStoryEntity (list_stories_difficulty, list_classes, list_traits) | May 14, 2026 |
    | 0.19.7 | list_stories_difficulty: added 7 stat columns (life=100, energy=100, sad=0, dexterity=10, intelligence=10, constitution=10, weight=10) via Flyway V0.19.7 on both adapters; StoryDifficultyEntity, DifficultyInfo (builder), DifficultyResponse, StoryQueryService, StoryCrudService.applyDifficultyFields(), StoryImportService.importDifficulties(); OpenAPI v0.14.0 DifficultyResponse extended; core tests 711 pass | May 19, 2026 |
    | 0.19.9 | gaming_match: 4 loadout columns added (single_player, character_template_uuid, class_uuid, trait_uuids) via Flyway V0.19.9 on both adapters; MatchCreateRequest extended (classUuid, traitUuids, singlePlayer new; characterTemplateUuid now persisted); MatchSummary echoes loadout; MatchTraitCodec handles comma-separated trait list; OpenAPI v0.19.0-match-creation-api.yaml bumped to 0.19.9; 152 adapter-rest unit tests + core pass | May 20, 2026 |
    | 0.19.10 | GET /api/admin/matches: MatchController.listAllMatches, MatchQueryService.listAllMatches, MatchReadPort.findAllMatches, GamingMatchRepository.findAllByOrderByTsInsertDesc; OpenAPI bumped to 0.19.10; 154 adapter-rest unit tests pass | May 20, 2026 |
    | 0.28.1 | GET /api/admin/matches pagination & filtering: `MatchAdminController.listAllMatches` now reads query params (`limit`, `cursor`, `status`, `userUuid`, `storyUuid`, `sinceDays`); `MatchQueryService.listMatchesPage`; new port method `MatchReadPort.findMatchesPage(MatchPageCriteria)`; new JPQL `GamingMatchRepository.findMatchesPage` with optional filters and keyset pagination on `(ts_insert DESC, id DESC)`; new core domain types `MatchListFilter`, `MatchSummaryPage`, record `MatchPageCriteria`; new REST DTO `PagedMatchesResponse`; cursor = base64 of `"{tsInsert}|{id}"`; OpenAPI `v0.19.0-match-creation-api.yaml` extended with `PagedMatches` schema and query params; full Java test suite 1079+ pass | Jun 26, 2026 |
    | 0.28.5 | `GET /api/match/{uuid}/locations` and `GET /api/admin/matches/{uuid}/locations` now resolve a full `card` object (CardInfoResponse shape) for every visited location and every neighbor, plus an optional `?lang=` param (default `en`). `MovementPort`/`MovementService` gained a `ContentQueryPort` dependency and a `resolveCard(storyId, idCard, lang)` helper (legacy 2-arg constructor preserved); `MatchLocationsResponse` builds `card` via `CardInfoResponse.fromModel`; `MovementController`/`MatchAdminController` accept `@RequestParam lang`; `CoreConfig` wires `ContentQueryPort` into the movement bean; OpenAPI `v0.28.0-movement-api.yaml` gained the `CardInfo` schema plus `card`/`lang`. No change to location/neighbor lookup logic. `mvn clean test` BUILD SUCCESS | Jul 11, 2026 |
    | 0.28.6 | Bugfix — fog-of-war leak on neighbor location cards: v0.28.5's card enrichment exposed the card of locations never visited by the match. `MovementService.buildLocations` now nulls a neighbor's `idCard`/`card` when its destination is outside `findVisitedLocationIds`. `MatchQueryService` gained an optional 6th constructor arg `MovementStorePort` (legacy 5-arg constructor preserved, delegates with `null` = no gating); `buildLocationsActive` gained a `visitedLocIds` param and only nulls the **fallback** to the destination location's card, never an authored `idCard` link card set on the neighbor edge itself. `CoreConfig` wires `MovementStorePort` into the `matchQueryPort` bean. OpenAPI `v0.28.0-movement-api.yaml` + `v0.19.0-match-creation-api.yaml` document the nullability. New Robot suite `28_movement/location_fog_of_war.robot` (4 tests). `mvn clean test` BUILD SUCCESS (+1 `MovementServiceTest`, +3 `MatchQueryServiceLocationsActiveTest`) | Jul 11, 2026 |
    | 0.29.0 | (still v0.29.0, no version bump) Movement availability verdict on `/info`: `locationsActive[].neighbors[]` gains `available`/`reason`, the movement twin of the event verdict added in Step 29 (`EventAvailabilityChecker`). New `core/service/match/MovementAvailabilityChecker.java` — pure static function, no ports, no I/O, same 8-code order as `movements/start` (§ Validation Order: `CHARACTER_CANNOT_ACT` → `MATCH_NOT_RUNNING` → `COMA` → `SLEEPING` → `NOT_A_NEIGHBOR` → `MOVEMENT_CONDITION_NOT_MET` → `OVERWEIGHT` → `INSUFFICIENT_ENERGY` → `LOCATION_FULL`). `MovementService.startMovement` refactored to call the checker instead of its own if-chain. `MatchQueryService` loads the check context once per request and loops the checker over neighbors, no port call inside the loop. `LocationNeighborInfo`/`MatchInfoResponse` gain `available`/`reason`. OpenAPI `v0.19.0-match-creation-api.yaml` updated. No Flyway migration | Jul 13, 2026 |
- **Last Updated**: Jul 13, 2026
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




