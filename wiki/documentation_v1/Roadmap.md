# Paths Games V1 - Roadmap

**V1 — beta: accounts and depth.** Draft plan of the second version: 42 steps released as
`1.N.0`, starting from `1.0.0`. Rules in [Version Template](../VersionTemplate.md),
all versions in the [Global Roadmap](../Roadmap.md), ideas in the
[Backlog](../Backlog.md).

Shared references for this version: [Game Rules](../GameRules.md),
[Data Model](../DataModel.md), [Story Format](../StoryFormat.md),
[Security](../Security.md), [Environments](../Environments.md),
[API Conventions](../ApiConventions.md).

- **Steps 1-8**: Google SSO first (tables ready for Steam), profile, guest linking.
- **Steps 9-14**: EN/IT interface, accessibility, optional background music, environment variables refactor.
- **Steps 15-21**: story frontend data, permadeath and game over, location-forced weather.
- **Steps 22-30**: admin tool, admin messages, negative conditions (to evaluate).
- **Steps 31-34**: AWS logs table, single-table analysis, crowdfunding, content licenses.
- **Step 35**: documentation alignment. **Steps 36-39**: reserved. **Steps 40-42**: recurring hardening, migration from alpha, beta launch.


# Steps

1. **Google SSO — identity model** — one user with one or more login providers.
    - New identity table (user, provider, provider subject, timestamps), ready for Steam in V2 (backend)
    - Flyway migrations for SQLite and PostgreSQL, DynamoDB item layout on AWS (backend)
    - No email/password and no stored emails: only the provider subject and a display name (backend)
    - Rule: a lost provider account is not recoverable (docs)
    - Update [Data Model](../DataModel.md) and [Security](../Security.md) (docs)
    - Unit tests for the identity repository on all backends (tests)
2. **Google SSO — backend flow** — login with Google on all three backends.
    - Google OAuth client configuration through parameters with code defaults (backend)
    - `POST /api/auth/google`: verify the Google token or code, find or create the user (backend)
    - Issue the existing JWT access and refresh tokens after SSO (backend)
    - OpenAPI spec for the SSO endpoints (backend)
    - Error cases: invalid token, disabled user, provider unavailable (backend)
    - Unit tests with provider mocks, coverage > 95% (tests)
3. **Google SSO — react-game login** — sign-in button and session handling.
    - Google sign-in button and callback page (frontend)
    - Session state for guest vs logged user, logout (frontend)
    - Show the logged user in the header and in the user's book (frontend)
    - Error and cancel flows (frontend)
    - Unit tests for login components and token handling (tests)
4. **Google SSO — privacy and E2E** — privacy check tied to accounts.
    - Privacy policy and terms of service updated for SSO accounts (docs, frontend)
    - Consent update: what is stored for a logged user (frontend)
    - Account deletion request: user and personal data removed (backend)
    - Robot suite for SSO with a mocked provider on all backends (tests)
    - OAuth security checks: redirect URI, state parameter, token replay (tests)
5. **User profile — backend** — who am I, statistics and preferences.
    - `GET /api/auth/me` with user info and statistics (matches played, completed, total play time) (backend)
    - Preferences storage: language, theme (backend)
    - Update preferences endpoint (backend)
    - OpenAPI spec and unit tests (backend, tests)
    - Robot suite for profile endpoints (tests)
6. **User profile — react-game page** — profile page in the user's book.
    - Profile page with user info and statistics (frontend)
    - Preferences editor: language, theme (frontend)
    - Link to account deletion and privacy pages (frontend)
    - Responsive layout in the book style (frontend)
    - Unit tests (tests)
7. **Guest to Google linking — backend** — a guest keeps its progress when logging in.
    - Link endpoint: the guest's matches, characters and logs move to the Google user (backend)
    - Always merge; when several started matches exist on the same story, the one with the latest `gaming_match.ts_update` wins (backend)
    - New match status `CANCELLED` for the losing matches, in all backends and specs (backend)
    - Invalidate the guest tokens after linking (backend)
    - Unit tests for merge, conflicts and cancellation (tests)
