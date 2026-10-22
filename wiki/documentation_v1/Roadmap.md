# Paths Games V1 - Roadmap

**V1 — beta: accounts and depth.** Draft plan of the second version: 42 steps released as
`1.N.0`, starting from `1.0.0`. Rules in [Version Template](../VersionTemplate.md),
all versions in the [Global Roadmap](../Roadmap.md), ideas in the
[Backlog](../Backlog.md).

Shared references for this version: [Game Rules](../GameRules.md),
[Data Model](../DataModel.md), [Story Format](../StoryFormat.md),
[Security](../Security.md), [Environments](../Environments.md),
[API Conventions](../ApiConventions.md).

- **Step 1**: version 1 launch. **Steps 2-5**: Google SSO first (tables ready for Steam; developed together, intermediate releases get intermediate versions).
- **Steps 6-9**: profile and multi-device (the same account on many devices finds the same game state): profile backend and page, match concurrency, match list and merge rule. **Steps 6-12 are developed together and released as 1.6.0**, docs included (like steps 2-5 in 1.2.0).
- **Steps 10-14**: admin tool — user management (backend and react-admin pages), pagination residuals plus multi-device continuity (step 12), navigation and match detail, intervention log.
- **Steps 15-20**: EN/IT interface, accessibility, background music (two steps), scripts and certificates (to evaluate).
- **Steps 21-27**: story frontend data, permadeath and game over, location-forced weather.
- **Steps 28-31**: admin tool parameters, admin messages, negative conditions (to evaluate).
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

6. **[User profile — backend](./Step06_UserProfileBackend.md)** — who am I, statistics and preferences; also the foundation of the multi-device steps.
    - Every gameplay write endpoint (the 11 of the step analysis, all backends) updates the match `ts_update`, one timestamp per request; admin writes bump it too (backend)
    - Match counter `play_ms`: on every gameplay write `+= min(now − previous ts_update, cap)`, cap is a parameter (code default 5 minutes); admin writes never touch it; a snapshot restore never rolls it back, AWS included; exported as `playMs` in the current export schema, missing at import = 0; the export status list gets `CANCELLED` and `BANNED` (backend)
    - `GET /api/auth/me` extended with statistics computed on the fly on all backends: played (`RUNNING`, `PAUSED`, `ENDED`, `GAMEOVER`), completed (`ENDED`), game over, total play time, total clocks; cancelled and banned matches count nowhere; AWS: still two GSIs per table, both redefined (match `summary` map, `playMs`, `tsUpdate` on GSI1), every environment inside the free tier; every AWS environment destroyed and recreated with 1.6.0 (data lost, accepted), seed fills the new tables, no backfill (backend)
    - Preferences: `PATCH /api/auth/me` `{language, highContrast}` with CSRF, refused to guests (403 `GOOGLE_ACCOUNT_REQUIRED`); `users.language`, `users.theme_selected`, AWS attributes on `USER#`; values validated against list parameters (languages `en,it`, themes `default,high-contrast`) exposed as `supportedLanguages` and `supportedThemes` in `GET /api/echo/status`, so a new theme or language is a config change (backend)
    - OpenAPI spec (backend)
    - Unit tests (tests)
    - Robot suite for profile endpoints (tests)
7. **[User profile — react-game page](./Step07_UserProfileReactGame.md)** — profile page in the user's book.
    - Profile page with user info and statistics (play time and clocks included), for guests too with an invitation to sign in (frontend)
    - Preferences editor: language (only the supported languages that have a bundle; guests keep it in localStorage only); the high-contrast toggle stays hidden until step 17 (its API and the localStorage key `pathsgames.highContrast` are ready); guest values in localStorage are copied with one `PATCH /me` after the first Google login (`newUser`); when logged in the profile wins and localStorage is only a cache; a language changed elsewhere is applied live when `/me` is re-read (frontend)
    - "Log out of all devices" button using the existing `POST /api/auth/logout/all`, for Google users only (frontend)
    - Full account deletion flow for Google users, confirmed with a freshly issued Google token, and links to the privacy pages: the only deletion UI (frontend)
    - Page-return hook with code constants that re-reads the profile when the page becomes visible again; step 8 adds the backend parameters and reuses it for the match (frontend)
    - Responsive layout in the book style (frontend)
    - Unit tests (tests)
