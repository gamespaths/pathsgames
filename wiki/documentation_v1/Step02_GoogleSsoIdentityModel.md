# Step 2 — Google SSO: identity model

**Status: developed in 1.2.0 (October 20, 2026) — unit tests green, Robot suites written and not yet run, docs aligned.**
Roadmap line: *one user with one or more login providers* ([Roadmap](./Roadmap.md) step 2).
**Steps 2-5 are developed together** (intermediate releases get intermediate versions, bumped by the
owner): [Step 2 identity model](./Step02_GoogleSsoIdentityModel.md),
[Step 3 backend flow](./Step03_GoogleSsoBackendFlow.md),
[Step 4 react-game login](./Step04_GoogleSsoReactGameLogin.md),
[Step 5 privacy and E2E](./Step05_GoogleSsoPrivacyE2E.md).

## 1. Goal

A user can own one or more login identities (Google now, Steam in V3). The platform never stores
a password. The Google email and profile data are stored (see section 2); the email is never written to logs.

## 2. Decisions (owner, October 19, 2026)

- New table `users_identities` (user, provider, provider subject, email, timestamps), ready for Steam.
- The migration drops only `password_hash` and `google_id_sso` from `users`; `email_address` is kept and stores the Google email. States
  `1` (registration) and `5` (password_reset) of `users.state` stay in the enum but are documented as unused.
- `username` = technical unique value `google_<first 8 chars of the user uuid>`.
- `nickname` = the Google email local part (only gmail.com accounts accepted), `+tag` removed, set
  **only at creation** (never refreshed from Google). Duplicates get an incremental suffix on the
  nickname (`mario.rossi#2`).
- Google scopes in the console stay `openid` + `email`, but the GIS ID token carries the profile claims anyway (`sub`, `email`, `email_verified`, `name`, `given_name`, `family_name`, `picture` on lh3.googleusercontent.com, `locale`): limiting the Data Access scopes does not remove them.
- The email is stored in `users.email_address` and **never written to logs** (error logs included); the nickname is still derived from its local part.
- Profile data per provider in new columns of `users_identities`: `profile_name`, `given_name`, `family_name`, `picture_url`, `locale`, `ts_profile_update`; refreshed at every Google login. DynamoDB: attributes of the `IDENTITY#GOOGLE#{sub}` item. Steam in V3 fills the same columns.
- `GET /api/auth/me` returns `displayName` (rule: "given_name family_name" if present, else `name`, else nickname), `pictureUrl`, and always `username` and `nickname` too (all 3 backends, OpenAPI).
- Match export includes the user's `users_identities` rows and the import recreates them (an imported Google user can still log in; also the base for moving Google users between stages).
- **Identity rules (owner)**: the email identifies the user (two different emails are two different users) and never changes; only VERIFIED emails and only `@gmail.com` accounts enter the system. Identity key = pair `sub` + email, both stored in `users_identities`; plain unique index on `users_identities (provider, email)`; `sub` checked at every login. The code lowercases the email before saving (no expression index); it is saved as Google returns it, lowercased.
  - Same `sub`, new email (Workspace/Gmail rename): a NEW user with fresh progress; the old user stays and is removed by the 24-month inactivity job.
  - Same email, different `sub` (re-assigned address): login refused with `IDENTITY_MISMATCH` ("contact support"); the owner decides from admin.
  - `email_verified` not true: refused with `EMAIL_NOT_VERIFIED`, nothing written (no user, no log of the email); same on 3 backends.
  - Domain other than `gmail.com` (`googlemail.com` included, owner decision; same mailbox; even a verified Google account): refused with `EMAIL_DOMAIN_NOT_ALLOWED`, nothing written.
  - The email is never updated (it is the key); name, surname, picture and locale are refreshed at every login.
  - Uniqueness: SQL partial unique index on `users.email_address` WHERE NOT NULL (guests have none), SQLite and PostgreSQL. DynamoDB: item `EMAIL#{email}` → user uuid written with a condition rejecting duplicates; it also replaces the email Scans.
  - An `IDENTITY_MISMATCH` is resolved by an admin action in roadmap step 11 ("re-link the Google subject" or "delete the old user", traced in the intervention log).
  - Steam (V3): no email; a Steam user is identified by its Steam id; linking Steam to a Google user is a V3 decision.
  - The email is visible and searchable only in react-admin (users list of step 11, owner move); the AWS admin search may use the `EMAIL#` item.
- **Mapping**: match import maps Google users by email with the `sub` check (a mismatch is a conflict in the import plan), guests by username, old 0.41.4 exports with `emailAddress` by email when present. Admin owner move goes back to uuid → email → username. This replaces the earlier username-only mapping.
- States: new state `7` = deleting (used by the deletion job of [Step 5](./Step05_GoogleSsoPrivacyE2E.md)).
- A lost provider account is not recoverable (rule already in the roadmap, no more detail).
- Identity and data are per backend database (see [Environments](../Environments.md): one backend per public stage).

## 3. Sub-points per component

