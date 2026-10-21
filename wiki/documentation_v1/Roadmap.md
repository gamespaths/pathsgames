# Paths Games V1 - Roadmap

**V1 — beta: accounts and depth.** Draft plan of the second version: 42 steps released as
`1.N.0`, starting from `1.0.0`. Rules in [Version Template](../VersionTemplate.md),
all versions in the [Global Roadmap](../Roadmap.md), ideas in the
[Backlog](../Backlog.md).

Shared references for this version: [Game Rules](../GameRules.md),
[Data Model](../DataModel.md), [Story Format](../StoryFormat.md),
[Security](../Security.md), [Environments](../Environments.md),
[API Conventions](../ApiConventions.md).

- **Step 1**: version 1 launch. **Steps 2-9**: Google SSO first (tables ready for Steam; steps 2-5 developed together, intermediate releases get intermediate versions), profile, guest linking.
- **Steps 10-15**: EN/IT interface, accessibility, background music (two steps), scripts and certificates (to evaluate).
- **Steps 16-22**: story frontend data, permadeath and game over, location-forced weather.
- **Steps 23-31**: admin tool, admin messages, negative conditions (to evaluate).
- **Steps 32-35**: single-table analysis, AWS logs table, crowdfunding, content licenses.
- **Step 36**: game manual for players. **Step 37**: documentation alignment.
- **Steps 38-39**: reserved for bug fixes or new features. 
- **Steps 40-42**: recurring hardening, migration from alpha, beta launch.



# Roadmap

|  | Step |  | Main goals |
| ---- | -- | ----- | ---------- |
| 1 | [Version 1 launch](./Step01_Version1Launch.md) | ✅ | Version 1 launch with daily smoke test, fast locations page, registry lock reason. |
| 2 | [Google SSO — identity model](./Step02_GoogleSsoIdentityModel.md) | ✅ | Identities table, nickname rules, no passwords, static policy pages. |
| 3 | [Google SSO — backend flow](./Step03_GoogleSsoBackendFlow.md) | ✅ | Google login on 3 backends, hashed sessions, guest merge, admin bootstrap. |
| 4 | [Google SSO — react-game login](./Step04_GoogleSsoReactGameLogin.md) | ✅ | Google button, session handling across tabs, EN/IT messages. |
| 5 | [Google SSO — privacy and E2E](./Step05_GoogleSsoPrivacyE2E.md) | ✅ | Account deletion, 24-month retention, policies, fake-provider Robot suite. |




# Next steps

6. **User profile — backend** — who am I, statistics and preferences.
    - `GET /api/auth/me` already exists in Java: extend it with statistics (matches played, completed, total play time) and align Python and AWS (backend)
    - Statistics computed on the fly; stored counters only if the cost requires them (backend)
    - Total play time = sum of the match durations, same rule as the KPI average duration (backend)
    - Preferences storage: language, high contrast (the option of step 12) (backend)
    - Update preferences endpoint (backend)
    - OpenAPI spec and unit tests (backend, tests)
    - Robot suite for profile endpoints (tests)
7. **User profile — react-game page** — profile page in the user's book.
    - Profile page with user info and statistics (frontend)
    - Preferences editor: language, high contrast; the guest values kept in localStorage are copied into the profile at the first Google login (backend, frontend)
    - Link to account deletion and privacy pages; "Log out of all devices" button using the existing `POST /api/auth/logout/all` (frontend)
    - When logged in the profile preferences win, localStorage is only a cache (frontend)
    - Responsive layout in the book style (frontend)
    - Unit tests (tests)
