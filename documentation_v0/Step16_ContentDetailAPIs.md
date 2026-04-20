# Step 16 — Story Content Detail APIs: Cards, Texts, and Creators

This document describes the implementation of **Step 16: Story Content Detail APIs — Cards, Texts, and Creators** from the [Roadmap](./Step00_Roadmap.md).

## Summary

| Item | Detail |
|------|--------|
| **Step** | 16 |
| **Goal** | Add content detail endpoints for individual cards, texts, and creators within a story |
| **Pattern** | Hexagonal Architecture (Ports & Adapters) |
| **Database** | Reuses existing JPA entity tables (`list_cards`, `list_texts`, `list_creator`) |
| **New endpoints** | 3 public REST endpoints under `/api/content/` |
| **Auth** | All endpoints are public (no authentication required) |
| **Version** | 0.16.0 |


## Sub-steps completed

| # | Sub-step | Description |
|---|----------|-------------|
| 16.1 | Create domain models | `CreatorInfo`, `TextInfo`, `CardDetail` immutable builders in `core/model/story` |
| 16.2 | Create inbound port | `ContentQueryPort` interface with 3 query methods |
| 16.3 | Extend outbound port | Added 3 new methods to `StoryReadPort` for card/creator UUID lookup and creator listing |
| 16.4 | Extend repositories | `CardRepository.findByIdStoryAndUuid()`, `CreatorRepository.findByIdStoryAndUuid()` |
| 16.5 | Implement persistence adapter | `StoryReadAdapter` wired with `CreatorRepository`, 3 new methods |
| 16.6 | Implement domain service | `ContentQueryService` with text resolution, language fallback, and creator resolution |
| 16.7 | Create REST DTOs and controller | `CardDetailResponse`, `TextInfoResponse`, `CreatorInfoResponse`, `ContentController` |
| 16.8 | Wire Spring beans | `CoreConfig.contentQueryPort()`, `application.yml` public path `/api/content/**` |
| 16.9 | Write comprehensive unit tests | Domain model, service, controller, adapter, DTO tests with 100% branch coverage |
| 16.10 | OpenAPI documentation | `v0.16.0-content-detail-api.yaml` |


## Architecture

This step adds a new controller (`ContentController`) and a new domain service (`ContentQueryService`) to the existing hexagonal architecture. No new modules are created:

```
┌───────────────────────────────────────────────────────────────────┐
│                          core module                              │
│  ┌────────────────────────┐  ┌─────────────────────────────────┐  │
│  │ Domain Models (new)    │  │   Services                      │  │
│  │  CreatorInfo           │  │   ContentQueryService (new)     │  │
│  │  TextInfo              │  │     + getCardByStoryAndCardUuid │  │
│  │  CardDetail            │  │     + getTextByStoryAndIdText   │  │
│  └────────────────────────┘  │     + getCreatorByStoryAndUuid  │  │
│  ┌────────────────────────┐  │     + resolveText() helper      │  │
│  │ Ports                  │  │     + resolveCreator() helper   │  │
│  │  ContentQueryPort(new) │  └─────────────────────────────────┘  │
│  │  StoryReadPort (+3)    │  ┌─────────────────────────────────┐  │
│  └────────────────────────┘  │   StoryReadAdapter (enhanced)   │  │
│                              │   + CreatorRepository (new dep) │  │
│                              │   + findCardByStoryIdAndUuid()  │  │
│                              │   + findCreatorByStoryIdAndUuid │  │
│                              │   + findCreatorsByStoryId()     │  │
│                              └─────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┘
          ▼
┌───────────────────────┐
│     adapter-rest      │
│                       │
│  ContentController    │
│  (3 new endpoints)    │
│  New DTOs:            │
│   CardDetailResponse  │
│   TextInfoResponse    │
│   CreatorInfoResponse │
└───────────────────────┘
```


## API Endpoints

### GET `/api/content/{uuidStory}/cards/{uuidCard}` — Get Card Detail

Returns the full detail of a card within a story, including resolved title, description, copyright text, and creator profile.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `uuidStory` | string | UUID of the story |
| `uuidCard` | string | UUID of the card |

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `lang` | string | `en` | Preferred language for text resolution |

