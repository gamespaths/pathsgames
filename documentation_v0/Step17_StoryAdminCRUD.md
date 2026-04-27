# Paths Games V1 - Step 17: Story Admin CRUD Endpoints

This document defines the **admin CRUD endpoints** for managing all story-related entities. These endpoints complement the existing bulk import system (Step 14) by providing granular create, read, update, and delete operations for individual entities within a story.

## 1. Overview

Step 17 introduces a **generic CRUD controller** pattern that handles all 21+ story entity types through a unified REST API. All endpoints require ADMIN role authentication.

### Architecture

```
┌─────────────────────────────────────────────────┐
│               adapter-admin                      │
│  StoryCrudAdminController                        │
│  (generic CRUD for all entity types)             │
│  /api/admin/stories/{uuidStory}/{entityType}     │
└──────────────────┬──────────────────────────────┘
                   │ uses
                   ▼
┌─────────────────────────────────────────────────┐
│                    core                          │
│  StoryCrudPort (inbound port interface)          │
│  StoryCrudService (domain service impl)          │
│  StoryReadPort / StoryPersistencePort (outbound) │
└─────────────────────────────────────────────────┘
```

## 2. Endpoint APIs

All endpoints are secured under `/api/admin/` path prefix (requires ADMIN JWT).

### 2.1 Story-Level Endpoints

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | `/api/admin/stories` | 201/400 | Create a new story |
| GET | `/api/admin/stories/{uuid}` | 200/404 | Get single story metadata (for editor) |
| PUT | `/api/admin/stories/{uuidStory}` | 200/404/400 | Update story metadata |
| GET | `/api/admin/stories` | 200 | List all stories (existing) |
| DELETE | `/api/admin/stories/{uuid}` | 200/404 | Delete story (existing) |

### 2.2 Sub-Entity CRUD Pattern