8. **Match concurrency — multi-device** — the same match opened on two devices (the guest merge moved into steps 2-5, [Step 3](./Step03_GoogleSsoBackendFlow.md)).
    - Optimistic check with the existing match `ts_update` on **every gameplay write endpoint**, full scope (large step; the list of endpoints is produced by the step analysis): SQL `UPDATE ... WHERE ts_update = ?`, DynamoDB `ConditionExpression` on writes; stale write answers 409 `STALE_MATCH` (backend: Java, Python, AWS)
    - OpenAPI: `STALE_MATCH` on the gameplay write endpoints (backend)
    - react-game: refetch the match when the window regains focus; clear message on `STALE_MATCH` (frontend)
    - The full version counter stays in V3 (docs)
    - Unit tests and Robot suite with two clients on the same match (tests)
9. **Match list — cancelled matches and last played** — match list after the merge.
    - Styling of cancelled matches in the match list (a plain label comes with steps 2-5) (frontend)
    - Match list "last played" date from the match `tsUpdate`, returned by all backends, AWS included (backend, frontend)
    - Robot suite: guest plays, logs in, finds the merged matches (tests)
    - Unit tests (tests)
10. **i18n — react-game EN/IT** — interface in English and Italian.
    - i18n library `react-i18next`, translation keys namespaced per page (frontend)
    - Extract every react-game string into EN and IT files (frontend)
    - Language selector and default from the browser or the profile preference; guests keep it in localStorage (frontend)
    - Story texts in the chosen language through the existing `list_texts.lang`; missing language falls back to the story default, no error (backend, frontend)
    - Unit tests and a missing-translation check (tests)
11. **i18n — backend messages** — second half of localisation.
    - react-admin stays in English only: no translation (frontend)
    - Backend error messages with stable codes the frontends translate (backend)
    - Dates and numbers formatted by locale (frontend)
    - Story import checks: texts present in both languages (warning, not blocking) (backend)
    - Unit tests (tests)
12. **Accessibility** — the game usable with keyboard and assistive technologies (no voice).
    - Keyboard navigation on every page and card (frontend)
    - ARIA labels and roles on cards, book pages and dialogs (frontend)
    - Colour contrast check of the medieval palette, high-contrast option saved in the profile, in localStorage for guests (frontend)
    - Reduced-motion option for animations (frontend)
    - Automated accessibility checks in unit tests (tests)
13. **Audio — part 1** — background music in the game.
    - Analysis of the audio scope, formats and the split with part 2 (docs)
    - Background music player with volume and mute, off by default (frontend)
    - Audio files hosting and caching (infra)
    - Unit tests (tests)
14. **Audio — part 2** — the rest of the audio work.
    - Preference saved in the profile (backend, frontend)
    - Remaining audio features chosen by the analysis of step 13 (backend, frontend)
    - Music is global in V1; per-story music only if the table of step 16 is ready, otherwise V2 (docs)
    - Update [Environments](../Environments.md) if audio hosting adds parameters (docs)
    - Unit tests (tests)
    - Robot checks (tests)
15. **Scripts, CI and certificates (to evaluate)** — the tooling after the variables refactor.
    - Evaluate if still needed: the backend variables refactor is already done; if dropped, the step becomes "Certificates" only (docs)
    - Certificates: analysis in [Environments](../Environments.md) (who owns the ACM certificates, regions, stages, future-proof) and the chosen change; moved from step 41 to be ready before the beta domains (infra, docs)
    - Update `.env.example`; `.env` and `.env.test` are changed only by the owner (infra)
    - Update deploy and test scripts in `code/scripts` (infra)
    - Update GitHub workflows (infra)
    - Update component READMEs and [Environments](../Environments.md) (docs)
    - Robot suites green with the new variables on all backends (tests)
16. **Story frontend data — analysis and schema** — per-story display and graphic settings.
    - Dedicated analysis of the fields (docs)
    - New table `story_frontend_data`, one row per story, with display and graphic info that never changes the game engine (backend)
    - Display flags for magic, food, coins, sadness and other stats; special cards; other graphic fields chosen by the analysis (backend)
    - Per-story music belongs to this table: used by audio part 2 (step 14) only if ready, otherwise V2 (docs)
    - Flags are display-only for now: the engine keeps every mechanic (docs)
    - Migrations on SQLite and PostgreSQL, DynamoDB layout on AWS (backend)
    - Unit tests (tests)
