# Step 6 — User profile: backend

**Status: developed (October 23, 2026) in version 1.7.0, together with steps 6-12. Robot suite `tests_v1/06_user_profile` written, not yet run. Analysis decisions below are kept; "Implementation notes" lists what shipped.**
Roadmap line: *who am I, statistics and preferences* ([Roadmap](./Roadmap.md) step 6).
**Owner goal of steps 6-12:** the same person uses the site from several devices (web and mobile) with the same Google account and finds the same game state: starts on device A, continues on B, then C, back on B finds C's progress, back on A finds B's. The steps are developed together, so placement between them is free.
Steps 6-12 are developed together and released as 1.7.0, docs included. Chain: [Step 6](./Step06_UserProfileBackend.md) foundation · [Step 7](./Step07_UserProfileReactGame.md) · [Step 8](./Step08_MatchConcurrencyMultiDevice.md) · [Step 9](./Step09_MatchListCancelledLastPlayed.md) · [Step 12](./Step12_PaginationAndMultiDeviceContinuity.md).

## 1. Goal

`GET /api/auth/me` tells who the user is, with statistics and preferences, on the 3 backends; the preferences can be changed; every gameplay write stamps the match reliably and counts play time (the foundation of steps 8, 9 and 12).

## 2. Decisions (owner, October 21, 2026)

- **Foundation moved here:** every gameplay write endpoint updates `gaming_match.ts_update` in the same transaction, with ONE timestamp per request (JPA `@PreUpdate` must not write a second, different value). The 11 endpoints (same list verified on Java, Python and AWS): `POST /api/matches/{uuid}/start` and `/join`; `POST /api/gameplay/{uuid}/action/pass`, `/sleep`, `/use-exp`, `/execute-event`, `/select-choice`; `/inventory/use-item`, `/inventory/drop-item`; `/movements/start`; `PATCH /api/match/{uuid}/end/{uuidEvent}`.
- **Admin writes** (pause, resume, stop, edits, owner move, snapshot restore) bump `ts_update` but NEVER `play_ms`.
- **Play time:** new match counter `play_ms`; on every gameplay write `play_ms += min(now − previous ts_update, cap)`, the cap is a parameter with code default 5 minutes. It replaces the old roadmap rule "sum of match durations like the KPI" (calendar time would count the days away).
- **Snapshots (checked):** a restore already sets `ts_update = now` (the other devices become stale: wanted). `play_ms` is NOT in `MATCH_COLUMNS`, so a restore never rolls it back (same idea as the KPI counters); new snapshots capture it through `SELECT *`; old snapshots keep their checksum (it covers the stored payload). AWS restore must behave the same.
- **Export:** NO second schema version. The CURRENT `match-export-v1.schema.json` (Java copy and AWS copy) gets an optional `playMs`; missing at import = 0. Its status list (`CREATED`, `RUNNING`, `PAUSED`, `ENDED`, `GAMEOVER`) gets `CANCELLED` (missing today: a cancelled match cannot be exported) and `BANNED`; the import keeps the original status. No backward compatibility is needed, existing matches start from 0, no backfill.
- **Statistics** in `GET /api/auth/me`, computed on the fly: played = `RUNNING`, `PAUSED`, `ENDED`, `GAMEOVER`; completed = `ENDED`; `GAMEOVER` is a separate counter; total play time = sum of `play_ms`; total clocks played. `CANCELLED` and `BANNED` ([Step 10](./Step10_AdminUserManagementBackend.md)) matches are excluded from everything (played, time, clocks). The query uses the list of included statuses, so a new terminal status is excluded by default. Guests get the same statistics.
- **AWS indexes:** still TWO GSIs per table, both redefined in 1.7.0, no new index (design and free-tier plan in section 4). GSI1 "by owner" serves the player match list, the statistics, "last played", the duplicate-match guard, the merge, the deletion, the export, the count and the admin `userUuid` filter; GSI2 "by type" serves the admin lists.
- **No backfill:** every AWS table is recreated with 1.7.0 (data lost, accepted) and the seed writes `playMs`, the match `summary` map and the new keys.
- **Preferences:** `PATCH /api/auth/me` with `{language, highContrast}`, CSRF header required, refused to guests with 403 `GOOGLE_ACCOUNT_REQUIRED` (guest preferences live only in localStorage); language in `users.language`, high contrast in `users.theme_selected`; no new table; AWS attributes on the `USER#` item. Themes and languages must be extensible: `theme_selected` takes `default` or `high-contrast`, validated against a list parameter (code default `default,high-contrast`); language is validated against a supported-languages list parameter (code default `en,it`); on the 3 backends. Adding a theme or a language is a config change, no schema change. `GET /api/echo/status` exposes `supportedLanguages` and `supportedThemes`; react-game shows only those that also have a translation or theme bundle.
- OpenAPI, unit tests (> 96% of new code), Robot suite for the profile endpoints.