All sub-entity endpoints follow this pattern:

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/admin/stories/{uuidStory}/{entityType}` | 200/404 | List all entities of type |
| GET | `/api/admin/stories/{uuidStory}/{entityType}/{entityUuid}` | 200/404 | Get single entity |
| POST | `/api/admin/stories/{uuidStory}/{entityType}` | 201/404/400 | Create new entity |
| PUT | `/api/admin/stories/{uuidStory}/{entityType}/{entityUuid}` | 200/404/400 | Update entity |
| DELETE | `/api/admin/stories/{uuidStory}/{entityType}/{entityUuid}` | 200/404 | Delete entity |

### 2.3 Entity Type Routes

| Entity Type | Route Segment | Table |
|-------------|---------------|-------|
| Difficulties | `difficulties` | `list_stories_difficulty` |
| Locations | `locations` | `list_locations` |
| Location Neighbors | `location-neighbors` | `list_locations_neighbors` |
| Keys | `keys` | `list_keys` |
| Events | `events` | `list_events` |
| Event Effects | `event-effects` | `list_events_effects` |
| Choices | `choices` | `list_choices` |
| Choice Conditions | `choice-conditions` | `list_choices_conditions` |
| Choice Effects | `choice-effects` | `list_choices_effects` |
| Items | `items` | `list_items` |
| Item Effects | `item-effects` | `list_items_effects` |
| Weather Rules | `weather-rules` | `list_weather_rules` |
| Global Random Events | `global-random-events` | `list_global_random_events` |
| Character Templates | `character-templates` | `list_character_templates` |
| Classes | `classes` | `list_classes` |
| Class Bonuses | `class-bonuses` | `list_classes_bonus` |
| Traits | `traits` | `list_traits` |
| Texts | `texts` | `list_texts` |
| Cards | `cards` | `list_cards` |
| Creators | `creators` | `list_creator` |
| Missions | `missions` | `list_missions` |
| Mission Steps | `mission-steps` | `list_missions_steps` |

## 3. DTOs

### 3.1 Request Body (Generic Map)

All CRUD endpoints accept a generic `Map<String, Object>` JSON body. Field names match the entity's camelCase Java property names.

Example: Create a location
```json
{
  "idTextName": 101,
  "idTextDescription": 102,
  "isSafe": 1,
  "costEnergyEnter": 2,
  "counterTime": null,
  "maxCharacters": 100
}
```

### 3.2 Response Body

Responses return the entity as a flat JSON map including base fields:

```json
{
  "uuid": "generated-uuid-v4",
  "idStory": 1,
  "idCard": null,
  "idTextName": 101,
  "idTextDescription": 102,
  "tsInsert": "2026-04-24T13:00:00Z",
  "tsUpdate": "2026-04-24T13:00:00Z",
  "isSafe": 1,
  "costEnergyEnter": 2
}
```

### 3.3 Error Response

```json
{
  "error": "STORY_NOT_FOUND | ENTITY_NOT_FOUND | EMPTY_IMPORT_DATA",
  "message": "Human-readable description"
}
```

## 4. Roles

| Role | Access |
|------|--------|
| ADMIN | Full CRUD on all story entities |
| PLAYER | No access (403 via JwtAuthenticationFilter) |
| GUEST | No access (401/403) |

Role enforcement is handled by the existing `JwtAuthenticationFilter` which checks the `/api/admin/` path prefix and validates the JWT token's role claim.

## 5. Database Tables

All 23 story-related tables (see Step 09 data model) now support individual CRUD operations via the admin API. Each repository was extended with:

- `findByIdStoryAndUuid(Long idStory, String uuid)` — single entity lookup
- `deleteByUuid(String uuid)` — entity deletion by UUID

## 6. Business Logic

### 6.1 Story Resolution
All sub-entity operations first resolve the story UUID to an internal ID via `StoryReadPort.findStoryByUuid()`. If the story is not found, the endpoint returns 404.

### 6.2 UUID Generation
New entities get a UUID v4 automatically generated by `BaseStoryEntity.baseOnCreate()` JPA lifecycle callback.

### 6.3 Timestamps
- `ts_insert` — set once on entity creation by `@PrePersist`
- `ts_update` — refreshed on every update by `@PreUpdate`

### 6.4 Cascading
Entity deletions are scoped — deleting a single entity does NOT cascade to child entities. Use the existing `DELETE /api/admin/stories/{uuid}` to cascade-delete an entire story with all sub-entities.

## 7. Frontend Implementation

### 7.1 Admin Panel (`react-admin`)
The admin frontend provides a full management interface for Step 17 features:
- **Story Editor**: A tabbed interface to edit metadata and manage all sub-entities.
- **Generic Entity Table**: A reusable component (`EntityTable.jsx`) that handles listing, searching, and column rendering for all entity types.
- **Text Resolution**: Automatic lookup of `short_text` for `idTextName` and `idTextDescription` columns by fetching the story's text collection.
- **Generic Entity Form**: A dynamic form (`EntityForm.jsx`) to create or update any story sub-entity.

### 7.2 Game Client (`react-game`)
- **Story Catalog**: A public interface that lists available stories with medieval-themed styling (Cinzel/Crimson Text fonts).
- **Architecture**: Initialized with Vite, Tailwind CSS, and a public `storyApi.js` for story consumption.

## 7. Test Cases

### 7.1 Controller Tests (`StoryCrudAdminControllerTest`)

| Test | Method | Expected |
|------|--------|----------|
| Create story — success | POST /stories | 201 + body |
| Create story — empty body | POST /stories | 400 + EMPTY_IMPORT_DATA |
| Create story — port returns null | POST /stories | 400 + INVALID_IMPORT_DATA |
| Update story — success | PUT /stories/{uuid} | 200 + body |
| Update story — not found | PUT /stories/{uuid} | 404 + STORY_NOT_FOUND |
| Update story — empty body | PUT /stories/{uuid} | 400 + EMPTY_IMPORT_DATA |
| List entities — success | GET /stories/{uuid}/{type} | 200 + array |
| List entities — story not found | GET /stories/{uuid}/{type} | 404 |
| Get entity — success | GET /stories/{uuid}/{type}/{euuid} | 200 + body |
| Get entity — not found | GET /stories/{uuid}/{type}/{euuid} | 404 |
| Create entity — success | POST /stories/{uuid}/{type} | 201 + body |
| Create entity — story not found | POST /stories/{uuid}/{type} | 404 |
| Create entity — empty body | POST /stories/{uuid}/{type} | 400 |
| Update entity — success | PUT /stories/{uuid}/{type}/{euuid} | 200 + body |
| Update entity — not found | PUT /stories/{uuid}/{type}/{euuid} | 404 |
| Update entity — empty body | PUT /stories/{uuid}/{type}/{euuid} | 400 |
| Delete entity — success | DELETE /stories/{uuid}/{type}/{euuid} | 200 + DELETED |
| Delete entity — not found | DELETE /stories/{uuid}/{type}/{euuid} | 404 |

### 7.2 Service Tests (`StoryCrudServiceTest`)

| Test | Input | Expected |
|------|-------|----------|
| createStory null/empty data | null / {} | null |
| createStory success | valid map | story map with uuid |
| updateStory null/blank uuid | null / "  " | null |
| updateStory null/empty data | null / {} | null |
| updateStory story not found | valid uuid, no story | null |
| updateStory success | valid uuid + data | updated map |
| listEntities null/blank inputs | null storyUuid/entityType | null |
| listEntities story not found | missing uuid | null |
| listEntities unknown type | valid story, bad type | empty list |
| getEntity null/blank inputs | null params | null |
| getEntity story not found | missing uuid | null |
| createEntity null/blank/empty inputs | null params | null |
| createEntity story not found | missing uuid | null |
| updateEntity null/blank/empty inputs | null params | null |
| updateEntity story not found | missing uuid | null |
| deleteEntity null/blank inputs | null params | false |
| deleteEntity story not found | missing uuid | false |

## 8. Files Changed

### New Files (Backend)
| File | Module | Description |
|------|--------|-------------|
| `StoryCrudPort.java` | core | Inbound port interface for admin CRUD |
| `StoryCrudService.java` | core | Domain service implementation |
| `StoryCrudAdminController.java` | adapter-admin | REST controller for sub-entities |
| `StoryCrudServiceTest.java` | core (test) | Service unit tests |
| `StoryCrudAdminControllerTest.java` | adapter-admin (test) | Controller unit tests |

### New Files (Frontend)
| File | Project | Description |
|------|---------|-------------|
| `StoryEditorPage.jsx` | react-admin | Main editing interface |
| `EntityTable.jsx` | react-admin | Generic table with search and text resolution |
| `EntityForm.jsx` | react-admin | Generic creation/edit form |
| `storyApi.js` (updated) | react-admin | Added full Admin CRUD methods |

### Modified Files (Backend)
| File | Module | Changes |
|------|--------|---------|
| `CoreConfig.java` | ms-launcher | Added `StoryCrudPort` bean wiring |
| `StoryAdminController.java` | adapter-admin | Added `GET /api/admin/stories/{uuid}` endpoint |
| All 20 repositories in `core/repository/story/` | core | Added `findByIdStoryAndUuid()` and `deleteByUuid()` methods |




## Version Control
- First version created with AI prompts:
  > Set Step/XX=17.  

  > Read all documentation into "documentation_v0" folder to have all information about my project. i wanna to run step XX descripted into Step00_Roadmap file: write all java backend code into "code/backend/java" project using JPA, never add new module, complete all unit-test using mokito to cover 100% of branches-case. write new md file inside documentation_v0 folder with all details, write a section with (endpoint apis, DTO, roles, tables, test cases and business logic). add (or update) openapi documentation into "/code/backend/java/adapter-rest/src/main/resources/openapi" folder with new/changed api, if some api changed write me into md files. create a new simple web example to use new api-interfaces inside new "documentation_v0/website_concepts_v0/v0.XX.0/" folder, if necessary create a new "documentation_v0/website_concepts_v0/v0.XX.0-admin/" folder for dedicated admin web-site sections, for websites use componentes by code/website/html and others last concepts (documentation_v0/website_concepts_v0). add new folder inside "code/tests/robot/test" and write new robot-framework test to check all apis and new components are ok (launcing java backend with sqlite profile to test all). don't look and don't change "backend/python" , "backend/php" , "backend/aws" and others concepts folder into "website". to execute robot command remember to use ".venv".  

  > Read all documentation into "documentation_v0" folder to have all information about my project. i wanna to run step XX=000 for python and php backend. please read all changes about step XX and write php and python project code using tecnologies defined into README.md file inside projects. I wanna all APIs are 100% compatibile with "code/backend/java/adapter-rest/src/main/resources/openapi" open-api documentation. For php and python i've sonar qube so complete all unit-test using phpunit and pytest to cover 100% of branches-case. never change files outside "code/backend/php" and "code/backend/python" folders. my robot "code/tests/robot" must works with python and php project, check it with script inside "code/script/dev/" folder. to execute python project and robot command remember to use ".venv".  

  > Read all documentation into "documentation_v0" folder to have all information about my project. i wanna to run step XX for aws backend version inside "code/backend/aws" folder. please read all changes about step XX from java and python versions and write into aws project new code using tecnologies defined into README.md file inside projects and previus code. I wanna all APIs are 100% compatibile with "code/backend/java/adapter-rest/src/main/resources/openapi" open-api documentation. never change files outside "code/backend/aws" folder. my robot "code/tests/robot" must works with new code, never change robot test code.

  > Read all documentation into "documentation_v0" folder to have all information about my project. read open-api documentation into "/code/backend/java/adapter-rest/src/main/resources/openapi" folder, i wanna to run step XX for frontend "react-admin" and "react-game" , add functionality inside project using react tecnologies defined into README.md file inside projects. In this step never change files outside react projects. Rember to cover code with tests for have 100% sonar coverage. On editors components I wanna change all table column. 

  > read all documentation_v0 folder, i'm developing step=17. Check all API: i wanna API permit change all values into tables, check API if permit change all values (Java, php, python and AWS editions), check openapi, check robot test anche check "code/frontend/react-admin" project if permit change all values


- **Document Version**: 0.17.1
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.17.0 | Admin CRUD APIs | April 25, 2026 |
    | 0.17.1 | Admin stories editor | April 27, 2026 |
    
- **Last Updated**: April 27, 2026
- **Status**: ✅ Complete



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