17. **Story frontend data — import, validation and API** — part of the story package.
    - Story import and export JSON with the new section, no null keys (backend)
    - Validation rules for the new fields (backend)
    - Admin CRUD endpoints and public read in the story detail (backend)
    - OpenAPI spec and [Story Format](../StoryFormat.md) update (backend, docs)
    - Unit tests and Robot suite (tests)
18. **Story frontend data — frontends** — use the flags.
    - react-admin editor for the story frontend data (frontend)
    - react-game hides the stats the story disables (frontend)
    - Special cards rendering (frontend)
    - Unit tests (tests)
    - Robot checks on a story with hidden stats (tests)
19. **Permadeath — rules and schema** — individual character death.
    - Define death rules: when a character dies, what happens to the party (docs)
    - Extend the match state machine of step 3 in [Game Rules](../GameRules.md) with game over (new status or `ENDED` with a reason) (docs)
    - Schema: death state and timestamp on the character instance (backend)
    - Story settings for death (enabled, conditions) in the story table used by the engine, not in `story_frontend_data` (backend)
    - Unit tests (tests)
20. **Permadeath and game over — engine** — deaths and endings on all backends.
    - Death triggers from stats and events (backend)
    - Game over when no character can continue; match status and timestamp (backend)
    - Interaction with coma: coma may lead to death when the story allows it (backend)
    - Logs for death and game over (backend)
    - Unit tests and Robot suite (tests)
21. **Permadeath and game over — frontend and KPI** — show the end.
    - Death and game over pages in the book (frontend)
    - Death KPI counter in the report (backend, frontend)
    - Match list shows dead characters and game-over matches (frontend)
    - Unit tests (tests)
    - Robot checks for the death flow (tests)
22. **Location-forced weather** — some places impose their weather.
    - Schema: location weather rule (backend)
    - Entering the location triggers its weather; no weather change at sleep while there (backend)
    - Leaving the location: the weather is recalculated normally at the next sleep (backend)
    - The location wins: weather events do not change the weather while there (backend)
    - Multiplayer behaviour postponed to V4 (docs)
    - Story format, validation and admin CRUD (backend, frontend)
    - Unit tests and Robot suite (tests)
23. **Admin tool — pagination and filters** — lists that scale, before the new admin pages.
    - Server-side pagination for matches and stories on all backends (backend)
    - Filters by date, user and story (backend)
    - react-admin tables with the new pagination and filters (frontend)
    - DynamoDB access patterns checked for the new filters (backend)
    - Unit tests and Robot checks (tests)
24. **Admin tool — navigation and match detail** — one clear admin dashboard.
    - react-admin sections: Matches, Users, Stories, System, Reports (frontend)
    - Match detail page: characters, locations, registry, turn queue (frontend)
    - Reuse existing admin endpoints; add only the missing summary fields (backend)
    - Role guard on every admin page (frontend)
    - Unit tests (tests)
25. **Admin tool — intervention log** — every admin action is traced, before ban and suspend exist.
    - Log admin actions with admin id, action, target and reason; the target is stored by uuid only, no nickname (backend)
    - The admin user with SSO (how an account becomes admin) is analysed apart: out of scope for now (docs)
    - Admin log list with filters (backend)
    - Admin log page in react-admin (frontend)
    - Unit tests (tests)
    - Robot checks (tests)