8. **[Match concurrency — multi-device](./Step08_MatchConcurrencyMultiDevice.md)** — the same match opened on two devices (the guest merge moved into steps 2-5, [Step 3](./Step03_GoogleSsoBackendFlow.md)).
    - `matchVersion` (opaque `ts_update`) in `/info`, in `POST /api/matches` and in every gameplay write response (backend)
    - `If-Match` on **every gameplay write endpoint**; a different value answers 409 `STALE_MATCH`; without the header the backend still does the compare-and-set against the value read at request start (409 only in a real race); the claim (SQL `UPDATE ... WHERE ts_update = ?` committed first, DynamoDB `ConditionExpression`) is the first write, no request-wide transaction; DynamoDB writes after it go in idempotent chunks within the transaction limits, a failed chunk is an ERROR log and a 5xx caught by the existing public-api-5xx alarm (backend: Java, Python, AWS)
    - OpenAPI: `If-Match`, `matchVersion` and `STALE_MATCH` on the gameplay write endpoints (backend)
    - react-game sends `If-Match`; on `STALE_MATCH` it refetches, shows "Match is being updated" (IT "Partita in aggiornamento") and never re-sends the action; a terminal-state error wins (frontend)
    - Refetch on return (`visibilitychange`, `pageshow`, `online`): `matchRefetchBrowsers` default `["webkit"]` (desktop Safari and every iOS browser; `all` also possible) and `matchRefetchMinHiddenSeconds` default 30, both backend parameters in `GET /api/echo/status`; Chrome Android relies on the 409; no polling, no websocket (backend, frontend)
    - Open choices are not exposed on other devices; the full version counter stays in V3; the request-wide transaction is a hardening idea in the [Backlog](../Backlog.md) (docs)
    - Unit tests and Robot suite with two clients on the same match (tests)
9. **[Match list — cancelled matches, last played and merge rule](./Step09_MatchListCancelledLastPlayed.md)** — match list after the merge.
    - `tsUpdate` returned by all backends (AWS from the redefined GSI1 of step 6); the list always answers the envelope `{items, nextCursor, limit}`: active matches first, then last played, sorted in memory, page size 50, `nextCursor` null up to 50 (backend)
    - Merge rule change: the Google user's active match always wins over the guest's match of the same story; the login answer adds `cancelledMatchUuids`; rule in [Game Rules](../GameRules.md) from 1.6.0 (backend, docs)
    - Match list: "last played", styling of cancelled matches (a plain label comes with steps 2-5), "show cancelled" toggle (cancelled and banned matches hidden, never deleted), just-cancelled matches highlighted once (frontend)
    - Hint "Have an account? Sign in to continue" before Play for guests (frontend)
    - Robot suite: guest plays, logs in, finds the merged matches, the Google match wins (tests)
    - Unit tests (tests)
10. **[Admin tool — user management backend](./Step10_AdminUserManagementBackend.md)** — control users.
    - `GET /api/admin/users` with the cursor envelope: email exact match, nickname prefix, state filter in nickname order, default view = active users by last access (guests excluded); AWS uses the redefined GSI1 (`USERSTATE#n` + nickname) and GSI2 (`GOOGLE_USER_LIST` by last access), no new index; same contract on the 3 backends (backend)
    - User detail: profile, identities, statistics, match history; the email is visible only in the detail page of react-admin (backend)
    - Ban, suspend and unblock endpoints; suspend needs `until` (max 90 days), unblocks itself at login or refresh after it and keeps its matches; the state change evicts the user from the 60 s state cache and revokes access and refresh tokens; an ADMIN can never be banned or suspended (backend)
    - Ban: Google users only (guests are handled by the per-IP limits of step 0.41); the active matches get the new terminal status `BANNED` (treated like `CANCELLED`, kept after an unblock; ended matches keep their status); HMAC-SHA256 of BOTH `sub` and email with a secret pepper from a parameter (code default only for dev) kept in `users_banned_subjects`, login blocked if either matches; unblock removes the two hashes (backend)
    - `IDENTITY_MISMATCH`: the admin arms a one-time re-link (the next login replaces the subject) or deletes the old user with the normal deletion of step 5 (backend)
    - Intervention log WRITER created here (admin id, action, target uuid only, reason max 500 characters, retention 24 months; AWS monthly partition), used by ban, suspend, unblock and the mismatch actions; list and page stay in step 14 (backend)
    - OpenAPI spec, including the `BANNED` status (backend)
    - Unit tests and Robot suite (tests)