8. **Guest to Google linking — frontend and E2E** — offer to keep the guest progress.
    - "Keep your guest progress" prompt after the first Google login (frontend)
    - Show cancelled matches in the match list (frontend)
    - Match list "last played" date from the match `tsUpdate`, returned by all backends, AWS included (backend, frontend)
    - Robot suite: guest plays, logs in, finds the merged matches (tests)
    - Update [Game Rules](../GameRules.md) with the `CANCELLED` status (docs)
    - Unit tests (tests)
9. **i18n — react-game EN/IT** — interface in English and Italian.
    - Choose the i18n library and structure of translation files (frontend)
    - Extract every react-game string into EN and IT files (frontend)
    - Language selector and default from the browser or the profile preference (frontend)
    - Story texts in the chosen language through the existing `list_texts.lang` (backend, frontend)
    - Unit tests and a missing-translation check (tests)
10. **i18n — react-admin and backend messages** — second half of localisation.
    - react-admin strings in EN and IT (frontend)
    - Backend error messages with stable codes the frontends translate (backend)
    - Dates and numbers formatted by locale (frontend)
    - Story import checks: texts present in both languages (warning, not blocking) (backend)
    - Unit tests (tests)
11. **Accessibility** — the game usable with keyboard and assistive technologies (no voice).
    - Keyboard navigation on every page and card (frontend)
    - ARIA labels and roles on cards, book pages and dialogs (frontend)
    - Colour contrast check of the medieval palette, high-contrast option (frontend)
    - Reduced-motion option for animations (frontend)
    - Automated accessibility checks in unit tests (tests)
12. **Audio (optional)** — maybe a background music, only if there is capacity.
    - Decide whether V1 has audio or it moves to V2 (docs)
    - Background music player with volume and mute, off by default (frontend)
    - Audio files hosting and caching (infra)
    - Preference saved in the profile (backend, frontend)
    - Unit tests (tests)
13. **Environment variables refactor — backends** — one naming convention, defaults in code.
    - Apply the analysis of step 0.41 ([Environments](../Environments.md)) (docs)
    - Common naming of variables across Java, Python and AWS (backend)
    - Every parameter has a code default: env files become optional (backend)
    - Update `application.yml`, `config.py` and SAM parameters (backend)
    - Unit tests on configuration loading (tests)
14. **Environment variables refactor — scripts and CI** — the rest of the tooling.
    - Update `.env.example`; `.env` and `.env.test` are changed only by the owner (infra)
    - Update deploy and test scripts in `code/scripts` (infra)
    - Update GitHub workflows (infra)
    - Update component READMEs and [Environments](../Environments.md) (docs)
    - Robot suites green with the new variables on all backends (tests)
15. **Story frontend data — analysis and schema** — per-story display settings.
    - Dedicated analysis of the fields (docs)
    - New table `story_frontend_data`, one row per story (backend)
    - Display flags for magic, food, coins, sadness and other stats; special cards; other fields to be defined (backend)
    - Flags are display-only for now: the engine keeps every mechanic (docs)
    - Migrations on SQLite and PostgreSQL, DynamoDB layout on AWS (backend)
    - Unit tests (tests)
16. **Story frontend data — import, validation and API** — part of the story package.
    - Story import and export JSON with the new section, no null keys (backend)
    - Validation rules for the new fields (backend)
    - Admin CRUD endpoints and public read in the story detail (backend)
    - OpenAPI spec and [Story Format](../StoryFormat.md) update (backend, docs)
    - Unit tests and Robot suite (tests)
17. **Story frontend data — frontends** — use the flags.
    - react-admin editor for the story frontend data (frontend)
    - react-game hides the stats the story disables (frontend)
    - Special cards rendering (frontend)
    - Unit tests (tests)
    - Robot checks on a story with hidden stats (tests)
