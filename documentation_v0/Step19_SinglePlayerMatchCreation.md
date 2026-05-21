# Paths Games V0 - Step 19: Single-Player Match Creation

This document describes the implementation of **Step 19** as requested in
`Step00_Roadmap.md` (line 77, *Single-player match creation*).

The step ships the first write-side endpoints of the runtime game engine.
Players can now turn a published story into a playable match: the platform
validates the request, creates the `gaming_match` row and seeds the per-match
state tables (`gaming_state_locations`, `gaming_state_registry`).

---

## 1. Scope

Step 19 covers the following items from the roadmap:

- `POST /api/matches` — create a new single-player match for the
  authenticated user.
- `GET /api/match/{uuidMatch}/info` — return the runtime state required by
  the player UI (match summary, location/registry state, slots for events
  and choices).
- `GET /api/matches` — list the matches owned by the current user. The
  endpoint is not strictly required by the roadmap but is necessary for the
  v0.19 frontend concept (My matches list).
- Validation rules: story exists, difficulty belongs to that story, user is
  not banned, and the platform is not in maintenance mode.
- Initialisation of `gaming_state_locations` (one row per story location,
  counters seeded from `list_locations.counter_time`).
- Initialisation of `gaming_state_registry` (one row per story key, default
  values copied from `list_keys.value` and split between `string_value` /
  `int_value` based on parse-ability).
- Backend unit tests with **100 %** branch coverage on all new code paths.

**v0.19.9** — the match creation request also records the creator loadout:
the selected character template, class, trait uuids and a single-player flag
(`1` single-player / `0` multiplayer). All four are persisted on
`gaming_match` (columns `character_template_uuid`, `class_uuid`,
`trait_uuids`, `single_player`) and echoed back on `MatchSummary`. The actual
character creation flow is still delivered by Steps 21–23.

---

## 2. Endpoint APIs

The OpenAPI source of truth is
[`code/backend/java/adapter-rest/src/main/resources/openapi/v0.19.0-match-creation-api.yaml`](../code/backend/java/adapter-rest/src/main/resources/openapi/v0.19.0-match-creation-api.yaml).
No previous API contract was changed.

### 2.1 `POST /api/matches`

Creates a single-player match.

| Header               | Required | Description                                |
|----------------------|----------|--------------------------------------------|
| `Authorization`      | yes      | `Bearer <accessToken>` (PLAYER or ADMIN)   |
| `Content-Type`       | yes      | `application/json`                         |

Request body (`MatchCreateRequest`):

```json
{
  "storyUuid": "f93b…",
  "difficultyUuid": "8d12…",
  "name": "Saturday adventure",
  "characterTemplateUuid": "1a2b…",
  "classUuid": "5c7e…",
  "traitUuids": ["9f01…", "9f02…"],
  "singlePlayer": 1
}
```

`storyUuid` and `difficultyUuid` are mandatory; every other field — including
the **v0.19.9** loadout (`characterTemplateUuid`, `classUuid`, `traitUuids`,
`singlePlayer`) — is optional. `singlePlayer` defaults to `1` when omitted.

| HTTP status | Cause                                                |
|-------------|------------------------------------------------------|
| `201`       | Match created — body is `MatchSummary`               |
| `400`       | `INVALID_INPUT`, `STORY_HAS_NO_LOCATIONS`             |
| `401`       | Missing / invalid bearer token (filter response)     |
| `403`       | `USER_BANNED` (states `3` blocked, `4` banned)       |
| `404`       | `STORY_NOT_FOUND`, `DIFFICULTY_NOT_FOUND`, `USER_NOT_FOUND` |
| `503`       | `MAINTENANCE_MODE` (server status set to MAINTENANCE) |

### 2.2 `GET /api/matches`

Returns the matches owned by the authenticated user, newest first.

### 2.3 `GET /api/admin/matches` *(v0.19.10)*

Returns **all** matches on the platform (newest first), regardless of creator. Requires `ADMIN` role.

| Header          | Required | Description                              |
|-----------------|----------|------------------------------------------|
| `Authorization` | yes      | `Bearer <accessToken>` (ADMIN only)      |

| HTTP status | Cause                                           |
|-------------|--------------------------------------------------|
| `200`       | Array of `MatchSummary` (same schema as 2.2)    |
| `401`       | Missing / invalid bearer token                  |
| `403`       | Caller does not hold the ADMIN role             |