**Response (200 OK):**
```json
{
  "uuid": "card-uuid-001",
  "imageUrl": "https://img.paths.games/cards/forest.png",
  "alternativeImage": "forest_alt.jpg",
  "awesomeIcon": "fa-tree",
  "styleMain": "bg-success",
  "styleDetail": "text-light",
  "title": "The Dark Forest",
  "description": "A dense forest full of mysteries.",
  "copyrightText": "© 2026 Paths Games",
  "linkCopyright": "https://paths.games/copyright",
  "creator": {
    "uuid": "creator-uuid-001",
    "name": "John Doe",
    "link": "https://johndoe.com",
    "url": "https://johndoe.com/profile",
    "urlImage": "https://johndoe.com/avatar.png",
    "urlEmote": "https://johndoe.com/emote.png",
    "urlInstagram": "https://instagram.com/johndoe"
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "CARD_NOT_FOUND",
  "message": "No card found with UUID: card-uuid-001 in story: story-uuid-001"
}
```


### GET `/api/content/{uuidStory}/texts/{idText}/lang/{lang}` — Get Resolved Text

Returns a resolved text entry for the given story, text ID, and language. Falls back to English when the requested language is not found.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `uuidStory` | string | UUID of the story |
| `idText` | integer | Business text identifier (grouping key) |
| `lang` | string | Requested language code (ISO 639-1) |

**Response (200 OK):**
```json
{
  "idText": 100,
  "lang": "it",
  "resolvedLang": "en",
  "shortText": "Hello World",
  "longText": "A longer description of Hello World.",
  "copyrightText": "© 2026 Author",
  "linkCopyright": "https://example.com/copyright",
  "creator": {
    "uuid": "creator-uuid-001",
    "name": "John Doe",
    "link": "https://johndoe.com",
    "url": null,
    "urlImage": null,
    "urlEmote": null,
    "urlInstagram": null
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "TEXT_NOT_FOUND",
  "message": "No text found with id_text: 100 in story: story-uuid-001"
}
```

**Language fallback logic:**
1. Look up `(id_story, id_text, lang)` in the `list_texts` table
2. If not found and `lang ≠ "en"`, try `(id_story, id_text, "en")`
3. If still not found, return 404
4. The `resolvedLang` field indicates which language was actually returned


### GET `/api/content/{uuidStory}/creators/{uuidCreator}` — Get Creator Detail

Returns the profile of a creator within a story. The creator's name is resolved from the multi-language `list_texts` table.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `uuidStory` | string | UUID of the story |
| `uuidCreator` | string | UUID of the creator |

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `lang` | string | `en` | Preferred language for the creator's name |

**Response (200 OK):**
```json
{
  "uuid": "creator-uuid-001",
  "name": "John Doe",
  "link": "https://johndoe.com",
  "url": "https://johndoe.com/profile",
  "urlImage": "https://johndoe.com/avatar.png",
  "urlEmote": "https://johndoe.com/emote.png",
  "urlInstagram": "https://instagram.com/johndoe"
}
```

**Response (404 Not Found):**
```json
{
  "error": "CREATOR_NOT_FOUND",
  "message": "No creator found with UUID: creator-uuid-001 in story: story-uuid-001"
}
```


## DTOs

### CardDetailResponse

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `uuid` | string | no | Card UUID |
| `imageUrl` | string | yes | Primary image URL |
| `alternativeImage` | string | yes | Alternative image filename |
| `awesomeIcon` | string | yes | FontAwesome icon class |
| `styleMain` | string | yes | CSS class for main style |
| `styleDetail` | string | yes | CSS class for detail style |
| `title` | string | yes | Resolved title text |
| `description` | string | yes | Resolved description text |
| `copyrightText` | string | yes | Resolved copyright text |
| `linkCopyright` | string | yes | Copyright URL |
| `creator` | CreatorInfoResponse | yes | Creator profile (null if no creator assigned) |

### TextInfoResponse

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `idText` | integer | no | Text business identifier |
| `lang` | string | no | Requested language |
| `resolvedLang` | string | no | Actually resolved language |
| `shortText` | string | yes | Short text content |
| `longText` | string | yes | Long text content |
| `copyrightText` | string | yes | Resolved copyright text |
| `linkCopyright` | string | yes | Copyright URL |
| `creator` | CreatorInfoResponse | yes | Creator profile (null if no creator assigned) |

### CreatorInfoResponse

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `uuid` | string | no | Creator UUID |
| `name` | string | yes | Resolved creator name |
| `link` | string | yes | Creator's primary link |
| `url` | string | yes | Creator's profile URL |
| `urlImage` | string | yes | Avatar image URL |
| `urlEmote` | string | yes | Emote image URL |
| `urlInstagram` | string | yes | Instagram profile URL |


## Database Tables Used

No new tables are created. Step 16 reads from existing tables:

| Table | Purpose |
|-------|---------|
| `list_stories` | Story lookup by UUID |
| `list_cards` | Card lookup by story ID and UUID |
| `list_creator` | Creator lookup by story ID and UUID, and list by story ID |
| `list_texts` | Text resolution by story ID, id_text, and lang |

### Key relationships

```
list_cards.id_text_title     → list_texts.id_text  (title resolution)
list_cards.id_text_description → list_texts.id_text  (description resolution, inherited from BaseStoryEntity)
list_cards.id_text_copyright → list_texts.id_text  (copyright resolution)
list_cards.id_creator        → list_creator.id     (creator FK by PK)
list_texts.id_text_copyright → list_texts.id_text  (copyright on text entries)
list_texts.id_creator        → list_creator.id     (creator FK by PK)
list_creator.id_text         → list_texts.id_text  (creator name resolution)
```


## Roles and Access Control

All three endpoints are **public** — no authentication required.

The path `/api/content/**` is added to `game.auth.public-paths` in `application.yml`, which causes `JwtAuthenticationFilter` to skip token validation for these requests.


## Business Logic

### Text Resolution (`resolveText`)

Used internally by the service to resolve `id_text` references to actual text content:

1. Receive `(storyId, idText, lang)`.
2. If `idText` is null → return null.
3. Normalize lang: if null or blank, use `"en"`.
4. Query `list_texts` for `(id_story, id_text, lang)`.
5. If found → return `shortText`.
6. If not found and `lang ≠ "en"` → try `(id_story, id_text, "en")`.
7. If English fallback found → return `shortText`.
8. If still not found → return null.

### Creator Resolution (`resolveCreator`)

Used internally to resolve `id_creator` integer FK references:

1. Receive `(storyId, idCreator, lang)`.
2. If `idCreator` is null → return null.
3. Load all creators for the story via `findCreatorsByStoryId()`.
4. Find the creator whose `id` (PK) matches `idCreator`.
5. If found → resolve the creator's name via `resolveText(storyId, creator.idText, lang)`.
6. Build and return `CreatorInfo` with all fields.
7. If no match → return null.

### Card Detail Composition

1. Validate `storyUuid` and `cardUuid` (null/blank → null).
2. Look up story by UUID.
3. Look up card by `(storyId, cardUuid)`.
4. Resolve title from `card.idTextTitle`.
5. Resolve description from `card.idTextDescription` (inherited from BaseStoryEntity).
6. Resolve copyright text from `card.idTextCopyright`.
7. Resolve creator from `card.idCreator`.
8. Compose `CardDetail` with all resolved fields.

### Text Entry Composition

1. Validate `storyUuid` (null/blank → null).
2. Look up story by UUID.
3. Normalize lang (null/blank → "en").
4. Look up text by `(storyId, idText, lang)`.
5. If not found and lang ≠ "en" → fallback to English.
6. Track `resolvedLang` for the response.
7. Resolve copyright text from `text.idTextCopyright`.
8. Resolve creator from `text.idCreator`.
9. Compose `TextInfo` with all fields.


## Test Cases

### Domain Model Tests

| Test Class | Tests | Description |
|-----------|-------|-------------|
| `CreatorInfoTest` | 3 | Builder pattern, all-fields, null-fields, toString |
| `TextInfoTest` | 3 | Builder pattern, all-fields, defaults, toString |
| `CardDetailTest` | 3 | Builder pattern, all-fields, null-creator, toString |

### Service Tests (`ContentQueryServiceTest`)

| Nested Class | Tests | Description |
|-------------|-------|-------------|
| `GetCard` | 13 | null/blank story UUID, null/blank card UUID, story not found, card not found, full detail, null creator, null text IDs, title/description resolution, copyright resolution, lang fallback |
| `GetText` | 12 | null/blank story UUID, story not found, text not found, full detail, lang fallback to English, null/blank lang defaults to "en", copyright resolution, creator resolution, null creator, null copyright |
| `GetCreator` | 11 | null/blank story UUID, null/blank creator UUID, story not found, creator not found, full detail, name resolution, lang parameter, null idText, empty URLs |
| `ResolveCreator` | 2 | No matching creator in list, empty creator list |

### Adapter Tests (`StoryReadAdapterTest`)

| Nested Class | Tests | Description |
|-------------|-------|-------------|
| `Step16EntityLookups` | 5 | findCardByStoryIdAndUuid, findCreatorByStoryIdAndUuid, findCreatorsByStoryId, empty results, empty list |

### Controller Tests (`ContentControllerTest`)