26. **Admin tool — user management backend** — control users.
    - `GET /api/admin/users` with search, state filter and pagination (backend)
    - Admin action to resolve an `IDENTITY_MISMATCH`: "re-link the Google subject" or "delete the old user", traced in the intervention log (backend)
    - Ban, suspend and unblock endpoints, traced in the intervention log; the state change evicts the user from the 60 s state cache of step 3 (backend)
    - Ban and suspend revoke the user's access and refresh tokens; the started matches of a banned user become `CANCELLED` (backend)
    - Ban only for Google users; guests are handled by the per-IP limits of step 0.41 (backend)
    - A hash of the banned Google subject is kept (no personal data) to block a new account after deletion: HMAC-SHA256 with a secret pepper from a parameter (code default only for dev), table `users_banned_subjects`; the HMAC of BOTH `sub` and email is kept and login is blocked if either matches (backend)
    - User detail: profile, identities, match history; the email is visible and searchable only in react-admin (backend)
    - OpenAPI spec (backend)
    - Unit tests and Robot suite (tests)
27. **Admin tool — user management pages** — the react-admin side.
    - Users list with search, filters and pagination (frontend)
    - User detail page with match history and actions (frontend)
    - Confirmation dialogs with a reason field (frontend)
    - Unit tests (tests)
    - Robot checks (tests)
28. **Admin tool — parameters** — see and manage all runtime parameters.
    - "Get all parameters" admin API from `global_runtime_variables` and code defaults (backend)
    - Update of editable parameters with validation (backend)
    - System configuration page in react-admin (frontend)
    - Unit tests (tests)
    - Robot suite (tests)
29. **Admin messages — backend** — asynchronous messages for players.
    - Messages table: text, target (all, story, match, user), validity dates (backend)
    - Messages delivered inside the REST info responses of any match, no polling and no push (backend)
    - Public read of the active "all" messages for the react-game home (backend)
    - Expiry rules on the server; read state kept on the client (ids of dismissed messages), no write per read (backend, frontend)
    - OpenAPI spec (backend)
    - Unit tests (tests)
30. **Admin messages — frontends** — write and read messages.
    - react-admin message composer and list (frontend)
    - react-game message display on the match page (frontend)
    - Messages section in the react-game home, where "Play tutorial" is; "Play tutorial" becomes a default message always present (frontend)
    - Unit tests (tests)
    - Robot suite (tests)
    - Update [Game Rules](../GameRules.md) if messages affect play (docs)
31. **Negative conditions (events to evaluate)** — event or choice not available when the user HAS an item or registry key.
    - Choices: already supported by `!=` in Java; parity check on Python and AWS done anyway (backend)
    - Events: evaluate if the negative condition is still wanted (docs)
    - Events: add a negative item condition, if wanted (backend)
    - Story format and validation (backend)
    - Unit tests and Robot suite (tests)
32. **DynamoDB single-table analysis** — should logs, users, stories and matches be split?
    - Measure item sizes, costs and access patterns (docs)
    - Options and trade-offs (docs)
    - Recommendation for step 33 (logs) and for V2 or later (docs)
    - Update [Data Model](../DataModel.md) (docs)
    - No code change in this step (docs)
33. **AWS logs table** — match logs in their own DynamoDB table, as the analysis of step 32 says.
    - Check first: the logs table is probably already done (infra)
    - New logs table with its access patterns (infra)
    - Move `LOG#` and `AUDIT#` rows out of the main table (backend)
    - Data migration script for existing matches (infra)
    - SAM template and IAM permissions (infra)
    - Account deletion (step 5) also cleans the logs table (backend)
    - Unit tests and Robot suite on AWS (tests)
34. **Crowdfunding** — campaign support on website and game.
    - Campaign page on the website with links (frontend)
    - Campaign banner in react-game: an "all" admin message with a special style, no separate component (frontend)
    - Campaign announcements through admin messages (all)
    - Update README and website content (docs)
    - Unit tests (tests)
35. **Content licenses** — clear licensing for every story.
    - License metadata per story (backend)
    - License and credits shown in the story detail and book (frontend)
    - Import validation: a missing license defaults to CC BY-NC-ND 4.0 with a warning, not blocking (backend)
    - Update [Story Format](../StoryFormat.md) (docs)
    - Unit tests (tests)
