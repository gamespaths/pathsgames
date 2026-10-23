# Step 10 — Admin tool: user management backend

**Status: developed (October 23, 2026) in version 1.7.0, together with steps 6-12. Robot suite `tests_v1/10_admin_users` written, not yet run. Analysis decisions below are kept; "Implementation notes" lists what shipped.**
Roadmap line: *control users* ([Roadmap](./Roadmap.md) step 10). Pages: [Step 11](./Step11_AdminUserManagementPages.md); the log list and page: roadmap step 14.
The intervention-log WRITER lives here because ban, suspend, unblock and the `IDENTITY_MISMATCH` actions need it; roadmap step 14 extends it to the other admin actions and adds the list and the page.

## 1. Goal

An admin can find a user, read the profile and match history, ban, suspend and unblock Google users and resolve an `IDENTITY_MISMATCH`, with every action traced in the intervention log.

## 2. Decisions (owner, October 21, 2026)

- As in the roadmap: `GET /api/admin/users`, the `IDENTITY_MISMATCH` actions, ban, suspend and unblock, token revocation, ban only for Google users (guests use the per-IP limits of step 0.41), banned-subject hashes, user detail, OpenAPI, unit tests and Robot suite.
- The list uses the **cursor envelope** of [API Conventions](../ApiConventions.md) section 6: `{items, nextCursor, limit}`.
- **Search:** email by exact match only (AWS: the existing `EMAIL#` item); nickname by prefix (`begins_with` on a GSI; `LIKE 'x%'` on SQL); state filter on a GSI `USERSTATE#n` in alphabetical nickname order; the default view (no filter) is ordered by last access and shows active users; guests are excluded (they stay in the Guests page). The same contract on the 3 backends.
- **AWS indexes:** no new index. Google `USER#` items get `GSI1_PK = USERSTATE#<n>`, `GSI1_SK = <nickname_lower>#<uuid>` (state filter and nickname prefix in one Query); the users list ordered by last access reads GSI2 `GOOGLE_USER_LIST` with the new SK `{ts_last_access:013d}#<uuid>`, which also turns the retention job into an SK range query. Details in [Step 6](./Step06_UserProfileBackend.md) section 4.
- **No backfill:** every AWS table is recreated with 1.7.0 (data lost, accepted) and the seed writes the new keys.
- **Suspend:** `until` is mandatory and at most 90 days away; the user is unblocked automatically at login or refresh after that date; the user's matches stay as they are (only a ban touches them). A suspended login answers `ACCOUNT_DISABLED` with `suspendedUntil`.
- **Ban is reversible:** unblock removes the two hashes. The active matches of a banned user get a NEW terminal match status `BANNED`, treated exactly like `CANCELLED` everywhere (terminal, not opened, muted style, excluded from statistics, hidden behind the toggle of [Step 9](./Step09_MatchListCancelledLastPlayed.md)); they stay `BANNED` after an unblock. Only active matches change: the ended matches of a banned user keep their status, stay visible and are counted. [Game Rules](../GameRules.md) carries it from 1.7.0. Ban of a user already in state 7 (deleting): the hashes are written anyway and the deletion job continues.
- **An ADMIN can never be banned or suspended**, by anyone, themselves included: refused.
- Ban and suspend change the state, evict the user from the 60-second state cache of [Step 3](./Step03_GoogleSsoBackendFlow.md) and revoke every access and refresh token. A hash of the banned Google subject is kept (no personal data): HMAC-SHA256 with a secret pepper from a parameter (code default only for dev), table `users_banned_subjects`; the HMAC of BOTH `sub` and email is kept and login is blocked if either matches. Pepper rotation is not supported; the pepper differs per stage.
- **`IDENTITY_MISMATCH`:** the admin arms a one-time re-link; the next login with that email replaces the subject. "Delete the old user" uses the normal deletion of [Step 5](./Step05_GoogleSsoPrivacyE2E.md).
- **Intervention-log writer** (admin id, action, target uuid only, reason) created here and used by ban, suspend, unblock and the mismatch actions. AWS: monthly partition `ADMINLOG#YYYY-MM`. The reason has at most 500 characters and the UI warns "no personal data". Retention 24 months. Roadmap step 14 extends the writer to every other admin action (match stop and delete, restore, owner move, guest purge, story import).
- The email is visible only in the react-admin detail page; the nickname prefix may reveal the email prefix (admin API only): accepted.

## 3. Sub-points per component

