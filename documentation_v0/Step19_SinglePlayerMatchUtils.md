# Paths Games V0 - Step 19: Admin Match Control

This document describes the implementation of **Step 19** (admin match control),
shipped in version **0.19.12**.

The admin console could already list every match on the platform
(`GET /api/admin/matches`, v0.19.10). Version 0.19.12 makes the Matches section
fully actionable: an admin can inspect a match detail, modify a match's status
or name, stop / pause / resume it, and delete stopped matches.

---

## 1. Scope

Step 21 covers the following:

- `GET /api/admin/matches/{uuidMatch}/info` — full match detail (summary +
  runtime state) for any match, without the per-user ownership check used by
  the player-facing endpoint.
- `GET /api/admin/matches/statuses` — list the valid match statuses with their
  terminal flag.
- `PUT /api/admin/matches/{uuidMatch}` — update a match's status and/or name.
- `POST /api/admin/matches/{uuidMatch}/stop` — force the match into the `ENDED`
  terminal status.
- `POST /api/admin/matches/{uuidMatch}/pause` — set status to `PAUSED`.
- `POST /api/admin/matches/{uuidMatch}/resume` — set status back to `RUNNING`.
- `DELETE /api/admin/matches/{uuidMatch}` — delete a match (and its runtime
  state rows) only when it is in a terminal status.
- react-admin Matches page: detail modal, Edit modal, Stop and Delete buttons.

All endpoints require the `ADMIN` role.

### 1.1 Background — the bug that motivated the info endpoint

In the react-admin Matches page (v0.19.10) the detail modal called
`GET /api/match/{uuidMatch}/info`. That endpoint enforces a per-user ownership
check: if the authenticated admin tries to open a match created by a guest
player, the backend returns `404 MATCH_NOT_FOUND`. The fix is a dedicated
admin-scoped endpoint that bypasses the ownership check entirely.

---

## 2. Endpoint APIs

The OpenAPI source of truth is
[`code/backend/java/adapter-rest/src/main/resources/openapi/v0.19.12-admin-match-control-api.yaml`](../code/backend/java/adapter-rest/src/main/resources/openapi/v0.19.12-admin-match-control-api.yaml).

All endpoints require:

| Header          | Required | Description                          |
|-----------------|----------|--------------------------------------|
| `Authorization` | yes      | `Bearer <accessToken>` (ADMIN only)  |

Role enforcement is handled by each backend's existing JWT filter / middleware
(the AWS Lambda handler checks the role field explicitly).

### 2.1 `GET /api/admin/matches/{uuidMatch}/info`

Returns the full match detail for **any** match, without the per-user ownership
check that `GET /api/match/{uuidMatch}/info` enforces for players.

