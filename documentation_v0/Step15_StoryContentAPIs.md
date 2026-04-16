# Step 15 — Story Content APIs: Categories and Groups

This document describes the implementation of **Step 15: Story Content APIs — Categories and Groups** from the [Roadmap](./Step00_Roadmap.md).

## Summary

| Item | Detail |
|------|--------|
| **Step** | 15 |
| **Goal** | Add category/group browsing endpoints and enrich story detail with character templates, classes, traits, and card |
| **Pattern** | Hexagonal Architecture (Ports & Adapters) |
| **Database** | Reuses existing 23 JPA entity tables (no new tables) |
| **New endpoints** | 4 public REST endpoints for categories and groups |
| **Enriched endpoint** | GET `/api/stories/{uuid}` now includes character templates, classes, traits, card, and counts |
| **Auth** | All endpoints are public (no authentication required) |


## Sub-steps completed

| # | Sub-step | Description |
|---|----------|-------------|
| 15.1 | Create domain models | `CharacterTemplateInfo`, `ClassInfo`, `TraitInfo`, `CardInfo` builders |
| 15.2 | Enrich StoryDetail | Added characterTemplates, classes, traits, card, classCount, characterTemplateCount, traitCount |
| 15.3 | Extend repositories | JPQL queries for distinct categories/groups, derived queries for filtering |
| 15.4 | Extend hexagonal ports | 8 new outbound methods on `StoryReadPort`, 4 new inbound methods on `StoryQueryPort` |
| 15.5 | Implement persistence adapter | `StoryReadAdapter` wired with 4 additional repositories |
| 15.6 | Implement domain service | `StoryQueryService` with category/group listing and enhanced detail resolution |
| 15.7 | Create REST DTOs and controller | 4 new DTOs, 4 new endpoints, enriched detail mapping |
| 15.8 | Write comprehensive unit tests | Domain model, service, controller tests with 100% branch coverage |


## Architecture

This step extends the existing hexagonal architecture from Step 14. No new modules are created — all changes are within `core` and `adapter-rest`:

```
┌───────────────────────────────────────────────────────────────────┐
│                          core module                              │
│  ┌────────────────────────┐  ┌─────────────────────────────────┐  │
│  │ Domain Models          │  │   Services                      │  │
│  │  CharacterTemplateInfo │  │   StoryQueryService (enhanced)  │  │
│  │  ClassInfo             │  │     + listCategories()          │  │
│  │  TraitInfo             │  │     + listStoriesByCategory()   │  │
│  │  CardInfo              │  │     + listGroups()              │  │
│  │  StoryDetail (updated) │  │     + listStoriesByGroup()      │  │
│  └────────────────────────┘  │     + enriched getStoryByUuid() │  │
│  ┌────────────────────────┐  └─────────────────────────────────┘  │
│  │ Ports (modified)       │  ┌─────────────────────────────────┐  │
│  │  StoryQueryPort (+4)   │  │   StoryReadAdapter (enhanced)   │  │
│  │  StoryReadPort (+8)    │  │   + CharacterTemplateRepository │  │
│  └────────────────────────┘  │   + ClassRepository             │  │
│                              │   + TraitRepository             │  │
│                              │   + CardRepository              │  │
│                              └─────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┘
          ▼
┌──────────────────┐
│   adapter-rest   │
│                  │
│ StoryController  │
│ (4 new endpoints)│
│ New DTOs:        │
│  CharacterTemp.  │
│  ClassInfo       │
│  TraitInfo       │
│  CardInfo        │
└──────────────────┘
```


## API Endpoints

### New Endpoints (Step 15)

#### GET `/api/stories/categories` — List Story Categories

Returns distinct categories from all publicly visible stories.

**Response (200 OK):**
```json
["adventure", "horror", "sci-fi"]
```

#### GET `/api/stories/category/{category}` — List Stories by Category

Returns all publicly visible stories matching the given category.

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `category` | string | Category name to filter by |

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