### 3.1 Java (`adapter-admin`, `core`, migrations)
- Flyway `V1.7.0_1__admin_users.sql` (sibling of `V1.7.0__` from step 6; SQLite and PostgreSQL): `users.suspended_until` (ISO text, null when not suspended), `users_banned_subjects` (uuid, `hash_sub`, `hash_email`, `ts_insert`; unique indexes on both hashes), `admin_intervention_log` (uuid, `ts_insert`, admin uuid, `action`, `target_uuid`, `reason`). Names proposed. No CHECK constraint exists on `gaming_match.status`, so `BANNED` needs no schema change.
- `GET /api/admin/users?limit&cursor&email&nickname&state`: `email` exact (lowercase, uses `uq_users_email`), `nickname` prefix (case rules of [Step 2](./Step02_GoogleSsoIdentityModel.md)), `state` through the `(state, ts_last_access)` index (alphabetical nickname order on AWS); no filter = newest access first, active users; state 6 (guests) not listable. Item (no email): uuid, nickname, state, role, account type, registration and last access, `suspendedUntil`. The existing `GET /api/admin/users/{identifier}` stays and is extended.
- User detail: profile with the email, identities (provider, subject, names, picture), state and `suspendedUntil`, statistics of [Step 6](./Step06_UserProfileBackend.md), the number of sessions. Match history: the admin reuses `GET /api/admin/matches?userUuid=` (already cursor-paged), no new endpoint.
- Actions (admin port only; verbs as sub-resources, like the existing `/stop` and `/pause` of matches; paths proposed): `POST /api/admin/users/{uuid}/ban` `{reason}`, `/suspend` `{until, reason}`, `/unblock` `{reason}`, `/relink-subject` `{reason}`; the deletion of the old user goes through the existing deletion job (state 7).
- Ban: Google users only (a guest answers 400; an ADMIN answers 400 `ADMIN_NOT_BANNABLE`); state 4; revoke tokens; evict cache; the user's active matches (`CREATED`, `RUNNING`, `PAUSED`) become `BANNED`; write the two HMAC rows. `GoogleLoginService` checks both hashes before creating or finding a user; error code `ACCOUNT_DISABLED` as for a banned user. Pepper parameter (proposed `BANNED_SUBJECT_PEPPER`): refused at startup outside dev when it is the committed default, like `StartupSecretsGuard`.
- Suspend: state 3 (`BLOCKED`) plus `suspended_until` (400 when missing, in the past or more than 90 days away; ADMIN refused); revoke tokens; evict cache. Login and refresh of a state-3 user whose date has passed set the state back to 2 and clear the date; a login before the date answers `ACCOUNT_DISABLED` with `suspendedUntil`.
- Unblock: back to state 2, clears `suspended_until`; for a banned user it also deletes the two hashes. Matches already `BANNED` stay so.
- `MatchStatuses`: add `BANNED` to `ALL` and `TERMINAL`; admin statuses endpoint, OpenAPI enums, the export schema status list (import keeps the original status), KPI and statistics queries use the terminal set or the included list.
- Intervention-log writer in core (`AdminInterventionPort.record(adminUuid, action, targetUuid, reason)`), written with the state change; actions `BAN`, `SUSPEND`, `UNBLOCK`, `RELINK_SUBJECT`, `DELETE_OLD_USER`; reason mandatory (max 500); never nickname or email. The automatic unblock is written as a system action. A retention job removes rows older than 24 months (with the existing account jobs).
- `IDENTITY_MISMATCH` re-link: nothing is stored when the login is refused, so the admin action arms a one-time flag on the user (for example `relink_pending`); the next verified login with that email replaces the subject and clears the flag.

### 3.2 Python
- Same endpoints and contract: models and `align_schema()` for the columns and tables, `user_admin_controller.py` extended, the Python column for last access is `last_access`; HMAC with `hmac` and the pepper from `config.py`; `match_statuses.py` gets `BANNED`; same writer and retention.

### 3.3 AWS
- Users list: no scan. State filter and nickname prefix: GSI1 `USERSTATE#<n>` with `begins_with` on the lowercase nickname; results are in alphabetical nickname order. The default view (no filter) reads GSI2 `GOOGLE_USER_LIST` (SK `{ts_last_access:013d}#<uuid>`, rewritten at most once a day) ordered by last access and filters "active" in memory (users are few). The last access shown in the list may be up to 24 hours old; the user detail page reads the real value from `USER#`. Both project `summary`, so no table read. Written at user creation and rewritten when the state or the nickname changes. Email exact: `EMAIL#<email>` item then `USER#`.
- Ban/suspend: conditional updates on `USER#`, revoke through `auth_tokens.revoke_all`, HMAC items `BANSUB#<hash>` and `BANEMAIL#<hash>` (conditional puts, deleted at unblock); `suspended_until` attribute; `lambda/auth/handler.py` routes on the admin API (IP allow-list unchanged). Active matches of the user, found through GSI1 `USER_MATCHES#`, get `status = BANNED`; `MATCH_STATUSES` and `TERMINAL_STATUSES` in `match/handler.py` and `common/sso.py` get the value.
- Intervention log: items `ADMINLOG#YYYY-MM` / `<ts_ms:013d>#<seq>` with a `ttl` of 24 months, written with the state change.

### 3.4 react-admin and react-game
- react-admin: none here ([Step 11](./Step11_AdminUserManagementPages.md)); it needs the new status in its status lists.
- react-game: `utils/matchStatus.js` and `MatchStatusBadge.jsx` treat `BANNED` like `CANCELLED` ([Step 9](./Step09_MatchListCancelledLastPlayed.md)).