## 3. Sub-points per component

### 3.1 Java (`code/backend/java/`)
- Flyway `V1.7.0__match_play_ms.sql` (SQLite and PostgreSQL; steps 10 and 12 add the siblings `V1.7.0_1__` and `V1.7.0_2__`): `gaming_match.play_ms BIGINT NOT NULL DEFAULT 0`. No change to `users` (`language` and `theme_selected` exist; `theme_selected` is TEXT, default `'default'`).
- Touch in core: one port and service stamps the match once per command; `GamingMatchEntity.@PreUpdate` reuses that stamp (or is replaced by explicit stamping), so a request never writes two values. Today the match row is saved only by `TurnCycleStoreAdapter`, `WeatherStoreAdapter`, `MatchCommandService`, `MatchPersistenceAdapter`, the snapshot status/restore and the guest merge: `select-choice` consumes no turn and does not touch it, `drop-item` probably neither. **Audit all 11 endpoints** and fix the ones that do not stamp. Admin match writes stamp too, without `play_ms`.
- Only a successful write touches; a refused request (4xx) leaves `ts_update` and `play_ms` as they were (in [Step 8](./Step08_MatchConcurrencyMultiDevice.md) a request refused after the version claim only changes the version).
- `play_ms` is updated with the same stamp from the `ts_update` loaded at request start; exactness under concurrency comes from the claim of Step 8.
- Export/import (`MatchExportStoreAdapter`, `NeutralColumnCodec`) carry `playMs`; the schema copy in `adapter-rest/.../openapi/match-export-v1.schema.json` gets the optional property.
- `AccountPort.profile` gets a stats query (`GROUP BY status` over the matches the user created, included statuses only: counts, sum of `play_ms`, sum of `current_clock`) and a new `updatePreferences`.
- `SessionController`: `PATCH /api/auth/me`, CSRF checked like match creation (`CsrfTokenService`), a guest is refused with 403 `GOOGLE_ACCOUNT_REQUIRED`, partial body allowed, language and theme validated against the two list parameters (400 on an unknown value), answers the profile. `EchoController` adds `supportedLanguages` and `supportedThemes` to `/api/echo/status`.
- Parameters in `application.yml`: `play-time-cap-seconds` (default 300, env `PLAY_TIME_CAP_SECONDS`), `supported-languages` (default `en,it`), `supported-themes` (default `default,high-contrast`); names proposed.
- Snapshot code stays as it is (`MATCH_COLUMNS` leaves `play_ms` alone); a unit test pins it.

### 3.2 Python (`code/backend/python/`)
- Model column `play_ms` and an `align_schema()` entry. The Python `users` model has NO `theme_selected` column: add it (model + `align_schema()`).
- `gaming_match.ts_update` is set by hand in five adapters (match persistence, time store, weather store, turn cycle store, snapshot): one helper `touch_match(...)` used by every gameplay write, same stamp rules as Java.
- `/me` statistics and `PATCH /me` (guests refused, 403) in `session_controller.py` and `account_service.py`; the three parameters in `config.py`; `echo_controller.py` adds the two echo fields; `match_export_store_adapter.py` carries `playMs`.