36. **Game manual** — a manual written for the players.
    - Manual outline from [Game Rules](../GameRules.md): start a match, cards, stats, movement, weather, coma and death, messages (docs)
    - Manual text written in EN and IT (docs)
    - Manual as a new book in react-game, reusing the book component; also reachable from the website (frontend)
    - Card tips and tutorial (step 0.40) link to the manual chapters (frontend)
    - Check of every manual chapter against the current rules (docs)
    - Unit tests for the new pages (tests)
37. **Documentation alignment** — fix the gaps between docs and code found during the V0 review.
    - V0 step files are frozen: every correction goes in the shared wiki docs, which point out the stale V0 text (docs)
    - Dropped columns `is_safe` and `cost_max_characteristics` (v0.38.0) still described in Step09, Step14 and Step17: check that [Data Model](../DataModel.md) and [Story Format](../StoryFormat.md) are correct (docs)
    - Weather movement-cost modifiers: Step27 says "not applied", Step28 and the code apply them; confirm [Game Rules](../GameRules.md) (docs)
    - Invariant `INV-33` used twice in Step09: renumber in [Data Model](../DataModel.md) (docs)
    - Step25 and Step28 stack several addenda under repeated headings: add a reading note in the V0 index or the shared docs (docs)
    - Flyway SQL comments and old `.claude/settings*.json` allow rules still name the old `documentation_v0/` paths: applied migrations are never edited (checksum), settings rules are cleaned by the owner (docs)
    - Final check of every shared doc against the code with `doc-finder` (tests)
38. **Reserved**
39. **Reserved**
40. **Security and hardening check** — recurring.
    - Security review of SSO, profile, linking, admin tool and messages (all)
    - OAuth and JWT penetration tests (tests)
    - Dependency scan and secrets review (all)
    - KPI report updated with the new mechanics (deaths, game over) (backend, frontend)
    - Analyse the export and import of large match snapshots (above the 5 MB cap of step 0.41, e.g. S3 hand-off), needed by the transfer of step 41 (backend, infra)
    - Run the Google user migration Robot test between two backends (`google_user_migration.robot` with `TARGET_BASE_URL` and `TARGET_ADMIN_BASE_URL`), skipped in the normal runs (tests)
    - Unit tests and Robot suites (tests)
41. **Migration from alpha and privacy check** — recurring.
    - Run the migration of users and stories from alpha to beta (the Google user mechanism is built and tested in step 5); guests move through the match export and import of step 0.41 plus the Google login merge of step 3 (docs)
    - One-time transfer code shown in alpha: the guest enters it in beta to start the export and import, since the alpha token stays on the alpha domain (backend, frontend)
    - Transfer code security: single use, 24h expiry, rate limit, Robot test (backend, tests)
    - The alpha stage is shut down right after the transfer (infra)
    - Google OAuth client for the beta stage only (the prod project and consent screen exist since release 1.2 on alpha) (infra)
    - Migration scripts and dry run (infra)
    - Privacy check: policy, consent, stored data, banned subject hashes (all)
    - Verify migrated data with Robot suites (tests)
    - Rollback plan (docs)
42. **Beta launch** — recurring.
    - New stage `beta`: own AWS stack, bucket and site; `beta.paths.games`, `api-beta.paths.games`; `paths.games` moves from alpha to beta (infra)
    - Content license check (docs)
    - i18n check (EN, IT) (frontend)
    - Robot suites green on all three backends (tests)
    - Release notes (docs)
    - Launch and smoke test (all)

# Version Control
- **Document Version**: 1.2.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First draft of the beta version plan, with docs alignment step | September 25, 2026 |
  | 0.41.5 | Version launch is now the first step | October 3, 2026 |
  | 0.42.0 | Version launch gains smoke test and versioning model | October 6, 2026 |
  | 1.1.0 | Launch done: smoke test, fast locations, clearer lock messages | October 14, 2026 |
  | 1.2.0 | Google login steps two to five done | October 20, 2026 |

- **Last Updated**: October 20, 2026 (v1.2.0)

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