Admin role enforcement is handled by each backend's existing JWT filter / middleware (the AWS Lambda handler checks the role field explicitly). This endpoint was introduced so the react-admin Matches section can display matches created by guest players, which the user-scoped `GET /api/matches` cannot surface when called with an admin token.

Implementation by backend:

| Backend | Controller method | Service method | Persistence method |
|---------|-------------------|----------------|--------------------|
| Java    | `MatchController.listAllMatches` | `MatchQueryService.listAllMatches` | `MatchReadPort.findAllMatches` → `GamingMatchRepository.findAllByOrderByTsInsertDesc` |
| Python  | `MatchController.list_all_matches` | `MatchQueryService.list_all_matches` | `MatchPersistenceAdapter.find_all_matches` |
| PHP     | `MatchController::listAllMatches` | `MatchQueryService::listAllMatches` | `MatchMysqlPersistenceAdapter::findAllMatches`; route in `public/index.php` |
| AWS     | `match/handler.py` `_list_all_matches` | — | `db_utils.scan_pk_prefix`; route `ListAllMatchesRoute` in `template/match.yaml` |

Note: for SQL-based backends (Java, Python, PHP) the response leaves `userCreatorUuid`, `storyUuid` and `difficultyUuid` null, mirroring the behaviour of `GET /api/matches`. The AWS backend populates all three fields from DynamoDB.

### 2.4 `GET /api/match/{uuidMatch}/info`

Returns the runtime state needed to render the in-game UI:

```json
{
  "match": { /* MatchSummary */ },
  "currentLocationId": 10,
  "currentLocationUuid": "loc-abcd",
  "currentLocationName": "location-10",
  "locations": [ { "idLocation": 10, "uuid": "...", "flagAlreadyActived": 0, "clockCounter": 5 } ],
  "registry": [ { "uuid": "...", "key": "act_1_done", "intValue": 0 } ],
  "events": [],
  "choices": []
}
```

The `events` and `choices` arrays are empty in Step 19 — the choice/event
engine is delivered by Steps 30–32. The contract is exposed now so the
frontend can already consume the endpoint.

---

## 3. DTOs

| DTO                                | File (Java)                                                                 | Purpose                              |
|------------------------------------|------------------------------------------------------------------------------|--------------------------------------|
| `MatchCreateRequest`               | `adapter-rest/.../dto/MatchCreateRequest.java`                              | POST `/api/matches` body              |
| `MatchSummaryResponse`             | `adapter-rest/.../dto/MatchSummaryResponse.java`                            | Output of POST/list                   |
| `MatchInfoResponse`                | `adapter-rest/.../dto/MatchInfoResponse.java`                               | Output of GET `/api/match/{uuid}/info` |
| `MatchInfoResponse.LocationStateDto` | nested class                                                              | Per-match location state              |
| `MatchInfoResponse.RegistryEntryDto` | nested class                                                              | Per-match registry value              |
| `MatchInfoResponse.EventOptionDto`   | nested class                                                              | Available event / choice              |

The matching domain models live under `core/.../model/match/`:
`MatchCreateCommand`, `MatchSummary`, `MatchDetail`, `MatchLocationState`,
`MatchRegistryEntry`, `MatchEventOption`.

---

## 4. Roles & Authentication

All endpoints require a valid bearer token. Both `PLAYER` and `ADMIN` roles
are allowed. The token is verified by the existing
`JwtAuthenticationFilter` (Step 13). The user's identity is propagated on
the request as the attribute `userUuid`; the `MatchController` reads it
without using Spring Security.

The user state taxonomy (column `users.state`) drives the ban check:

| state | meaning      | allowed to create match? |
|-------|--------------|--------------------------|
| 1     | registration | yes                      |
| 2     | active       | yes                      |
| 3     | blocked      | no — `USER_BANNED`       |
| 4     | banned       | no — `USER_BANNED`       |
| 5     | password reset | yes (until reset expires) |
| 6     | guest        | yes                      |

---

## 5. Tables

Step 19 originally only **used** existing tables. **v0.19.9** adds Flyway
migration `V0.19.9__add_match_loadout_columns.sql` (SQLite + PostgreSQL) that
appends four loadout columns to `gaming_match`: `single_player`,
`character_template_uuid`, `class_uuid` and `trait_uuids` (the trait list is
stored comma-separated). The involved tables are:

| Table                       | Read | Write | Notes                                         |
|-----------------------------|:----:|:-----:|-----------------------------------------------|
| `users`                     | ✔    |       | resolve creator id, ban state                  |
| `list_stories`              | ✔    |       | story exists                                  |
| `list_stories_difficulty`   | ✔    |       | difficulty exists for the chosen story         |
| `list_locations`            | ✔    |       | source for `gaming_state_locations` rows       |
| `list_keys`                 | ✔    |       | source for `gaming_state_registry` rows        |
| `gaming_match`              | ✔    | ✔     | created on POST, queried on GET                |
| `gaming_state_locations`    | ✔    | ✔     | one row per location of the story              |
| `gaming_state_registry`     | ✔    | ✔     | one row per story key                          |

`gaming_match.exp_cost` is initialised from `list_stories_difficulty.exp_cost`
(or 5 when the difficulty row leaves the column null).

---

## 6. Business Logic (`MatchCommandService.createMatch`)

1. Reject the request when `userUuid`, `storyUuid` or `difficultyUuid` is
   blank — HTTP 400 `INVALID_INPUT`.
2. Refuse new matches while the server is in maintenance mode — HTTP 503.
3. Resolve the user via `UserAccessPort`. Missing user → 404; banned/blocked
   user → 403.
4. Look up the story by uuid and the difficulty by `(storyId, uuid)`. Either
   miss returns 404.
5. Load the story locations. An empty list returns 400
   `STORY_HAS_NO_LOCATIONS` because the runtime cannot place the player.
6. Persist a new `GamingMatchEntity` with `status = CREATED`, `currentClock = 0`,
   `expCost` copied from the difficulty, and the creator loadout
   (`single_player` defaulting to `1`, plus `character_template_uuid`,
   `class_uuid` and the comma-separated `trait_uuids`).
7. Create one `GamingStateLocationsEntity` per location, copying
   `counter_time` into `clock_counter` (defaults to 0 when null) and setting
   `flagAlreadyActived = 0`.
8. Create one `GamingStateRegistryEntity` per story key, mapping the default
   value from `list_keys.value`:
   - integer-parsable values → `intValue`
   - empty / blank values → `stringValue = ""`
   - everything else → `stringValue`
9. Return a `MatchSummary` populated from the saved entities.

`MatchQueryService.getMatchInfo` enforces ownership: a match cannot be
retrieved by another user — the service returns `null`, which the controller
surfaces as 404.

---

## 7. Test Cases

The test suite covers every branch described above. Key files:

| Test class                                        | Scenarios covered                                                                                  |
|---------------------------------------------------|----------------------------------------------------------------------------------------------------|
| `MatchCommandServiceTest`                         | 7 input-validation branches; maintenance mode; user not found / banned / blocked / null state; story / difficulty 404; null and empty location list; registry default-value parsing (int, string, blank, null); successful happy path. |
| `MatchQueryServiceTest`                           | List endpoint: blank/null user, unknown user, mapped result. Info endpoint: blank user/match, missing user, missing match, foreign owner, full path, missing start location, missing story.  |
| `MatchPersistenceAdapterTest`                     | Both adapters: save/find delegations, null-safety paths for `saveLocations`, `saveRegistry`, `findMatchesByUserId`, `findLocationsByMatchId`, `findRegistryByMatchId`. |
| `MatchEntitiesTest`                               | `@PrePersist` and `@PreUpdate` hooks of all three entities (idempotency on uuid, defaults applied), composite key `equals` / `hashCode` on both PK classes. |
| `MatchModelsTest`                                 | Getter/setter and null-safety branches of every domain model.                                    |
| `PropertySystemModeServiceTest`                   | Case-insensitive maintenance string and falsy values.                                             |
| `MatchControllerTest`                             | All 8 `MatchCreationException.Code` branches mapped to HTTP statuses; auth-missing 401; empty body & missing fields 400; happy path 201; list 200/401; info 200/401/404. |
| `MatchDtosTest`                                   | `fromModel(null)` paths and getter/setter coverage of every DTO including the nested classes.     |
| `UserAccessAdapterTest`                           | Blank / unknown / present uuid mapping to `UserView`.                                              |

Run from the Java project root:

```bash
mvn -pl core,adapter-rest,adapter-auth -am test
```

Total tests added: **96**. All pass in the local CI run.

---

## 8. API Changes Summary

Step 19 introduced three new endpoints. **v0.19.9** additively extends the
`MatchCreateRequest` and `MatchSummary` schemas with the creator loadout
fields (`classUuid`, `traitUuids`, `singlePlayer`; `characterTemplateUuid` is
now persisted instead of being ignored). **v0.19.10** adds the admin-wide
listing endpoint. All changes are backward compatible — every new field is
optional. The OpenAPI document `v0.19.0-match-creation-api.yaml` is bumped to
version `0.19.10`.

| Endpoint                              | Status                                                    |
|---------------------------------------|-----------------------------------------------------------|
| `POST /api/matches`                   | NEW (v0.19.0); request body extended (v0.19.9)            |
| `GET /api/matches`                    | NEW (v0.19.0); response extended (v0.19.9)                |
| `GET /api/match/{uuidMatch}/info`     | NEW (v0.19.0); embedded summary extended (v0.19.9)        |
| `GET /api/admin/matches`              | NEW (v0.19.10) — admin-wide list, all backends            |
| `GET /api/admin/matches/{uuid}/info`  | NEW (v0.19.12) — admin detail without ownership check; see [Step21_AdminMatchControl.md](Step21_AdminMatchControl.md) |

---

## 9. Frontend Concept

Two HTML concepts are shipped under
`documentation_v0/website_concepts_v0/v0.19.0/` (player) and
`documentation_v0/website_concepts_v0/v0.19.0-admin/` (admin). They re-use
the page chrome from `code/website/html` and the layout patterns of the
v0.17 admin/console concepts.

The player concept lets a guest:
1. Login as guest (POST `/api/auth/guest`).
2. Pick a story and difficulty from `/api/stories/{uuid}`.
3. Create a match (POST `/api/matches`).
4. Open `/api/match/{uuid}/info` and render the runtime state as cards
   (current location, location counters, registry table).

The admin concept lists every match found in the new gaming tables (this
listing reuses the existing admin filter; a richer version is part of the
multiplayer admin work in Step 77+).

### 9.1 react-game: StartMatchPage (v0.19.10)

The `StartMatchPage` (`src/pages/StartMatchPage.jsx`) is a new full-screen
book page that sits between the story configuration modal and the actual game.
It is reached at the route `/start-match/:storyId`; the start book's
"Start Game" button navigates here, passing `{ story, config }` via React
Router `state`.

Layout — left page: the story card. Right page: the six chosen loadout cards
(class, character, trait, difficulty, game-type, login) plus the aggregated
bonus-totals list.

Flow:
1. Renders "Starting match…" with a countdown timer.
2. Waits `VITE_MATCH_START_DELAY` seconds (default 20, configured in `.env` /
   `.env.example`).
3. Calls `POST /api/matches` with the full loadout payload (`storyUuid`,
   `difficultyUuid`, `name`, `characterTemplateUuid`, `classUuid`,
   `traitUuids`, `singlePlayer`). The bearer token is taken from the
   `accessToken` field now stored in `GuestUserContext`.
4. On success, shows "Match created, the story book is loading…", waits X
   more seconds, then navigates to `GamePage`.
5. On failure, shows an error message with **Retry** and **Back-to-home**
   buttons.

New files introduced:
- `src/api/matches.js` — `createMatch`, `listMatches`, `getMatchInfo` with
  automatic mock fallback when the backend is unreachable.
- `src/features/startBook/loadoutCards.js` — shared helper that builds the
  ordered array of six loadout card descriptors; adopted by both
  `StartMatchPage` and `ConfigView`.
- `src/test/matches.test.js` and `src/test/StartMatchPage.test.jsx` — unit
  tests (62 tests total passing after this step).

The `GuestUserContext` now persists the JWT `accessToken` alongside
`userUuid`/`username` so that `StartMatchPage` can attach the bearer token
to the `POST /api/matches` call without an extra login round-trip.

### 9.2 react-admin: Matches section (v0.19.10)

A new **Matches** section is accessible via the sidebar at route `/matches`
and rendered by `src/pages/MatchesPage.jsx`. It provides:
- A filterable, refreshable table of matches (filter by text or status, stat
  summary cards at the top).
