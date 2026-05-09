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

The character template selection requested by the creator is accepted in the
request body but persisted only for forward compatibility; the actual
character creation flow is delivered by Steps 21–23.

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
  "characterTemplateUuid": "1a2b…"
}
```

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

### 2.3 `GET /api/match/{uuidMatch}/info`

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

Step 19 only **uses** existing tables — no Flyway migration is added. The
involved tables are:

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
   `expCost` copied from the difficulty.
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

Only **new** endpoints are introduced. No previously published API has been
modified. The new OpenAPI document is published as
`v0.19.0-match-creation-api.yaml` so existing v0.14 → v0.17 documents stay
unchanged.

| Endpoint                              | Status |
|---------------------------------------|--------|
| `POST /api/matches`                   | NEW    |
| `GET /api/matches`                    | NEW    |
| `GET /api/match/{uuidMatch}/info`     | NEW    |

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

---

## 10. Robot Framework Coverage

Tests live under `code/tests/robot/tests/19_match/`. They exercise:

- Match creation (happy path, missing fields, missing token).
- Match listing.
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

- **Document Version**: 0.19.1
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.19.0 | Single player match creation | May 08, 2026 |
    | 0.19.1 | Single player match creation | May 08, 2026 |
    | 0.19.2 | Bug fix: story defailt for website, story export in admin project, sonar coverage | May 08, 2026 |
    | 0.19.2 | Add idCard and card object into stories API | May 09, 2026 |
    
- **Last Updated**: May 08, 2026
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