11. **[Admin tool — user management pages](./Step11_AdminUserManagementPages.md)** — the react-admin side.
    - Users list with one search box ("@" = exact email, else nickname prefix), state filter and cursor paging; no email column (frontend)
    - User detail page with profile (the email is shown only here), identities, match history and actions (frontend)
    - Confirmation dialogs with a standard reason (spam, abuse, cheating, security, support request, other) plus mandatory free text (10-500 characters); the suspend dialog has the `until` date (frontend)
    - Unit tests (tests)
    - Robot checks (tests)
12. **[Pagination residuals and multi-device continuity](./Step12_PaginationAndMultiDeviceContinuity.md)** — lists that scale, and the same account on many devices (takes over the old admin pagination step).
    - Pagination residuals: user (picker) and story filters in the react-admin Matches page, server-side paging of the stories list, DynamoDB access patterns checked (backend, frontend)
    - Banner "Match is being updated" (same text as the 409 of step 8) with a link to the match log when the refetched `matchVersion` differs from the known one (frontend)
    - Flag `pathsgames.knownAccount` and the message "Sign in with Google to find your matches"; cookie policy and privacy texts updated for the new key, the other local keys and the real cookie durations (7 days becomes 250 days) (frontend)
    - Session cap from 5 to 12 on all backends, `SESSION_LIMIT` for a session revoked by the cap, active sessions (used in the last 30 days) shown in the profile; rotated rows deleted after 7 days, reuse of a rotated token revokes all sessions (backend, frontend)
    - `sessions_valid_after`, set by "Log out of all devices", ban and suspend: access tokens die within 60 seconds (backend)
    - Refresh token 250 days sliding for all refresh tokens on all backends (cookie follows, guest cookie and guest refresh stay at 180 days, on Java/Python older tokens get 250 days at their next refresh), `SameSite` a parameter with default `Lax`, README of each backend lists where `None` is needed (backend)
    - Robot scenario A, B, C, B, A with 3 fake-provider sessions of the same Google user (tests)
    - Unit tests and a manual Safari cookie check on test with a real iPhone (tests)
13. **Admin tool — navigation and match detail** — one clear admin dashboard.
    - react-admin sections: Matches, Users, Stories, System, Reports (frontend)
    - Match detail page: characters, locations, registry, turn queue (frontend)
    - Reuse existing admin endpoints; add only the missing summary fields (backend)
    - Role guard on every admin page (frontend)
    - Unit tests (tests)
14. **Admin tool — intervention log** — every admin action is traced (ban, suspend, unblock and mismatch actions since step 10).
    - Extend the log writer of [Step 10](./Step10_AdminUserManagementBackend.md) to every other admin action: match stop and delete, snapshot restore, owner move, guest purge, story import; the target is stored by uuid only, no nickname (backend)
    - The admin user with SSO (how an account becomes admin) is analysed apart: out of scope for now (docs)
    - Admin log list with filters (backend)
    - Admin log page in react-admin (frontend)
    - Unit tests (tests)
    - Robot checks (tests)
15. **i18n — react-game EN/IT** — interface in English and Italian.
    - i18n library `react-i18next`, translation keys namespaced per page (frontend)
    - Extract every react-game string into EN and IT files (frontend)
    - Language selector and default from the browser or the profile preference; guests keep it in localStorage (frontend)
    - Story texts in the chosen language through the existing `list_texts.lang`; missing language falls back to the story default, no error (backend, frontend)
    - Unit tests and a missing-translation check (tests)
16. **i18n — backend messages** — second half of localisation.
    - react-admin stays in English only: no translation (frontend)
    - Backend error messages with stable codes the frontends translate (backend)
    - Dates and numbers formatted by locale (frontend)
    - Story import checks: texts present in both languages (warning, not blocking) (backend)
    - Unit tests (tests)
17. **Accessibility** — the game usable with keyboard and assistive technologies (no voice).
    - Keyboard navigation on every page and card (frontend)
    - ARIA labels and roles on cards, book pages and dialogs (frontend)
    - Colour contrast check of the medieval palette, high-contrast option saved in the profile, in localStorage for guests (frontend)
    - Show the high-contrast toggle prepared in step 7 in the profile page (frontend)
    - Reduced-motion option for animations (frontend)
    - Automated accessibility checks in unit tests (tests)
18. **Audio — part 1** — background music in the game.
    - Analysis of the audio scope, formats and the split with part 2 (docs)
    - Background music player with volume and mute, off by default (frontend)
    - Audio files hosting and caching (infra)
    - Unit tests (tests)