### 3.5 OpenAPI
- The one file `v1.7.0-multi-device-api.yaml` (admin port paths included): list, detail, ban, suspend, unblock, relink, the `BANNED` match status, errors `USER_NOT_FOUND`, `GUEST_NOT_BANNABLE`, `ADMIN_NOT_BANNABLE`, `SUSPEND_UNTIL_INVALID`, `INVALID_STATE_TRANSITION`, `suspendedUntil` in the `ACCOUNT_DISABLED` body.

### 3.6 Tests
- Unit (coverage > 96%): list filters, default and cursor on each backend, ban side effects (tokens, cache, matches to `BANNED`, hashes, blocked re-registration by `sub` and by email), unblock removing the hashes while matches stay `BANNED`, suspend limits and the automatic unblock, guest and ADMIN refused, pepper guard, re-link flag, log row per action and none for refused actions, retention, statistics excluding `BANNED`.
- Robot `tests_v1/10_admin_users/`: list and search (a check after the database refresh finds a user by nickname), ban then login refused (also with a new fake account that has the same email), unblock then login works, suspend with `until`, mismatch resolution, an admin cannot be banned. The log rows are covered by unit tests only: the list endpoint comes in roadmap step 14.

### 3.7 Docs (when developed)
- [Security](../Security.md) (ban, suspend, pepper), [Data Model](../DataModel.md) (tables, columns, GSI keys, `BANNED`), [Game Rules](../GameRules.md) (already marked from 1.7.0), [Environments](../Environments.md) (pepper), [API Conventions](../ApiConventions.md) only for the new resource paths.

## 4. Open points

1. (decided) Cursor envelope, search rules, suspend rules, writer moved here.
2. (decided) Default view (no filter) = active users ordered by last access (GSI2 `GOOGLE_USER_LIST`, filtered in memory); state filter and nickname search on GSI1 in alphabetical nickname order; last access in the list up to 24 hours old (detail reads the real value); guests excluded.
3. (decided) `IDENTITY_MISMATCH`: one-time re-link armed by the admin; old user deleted with the normal deletion.
4. (decided) Ban reversible, unblock removes the hashes; matches of a banned user become `BANNED` and stay so.
5. (decided) AWS log partition per month, reason max 500 characters with a UI warning, retention 24 months.
6. (decided) Roadmap step 14 extends the writer to every other admin action.
7. (decided) An ADMIN is never banned or suspended; a suspended login answers `ACCOUNT_DISABLED` with `suspendedUntil`.
8. (decided) Pepper rotation not supported, one pepper per stage; nickname prefix revealing the email prefix accepted.
9. (decided) Nickname prefix on GSI1 (`USERSTATE#n` / `<nickname_lower>#<uuid>`), no new index.
10. (decided) Ban of a user in state 7: hashes written anyway, the deletion job continues.
11. (decided) No backfill: every AWS table is recreated with 1.7.0 (data lost, accepted) and the seed writes `playMs`, the match `summary` map and the new keys.
12. (decided) Only active matches become `BANNED`; ended matches of a banned user keep their status, stay visible and counted.

## Implementation notes (1.7.0)

- Endpoints (admin port only): `GET /api/admin/users` (cursor envelope; `email` exact, `nickname` prefix, `state`; default view = active users by last access, guests excluded), `GET /api/admin/users/{identifier}`, `POST /api/admin/users/{uuid}/ban|suspend|unblock|relink-subject` and the new `POST /api/admin/users/{uuid}/deletion` (marks the old user for the normal deletion job). Errors: `USER_NOT_FOUND`, `USER_AMBIGUOUS`, `GUEST_NOT_BANNABLE`, `ADMIN_NOT_BANNABLE`, `SUSPEND_UNTIL_INVALID`, `INVALID_STATE_TRANSITION`, `INVALID_INPUT`.
- Flyway `V1.7.0_1__admin_users.sql`: `users.suspended_until`, `users.relink_pending`, index on `lower(nickname)`, tables `users_banned_subjects` and `admin_intervention_log` ([Data Model](../DataModel.md)). A ban sets state 4 and the active matches `BANNED`; suspend is state 3.
- Ban hashes are HMAC-SHA256 with the stage pepper `BANNED_SUBJECT_PEPPER` (required outside dev/test; SAM `BannedSubjectPepper`; GitHub secret `AWS_ALPHA_LAMBDA_BANNED_SUBJECT_PEPPER`; `.env` `AWS_<STAGE>_LAMBDA_BANNED_SUBJECT_PEPPER`). See [Security §1.2](../Security.md).
- AWS items: `USERSTATE#<n>` on GSI1 and `GOOGLE_USER_LIST` on GSI2 (no third index), `BANSUB#<hash>`, `BANEMAIL#<hash>`, `ADMINLOG#YYYY-MM` (24-month ttl). Backend only requires a non-blank reason of at most 500 characters; the 10-character minimum is a react-admin rule (step 11).

# Version Control
- **Document Version**: 1.7.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.4.0 | Admin user management and log writer analysed | October 21, 2026 |
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
