# Step 8 — Match concurrency: multi-device

**Status: developed (October 23, 2026) in version 1.7.0, together with steps 6-12. Robot suite `tests_v1/08_match_concurrency` written, not yet run. Analysis decisions below are kept; "Implementation notes" lists what shipped.**
Roadmap line: *the same match opened on two devices* ([Roadmap](./Roadmap.md) step 8; the guest merge is in [Step 3](./Step03_GoogleSsoBackendFlow.md)).
Multi-device chain: [Step 6](./Step06_UserProfileBackend.md) (stamp on every write, `play_ms`) · [Step 7](./Step07_UserProfileReactGame.md) · [Step 8](./Step08_MatchConcurrencyMultiDevice.md) · [Step 9](./Step09_MatchListCancelledLastPlayed.md) · [Step 12](./Step12_PaginationAndMultiDeviceContinuity.md). This step builds on the reliable `ts_update` of step 6.

## 1. Goal

Two devices of the same player never overwrite each other's moves: a write made with an out-of-date view is refused (409 `STALE_MATCH`), the device refetches and the player continues from the newest state.

## 2. Decisions (owner, October 21, 2026)

Superseded in 1.8.0: the floating "Match is being updated" notice of the 409 UX is now a "Refreshing" card-page, see "Fixes (1.8.0)" below.

- `GET /api/match/{uuid}/info` returns `matchVersion` (opaque, the `ts_update`). Every gameplay write response also returns the new `matchVersion`, so the same device never becomes stale by its own move. `POST /api/matches` (create) returns it too, so `start` and `join` can send `If-Match`.
- react-game sends it in the header `If-Match`; a different value answers **409 `STALE_MATCH`** (not 412). OpenAPI on every write endpoint (the 11 of [Step 6](./Step06_UserProfileBackend.md)).
- **Header missing:** the backend still does the internal compare-and-set against the value read at request start; a 409 happens only in a real race. The client-side comparison runs only when `If-Match` is sent. Old clients and the existing Robot suites keep working.
- **Atomicity "claim first", NO request-wide unit of work:** the conditional claim is committed first (SQL `UPDATE gaming_match SET ts_update = :new WHERE id = ? AND ts_update = :old`, a short transaction of its own; AWS `UpdateItem` with `ConditionExpression` on METADATA). If it fails: 409 before any other write. A request refused after the claim only changes the version: harmless, the other device refetches and the `play_ms` delta is capped. The request-wide transaction goes to the [Backlog](../Backlog.md) as a V1 hardening idea.
- When the AWS writes exceed the DynamoDB transaction limits (100 items / 4 MB) the remaining writes are split into several chunks after the claim (idempotent writes, retried on failure, logged). A chunk that still fails after the retries is an **accepted risk**: ERROR log with the match uuid and a 5xx answer; NO new alarm (the existing `pathsgames-<env>-public-api-5xx` alarm and its SNS topic in `template/monitoring.yaml` already catch it); the next move rewrites the state; no repair marker. Real concurrency that could read a half-written match is not expected now: accepted risk, no lease.
- **409 UX:** a terminal-state error (`MATCH_NOT_RUNNING`) wins over `STALE_MATCH`; react-game refetches, shows "Match is being updated" (IT "Partita in aggiornamento"), the same text as the banner of [Step 12](./Step12_PaginationAndMultiDeviceContinuity.md), and never re-sends the action. A lost response retried with the old version gets the same 409: accepted.
- **Refetch on return:** on `visibilitychange` to visible, `pageshow` with `persisted`, `online`. Two backend parameters (code defaults) exposed in `GET /api/echo/status` like `googleEnabled`, no build variable: `matchRefetchBrowsers` default `["webkit"]` (desktop Safari plus every iOS browser, all WebKit; the other value is `all`) and `matchRefetchMinHiddenSeconds` default 30. Chrome Android relies on the 409. No polling and no websocket in V1 (realtime stays V4). The full version counter stays in V3.
- **Open choices are NOT exposed on other devices** (owner: "the energy is lost, that's it"): no `openChoices` in `/info`.
- Unit tests and a Robot suite with two clients on the same match.

## 3. Sub-points per component

### 3.1 Java
- Port `MatchVersionPort.claim(matchId, old, new, delta)` in core, implemented by an adapter as one conditional update in its own transaction (the adapters are `@Transactional` per call already); no `TransactionPort`. The 11 commands call it first: after the match is found (404), after the terminal-state check (`MATCH_NOT_RUNNING`) and after the `If-Match` comparison on the loaded row (fast fail); zero rows updated: `StaleMatchException`, mapped to 409.
- `:new` must be strictly greater than `:old` (clock tie: `max(now, old + 1 µs)`) and is the one stamp of the request: `GamingMatchEntity.@PreUpdate` reuses it ([Step 6](./Step06_UserProfileBackend.md)). The claim statement also adds the capped `play_ms` delta.
- `matchVersion` in `MatchInfoResponse` (top level), in `MatchSummaryResponse` of the create answer and in the 11 response DTOs. Error body: `{error: "STALE_MATCH", message, matchVersion: <current>, timestamp}`.
- Parameters in `application.yml`, exposed by `EchoController` in `/api/echo/status`: `matchRefetchBrowsers` and `matchRefetchMinHiddenSeconds` (names proposed).