### 3.3 AWS (`code/backend/aws/`)
- Attribute `playMs` on the match METADATA item (camelCase like `currentClock`); `ts_update` stays epoch ms. `db_utils.batch_put_items` stamps one `now` per flush, but direct `put_item`/`update_attributes` calls of the same request stamp their own: compute the request stamp once at `repo.begin()` and hand it to `repo.flush()`.
- Snapshots: `snapshots.restore_state` replaces the whole METADATA item with the snapshot's plus `_META_KEEP`; add `playMs` to `_META_KEEP` (kept) and to `_META_SKIP` (never captured), so a restore cannot roll it back.
- `template.yaml`: GSI1 and GSI2 are redefined (keys and projections of section 4). The match METADATA item gets the stable `summary` map, built at every flush by `_summary_from_item` without `currentClock`; `currentClock`, `ts_update` and `playMs` stay top-level and are projected only on GSI1. Code that reads the 14 loose match attributes from GSI rows (`_list_user_matches`, `_has_active_match_for_story`, the merge, the deletion, the guest purge, `user_lookup`, the export, the admin list) reads `summary` instead; every writer of the match keys (creation in `match/handler.py`, owner move, guest merge in `common/sso.py`, import in `match_export.py`) keeps `GSI1_PK = USER_MATCHES#<owner>` and sets `summary`. The admin match list no longer shows the live clock (detail only): accepted.
- `match_export.py` and the schema copy `lambda/match/match_export_v1.schema.json` carry `playMs`.
- `PATCH /api/auth/me` route in `template/auth.yaml` and `lambda/auth/handler.py`; attributes `language` and `theme_selected` on `USER#<uuid>`; CORS already allows `PATCH` and `X-CSRF-TOKEN`; guests refused with 403. The three parameters are SAM parameters with code defaults; `lambda/echo/handler.py` adds the two echo fields.

### 3.4 react-game / react-admin
- None here: the page is [Step 7](./Step07_UserProfileReactGame.md).

### 3.5 OpenAPI
- ONE OpenAPI file for steps 6-12, `v1.7.0-multi-device-api.yaml`; this step adds `GET /api/auth/me` (adds `preferences` and `stats`; names proposed: `matchesPlayed`, `matchesCompleted`, `matchesGameOver`, `playTimeMs`, `clocksPlayed`) and `PATCH /api/auth/me` (400, 401, 403 for CSRF and `GOOGLE_ACCOUNT_REQUIRED`); `supportedLanguages` and `supportedThemes` in the echo status; `playMs` in the export schema.

### 3.6 Tests
- Unit (Java, Python, AWS; coverage > 96%): per endpoint of the list, one new `ts_update` and the `play_ms` step (normal, capped, first write after creation); admin writes bump `ts_update` only; a refused request does not touch; no second `@PreUpdate` value; restore keeps `play_ms` and an old snapshot still passes its check; stats per status (`CANCELLED`, `BANNED`, `CREATED` excluded); PATCH validation against the lists, CSRF, partial body, guest refused; echo fields; on AWS the match `summary` map and the GSI1 keys set at creation, owner move, merge and import; export round trip with `playMs`, an import without it (0), `CANCELLED` and `BANNED` exported and imported with their status.
- Robot `tests_v1/06_user_profile/user_profile.robot` on all backends: `/me` statistics after some moves, PATCH round trip, unknown language and theme refused, guest refused, missing CSRF refused, play time grows and does not drop after an admin snapshot restore.

### 3.7 Docs (when developed)
- [Data Model](../DataModel.md) (`play_ms`/`playMs`, preferences, the two redefined GSIs), [Security](../Security.md) (CSRF on `PATCH /me`), [Environments](../Environments.md) (the three parameters).

## 4. DynamoDB indexes and free tier

**Rule (owner):** every environment (dev, test, alpha, beta, prod) stays FREE; no extra cost allowed. Today test, alpha, beta and prod are on-demand (not free).

