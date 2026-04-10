# Step 14 — Story Import System and Data Seeding

This document describes the implementation of **Step 14: Story Import System and Data Seeding** from the [Roadmap](./Step00_Roadmap.md).

## Summary

| Item | Detail |
|------|--------|
| **Step** | 14 |
| **Goal** | Import complete stories from JSON, public story catalogue, admin management |
| **Pattern** | Hexagonal Architecture (Ports & Adapters) |
| **Database** | 23 JPA entity tables for story data |
| **Text system** | Multi-language with English fallback |
| **Import mode** | Replace-on-conflict (delete existing + re-import) |
| **Public API** | Story listing and detail retrieval (no auth required) |
| **Admin API** | Story import, listing, and deletion (ADMIN role required) |


## Sub-steps completed

| # | Sub-step | Description |
|---|----------|-------------|
| 14.1 | Define JPA entities | 23 entity classes mapping to Flyway-managed `list_*` tables |
| 14.2 | Create Spring Data repositories | 23 repository interfaces with custom query methods |
| 14.3 | Design domain models | `StorySummary`, `StoryDetail`, `DifficultyInfo`, `StoryImportResult` builders |
| 14.4 | Define hexagonal ports | `StoryQueryPort`, `StoryImportPort` (inbound), `StoryReadPort`, `StoryPersistencePort` (outbound) |
| 14.5 | Implement domain services | `StoryQueryService` (text resolution + fallback), `StoryImportService` (import + delete) |
| 14.6 | Create REST and Admin controllers | Public story endpoints + admin import/delete endpoints |
| 14.7 | Write comprehensive unit tests | Domain model, service, persistence adapter, controller, and DTO tests |


## Architecture

Following the project's **Hexagonal Architecture** — JPA entities and repositories reside in the `core` module alongside domain logic:

```
┌───────────────────────────────────────────────────────────────────┐
│                          core module                              │
│  ┌───────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Domain Models     │  │   Services                           │  │
│  │  StorySummary     │  │   StoryQueryService → StoryQueryPort │  │
│  │  StoryDetail      │  │  StoryImportService → StoryImportPort│  │
│  │  DifficultyInfo   │  │   (pure domain logic)                │  │
│  │  StoryImportResult│  │                                      │  │
│  └───────────────────┘  └──────────────────────────────────────┘  │
│  ┌───────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Ports (inbound)   │  │   Ports (outbound)                   │  │
│  │  StoryQueryPort   │  │   StoryReadPort                      │  │
│  │  StoryImportPort  │  │   StoryPersistencePort               │  │
│  └───────────────────┘  └──────────────────────────────────────┘  │
│  ┌───────────────────┐  ┌──────────────────────────────────────┐  │
│  │ JPA Entities      │  │   Persistence Adapters               │  │
│  │  23 @Entity       │  │   StoryReadAdapter → StoryReadPort   │  │
│  │  classes          │  │   StoryPersistenceAdapter            │  │
│  └───────────────────┘  │     → StoryPersistencePort           │  │
│  ┌──────────────────┐   └──────────────────────────────────────┘  │
│  │ JPA Repositories │                                             │
│  │  23 interfaces   │                                             │
│  └──────────────────┘                                             │
└───────────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────────┐
          ▼                ▼                    ▼
┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐
│ adapter-rest │  │  adapter-admin  │  │   ms-launcher    │
│              │  │                 │  │                  │
│ StoryCtrl    │  │ StoryAdminCtrl  │  │ CoreConfig       │
│ (public)     │  │ (ADMIN only)    │  │ (bean wiring)    │
│ DTOs:        │  │ StoryImportResp │  │ application.yml  │
│  Summary     │  │                 │  │ (public paths)   │
│  Detail      │  │                 │  │                  │
│  Difficulty  │  │                 │  │                  │
└──────────────┘  └─────────────────┘  └──────────────────┘
```


## API Endpoints

### Public Endpoints (no authentication required)

#### GET `/api/stories` — List Public Stories

Returns all publicly visible stories, ordered by priority descending.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `lang` | string | `en` | Language code for text resolution |

**Response (200 OK):**
```json
[
  {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "title": "The Lost Kingdom",
    "description": "An adventure in a forgotten realm",
    "author": "GameMaster",
    "category": "adventure",
    "group": "fantasy",
    "visibility": "PUBLIC",
    "priority": 5,
    "peghi": 2,
    "difficultyCount": 3
  }
]
```

#### GET `/api/stories/{uuid}` — Get Story Details

Returns the full detail of a single story by UUID.

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `uuid` | string | Story UUID |

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `lang` | string | `en` | Language code for text resolution |