18. **Permadeath — rules and schema** — individual character death.
    - Define death rules: when a character dies, what happens to the party (docs)
    - Update [Game Rules](../GameRules.md) (docs)
    - Schema: death state and timestamp on the character instance (backend)
    - Story settings for death (enabled, conditions) (backend)
    - Unit tests (tests)
19. **Permadeath and game over — engine** — deaths and endings on all backends.
    - Death triggers from stats and events (backend)
    - Game over when no character can continue; match status and timestamp (backend)
    - Interaction with coma: coma may lead to death when the story allows it (backend)
    - Logs for death and game over (backend)
    - Unit tests and Robot suite (tests)
20. **Permadeath and game over — frontend and KPI** — show the end.
    - Death and game over pages in the book (frontend)
    - Death KPI counter in the report (backend, frontend)
    - Match list shows dead characters and game-over matches (frontend)
    - Unit tests (tests)
    - Robot checks for the death flow (tests)
21. **Location-forced weather** — some places impose their weather.
    - Schema: location weather rule (backend)
    - Entering the location triggers its weather; no weather change at sleep while there (backend)
    - Multiplayer behaviour postponed to V4 (docs)
    - Story format, validation and admin CRUD (backend, frontend)
    - Unit tests and Robot suite (tests)
22. **Admin tool — navigation and match detail** — one clear admin dashboard.
    - react-admin sections: Matches, Users, Stories, System, Reports (frontend)
    - Match detail page: characters, locations, registry, turn queue (frontend)
    - Reuse existing admin endpoints; add only the missing summary fields (backend)
    - Role guard on every admin page (frontend)
    - Unit tests (tests)
23. **Admin tool — user management backend** — control users.
    - `GET /api/admin/users` with search, state filter and pagination (backend)
    - Ban, suspend and unblock endpoints; banned users leave their active matches (backend)
    - User detail: profile, identities, match history (backend)
    - OpenAPI spec (backend)
    - Unit tests and Robot suite (tests)
24. **Admin tool — user management pages** — the react-admin side.
    - Users list with search, filters and pagination (frontend)
    - User detail page with match history and actions (frontend)
    - Confirmation dialogs with a reason field (frontend)
    - Unit tests (tests)
    - Robot checks (tests)
25. **Admin tool — intervention log** — every admin action is traced.
    - Log admin actions with admin id, action, target and reason (backend)
    - Admin log list with filters (backend)
    - Admin log page in react-admin (frontend)
    - Unit tests (tests)
    - Robot checks (tests)
26. **Admin tool — parameters** — see and manage all runtime parameters.
    - "Get all parameters" admin API from `global_runtime_variables` and code defaults (backend)
    - Update of editable parameters with validation (backend)
    - System configuration page in react-admin (frontend)
    - Unit tests (tests)
    - Robot suite (tests)
27. **Admin tool — pagination and filters** — lists that scale.
    - Server-side pagination for matches and stories on all backends (backend)
    - Filters by date, user and story (backend)
    - react-admin tables with the new pagination and filters (frontend)
    - DynamoDB access patterns checked for the new filters (backend)
    - Unit tests and Robot checks (tests)
28. **Admin messages — backend** — asynchronous messages for players.
    - Messages table: text, target (all, story, match, user), validity dates (backend)
    - Messages delivered inside the REST info responses of any match, no polling and no push (backend)
    - Read state and expiry rules (backend)
    - OpenAPI spec (backend)
    - Unit tests (tests)
29. **Admin messages — frontends** — write and read messages.
    - react-admin message composer and list (frontend)
    - react-game message display on the match page (frontend)
    - Unit tests (tests)
    - Robot suite (tests)
    - Update [Game Rules](../GameRules.md) if messages affect play (docs)