### 3.2 Python
- Same contract. The claim is an `update(MATCH).where(id == ..., ts_update == old)` committed on its own (the adapters already commit per call); `rowcount == 0` raises the 409 error. No request-scoped session is introduced.
- Config fields and the `echo_controller.py` fields as in Java.

### 3.3 AWS
- `repo.flush()` is the single write point of a request (dirty set, `batch_put_items`). The logic runs in memory first, so a request refused for a domain reason never reaches the flush and never claims. At the flush the first write is the claim: an `UpdateItem` on METADATA with `ConditionExpression ts_update = :old` setting `ts_update = :new` and adding `playMs` (`ConditionalCheckFailedException` is the 409). Without the header `:old` is the value read at request start.
- Today METADATA is written as a whole-item `put` (last writer wins) and there are NO DynamoDB transactions: the dirty set uses `batch_writer` (25 per batch, not atomic). The remaining rows move to chunked `TransactWriteItems` (up to 100 items and 4 MB per chunk); the METADATA `put` of the first chunk carries the claim stamp and is conditional on it; each chunk is idempotent (full item puts), retried with backoff, and a final failure writes an ERROR log with the match uuid and the request returns 5xx, which the existing `public-api-5xx` alarm catches (no new alarm).
- `If-Match` must be added to `AllowHeaders` of the public API in `template.yaml` (the list is explicit because of `AllowCredentials`: today `Content-Type, Authorization, Cookie, X-CSRF-TOKEN`); Java and Python use `*`.
- `matchVersion` = the METADATA `ts_update` as a string; Java and Python use their ISO strings: opaque for the client.
- Parameters as SAM parameters with code defaults; `lambda/echo/handler.py` exposes them.

### 3.4 react-game

Superseded in 1.8.0: the "Match is being updated" message on `STALE_MATCH` is now a "Refreshing" card-page, see "Fixes (1.8.0)" below.
- Keep `matchVersion` in `GamePage` state (from `/info` and the create answer, replaced by every write response); `api/matches.js` adds `If-Match` to the 11 write calls; the 401 retry in `api/client.js` repeats the same header (a 401 happens before any write).
- On `STALE_MATCH`: refetch (`/info` plus the hooks that load clock, weather, locations, inventory, missions and logs, for example through a reload counter in `GamePage`), message "Match is being updated" / "Partita in aggiornamento", the action is never re-sent; `MATCH_NOT_RUNNING` keeps the existing end-of-match flow.
- Refetch on return: the `usePageReturn` hook of [Step 7](./Step07_UserProfileReactGame.md) with the two parameters read from `/api/echo/status` (`ServerContext`). `webkit` detection: iOS (iPhone, iPad, iPod, and iPadOS reporting a Mac with touch) or desktop Safari (Safari in the user agent without Chrome, Chromium, Edg or Android); skipped while a request is in flight.
- Pending choices are not restored after a refetch (decided).

### 3.5 OpenAPI
- The one file `v1.7.0-multi-device-api.yaml` (see [Step 6](./Step06_UserProfileBackend.md)): header parameter `If-Match`, `matchVersion` in `/info`, in the create answer and in the write responses, 409 `STALE_MATCH` on the 11 endpoints, the two `echo/status` fields.

### 3.6 Tests
- Unit (all backends, coverage > 96%): claim success and failure, header absent (internal compare-and-set, one winner in a race), header stale, terminal wins over stale, `ts_update` strictly increasing, no second `@PreUpdate` value, a request refused after the claim leaves the version changed and nothing else (SQL), claim-before-write order and chunking over 100 items and over 4 MB with a retry and a final ERROR log with a 5xx answer (AWS), CORS header (AWS template check), `webkit` detection table.
- Vitest: header sent from the stored version, version replaced by the write response, 409 flow without re-send, trigger matrix (`webkit` filter, `all`, hidden seconds, `pageshow`, `online`), no refetch during a request.
- Robot `tests_v1/08_match_concurrency/`: two sessions of the same user (two fake-provider logins) on one match; `matchVersion` changes at every write; an old version gets `STALE_MATCH` and nothing is written; no header still works; terminal state answers `MATCH_NOT_RUNNING`; two parallel writes with the same version: exactly one succeeds (a Python helper with two threads).

### 3.7 Docs (when developed)
- [API Conventions](../ApiConventions.md) (`If-Match`, `STALE_MATCH`), [Architecture](../Architecture.md) (the claim), [Environments](../Environments.md) (two parameters), [Data Model](../DataModel.md) (AWS write path).

## 4. Open points

