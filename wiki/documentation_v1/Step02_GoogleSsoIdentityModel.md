# Step 2 — Google SSO: identity model

**Status: analysis (October 19, 2026), not developed.**
Roadmap line: *one user with one or more login providers* ([Roadmap](./Roadmap.md) step 2).
**Steps 2-5 are developed together** (intermediate releases get intermediate versions, bumped by the
owner): [Step 2 identity model](./Step02_GoogleSsoIdentityModel.md),
[Step 3 backend flow](./Step03_GoogleSsoBackendFlow.md),
[Step 4 react-game login](./Step04_GoogleSsoReactGameLogin.md),
[Step 5 privacy and E2E](./Step05_GoogleSsoPrivacyE2E.md).

## 1. Goal

A user can own one or more login identities (Google now, Steam in V3). The platform never stores
an email nor a password: only the provider subject and a nickname.

## 2. Decisions (owner, October 19, 2026)

- New table `users_identities` (user, provider, provider subject, timestamps), ready for Steam.
- The migration drops `email_address`, `password_hash`, `google_id_sso` from `users`. States
  `1` (registration) and `5` (password_reset) of `users.state` stay in the enum but are documented as unused.
- `username` = technical unique value `google_<first 8 chars of the user uuid>`.
- `nickname` = the Google email local part (only gmail accounts expected), `+tag` removed, set
  **only at creation** (never refreshed from Google). Duplicates get an incremental suffix on the
  nickname (`mario.rossi#2`).
- Google scopes: `openid email` only. The email is read once from the ID token to derive the
  nickname; it is never stored and never logged (error logs included).
- Match export includes the user's `users_identities` rows and the import recreates them (an imported Google user can still log in; also the base for moving Google users between stages).
- Old export files (0.41.4) with `emailAddress` are accepted: the email is ignored, the user is mapped by username, and the import plan shows a warning.
- States: new state `7` = deleting (used by the deletion job of [Step 5](./Step05_GoogleSsoPrivacyE2E.md)).
- A lost provider account is not recoverable (rule already in the roadmap, no more detail).
- Identity and data are per backend database (see [Environments](../Environments.md): one backend per public stage).

## 3. Sub-points per component

### 3.1 Java (`code/backend/java/`)
- Migrations `adapter-sqlite` and `adapter-postgres`: `db/migration/v1/V1.2.0__user_identities.sql` (first `v1/` folder). Creates `users_identities` (unique `(provider, provider_subject)`, FK to `users`), drops the three columns (SQLite: table rebuild if the version has no `DROP COLUMN`). Unique index on `users.nickname`.
- Core: identity entity, repository port and JPA/SQLite adapters; nickname generator (local part, strip `+tag`, suffix `#n`) with retry on unique violation.
- Match export carries the user's `users_identities` rows (provider + subject); the import recreates them, so an imported Google user can still log in (base of the stage migration, see [Step 5](./Step05_GoogleSsoPrivacyE2E.md)).
- Match import (`MatchImportService`, today by `emailAddress`) and admin owner move (`MatchOwnerService`, uuid → email → username): **replace email with a USERNAME mapping**; the email path is removed. OpenAPI updated.
- Guests keep `username = nickname = guest_xxx`.

### 3.2 Python (`code/backend/python/`)
- Models mirror the table; no Flyway: add the new table through `create_all` and the column drops/new index to the ALTER list in `app/adapters/persistence/database.py`.
- Same nickname generator, USERNAME mapping in import and owner move, identity rows in export/import.

### 3.3 AWS (`code/backend/aws/`)
- Item `IDENTITY#GOOGLE#{sub}` → user uuid (point read at login, no Scan).
- Counter item `NICK#{base}` with atomic increment (`ADD`) for the nickname suffix.
- `db_utils.find_user_by_email` (Scan) and `find_users_by_email/username` for owner move: email path removed, USERNAME mapping used by match import and owner move.
- Same export/import identity rows and warning as above.
- No SAM parameter in this step.

### 3.3b Dev seeds and Robot
- Rewrite the dev seed users without `password_hash` / `email_address`: repeatable `R__insert_dev_test_data.sql` on SQLite and PostgreSQL, the Python seed, AWS `lambda/seed/handler.py`.
- `tests_v0/41_alpha_prep/match_owner_move.robot` looks users up by username instead of `player1@test.local`.

### 3.4 react-game / react-admin
- react-game: shows `nickname` (see step 4). react-admin: the admin owner-move form and match import dialog use the username, not the email; the users list no longer shows email (check the entity table).

### 3.5 Docs (when developed)
[Data Model](../DataModel.md) and [Security](../Security.md) updated by the doc agent; `users` states table marks 1 and 5 unused; OpenAPI of import and owner move.

### 3.6 Tests
Unit tests for the identity repository, nickname generator (suffix, `+tag`, race/retry) and the username mapping on all backends, coverage > 96%. Robot: import and owner move by username on all backends (existing suites updated).

## 4. Open points

1. Existing V0 users with `email_address`/`google_id_sso` values: the migration drops them; alpha is emptied at release 1.2, so no real data has to survive.
2. Existing guest nicknames `guest_xxx` and the new unique index on `nickname`: collisions check in the migration.
3. (decided) Old export files with `emailAddress`: accepted, email ignored, warning in the plan.
4. Nickname change by the player is out of scope (set only at creation).


# Version Control
- **Document Version**: 1.1.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.1.0 | Google login analysis, steps two to five | October 19, 2026 |

- **Last Updated**: October 19, 2026 (v1.1.0)

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