**Response (200 OK):**
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "title": "The Lost Kingdom",
  "description": "An adventure in a forgotten realm",
  "author": "GameMaster",
  "category": "adventure",
  "group": "fantasy",
  "visibility": "PUBLIC",
  "priority": 5,
  "peghi": 2,
  "versionMin": "0.10",
  "versionMax": "1.0",
  "clockSingularDescription": "hour",
  "clockPluralDescription": "hours",
  "copyrightText": "© 2025 GameMaster",
  "linkCopyright": "https://example.com",
  "locationCount": 15,
  "eventCount": 42,
  "itemCount": 8,
  "difficulties": [
    {
      "uuid": "diff-easy-uuid",
      "description": "Easy mode",
      "expCost": 5,
      "maxWeight": 10,
      "minCharacter": 1,
      "maxCharacter": 4,
      "costHelpComa": 3,
      "costMaxCharacteristics": 3,
      "numberMaxFreeAction": 1
    }
  ]
}
```

**Response (404 Not Found):**
```json
{
  "error": "STORY_NOT_FOUND",
  "message": "No story found with UUID: unknown-uuid"
}
```

### Admin Endpoints (ADMIN role required)

#### POST `/api/admin/stories/import` — Import Story

Imports a complete story from a JSON body. If a story with the same UUID already exists, it is fully deleted and re-imported (replace-on-conflict). If UUID is null/blank, a new one is auto-generated.

**Request Body:** Structured JSON with story header fields plus nested arrays for sub-entities (texts, difficulties, locations, events, items, choices, classes, creators, cards, keys, traits, character templates, weather rules, global random events, missions).

**Response (201 Created):**
```json
{
  "storyUuid": "550e8400-e29b-41d4-a716-446655440000",
  "status": "IMPORTED",
  "textsImported": 25,
  "locationsImported": 15,
  "eventsImported": 42,
  "itemsImported": 8,
  "difficultiesImported": 3,
  "classesImported": 5,
  "choicesImported": 20
}
```

**Response (400 Bad Request):**
```json
{
  "error": "EMPTY_IMPORT_DATA",
  "message": "Request body must contain story data"
}
```

#### GET `/api/admin/stories` — List All Stories

Returns all stories regardless of visibility. Same response format as `GET /api/stories`.

#### DELETE `/api/admin/stories/{uuid}` — Delete Story

Deletes a story and all related data in cascading order.

**Response (200 OK):**
```json
{
  "status": "DELETED",
  "uuid": "550e8400-e29b-41d4-a716-446655440000"
}
```


## DTOs (Data Transfer Objects)

### REST DTOs (adapter-rest)

| Class | Fields | Purpose |
|-------|--------|---------|
| `StorySummaryResponse` | uuid, title, description, author, category, group, visibility, priority, peghi, difficultyCount | Catalogue list entry |
| `StoryDetailResponse` | All summary fields + versionMin, versionMax, clock descriptions, copyright, location/event/item counts, difficulties list | Full story view |
| `DifficultyResponse` | uuid, description, expCost, maxWeight, min/maxCharacter, costHelpComa, costMaxCharacteristics, numberMaxFreeAction | Difficulty level detail |

### Admin DTOs (adapter-admin)

| Class | Fields | Purpose |
|-------|--------|---------|
| `StoryImportResponse` | storyUuid, status, textsImported, locationsImported, eventsImported, itemsImported, difficultiesImported, classesImported, choicesImported | Import operation result |


## Roles and Permissions

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/stories` | GET | No | — |
| `/api/stories/{uuid}` | GET | No | — |
| `/api/admin/stories/import` | POST | Yes | ADMIN |
| `/api/admin/stories` | GET | Yes | ADMIN |
| `/api/admin/stories/{uuid}` | DELETE | Yes | ADMIN |

Public paths configured in `application.yml`:
```yaml
app:
  security:
    public-paths: /api/echo/**,/api/auth/**,/api/stories,/api/stories/**
```


## Database Tables

23 tables used by the story import system, all created by Flyway migrations (V0.10.2–V0.10.5, V0.10.12):