19. **Audio — part 2** — the rest of the audio work.
    - Preference saved in the profile (backend, frontend)
    - Remaining audio features chosen by the analysis of step 18 (backend, frontend)
    - Music is global in V1; per-story music only if the table of step 21 is ready, otherwise V2 (docs)
    - Update [Environments](../Environments.md) if audio hosting adds parameters (docs)
    - Unit tests (tests)
    - Robot checks (tests)
20. **Scripts, CI and certificates (to evaluate)** — the tooling after the variables refactor.
    - Evaluate if still needed: the backend variables refactor is already done; if dropped, the step becomes "Certificates" only (docs)
    - Certificates: analysis in [Environments](../Environments.md) (who owns the ACM certificates, regions, stages, future-proof) and the chosen change; moved from step 41 to be ready before the beta domains (infra, docs)
    - Update `.env.example`; `.env` and `.env.test` are changed only by the owner (infra)
    - Update deploy and test scripts in `code/scripts` (infra)
    - Update GitHub workflows (infra)
    - Update component READMEs and [Environments](../Environments.md) (docs)
    - Robot suites green with the new variables on all backends (tests)
21. **Story frontend data — analysis and schema** — per-story display and graphic settings.
    - Dedicated analysis of the fields (docs)
    - New table `story_frontend_data`, one row per story, with display and graphic info that never changes the game engine (backend)
    - Display flags for magic, food, coins, sadness and other stats; special cards; other graphic fields chosen by the analysis (backend)
    - Per-story music belongs to this table: used by audio part 2 (step 19) only if ready, otherwise V2 (docs)
    - Flags are display-only for now: the engine keeps every mechanic (docs)
    - Migrations on SQLite and PostgreSQL, DynamoDB layout on AWS (backend)
    - Unit tests (tests)
22. **Story frontend data — import, validation and API** — part of the story package.
    - Story import and export JSON with the new section, no null keys (backend)
    - Validation rules for the new fields (backend)
    - Admin CRUD endpoints and public read in the story detail (backend)
    - OpenAPI spec and [Story Format](../StoryFormat.md) update (backend, docs)
    - Unit tests and Robot suite (tests)
23. **Story frontend data — frontends** — use the flags.
    - react-admin editor for the story frontend data (frontend)
    - react-game hides the stats the story disables (frontend)
    - Special cards rendering (frontend)
    - Unit tests (tests)
    - Robot checks on a story with hidden stats (tests)
24. **Permadeath — rules and schema** — individual character death.
    - Define death rules: when a character dies, what happens to the party (docs)
    - Extend the match state machine of step 3 in [Game Rules](../GameRules.md) with game over (new status or `ENDED` with a reason) (docs)
    - Schema: death state and timestamp on the character instance (backend)
    - Story settings for death (enabled, conditions) in the story table used by the engine, not in `story_frontend_data` (backend)
    - Unit tests (tests)
25. **Permadeath and game over — engine** — deaths and endings on all backends.
    - Death triggers from stats and events (backend)
    - Game over when no character can continue; match status and timestamp (backend)
    - Interaction with coma: coma may lead to death when the story allows it (backend)
    - Logs for death and game over (backend)
    - Unit tests and Robot suite (tests)
26. **Permadeath and game over — frontend and KPI** — show the end.
    - Death and game over pages in the book (frontend)
    - Death KPI counter in the report (backend, frontend)
    - Match list shows dead characters and game-over matches (frontend)
    - Unit tests (tests)
    - Robot checks for the death flow (tests)
27. **Location-forced weather** — some places impose their weather.
    - Schema: location weather rule (backend)
    - Entering the location triggers its weather; no weather change at sleep while there (backend)
    - Leaving the location: the weather is recalculated normally at the next sleep (backend)
    - The location wins: weather events do not change the weather while there (backend)
    - Multiplayer behaviour postponed to V4 (docs)
    - Story format, validation and admin CRUD (backend, frontend)
    - Unit tests and Robot suite (tests)
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
- **Document Version**: 1.4.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First draft of the beta version plan, with docs alignment step | September 25, 2026 |
  | 0.41.5 | Version launch is now the first step | October 3, 2026 |
  | 0.42.0 | Version launch gains smoke test and versioning model | October 6, 2026 |
  | 1.1.0 | Launch done: smoke test, fast locations, clearer lock messages | October 14, 2026 |
  | 1.2.0 | Google login steps two to five done | October 20, 2026 |
  | 1.4.0 | Admin steps moved before translations; profile and multi-device steps detailed | October 21, 2026 |

- **Last Updated**: October 21, 2026 (v1.4.0)

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