1. (decided) No request-wide unit of work; the claim is committed first; the idea is in the [Backlog](../Backlog.md).
2. (decided) Claim first on every backend; on AWS the claim is the first write after the in-memory logic, so a refused request never claims; on SQL a request refused after the claim only changes the version.
3. (decided) Header missing: internal compare-and-set against the value read at request start; 409 only in a real race.
4. (decided) 409 for `STALE_MATCH` (not 412); terminal-state error first.
5. (decided) The board is built from `/info` plus other reads; a write on another device between them mixes versions: accepted, the next write gets the 409 and the refetch fixes it.
6. (decided) Failed chunk retries on AWS: accepted risk, ERROR log with the match uuid, 5xx caught by the existing `public-api-5xx` alarm, the next move rewrites, no repair marker.
7. (decided) `matchRefetchBrowsers` default `["webkit"]`, `matchRefetchMinHiddenSeconds` default 30; Chrome Android relies on the 409.
8. (decided) A lost response retried with the old version gets the 409: accepted. `POST /api/matches` returns `matchVersion`.
9. (decided) Admin writes change the version but are never checked ([Step 6](./Step06_UserProfileBackend.md)).
10. (decided) No polling, no websocket, no `openChoices`; the full version counter stays in V3.
11. (decided) Half-written reads between the claim and the end of the writes: real concurrency like that is not expected now; accepted risk, no lease, no extra work.
12. (decided) ONE message for the 409 and the banner: EN "Match is being updated", IT "Partita in aggiornamento".
13. (decided) No new alarm: a failed chunk returns 5xx, caught by the existing `pathsgames-<env>-public-api-5xx` alarm (SNS topic in `template/monitoring.yaml`), plus the ERROR log with the match uuid.

## Implementation notes (1.7.0)

- `matchVersion` (opaque `ts_update`: ISO text on Java and Python, epoch ms on AWS; clients never parse it) in `/info`, in the create answer and in every gameplay write answer; `If-Match` on all 11 write endpoints; a different value answers 409 `STALE_MATCH`, the terminal-state error wins. See the long description in `v1.7.0-multi-device-api.yaml`.
- Java/Python: `StaleMatchException` mapped to 409 by `MatchVersionAdvice` (Java) / an exception handler in `launcher.py` (Python); the claim is a conditional update of `ts_update` committed first. AWS: `db_utils.claim_version` (condition expression) then the other rows in `TransactWriteItems` chunks (100 items / 4 MB, 3 attempts); a chunk that still fails answers 500 `WRITE_FAILED`. CORS allows `If-Match`.
- react-game: `api/matchVersion.js` (version per match, `If-Match`), `hooks/useMatchRefetchOnReturn.js` (`visibilitychange`, `pageshow`, `online`), parameters `MATCH_REFETCH_BROWSERS` (`webkit`|`all`, default `webkit`) and `MATCH_REFETCH_MIN_HIDDEN_SECONDS` (30) in `GET /api/echo/status`; on `STALE_MATCH` it refetches and shows "Match is being updated".
- Robot helper `resources/ParallelWriteHelper.py` sends the same write from two threads at once.

## Fixes (1.8.0)

- AWS `db_utils.transact_put_items` passes plain values: the boto3 resource client already serializes, and a second `TypeSerializer` pass made every `TransactWriteItems` fail (500 `WRITE_FAILED`). A unit test checks the real wire body.
- AWS `GET /api/match/{uuid}/info` now returns top-level `matchVersion` too (`_detail_from_item`), as Java and Python do.
- react-game `STALE_MATCH` UX (`pages/GamePage.jsx`, `GameBook.jsx` prop `staleKey`, `utils/loadoutCards.js` `buildUpdateMatchCard`, image `refresh` in `data/images.json`): the floating "Match is being updated" notice is gone (supersedes the notice above). After the 409 refetch the left page shows the refreshed location and the right page (mobile: below) shows a card-page "Refreshing" (entity `updateMatch`) saying in two sentences that the page refreshed because the same account moved on another device.
- AWS `match_export.export_match`: the checksum is recomputed after the `playMs` and status overrides, so a live export no longer fails the import with `CHECKSUM_MISMATCH`.

## Fixes (1.10.0)

- AWS: a `ConditionalCheckFailed` of a `TransactWriteItems` chunk is never retried. `db_utils.TransactConditionFailed` is raised, `repo._stale_after_claim` turns it into the stale-match error and `match/handler._route` answers 409 `STALE_MATCH` with the current `matchVersion` (it was 500 `WRITE_FAILED`). Every chunk retry (other errors) is logged as `TRANSACT_RETRY`.
- AWS: an admin `touch` on a dirty `METADATA` moves the request stamp above the stored one.
- Robot `tests_v1/08_match_concurrency/match_concurrency_writes.robot` (7 tests, own story `story_concurrency.json`): `If-Match` / `STALE_MATCH` on execute-event, select-choice, movement, use-item, drop-item, use-exp and end; shared keywords in `concurrency_common.resource`. See `.claude/docs/robot-suites.md`.

# Version Control
- **Document Version**: 1.10.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.4.0 | Same game on several devices analysed | October 21, 2026 |
  | 1.7.0 | Developed and released | October 23, 2026 |
  | 1.8.0 | Fixes after first full Robot run, new refresh card | October 23, 2026 |
  | 1.10.0 | Stale writes answer conflict, more write tests | October 28, 2026 |

- **Last Updated**: October 28, 2026 (v1.10.0)


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