| # | Table | Entity | Description |
|---|-------|--------|-------------|
| 1 | `list_stories` | `StoryEntity` | Story header (author, visibility, version, clock, etc.) |
| 2 | `list_stories_difficulty` | `StoryDifficultyEntity` | Difficulty levels per story |
| 3 | `list_texts` | `TextEntity` | Multi-language text strings (unique: story + id_text + lang) |
| 4 | `list_keys` | `KeyEntity` | Story key-value pairs |
| 5 | `list_classes` | `ClassEntity` | Character classes |
| 6 | `list_classes_bonus` | `ClassBonusEntity` | Class bonuses |
| 7 | `list_traits` | `TraitEntity` | Character traits |
| 8 | `list_character_templates` | `CharacterTemplateEntity` | Pre-built character templates (PK: `id_tipo`) |
| 9 | `list_locations` | `LocationEntity` | Game locations |
| 10 | `list_locations_neighbors` | `LocationNeighborEntity` | Location adjacency graph |
| 11 | `list_items` | `ItemEntity` | Inventory items |
| 12 | `list_items_effects` | `ItemEffectEntity` | Item usage effects |
| 13 | `list_weather_rules` | `WeatherRuleEntity` | Weather system rules |
| 14 | `list_events` | `EventEntity` | Game events |
| 15 | `list_events_effects` | `EventEffectEntity` | Event outcomes |
| 16 | `list_choices` | `ChoiceEntity` | Player choices |
| 17 | `list_choices_conditions` | `ChoiceConditionEntity` | Choice prerequisites |
| 18 | `list_choices_effects` | `ChoiceEffectEntity` | Choice outcomes |
| 19 | `list_global_random_events` | `GlobalRandomEventEntity` | Random event triggers |
| 20 | `list_missions` | `MissionEntity` | Quests/missions |
| 21 | `list_missions_steps` | `MissionStepEntity` | Mission progress steps |
| 22 | `list_creator` | `CreatorEntity` | Content creators |
| 23 | `list_cards` | `CardEntity` | Display cards |

**Cascading delete order** (reverse dependency): mission_steps → missions → global_random_events → choice_effects → choice_conditions → choices → event_effects → events → weather_rules → item_effects → items → location_neighbors → locations → character_templates → traits → class_bonuses → classes → keys → cards → creators → texts → difficulties → story


## Test Cases

### Domain Model Tests
| Test Class | Tests | Coverage |
|------------|-------|----------|
| `StorySummaryTest` | Build success, null optional fields, null/blank/empty UUID validation | 100% branches |
| `StoryDetailTest` | Build success, null difficulties default, immutable list, null optional fields, null/blank/empty UUID validation | 100% branches |
| `DifficultyInfoTest` | Build success, null optional fields, default int values | 100% branches |
| `StoryImportResultTest` | Build success, default counts, null/blank/empty storyUuid validation, null/blank/empty status validation | 100% branches |

### Service Tests
| Test Class | Tests | Coverage |
|------------|-------|----------|
| `StoryQueryServiceTest` | List public (empty, with stories, null priority/peghi), list all, get by UUID (null, blank, not found, success with difficulties, language fallback, no text at all, English not found, null lang, difficulty null fields) | 100% branches |
| `StoryImportServiceTest` | Import (null data, empty data, minimal auto-UUID, replace existing, all sub-entities, empty lists, blank UUID, non-list sub-entities, string-to-integer parsing, text null lang), delete (null, blank, not found, success), listStoryUuids | 100% branches |

### Persistence Adapter Tests
| Test Class | Tests | Coverage |
|------------|-------|----------|
| `StoryPersistenceAdapterTest` | 23 save operations (one per repository), findStoryByUuid (found/not found), deleteStoryData (verifies correct reverse-dependency deletion order via InOrder) | 100% delegation |
| `StoryReadAdapterTest` | findStoriesByVisibility, findAllStories, findStoryByUuid (found/not found), findDifficulties, findTextsByStoryAndIdText, findTextByLang (found/not found), countLocations, countEvents, countItems | 100% delegation |

### Controller Tests
| Test Class | Tests | Coverage |
|------------|-------|----------|
| `StoryControllerTest` | GET /api/stories (empty, with results, with lang param, default lang), GET /api/stories/{uuid} (success, not found, with lang, JSON content type, empty difficulties) | 100% branches |
| `StoryAdminControllerTest` | POST import (success 201, empty body 400, invalid data 400), GET list all (success, empty, with lang), DELETE (success 200, not found 404) | 100% branches |

### DTO Tests
| Test Class | Tests | Coverage |
|------------|-------|----------|
| `StorySummaryResponseTest` | All-args constructor, no-arg + setters | 100% |
| `StoryDetailResponseTest` | Setters/getters, default values | 100% |
| `DifficultyResponseTest` | All-args constructor, no-arg + setters | 100% |
| `StoryImportResponseTest` | All-args constructor, no-arg + setters, default values | 100% |


## Business Logic

### Text Resolution
The `StoryQueryService` resolves text fields through the `list_texts` table:
1. Look up text by `(id_story, id_text, lang)` using the requested language
2. If not found and lang ≠ "en", fallback to English: `(id_story, id_text, "en")`
3. If still not found, return `null`
4. If `lang` parameter is null or blank, default to "en"

### Story Import Flow
The `StoryImportService` processes a structured JSON map:
1. Extract UUID from data (auto-generate if null/blank)
2. Check if story exists by UUID → if yes, **cascade-delete** all data
3. Save `StoryEntity` to get the generated primary key
4. Import texts and update story text ID references
5. Import all 14 sub-entity types in order
6. Return `StoryImportResult` with counts