The response body has the same shape as
[`GET /api/match/{uuidMatch}/info`](Step19_SinglePlayerMatchCreation.md#24-get-apimatchuuidmatchinfo):

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

| HTTP status | Cause                                                |
|-------------|------------------------------------------------------|
| `200`       | Full `MatchDetail` (summary + locations + registry)  |
| `404`       | `MATCH_NOT_FOUND` — no match with the given uuid     |
| `401`       | Missing / invalid bearer token                       |
| `403`       | Caller does not hold the ADMIN role                  |

Implementation by backend:

| Backend | Controller method             | Service method                        | Persistence        |
|---------|-------------------------------|---------------------------------------|--------------------|
| Java    | `MatchController.getAdminMatchInfo` | `MatchQueryService.getMatchInfoForAdmin` via `MatchQueryPort` | `MatchReadPort.findMatchByUuid` |
| Python  | `MatchController.get_admin_match_info` | `MatchQueryService.get_match_info_for_admin` via `MatchQueryPort` | same persistence layer |
| PHP     | `MatchController::getAdminMatchInfo` | `MatchQueryService::getMatchInfoForAdmin` via `MatchQueryPort` | same |
| AWS     | `match/handler.py _get_admin_match_info` | — | `db_utils.get_item("MATCH#{uuid}")` |

In the Java / Python / PHP backends the detail-building logic was refactored
into a shared private `buildDetail` helper that is called by both
`getMatchInfo` (per-user) and `getMatchInfoForAdmin` (admin, no ownership
check). The AWS handler already had a shared `_detail_from_item` helper and
follows the same pattern.

The react-admin `matchApi.getMatchInfo` (formerly calling
`GET /api/match/{uuid}/info`) was updated to call
`GET /api/admin/matches/{uuid}/info` instead.

### 2.2 `GET /api/admin/matches/statuses`

Returns every valid match status with its `terminal` flag. Terminal statuses
(`ENDED`, `GAMEOVER`) mark a match as stopped and therefore deletable.

```json
[
  { "value": "CREATED",  "terminal": false },
  { "value": "RUNNING",  "terminal": false },
  { "value": "PAUSED",   "terminal": false },
  { "value": "ENDED",    "terminal": true  },
  { "value": "GAMEOVER", "terminal": true  }
]
```

| HTTP status | Cause                                    |
|-------------|------------------------------------------|
| `200`       | Array of `MatchStatus` objects           |
| `403`       | Caller does not hold the ADMIN role      |

### 2.3 `PUT /api/admin/matches/{uuidMatch}`

Updates the admin-editable fields of a match. Both `status` and `name` are
optional, but at least one must be provided.

Request body (`MatchUpdateRequest`):

```json
{
  "status": "PAUSED",
  "name":   "Renamed adventure"
}
```

| HTTP status | Cause                                                   |
|-------------|---------------------------------------------------------|
| `200`       | `{ "status": "UPDATED", "uuid": "<uuidMatch>" }`        |
| `400`       | `INVALID_INPUT` — no field provided; `INVALID_STATUS` — unknown status value |
| `404`       | `MATCH_NOT_FOUND`                                       |

### 2.4 `POST /api/admin/matches/{uuidMatch}/stop`

Convenience shortcut — equivalent to `PUT` with `{ "status": "ENDED" }`.

| HTTP status | Cause                                                    |
|-------------|----------------------------------------------------------|
| `200`       | `{ "status": "UPDATED", "uuid": "<uuidMatch>" }`         |
| `404`       | `MATCH_NOT_FOUND`                                        |

### 2.5 `POST /api/admin/matches/{uuidMatch}/pause`

Sets the match status to `PAUSED`.

| HTTP status | Cause                                                    |
|-------------|----------------------------------------------------------|
| `200`       | `{ "status": "UPDATED", "uuid": "<uuidMatch>" }`         |
| `404`       | `MATCH_NOT_FOUND`                                        |

### 2.6 `POST /api/admin/matches/{uuidMatch}/resume`

Sets the match status to `RUNNING`.

| HTTP status | Cause                                                    |
|-------------|----------------------------------------------------------|
| `200`       | `{ "status": "UPDATED", "uuid": "<uuidMatch>" }`         |
| `404`       | `MATCH_NOT_FOUND`                                        |

### 2.7 `DELETE /api/admin/matches/{uuidMatch}`

Deletes a match together with its derived runtime state rows
(`gaming_state_locations`, `gaming_state_registry`). Only matches in a
terminal status may be deleted.

| HTTP status | Cause                                                         |
|-------------|---------------------------------------------------------------|
| `200`       | `{ "status": "DELETED", "uuid": "<uuidMatch>" }`              |
| `404`       | `MATCH_NOT_FOUND`                                             |
| `409`       | `MATCH_NOT_STOPPED` — match is not in a terminal status       |

---

## 3. Match Lifecycle

```
CREATED → RUNNING → PAUSED → RUNNING   (resume)
                 ↘          ↗
                  ENDED  (stop / admin PUT)
GAMEOVER          (set via PUT)
```

Terminal statuses: `ENDED`, `GAMEOVER`. Only a match in a terminal status may
be deleted.

---

## 4. Implementation Details

### 4.1 Java

New methods on the `MatchQueryPort` interface and `MatchQueryService`:

- `getMatchInfoForAdmin(String matchUuid)` — bypasses the `idUserCreator`
  ownership check; calls the shared private `buildDetail(match, null)`.
- `buildDetail(GamingMatchEntity match, String userCreatorUuid)` — private
  helper shared by `getMatchInfo` (per-user) and `getMatchInfoForAdmin`.

`MatchController` additions:

| HTTP method | Path                                    | Controller method       |
|-------------|-----------------------------------------|-------------------------|
| `GET`       | `/api/admin/matches/{uuidMatch}/info`   | `getAdminMatchInfo`     |
| `GET`       | `/api/admin/matches/statuses`           | `listMatchStatuses`     |
| `PUT`       | `/api/admin/matches/{uuidMatch}`        | `updateMatch`           |
| `POST`      | `/api/admin/matches/{uuidMatch}/stop`   | `stopMatch`             |
| `POST`      | `/api/admin/matches/{uuidMatch}/pause`  | `pauseMatch`            |
| `POST`      | `/api/admin/matches/{uuidMatch}/resume` | `resumeMatch`           |
| `DELETE`    | `/api/admin/matches/{uuidMatch}`        | `deleteMatch`           |

`MatchPersistenceAdapter` additions: `updateMatch`, `deleteMatch` (plus cascade
delete of location and registry state rows).

### 4.2 Python

Same structure:
- `MatchQueryPort.get_match_info_for_admin` / `MatchQueryService.get_match_info_for_admin`.
- `MatchController.get_admin_match_info` registered at
  `/api/admin/matches/{uuid_match}/info` (GET).
- Lifecycle methods on `MatchCommandPort` / `MatchCommandService`.

### 4.3 PHP

- `MatchQueryPort::getMatchInfoForAdmin` / `MatchQueryService::getMatchInfoForAdmin`.
- `MatchController::getAdminMatchInfo`; route registered in `public/index.php`:
  `$group->get('/admin/matches/{uuidMatch}/info', [$matchController, 'getAdminMatchInfo'])`.

### 4.4 AWS Serverless

- `_get_admin_match_info(match_uuid)` in `lambda/match/handler.py` — fetches
  `MATCH#{uuid}` from DynamoDB and calls the shared `_detail_from_item` helper
  without any `userCreatorUuid` comparison.
- Route added to `template/match.yaml`:
  `RouteKey: "GET /api/admin/matches/{uuidMatch}/info"`.

### 4.5 react-admin

`src/api/matchApi.js`:

- `getMatchInfo(uuid)` now calls `GET /api/admin/matches/${uuid}/info` (was
  `GET /api/match/${uuid}/info`). This is the fix for the "Match not found or
  not accessible" bug when an admin opened a guest-created match.
- `listMatchStatuses()`, `updateMatch()`, `stopMatch()`, `pauseMatch()`,
  `resumeMatch()`, `deleteMatch()` added.

`src/pages/MatchesPage.jsx` changes:

- Detail modal calls `matchApi.getMatchInfo` (via the admin endpoint).
- Edit modal: status dropdown populated from `listMatchStatuses()`; name field.
- Stop button: calls `stopMatch` and refreshes the list.
- Delete button: visible only when `isTerminal(match.status)`; calls
  `deleteMatch` with confirmation.

---

## 5. Tables

No schema changes in v0.19.12. The endpoints read and write the tables already
created in Steps 19–20:

| Table                    | Read | Write | Notes                                           |
|--------------------------|:----:|:-----:|-------------------------------------------------|
| `gaming_match`           | ✔    | ✔     | Updated by PUT/stop/pause/resume, deleted by DELETE |
| `gaming_state_locations` | ✔    |       | Read for the info detail; cascade-deleted by DELETE |
| `gaming_state_registry`  | ✔    |       | Read for the info detail; cascade-deleted by DELETE |

---

## 6. Test Cases

### 6.1 Java

| Test class              | New scenarios                                                                                   |
|-------------------------|------------------------------------------------------------------------------------------------|
| `MatchQueryServiceTest` | `getMatchInfoForAdmin`: blank uuid → null; match not found → null; match owned by another user is returned (ownership check bypassed). |
| `MatchControllerTest`   | `GET /api/admin/matches/{uuid}/info`: 200 with detail; 404 when missing. Existing stop/pause/resume/delete/update/statuses cases unchanged. |

Run from the Java project root:

```bash
mvn -pl core,adapter-rest -am test
```

### 6.2 Python

| Test file                    | New scenarios                                                                              |
|------------------------------|-------------------------------------------------------------------------------------------|
| `test_match_query_service.py` | `get_match_info_for_admin`: blank uuid, match not found, any-owner match returned.       |
| `test_match_controller.py`   | `GET /api/admin/matches/m1/info`: 200 with detail; 404 when service returns None.        |

### 6.3 PHP

| Test class              | New scenarios                                                                               |
|-------------------------|--------------------------------------------------------------------------------------------|
| `MatchQueryServiceTest` | `getMatchInfoForAdmin`: blank uuid, match not found, any-owner match returned.             |
| `MatchControllerTest`   | `GET /api/admin/matches/m1/info`: 200 with full detail; 404 when service returns null.    |

### 6.4 Robot Framework

No dedicated Robot suite was added for the admin info endpoint. The existing
`code/tests/robot/tests/19_match/match_creation.robot` covers the per-user info
endpoint; admin endpoint coverage can be added to that suite or to a future
`21_admin_match_control` suite.

---

## 7. API Changes Summary

All changes in v0.19.12 are admin-only additions; no existing endpoint
contracts were modified.

| Endpoint                                  | Status                     |
|-------------------------------------------|----------------------------|
| `GET /api/admin/matches/{uuid}/info`      | NEW (v0.19.12) — admin match detail without ownership check |
| `GET /api/admin/matches/statuses`         | NEW (v0.19.12)             |
| `PUT /api/admin/matches/{uuid}`           | NEW (v0.19.12)             |
| `POST /api/admin/matches/{uuid}/stop`     | NEW (v0.19.12)             |
| `POST /api/admin/matches/{uuid}/pause`    | NEW (v0.19.12)             |
| `POST /api/admin/matches/{uuid}/resume`   | NEW (v0.19.12)             |
| `DELETE /api/admin/matches/{uuid}`        | NEW (v0.19.12)             |
| `GET /api/admin/matches`                  | unchanged (v0.19.10)       |
| `GET /api/match/{uuid}/info`              | unchanged (v0.19.0) — per-user, ownership-checked |

react-admin `matchApi.getMatchInfo` was updated to call the new admin endpoint
instead of the per-user endpoint (bug fix — no API contract change).

---

## Version Control
- Created with AI prompts:
  ```
  > using "0.19.12" version: read documentation files. admin console, into react-admin, needs to be able to:
    - stop, pause, resume a match (set status)
    - modify match fields (name, status, expCost...)
    - delete a match (only when stopped/ended)
    - see the full match detail (summary + runtime state)
    show a list of valid statuses in the react-admin edit form.
    implement in all 4 backends, update openapi, add robot tests.
  ```

- **Document Version**: 0.19.12
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.19.12 | Admin match control (list statuses, update, stop, pause, resume, delete, admin match detail) | May 21, 2026 |

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