### 3.0 Static policy pages (FIRST point, DONE, developed with version 1.2.0)
"One source, two outputs", all in `code/frontend/react-game/`; needed so Google Auth Platform Branding can use `https://paths.games/privacy.html` and `https://paths.games/terms.html` (only Google points to them; footer and in-game links keep opening the PolicyBook). Also serves future clients (V3 Android/Steam app) and other external references.
- Texts: the i18n files `src/i18n/en.json` and `it.json` (`modals.privacy`, `modals.terms`, `modals.cookies`) stay the single source.
- `src/data/policies.json`: sections list/order of privacy, terms, cookies (`ns`, `copyright`, `sections`), moved out of `PolicyBook.jsx`, which now spreads it; PolicyBook behaviour unchanged (output 1).
- `src/utils/policyPages.js`: pure functions `escapeHtml`, `missingKeys`, `renderPolicyPage`, `buildPolicyPages`; EN then IT on one page with `#en`/`#it` nav, canonical `https://paths.games/<kind>.html`, "Open in the game" / "Apri nel gioco" link to `/?policy=<kind>`, inline dark style; any missing or blank text throws so the build fails.
- `scripts/generate-policy-pages.mjs`: thin CLI writing `dist/privacy.html`, `dist/terms.html`, `dist/cookies.html` (output 2). `package.json` `"postbuild"` runs it (postbuild, not prebuild: `vite build` empties `dist` first). Both website deploy scripts use `npm run build`, so the pages are synced with the root files; no deploy change.
- Tests: `src/test/policyPages.test.js`, 15 tests, 100% coverage of `policyPages.js`; the react-game suite is green.
- TO DO: Robot check that the three pages answer 200 on the deployed site.

### 3.1 Java (`code/backend/java/`)
- Migrations `adapter-sqlite` and `adapter-postgres`: `db/migration/v1/V1.2.0__user_identities.sql` (first `v1/` folder). Creates `users_identities` (unique index `(provider, email)`, plain non-unique index on `(provider, provider_subject)` because a renamed Gmail gives a new user with the same `sub`; FK to `users`), adds the profile columns and drops `password_hash` and `google_id_sso` (SQLite: table rebuild if the version has no `DROP COLUMN`). Unique index on `users.nickname`.
- Core: identity entity, repository port and JPA/SQLite adapters; nickname generator (local part, strip `+tag`, suffix `#n`) with retry on unique violation.
- Match export carries the user's `users_identities` rows (provider + subject); the import recreates them, so an imported Google user can still log in (base of the stage migration, see [Step 5](./Step05_GoogleSsoPrivacyE2E.md)).
- Match import (`MatchImportService`, today by `emailAddress`) and admin owner move (`MatchOwnerService`, uuid → email → username): mapping as in section 2 (Google users by email with `sub` check, guests by username; owner move uuid → email → username). OpenAPI updated.
- Guests keep `username = nickname = guest_xxx`.

### 3.2 Python (`code/backend/python/`)
- Models mirror the table; no Flyway: add the new table through `create_all` and the column drops/new index to the ALTER list in `app/adapters/persistence/database.py`.
- Same nickname generator, same import / owner-move mapping (Google users by email with `sub` check, guests by username), identity rows in export/import.

### 3.3 AWS (`code/backend/aws/`)
- Item `IDENTITY#GOOGLE#{sub}` → user uuid (point read at login, no Scan).
- Counter item `NICK#{base}` with atomic increment (`ADD`) for the nickname suffix.
- `db_utils.find_user_by_email` (Scan) and `find_users_by_email/username` for owner move: the email Scans are replaced by the `EMAIL#{email}` item; mapping as in section 2.
- Same export/import identity rows and warning as above.
- No SAM parameter in this step.

### 3.3b Dev seeds and Robot
- Dev seeds: only `password_hash` is removed; seed emails (e.g. `player1@test.local`) stay: repeatable `R__insert_dev_test_data.sql` on SQLite and PostgreSQL, the Python seed, AWS `lambda/seed/handler.py`.
- `tests_v0/41_alpha_prep/match_owner_move.robot` stays unchanged (owner move is again uuid → email → username).

### 3.4 react-game / react-admin
- react-game: shows `nickname` (see step 4). react-admin: the email is visible and searchable only here (owner-move form, import dialog).

### 3.5 Docs (when developed)
[Data Model](../DataModel.md) and [Security](../Security.md) updated by the doc agent; `users` states table marks 1 and 5 unused; OpenAPI of import and owner move.

### 3.6 Tests
Unit tests (and Robot with the fake provider minting unverified or non-gmail tokens) for `EMAIL_NOT_VERIFIED`, `EMAIL_DOMAIN_NOT_ALLOWED`, `IDENTITY_MISMATCH`, renamed email, the email uniqueness index and the identity repository, nickname generator (suffix, `+tag`, race/retry) and the username mapping on all backends, coverage > 96%. Robot: import and owner move by username on all backends (existing suites updated).

## 4. Open points

1. Existing V0 users with `google_id_sso` values: the migration drops that column; alpha is emptied at release 1.2, so no real data has to survive.
2. Existing guest nicknames `guest_xxx` and the new unique index on `nickname`: collisions check in the migration.
3. (decided) Mapping by email with `sub` check; see section 2.
4. Nickname change by the player is out of scope (set only at creation).


# Version Control
- **Document Version**: 1.2.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.2.0 | Google login analysis, steps two to five | October 19, 2026 |

- **Last Updated**: October 19, 2026 (v1.2.0)

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