| Nested Class | Tests | Description |
|-------------|-------|-------------|
| `GetCard` | 6 | Success response, 404 not found, lang parameter, default lang, null creator in response, JSON content type |
| `GetText` | 5 | Success response, 404 not found, lang path variable, null creator in response, JSON content type |
| `GetCreator` | 6 | Success response, 404 not found, lang parameter, default lang, null URLs, JSON content type |

### DTO Tests

| Test Class | Tests | Description |
|-----------|-------|-------------|
| `CardDetailResponseTest` | 2 | All-args constructor mapping, default constructor + setters |
| `TextInfoResponseTest` | 2 | All-args constructor mapping, default constructor + setters |
| `CreatorInfoResponseTest` | 2 | All-args constructor mapping, default constructor + setters |


## Files Created and Modified

### New files

| File | Module | Description |
|------|--------|-------------|
| `CreatorInfo.java` | core | Domain model for creator profile |
| `TextInfo.java` | core | Domain model for resolved text entry |
| `CardDetail.java` | core | Domain model for enriched card detail |
| `ContentQueryPort.java` | core | Inbound port interface |
| `ContentQueryService.java` | core | Domain service implementing content queries |
| `CardDetailResponse.java` | adapter-rest | REST DTO for card detail |
| `TextInfoResponse.java` | adapter-rest | REST DTO for text info |
| `CreatorInfoResponse.java` | adapter-rest | REST DTO for creator info |
| `ContentController.java` | adapter-rest | REST controller with 3 endpoints |
| `ContentQueryServiceTest.java` | core (test) | Comprehensive service unit tests |
| `CreatorInfoTest.java` | core (test) | Domain model tests |
| `TextInfoTest.java` | core (test) | Domain model tests |
| `CardDetailTest.java` | core (test) | Domain model tests |
| `ContentControllerTest.java` | adapter-rest (test) | MockMvc controller tests |
| `CardDetailResponseTest.java` | adapter-rest (test) | DTO tests |
| `TextInfoResponseTest.java` | adapter-rest (test) | DTO tests |
| `CreatorInfoResponseTest.java` | adapter-rest (test) | DTO tests |
| `v0.16.0-content-detail-api.yaml` | adapter-rest | OpenAPI specification |

### Modified files

| File | Module | Changes |
|------|--------|---------|
| `StoryReadPort.java` | core | Added 3 new methods for Step 16 entity lookup |
| `CardRepository.java` | core | Added `findByIdStoryAndUuid()` |
| `CreatorRepository.java` | core | Added `findByIdStoryAndUuid()`, added `Optional` import |
| `StoryReadAdapter.java` | core | Added `CreatorRepository` dependency, 3 new methods |
| `StoryReadAdapterTest.java` | core (test) | Added Step 16 entity lookup test nested class |
| `CoreConfig.java` | ms-launcher | Added `contentQueryPort()` bean |
| `application.yml` | ms-launcher | Added `/api/content/**` to public-paths |



## OpenAPI Documentation

Full API specification: `code/backend/java/adapter-rest/src/main/resources/openapi/v0.16.0-content-detail-api.yaml`



## Version Control
- First version created with AI prompts:
    > Set Step/XX=16. read all documentation into "documentation_v0" folder to have all information about my project. i wanna to run step XX descripted into Step00_Roadmap file: write all java backend code into "code/backend/java" project using JPA, never add new module, complete all unit-test using mokito to cover 100% of branches-case. write new md file inside documentation_v0 folder with all details, write a section with (endpoint apis, DTO, roles, tables, test cases and business logic). add (or update) openapi documentation into "/code/backend/java/adapter-rest/src/main/resources/openapi" folder with new/changed api, if some api changed write me into md files. create a new simple web example to use new api-interfaces inside new "code/website/concepts_v0/v0.XX.0/" folder, if necessary create a new "code/website/concepts_v0/v0.XX.0-admin/" folder for dedicated admin web-site sections, for websites use componentes by code/website/html and others last concepts. add new folder inside "code/tests/robot/test" and write new robot-framework test to check all apis and new components are ok (launcing java backend with sqlite profile to test all). don't look and don't change "backend/python" , "backend/php" , "backend/aws" and others concepts folder into "website". to execute robot command remember to use ".venv".   

    > on project I see CardDetail & CardInfo types (dto, responseses, ...) , they are similar. I wanna to use only CardInfo name, remove Details classes and objects but add into Info all informations. . update testunit, robot tests and open-api  




- **Document Version**: 0.16.0
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.16.0 | Card, test and authors details APIs | April 20, 2026 |
- **Last Updated**: April 20, 2026
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


