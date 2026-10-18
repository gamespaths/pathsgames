# Step 5 — Google SSO: privacy and E2E

**Status: analysis (October 19, 2026), not developed.** Version 1.x runs on alpha, so release 1.2 (steps 2-5) must have the privacy, age and cookie items online on alpha.
Roadmap line: *privacy check tied to accounts* ([Roadmap](./Roadmap.md) step 5).
**Steps 2-5 are developed together** (intermediate releases get intermediate versions):
[Step 2](./Step02_GoogleSsoIdentityModel.md) · [Step 3](./Step03_GoogleSsoBackendFlow.md) ·
[Step 4](./Step04_GoogleSsoReactGameLogin.md) · [Step 5](./Step05_GoogleSsoPrivacyE2E.md).

## 1. Goal

Accounts can be deleted, personal data has a retention rule, the policies are updated, and the
whole flow is covered by E2E tests with a fake Google provider.

## 2. Decisions (owner, October 19, 2026)

- `DELETE /api/auth/me` answers **202**: the user goes to state "deleting"; a job removes user, personal data, all matches and logs (AWS: `USER_MATCHES#`, `LOG#`, `AUDIT#` items). It requires a **fresh Google ID token** (< 5 minutes).
- Robot **fake Google provider**: a test key/JWKS enabled only when the test endpoints are enabled (like `X-Test-Marker`); a unit test asserts it is off in the prod profile.
- Retention: Google users are kept until a deletion request or **24 months since `users.ts_last_access`** (updated at Google login and at refresh, see Step 3); the cleanup job is extended to them.
- Deletion job is **chunked like the guest cleanup, idempotent**, and restarts from the users in state `7` (deleting).
- ID token security checks in Robot and unit tests: `aud`, `iss`, `exp`, `nonce`, replay.
- **Google user migration is implemented and tested now** (not analysis only): the Google subject is the key and the match export/import carries `users_identities` ([Step 2](./Step02_GoogleSsoIdentityModel.md)). Roadmap step 41 only runs it alpha to beta, handling guests with the transfer code; see "Stage migration" in [Environments](../Environments.md).

## 3. Sub-points per component

### 3.1 Java / Python / AWS
- `DELETE /api/auth/me` (OpenAPI) with fresh-token check (`iat`/`auth_time` within 5 minutes, same verifier as step 3), state `deleting` (step 3 refuses login), revoke all sessions.
- Deletion job: users, identities, tokens, matches, characters, logs, snapshots. AWS: query `USER#`, `USER_MATCHES#`, `MATCH#` partitions, `LOG#`, `AUDIT#` items; KPI counters stay (`system_kpi_daily` is aggregated). SQL: ordered deletes in one transaction per match.
- Cleanup job extended to Google users with `ts_last_access` older than 24 months.
- Test-only fake provider (JWKS + signing key; fake tokens carry the non-prod client id as `aud`) behind the test-endpoints flag; unit test: absent in the prod profile.

### 3.2 react-game
- No account deletion UI here: it comes only with the profile page of roadmap step 7 (the endpoint is API-only until then).

### 3.3 Tests
- Robot suite on all backends: login, nickname rules, link, deletion (202, then data gone), state refusal; security cases `aud`, `iss`, `exp`, `nonce`, replay.
- Unit tests, coverage > 96%.

### 3.4 Docs
- [Security](../Security.md) and [Data Model](../DataModel.md) when developed.
- Migration of Google users: export of subject, provider and nickname through the match export, import by subject into the target stage; implementation, unit tests, and a Robot test moving a Google user between two backends/stages (e.g. test to dev). Step 41 runs it alpha to beta.

### 3.5 Privacy, minimum age and cookies (LAST sub-points of the step)
All the items below are gathered here and nowhere else; they must be online on alpha with release 1.2.
- Privacy policy and terms EN/IT (texts in `src/i18n/en.json` and `it.json`, `modals.privacy`, `modals.terms`, `modals.cookies`): nickname, provider subject, hash of banned subjects (HMAC-SHA256 with a secret pepper, table `users_banned_subjects`, defined in roadmap step 26), Google as third party; consent update for logged users.
- Minimum age in the terms: **14 (Italy) / 16 (EU default)**; no checkbox, one visible line near the login button.
- **Static policy pages, "one source, two outputs"** (code facts: `PolicyBook.jsx` holds only the sections list `sections: [[titleKey, bodyKey], ...]`; deep link `?policy=privacy|cookies|terms|roadmap` in `src/utils/policyDeepLink.js`; build is `vite build`):
  - The i18n JSON files stay the single source of the texts. The sections list moves out of `PolicyBook.jsx` into a shared data file (e.g. `src/data/policies.json`) read by both outputs.
  - Output 1: the React PolicyBook stays as it is (book style, EN/IT switch, cookie preferences button), reading the shared file.
  - Output 2: a small script run before `vite build` (`prebuild`) generates `dist/privacy.html`, `dist/terms.html`, `dist/cookies.html`: EN and IT text, simple style, an "Open in the game" link to `/?policy=<kind>`. Deployed with the existing website deploy (whole `dist` to S3), no extra step.
  - Only Google points to the HTML pages (Branding: `https://paths.games/privacy.html`, `https://paths.games/terms.html`). The react-game footer and in-game links keep opening the PolicyBook.
  - Note: the static pages will also serve future clients (V3 Android/Steam app) and other external references.
  - Tests: unit test of the generator script (all sections present in EN and IT, no missing key); a Robot check that the three pages answer 200 on the deployed site.
- The GIS script is loaded only on click, classified as necessary in the cookie consent (`src/consent/`) and cited in the cookie policy.

## 4. Open points

1. (decided) Chunked, idempotent job; `ts_last_access` for inactivity.
2. Fresh token < 5 minutes needs a new Google popup at deletion: UX of the popup in step 7 (profile, the only deletion UI).
3. The `users_banned_subjects` table and pepper parameter are defined in roadmap step 26; this step only cites them in the policy.
4. (decided) Fake ID tokens use the client id of the non-prod Google project as `aud`, accepted only when test endpoints are enabled.


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