#### GET `/api/stories/groups` — List Story Groups

Returns distinct groups from all publicly visible stories.

**Response (200 OK):**
```json
["dark", "fantasy", "classic"]
```

#### GET `/api/stories/group/{group}` — List Stories by Group

Returns all publicly visible stories matching the given group.

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `group` | string | Group name to filter by |

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `lang` | string | `en` | Language code for text resolution |

**Response (200 OK):** Same format as list by category.


### Enhanced Endpoint

#### GET `/api/stories/{uuid}` — Get Story Details (enriched)

Now returns additional fields: character templates, classes, traits, card info, and entity counts.

**New fields in response:**

| Field | Type | Description |
|-------|------|-------------|
| `classCount` | int | Number of character classes in the story |
| `characterTemplateCount` | int | Number of character templates in the story |
| `traitCount` | int | Number of character traits in the story |
| `characterTemplates` | array | List of character template summaries |
| `classes` | array | List of class summaries |
| `traits` | array | List of trait summaries |
| `card` | object\|null | Story card visual info (null if no card assigned) |

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
  "classCount": 3,
  "characterTemplateCount": 4,
  "traitCount": 6,
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
  ],
  "characterTemplates": [
    {
      "uuid": "ct-uuid-1",
      "name": "Warrior",
      "description": "Strong melee fighter",
      "lifeMax": 20,
      "energyMax": 10,
      "sadMax": 5,
      "dexterityStart": 2,
      "intelligenceStart": 1,
      "constitutionStart": 3
    }
  ],
  "classes": [
    {
      "uuid": "class-uuid-1",
      "name": "Knight",
      "description": "Noble warrior class",
      "weightMax": 15,
      "dexterityBase": 2,
      "intelligenceBase": 1,
      "constitutionBase": 3
    }
  ],
  "traits": [
    {
      "uuid": "trait-uuid-1",
      "name": "Brave",
      "description": "Fearless in battle",
      "costPositive": 2,
      "costNegative": 0,
      "idClassPermitted": null,
      "idClassProhibited": null
    }
  ],
  "card": {
    "uuid": "card-uuid-1",
    "imageUrl": "https://example.com/card.png",
    "alternativeImage": "Kingdom card",
    "awesomeIcon": "fa-crown",
    "styleMain": "bg-primary",
    "styleDetail": "text-light",
    "title": "The Lost Kingdom"
  }
}
```


## DTOs (Data Transfer Objects)

### New REST DTOs (adapter-rest)

| Class | Fields | Purpose |
|-------|--------|---------|
| `CharacterTemplateResponse` | uuid, name, description, lifeMax, energyMax, sadMax, dexterityStart, intelligenceStart, constitutionStart | Character template in story detail |
| `ClassInfoResponse` | uuid, name, description, weightMax, dexterityBase, intelligenceBase, constitutionBase | Character class in story detail |
| `TraitInfoResponse` | uuid, name, description, costPositive, costNegative, idClassPermitted, idClassProhibited | Character trait in story detail |
| `CardInfoResponse` | uuid, imageUrl, alternativeImage, awesomeIcon, styleMain, styleDetail, title | Visual card in story detail |

### Updated REST DTO

| Class | New Fields | Purpose |
|-------|------------|---------|
| `StoryDetailResponse` | classCount, characterTemplateCount, traitCount, characterTemplates (list), classes (list), traits (list), card (object) | Enriched story view |


## Roles and Permissions

| Endpoint | Method | Auth Required | Role Required |
|----------|--------|---------------|---------------|
| `/api/stories/categories` | GET | No | — |
| `/api/stories/category/{category}` | GET | No | — |
| `/api/stories/groups` | GET | No | — |
| `/api/stories/group/{group}` | GET | No | — |
| `/api/stories/{uuid}` | GET | No | — (enriched response) |

All new endpoints are covered by the existing `public-paths` configuration:
```yaml
app:
  security:
    public-paths: /api/echo/**,/api/auth/**,/api/stories,/api/stories/**
```


## Database Tables

No new tables are created. This step reuses existing tables from Step 14:

| Table | Entity | Step 15 Usage |
|-------|--------|---------------|
| `list_stories` | `StoryEntity` | Category/group queries, card ID reference |
| `list_character_templates` | `CharacterTemplateEntity` | Character template listing in detail |
| `list_classes` | `ClassEntity` | Class listing in detail |
| `list_traits` | `TraitEntity` | Trait listing in detail |
| `list_cards` | `CardEntity` | Card resolution by story + card ID |
| `list_texts` | `TextEntity` | Name/description resolution for templates, classes, traits |

### Key Queries Added

| Repository | Method | Query |
|------------|--------|-------|
| `StoryRepository` | `findDistinctCategoriesByVisibility` | JPQL: `SELECT DISTINCT s.category FROM StoryEntity s WHERE s.visibility = ?1 AND s.category IS NOT NULL` |
| `StoryRepository` | `findDistinctGroupsByVisibility` | JPQL: `SELECT DISTINCT s.group FROM StoryEntity s WHERE s.visibility = ?1 AND s.group IS NOT NULL` |
| `StoryRepository` | `findByCategoryAndVisibilityOrderByPriorityDesc` | Derived query |
| `StoryRepository` | `findByGroupAndVisibilityOrderByPriorityDesc` | Derived query |
| `CardRepository` | `findByIdStoryAndId` | Lookup card by story ID and card PK |


## Test Cases

### Domain Model Tests
| Test Class | Tests | Coverage |
|------------|-------|----------|
| `CharacterTemplateInfoTest` | Build success, null optional fields, default int values | 100% branches |
| `ClassInfoTest` | Build success, null optional fields, default int values | 100% branches |
| `TraitInfoTest` | Build success, null optional fields, default int values, null Integer fields, non-null Integer fields | 100% branches |
| `CardInfoTest` | Build success, all null fields, default fields | 100% branches |
| `StoryDetailTest` (updated) | + Step 15 fields, null lists default, immutable characterTemplates/classes/traits, default counts | 100% branches |

### Service Tests
| Test Class | Tests | Coverage |
|------------|-------|----------|
| `StoryQueryServiceTest` (updated) | + ListCategories (success, empty), ListStoriesByCategory (success, null, blank, noMatches), ListGroups (success, empty), ListStoriesByGroup (success, null, blank, noMatches), GetStoryByUuid enriched (all entities, noCard, cardNotFound, nullFields per entity type, emptySubEntities) | 100% branches |

### Controller Tests
| Test Class | Tests | Coverage |
|------------|-------|----------|
| `StoryControllerTest` (updated) | + GET /categories (success, empty), GET /category/{category} (success, empty, lang param, default lang), GET /groups (success, empty), GET /group/{group} (success, empty, lang param, default lang), GET /{uuid} (enriched success, empty lists + null card) | 100% branches |


## Business Logic

### Category and Group Listing
The `StoryQueryService` provides category and group browsing:
1. **`listCategories()`** — Delegates to `StoryReadPort.findDistinctCategoriesByVisibility("PUBLIC")`. Returns distinct non-null category values from all public stories.
2. **`listGroups()`** — Same pattern for group field.
3. **`listStoriesByCategory(category, lang)`** — Validates input: returns empty list for null/blank category. Otherwise delegates to `StoryReadPort.findStoriesByCategoryAndVisibility()` and maps results to `StorySummary` using text resolution.
4. **`listStoriesByGroup(group, lang)`** — Same pattern for group filtering.

### Enriched Story Detail
When `getStoryByUuid()` is called, the service now resolves additional entities:
1. **Character Templates** — Fetches all `CharacterTemplateEntity` for the story, resolves name/description via text system, maps to `CharacterTemplateInfo` with null-safe defaults (0 for int fields).
2. **Classes** — Fetches all `ClassEntity`, resolves name/description, maps to `ClassInfo`.
3. **Traits** — Fetches all `TraitEntity`, resolves name/description, maps to `TraitInfo`.
4. **Card** — If `StoryEntity.idCard` is not null, looks up `CardEntity` by `(idStory, idCard)`. Resolves title via text system. Returns `null` if card not found.
5. **Entity Counts** — `classCount`, `characterTemplateCount`, `traitCount` are derived from repository count queries.

### Text Resolution for Sub-entities
Character templates, classes, and traits all follow the same text resolution pattern:
1. Use `idTextName` field → resolve via `TextEntity` with language fallback
2. Use `idTextDescription` field → resolve via `TextEntity` with language fallback
3. If text entity not found, field defaults to `null`

### Card Resolution
The card uses `idTextName` for title resolution. Other card fields (`imageUrl`, `alternativeImage`, `awesomeIcon`, `styleMain`, `styleDetail`) are taken directly from the `CardEntity` entity (no text resolution needed).


## File Structure

### New Files
```
core/src/main/java/games/paths/core/model/story/
├── CharacterTemplateInfo.java
├── ClassInfo.java
├── TraitInfo.java
└── CardInfo.java

adapter-rest/src/main/java/games/paths/adapters/rest/dto/
├── CharacterTemplateResponse.java
├── ClassInfoResponse.java
├── TraitInfoResponse.java
└── CardInfoResponse.java

adapter-rest/src/main/resources/openapi/
└── v0.15.0-story-content-api.yaml

core/src/test/java/games/paths/core/model/story/
├── CharacterTemplateInfoTest.java
├── ClassInfoTest.java
├── TraitInfoTest.java
└── CardInfoTest.java
```

### Modified Files
```
core/src/main/java/games/paths/core/
├── model/story/StoryDetail.java           (+ new fields and builder methods)
├── repository/story/StoryRepository.java  (+ 4 new queries)
├── repository/story/CardRepository.java   (+ findByIdStoryAndId)
├── port/story/StoryReadPort.java          (+ 8 new methods)
├── port/story/StoryQueryPort.java         (+ 4 new methods)
├── persistence/story/StoryReadAdapter.java (+ 4 new repository injections)
└── service/story/StoryQueryService.java   (+ category/group logic, enriched detail)

adapter-rest/src/main/java/games/paths/adapters/rest/
├── controller/story/StoryController.java  (+ 4 new endpoints, enriched mapping)
└── dto/StoryDetailResponse.java           (+ new fields)

core/src/test/java/games/paths/core/
├── model/story/StoryDetailTest.java       (+ Step 15 field tests)
└── service/story/StoryQueryServiceTest.java (+ comprehensive Step 15 tests)

adapter-rest/src/test/java/games/paths/adapters/rest/
└── controller/story/StoryControllerTest.java (+ 4 new endpoint test sections)
```


## OpenAPI Documentation

Full API specification: `adapter-rest/src/main/resources/openapi/v0.15.0-story-content-api.yaml`


## Version Control
- First version created with AI prompts:
    > Set Step/XX=15. write all java backend code into 'code/backend/java' project using JPA, never add new module, complete all unit-test using mokito to cover 100% of branches-case. write new md file inside documentation_v0 folder with all details, write a section with (endpoint apis, DTO, roles, tables, test cases and business logic). add (or update) openapi documentation into '/code/backend/java/adapter-rest/src/main/resources/openapi' folder with new/changed api. create a new simple web example to use new interfaces inside new code/website/concepts_v0/ folder. add new folder inside 'code/tests/robot/test' and write new robot-framework test. don't look and don't change 'backend/python', 'backend/php', 'backend/aws' and others concepts folder into 'website'

- **Document Version**: 0.15.0
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.15.0 | Story content APIs: categories, groups, enriched detail | April 16, 2026 |
- **Last Updated**: April 16, 2026
- **Status**: In progress




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