Facts (AWS ones as stated by the owner; `samconfig.toml` and `template.yaml` verified):
- Always-free DynamoDB: 25 GB, 25 RCU and 25 WCU of PROVISIONED capacity per Region and payer account, Standard class; every GSI draws from the same 25. On-demand is billed from the first request (us-east-1 about $0.625 per million writes and $0.125 per million reads, GSI writes included); an idle on-demand table costs nothing.
- Regions: dev and test in us-east-2; alpha, beta and prod in us-east-1. Dev is PROVISIONED 10/10 + 2 GSIs × 5/5 = 20 of 25; test, alpha, beta and prod are PAY_PER_REQUEST.
- An index projection or key cannot change in place (delete + create, CloudFormation one GSI per deploy); at most 20 NonKeyAttributes per index, 100 per table. Two GSIs is the minimum: matches need two orders (by owner; all by date for the admin), guest items two lookups (token; guest list). Google `USER#` items have no GSI1 keys today (only GSI2 `GOOGLE_USER_LIST` / `DELETING_USERS` and a `summary` map); the retention job reads the whole `GOOGLE_USER_LIST` partition checking `summary.ts_last_access`.

**Final design (decided): still TWO GSIs per table, both redefined in 1.7.0, no new index.**
- GSI1 "by owner": `USER_MATCHES#<owner>` / `MATCH#<tsInsert>#<uuid>`, `GUEST_TOKEN#<hash>`, `USER_IDENTITIES#<uuid>`, `USER_SESSIONS#<uuid>` unchanged; NEW on Google `USER#` items `GSI1_PK = USERSTATE#<n>`, `GSI1_SK = <nickname_lower>#<uuid>` (admin users by state and nickname prefix with `begins_with`; updated when state or nickname change; guests excluded, they keep `GUEST_TOKEN#`; email exact stays on the `EMAIL#` item). Projection: `summary`, `currentClock`, `ts_update`, `playMs`, `username`, `role`, `token_version`, `guest_token` = 8 of 20 (18 today).
- Match METADATA gets a STABLE `summary` map (uuid, storyUuid, difficultyUuid, name, status, expCost, rngSeed, userCreatorUuid, tsInsert, singlePlayer, characterTemplateUuid, classUuid, traitUuids); `currentClock`, `ts_update` and `playMs` stay top-level, projected only on GSI1.
- GSI2 "by type": `MATCH`, `STORY_LIST`, `GUEST_LIST`, `DELETING_USERS` unchanged; `GOOGLE_USER_LIST` gets SK `{ts_last_access:013d}#<uuid>` (admin users ordered by last access; the retention job becomes an SK range query reading only expired users), updated at most once a day (first access of the day). Projection: ONLY `summary` = 1 of 20 (15 today).
- Effects: a move writes GSI1 only (today GSI1 and GSI2 at every clock change); GSI2 is written only when the status changes; users by nickname and by last access need no new index; hot partitions `MATCH` (GSI2) and `USERSTATE#2` (GSI1) are accepted (the 1000 WCU per partition limit is far above the free capacity), revisit in V4 with multiplayer. Dev capacity stays 10/10 + 2 × 5/5 = 20 of 25.

**Free plan (decided).** us-east-1: alpha (later beta) PROVISIONED inside the 25 units (alpha 10/10 + 2 × 5 = 20); prod on-demand while idle; at the beta launch beta takes alpha's units and alpha is shut down right after the transfer. us-east-2: if the AWS dev stack is not needed (local dev uses SQLite) delete it and give test all 25 units (table 13/13 + 2 GSIs × 6/6); otherwise dev 5/5 + 2 × 2 and test 8/8 + 2 × 4. Throttling on provisioned public stages is accepted: boto3 retries with backoff, the existing `dynamodb-throttles` alarm watches it, and a stage where it fires often goes on-demand (cents) after talking with the owner.

**1.7.0 deploy procedure (owner).** No table rename, no dual write, no migration: every AWS environment (dev, test, alpha, prod) is completely destroyed and recreated with 1.7.0; ALL data is lost and that is accepted; the new tables are born with the final indexes and the seed fills them. Deletion protection on the public stages is disabled first; AWS commands run only by or with the owner. Alpha IS redeployed.