- A detail modal that loads `GET /api/match/{uuid}/info` and displays the
  match summary, current location, locations state and registry.

New files:
- `src/api/matchApi.js` — `listMatches` (`GET /api/admin/matches`) and
  `getMatchInfo` (`GET /api/admin/matches/{uuid}/info` since v0.19.12; was
  `GET /api/match/{uuid}/info` in v0.19.10 — changed as a bug fix because the
  per-user endpoint returned 404 when an admin opened a guest's match).
- `src/tests/api/matchApi.test.js` and
  `src/tests/pages/MatchesPage.test.jsx` — unit tests (236 tests total
  passing after this step).

Note: `listMatches` in `matchApi.js` calls `GET /api/admin/matches` (added in
v0.19.10) so the react-admin table shows matches created by all players, not
just the admin token owner. The user-scoped `GET /api/matches` is still
available for the player-facing frontend (`react-game`).

---

## 10. Robot Framework Coverage

Tests live under `code/tests/robot/tests/19_match/`. They exercise:

- Match creation (happy path, missing fields, missing token).
- Match creation with the full creator loadout (v0.19.9 — character,
  class, traits and the single-player flag) verified end-to-end via
  `GET /api/match/{uuid}/info`.
- Match listing (`GET /api/matches` — user-scoped).
- Admin match listing (`GET /api/admin/matches`): asserts 200 for an ADMIN token and 403 for a non-admin token.
- Match info retrieval (own match, foreign match returning 404).

Run them against the Java backend with:

```bash
.venv/bin/python -m pip install -r code/tests/robot/requirements.txt
code/scripts/dev/run_robots/run_robot_with_local_java.sh
```

The same suite passes against the Python and PHP backends — see
`code/scripts/dev/run_robots/run_robot_with_local_python.sh` and
`run_robot_with_local_php.sh`.

## Version Control
- Created with AI prompts:
  ```  
  Set Step/XX=19

  Starting from the develop branch, checkout develop, create a new branch called develop_v0_19_0, and throughout this session commit and push all changes to that branch using git user email 'gamespaths@gmail.com' and git user name 'Paths.Games agent'.

  --- PART 1: JAVA BACKEND ---
  Read all documentation inside the 'documentation_v0' folder to have all information about the project. Read the Step00_Roadmap file to understand what Step 19 requires. Then implement Step 19 for the Java backend inside 'code/backend/java' using JPA. Never add a new Maven module. Complete all unit tests using Mockito to cover 100% of branch cases. Write a new markdown file inside the documentation_v0 folder with all details covering: endpoint APIs, DTOs, roles, tables, test cases, and business logic. Add or update the OpenAPI documentation inside '/code/backend/java/adapter-rest/src/main/resources/openapi' for any new or changed APIs — if an API changed, note it in the markdown file. Create a new simple web example to demonstrate the new API interfaces inside 'documentation_v0/website_concepts_v0/v0.19.0/' folder; if necessary create 'documentation_v0/website_concepts_v0/v0.19.0-admin/' for admin-specific sections. Use components from 'code/website/html' and other existing concepts in 'documentation_v0/website_concepts_v0'. Add a new folder inside 'code/tests/robot/tests' and write new Robot Framework tests to check all APIs and new components (launch Java backend with SQLite profile). To execute robot commands remember to use '.venv'. Do NOT look at or change 'backend/python', 'backend/php', 'backend/aws', or other concepts folders inside 'website'.

  --- PART 2: PYTHON & PHP BACKENDS ---
  Read all documentation inside the 'documentation_v0' folder to have all information about the project. Read all changes implemented in Step 19 for the Java backend above. Implement Step 19 for both the Python backend ('code/backend/python') and the PHP backend ('code/backend/php') using the technologies defined in each project's README.md. All APIs must be 100% compatible with the OpenAPI documentation in 'code/backend/java/adapter-rest/src/main/resources/openapi'. For PHP use PHPUnit and for Python use pytest — both must achieve 100% branch coverage. Never change files outside 'code/backend/php' and 'code/backend/python'. The Robot Framework tests in 'code/tests/robot' must work with both projects — verify using scripts inside 'code/script/dev/'. To execute Python and robot commands remember to use '.venv'.

  --- PART 3: AWS BACKEND ---
  Read all documentation inside the 'documentation_v0' folder to have all information about the project. Read all changes from Step 19 in the Java and Python versions. Implement Step 19 for the AWS serverless backend inside 'code/backend/aws' using the technologies defined in the project's README.md. All APIs must be 100% compatible with the OpenAPI documentation in 'code/backend/java/adapter-rest/src/main/resources/openapi'. Never change files outside 'code/backend/aws'. The Robot Framework tests in 'code/tests/robot' must work with the new code — never change robot test code.

  After completing all three parts, commit and push everything to the develop_v0_19_0 branch.
  ```
  > ciao, read MD files into documentation_v0 folder for project context, read code/backend/java/adapter-rest/src/main/resources/openapi/v0.15.0-story-content-api.yaml, i wanna add idCard and all cards informations into api  "/api/stories/{uuid}". I wanna you change java project, open api documentation, python backend project, php backend project and aws lambda project. I wanna you add robot test to check new field in api. update md documentation file. Let's go

  > Add image style columns to list_cards table
  > add "card_type" field everywhere (Into react-admin i wanna a posibile values list = charater, classes, trait, difficulty, events, ...all table with card filed external reference ). after write me a MD file into "documentation_v0/Step15_StoryContentHowAddFiledIntoCard.md" to explain how and where add filed into card object into all project. Let's go

  > edit only react-game project. on characters/classes/traits lists there are some bonus column/fieds, i wanna see this on big card component . on bonus hide fields with zero value, show with bootstrap badge stype and on top of big card. on ConfigView show sum of all bonus values (if different to zero) after "page-footer".

  > "v0.19.8" on website react-game we need manage guest-user information: when user enter without any cookies (paths.games.user) i need create a new guest user with dedicated APIs, it there is the cookies load information from cookie. on nav bar button open modal (new component) with user card (BookPageContent) where see "guest user name" and description (for now use a new text , in future we will use for match stories and others informations). Note: cookie consent banner will be managed by cookies yes so don't worry about that.

  > ciao, check documentation_v0 files and all projects. i wanna check/add into MatchCreate Requests character, difficulty, traits, Class and flag singlePlayer=YES/NO. If there aren't add them. Check all backend and all frontend. Update openapi, robot test and tests.

  > using "0.19.10" version, read documentation_v0. Into react-game project when "start game" jump to another page "StartMatch" with book style (left and right page), on left the story card, on right the 6 little card selected in startBook. after bonus lists show "starting match", wait X seconds (X on env file , default 20 seconds)  and call the match POST API to create the match (pass all information to API), show "Match created, story book is loading" and jump after X seconds to GamePage. update the react-admin project: create a new section "match" to see all match from GET API and details/operatons . Let's go
  
  > Ciao, i've a problem; when rotob test runned , in tables there are so many rows from tests execution, for example guest users and matches. I wanna remove these elements from tables (sql/dynamo) after robot test runned, i wanna remove only robot test rows preserve others informations. 

- **Document Version**: 0.19.10
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.19.0 | Single player match creation | May 08, 2026 |
    | 0.19.1 | Single player match creation | May 08, 2026 |
    | 0.19.2 | Bug fix: story defailt for website, story export in admin project, sonar coverage | May 08, 2026 |
    | 0.19.2 | Add idCard and card object into stories API | May 09, 2026 |
    | 0.19.3 | Add style fileds columns into card tables and use into frontend | May 14, 2026 |
    | 0.19.4 | Characters and traits not permitted for class selection | May 18, 2026 |
    | 0.19.6 | Added seven stat-delta columns (`life`, `energy`, ...) to `list_traits`| May 19, 2026 |
    | 0.19.7 | Added seven stat columns (`life`, `energy`,...) to `list_stories_difficulty` | May 19, 2026 |
    | 0.19.8 | Added guest user management into game frontend project | May 19, 2026 |
    | 0.19.9 | Added character/class/traits/singlePlayer fields into creation request and gaming_match | May 20, 2026 |
    | 0.19.10 | StartMatchPage on react-game, Matches list on react-admin and GET /api/admin/matches | May 20, 2026 |
    | 0.19.11 | Dev-only test-data cleanup | May 21, 2026 |
    | 0.19.12 | Admin match control (update/stop/pause/resume/delete) | May 21, 2026 |

- **Last Updated**: May 21, 2026
- **Status**: Complete



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