30. **Negative conditions (to evaluate)** — event or choice not available when the user HAS an item or registry key.
    - Evaluate if the feature is still wanted (docs)
    - Choices: already supported by `!=` in Java; verify Python and AWS (backend)
    - Events: add a negative item condition (backend)
    - Story format and validation (backend)
    - Unit tests and Robot suite (tests)
31. **AWS logs table** — match logs in their own DynamoDB table.
    - New logs table with its access patterns (infra)
    - Move `LOG#` and `AUDIT#` rows out of the main table (backend)
    - Data migration script for existing matches (infra)
    - SAM template and IAM permissions (infra)
    - Unit tests and Robot suite on AWS (tests)
32. **DynamoDB single-table analysis** — should users, stories and matches be split too?
    - Measure item sizes, costs and access patterns (docs)
    - Options and trade-offs (docs)
    - Recommendation for V2 or later (docs)
    - Update [Data Model](../DataModel.md) (docs)
    - No code change in this step (docs)
33. **Crowdfunding** — campaign support on website and game.
    - Campaign page on the website with links (frontend)
    - Campaign banner in react-game (frontend)
    - Campaign announcements through admin messages (all)
    - Update README and website content (docs)
    - Unit tests (tests)
34. **Content licenses** — clear licensing for every story.
    - License metadata per story (backend)
    - License and credits shown in the story detail and book (frontend)
    - Import validation: license present (backend)
    - Update [Story Format](../StoryFormat.md) (docs)
    - Unit tests (tests)
35. **Documentation alignment** — fix the gaps between docs and code found during the V0 review.
    - V0 step files are frozen: every correction goes in the shared wiki docs, which point out the stale V0 text (docs)
    - Dropped columns `is_safe` and `cost_max_characteristics` (v0.38.0) still described in Step09, Step14 and Step17: check that [Data Model](../DataModel.md) and [Story Format](../StoryFormat.md) are correct (docs)
    - Weather movement-cost modifiers: Step27 says "not applied", Step28 and the code apply them; confirm [Game Rules](../GameRules.md) (docs)
    - API versioning of Step11 (`/api/{version}/`) was never built: decide whether to implement it or drop it, and update [API Conventions](../ApiConventions.md) (backend, docs)
    - Invariant `INV-33` used twice in Step09: renumber in [Data Model](../DataModel.md) (docs)
    - Step25 and Step28 stack several addenda under repeated headings: add a reading note in the V0 index or the shared docs (docs)
    - Flyway SQL comments and old `.claude/settings*.json` allow rules still name the old `documentation_v0/` paths: applied migrations are never edited (checksum), settings rules are cleaned by the owner (docs)
    - Final check of every shared doc against the code with `doc-finder` (tests)
36. **Reserved**
37. **Reserved**
38. **Reserved**
39. **Reserved**
40. **Security and hardening check** — recurring.
    - Security review of SSO, profile, linking, admin tool and messages (all)
    - OAuth and JWT penetration tests (tests)
    - Dependency scan and secrets review (all)
    - KPI report updated with the new mechanics (deaths, game over) (backend, frontend)
    - Unit tests and Robot suites (tests)
41. **Migration from alpha and privacy check** — recurring.
    - Design the migration of users and stories from alpha to beta (docs)
    - Migration scripts and dry run (infra)
    - Privacy check: policy, consent, stored data (all)
    - Verify migrated data with Robot suites (tests)
    - Rollback plan (docs)
42. **Beta launch** — recurring.
    - New stage `beta`: own AWS stack, bucket and site; `beta.paths.games`, `beta-api.paths.games` (infra)
    - Content license check (docs)
    - i18n check (EN, IT) (frontend)
    - Robot suites green on all three backends (tests)
    - Release notes (docs)
    - Launch and smoke test (all)

# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First draft of the beta version plan, with docs alignment step | September 25, 2026 |

- **Last Updated**: September 25, 2026 (v0.40.0)

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