### Cascading Delete
When a story is deleted, all 22 sub-tables are cleared in reverse foreign-key dependency order before the story row itself is removed. This prevents constraint violations.

### Default Values for Difficulty Fields
When difficulty integer fields are null in the database, the following defaults are applied:
| Field | Default |
|-------|---------|
| `expCost` | 5 |
| `maxWeight` | 10 |
| `minCharacter` | 1 |
| `maxCharacter` | 4 |
| `costHelpComa` | 3 |
| `costMaxCharacteristics` | 3 |
| `numberMaxFreeAction` | 1 |


## File Structure

```
core/src/main/java/games/paths/core/
├── entity/story/          (23 JPA entities)
├── repository/story/      (23 Spring Data repositories)
├── model/story/           (StorySummary, StoryDetail, DifficultyInfo, StoryImportResult)
├── port/story/            (StoryQueryPort, StoryImportPort, StoryReadPort, StoryPersistencePort)
├── service/story/         (StoryQueryService, StoryImportService)
└── persistence/story/     (StoryPersistenceAdapter, StoryReadAdapter)

adapter-rest/src/main/java/games/paths/adapters/rest/
├── controller/story/      (StoryController)
└── dto/                   (StorySummaryResponse, StoryDetailResponse, DifficultyResponse)

adapter-admin/src/main/java/games/paths/adapters/admin/
├── controller/story/      (StoryAdminController)
└── dto/story/             (StoryImportResponse)

adapter-rest/src/main/resources/openapi/
└── v0.14.0-story-api.yaml

ms-launcher/src/main/java/games/paths/launcher/
├── CoreConfig.java        (bean wiring: storyQueryPort, storyImportPort)
└── resources/application.yml  (public paths updated)
```


## OpenAPI Documentation

Full API specification: `adapter-rest/src/main/resources/openapi/v0.14.0-story-api.yaml`


## Version Control
- First version created with AI prompts:
    > about my project (documentation into documentation_v0 folder), i wanna start build a prototipe of game website, I wanna user React, Vite & Tailwind & bootstrap5 & font-awesome. start a big project. I've a home page with stories list, when user click on an active story, show a modal with story details and a button "start", the start is a locations list with a actions list. read my actual website "/pathsgames/code/website/html"  and use same color/style/actions. write all code into  new folder "pathsgames/code/website/concepts_v0/v0.14.0-prototype" and write me a complete README.md file with all tecnical details. never change file outside new folder  

    > ciao, read all "documentation_v0" for context, i wanna change my roadmap file, now I've 42 step, 13 already done and i started to work to step 14,  I wanna change my roadmap to be 101 step, 14 step should be stories management, from 14 to 42 should be single-player game system with only guess login, I would 42 step be "launch beta version with guess and single player game". since 43 to 84 "multiplayer game with credential login" with all multiplayer systems and game engine. since 85 to 101 test and launch system. all step with 7 subpoint , subpoint for backend and frontend too, add unit test into frontend and backend. 

    > write all java backend code into code/backend/java project using JPA, complete all unit-test using mockito to cover 100% of branches-case. write new md file inside documentation_v0 folder with all details, write a section with (endpoint apis, DTO, roles, tables, test cases and business logic). update/write openapi documentation into '/code/backend/java/adapter-rest/src/main/resources/openapi' folder with new/changed api. create a simple web example to use new interfaces inside new code/website/concepts_v0/v0.14.0/ folder, use 'code/website/concepts_v0/v0.14.0-admin/' folder for admin sections

    > You've done an amazing job. Now I want a database script in the db/migration/dev folder to create two complete stories. Please write complete stories with 12 locations each; every component should have 3 or more elements. Also, write 2 additional stories in JSON format so that I can test the import functionality. The first story should be inspired by the Witcher series, the second by One Piece, the third by Star Trek, and the fourth by Ranma. Write json file into "/mnt/Dati4/Workspace/pathsgames/code/backend/java/adapter-sqlite/src/main/resources/db/migration/dev" folder  

    > read all documentation and create /code/test/robot with robot-test-framework components to test all API
    
    > sonar tell me Coverage at 72.4% and Duplications at 15.9%, please check and resolve!


- **Document Version**: 0.14.3
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.14.0 | Create a website new prototype with React and Vite | April 8, 2026 |
    | 0.14.1 | Manage projects structure and 101 steps definition | April 9, 2026 |
    | 0.14.2 | Full backend implementation: JPA entities, services, API, tests | April 10, 2026 |
    | 0.14.3 | Create robot-test-framework components to test all APIs | April 10, 2026 | 
- **Last Updated**: April 10, 2026
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