**Rule for future indexes on live stages (decided, with a condition):** never replace an index in place; create a new index with a new name, switch the code, drop the old one (3 deploys), ONLY if the temporary extra index fits in the free units (for example lower capacities during the switch); otherwise wait for a planned remove-all and redeploy.

## 5. Open points

1. (decided) Foundation in this step: stamp on every write, one timestamp per request.
2. (decided) `play_ms` formula with cap; admin writes never touch it; a restore never rolls it back.
3. (decided) `playMs` in the current export schema, missing = 0; the status list gets `CANCELLED` and `BANNED`, the import keeps the original status; no backfill, no compatibility.
4. (decided) Statistics on the fly; played = `RUNNING`, `PAUSED`, `ENDED`, `GAMEOVER`; `CANCELLED` and `BANNED` count nowhere; guests get them too.
5. (decided) AWS: still two GSIs per table, both redefined (section 4); match `summary` map; the admin match list loses the live clock.
6. (decided) Preferences in `users.language` / `users.theme_selected`, validated against list parameters (languages `en,it`; themes `default,high-contrast`); `PATCH /me` refuses guests with 403 `GOOGLE_ACCOUNT_REQUIRED`.
7. (decided) `GET /api/echo/status` exposes `supportedLanguages` and `supportedThemes`; react-game shows only those that also have a translation or theme bundle.
8. (decided) Statistics count the matches the user created: fine for V1; "participation stats with multiplayer" is a line in the [Backlog](../Backlog.md).
9. (decided) No backfill: every AWS table is recreated with 1.7.0 (data lost, accepted) and the seed writes `playMs`, the match `summary` map and the new keys.
10. (decided) Dev capacity stays 10/10 + 2 × 5/5 = 20 of 25 (the 3/3 idea is withdrawn). Every environment stays free; future indexes follow the rule of section 4.
11. (decided) 1.7.0 deploy: every AWS environment is destroyed and recreated; all data is lost (accepted); no migration, no backfill, no refresh.
12. (decided) Steps 6-12 are developed and released together as 1.7.0; one OpenAPI file `v1.7.0-multi-device-api.yaml`, Flyway siblings `V1.7.0__`, `V1.7.0_1__`, `V1.7.0_2__`.

## Implementation notes (1.7.0)

- Names: `Flyway V1.7.0__match_play_ms.sql` (SQLite and PostgreSQL); the stats fields are `matchesPlayed`, `matchesCompleted`, `matchesGameOver`, `playTimeMs`, `clocksPlayed` (over the matches the user created).
- One `ts_update` per request: Java `RequestStampFilter` + `MatchStampService`, Python `request_stamp_middleware.py` + `match_stamp.py`, AWS `db_utils.set_request_stamp` / `stamp_ms`. `play_ms` grows by the capped gap (`PLAY_TIME_CAP_SECONDS`, SAM `PlayTimeCapSeconds`); a snapshot restore keeps it.
- `PATCH /api/auth/me` accepts `language`, `theme` and `highContrast` (partial body, at least one), CSRF required, guests 403 `GOOGLE_ACCOUNT_REQUIRED`, unknown values 400 `INVALID_REQUEST`. `GET /api/echo/status` adds `supportedLanguages` and `supportedThemes`.
- New match status `BANNED` (set by step 10); the match export schema adds `playMs`, `CANCELLED` and `BANNED`, and the import keeps every stopped status (`ENDED`, `GAMEOVER`, `CANCELLED`, `BANNED`).
- AWS: GSI1 and GSI2 redefined with the `summary` map, so **every AWS table must be recreated** (no migration). Shared docs: [Data Model](../DataModel.md), [Environments](../Environments.md), [Security](../Security.md).

# Version Control
- **Document Version**: 1.7.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.4.0 | Profile statistics and preferences analysed | October 21, 2026 |
  | 1.7.0 | Developed and released | October 23, 2026 |

- **Last Updated**: October 23, 2026 (v1.7.0)


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
