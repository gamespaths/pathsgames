# Paths Games V3 - Roadmap

**V3 — delta: everywhere.** Draft plan of the fourth version: 42 steps released as `3.N.0`.
Rules in [Version Template](../VersionTemplate.md), all versions in the
[Global Roadmap](../Roadmap.md), ideas in the [Backlog](../Backlog.md).
Store packages (Android, Steam, Debian) use their own numbering, mapped to the internal version.

Shared references: [Architecture](../Architecture.md),
[Environments](../Environments.md), [Game Rules](../GameRules.md).

- **Steps 1-2**: distribution analysis and package numbering. **Steps 3-5**: performance, database, REST load test.
- **Steps 6-8**: Android app, online only. **Steps 9-13**: offline backend and sync (last played match wins).
- **Steps 14-18**: desktop app, Steam, Debian package. **Step 19**: admin system export/import.
- **Steps 20-22**: free actions, packaged-app testing. **Steps 23-39**: reserved (overflow from V2 lands here).
- **Steps 40-42**: recurring hardening, migration from gamma, delta launch.


# Steps

1. **Distribution analysis** — how the game reaches each platform.
    - Android: web wrapper (e.g. Capacitor or TWA), online only (docs)
    - Desktop and Steam: shell (e.g. Electron or Tauri) with an embedded offline backend (docs)
    - Debian package: content, dependencies, desktop entry (docs)
    - Offline backend choice (Python is the first candidate) (docs)
    - List of doubts for the owner (docs)
2. **Package numbering** — store versions vs internal versions.
    - Numbering scheme for Android, Steam and Debian (docs)
    - Mapping table store version → internal version (docs)
    - Where the mapping is published for support (docs)
    - Build metadata shown in the about page (frontend)
    - Update [Version Template](../VersionTemplate.md) (docs)
3. **Performance baseline** — measure before optimising (old step 93).
    - Targets: API response < 2 s at p95, page load < 3 s (all)
    - Measure every REST endpoint under normal load (backend)
    - Frontend rendering and memory profile (frontend)
    - Payload size review (backend)
    - Benchmark tests failing on regression (tests)
4. **Database optimisation** — faster queries (old step 95).
    - Top expensive operations from slow query logs (backend)
    - Composite indexes for common patterns (backend)
    - JPA fetch strategies and DTO projections in Java (backend)
    - Cache for read-only story data (backend)
    - DynamoDB access patterns and capacity review (backend)
    - Performance tests comparing baseline and optimised (tests)
5. **REST load test** — concurrent single-player matches (old step 94, REST part).
    - Load targets and scenarios (all)
    - Load tool (e.g. k6) with scripted players (tests)
    - Run on a dedicated stage, never on production (infra)
    - Bottleneck fixes (backend)
    - Load test report (docs)
6. **Android app — wrapper** — the game in an Android package.
    - Android project wrapping react-game, online only (frontend)
    - App icons, splash and offline error page (frontend)
    - API endpoint configuration per stage (frontend)
    - Build pipeline (infra)
    - Unit tests (tests)
7. **Android app — login and links** — accounts inside the app.
    - Google SSO inside the app (frontend)
    - Deep links to stories and matches (frontend)
    - Back button and lifecycle handling (frontend)
    - Device tests on common screen sizes (tests)
    - Privacy check for the store (docs)
8. **Android app — store release** — publish on the store.
    - Signing keys and their safe storage (infra)
    - Store listing, screenshots, privacy form (docs)
    - Release pipeline with store numbering (infra)
    - Internal testing track (tests)
    - Release notes (docs)
9. **Offline backend — packaging** — a local backend for desktop.
    - Package the chosen backend with embedded SQLite (backend)
    - Local start and stop from the desktop shell (backend)
    - Local data folder and upgrades between versions (backend)
    - Unit tests (tests)
    - Robot suites against the packaged backend (tests)
10. **Offline backend — stories** — play without network.
    - Download and install stories for offline play (backend)
    - Story versions and updates when back online (backend)
    - Content license check on downloaded stories (docs)
    - Unit tests (tests)
    - Robot suite (tests)
11. **Sync — model** — who wins when the same match is played in two places.
    - Rule: the last played match always wins (docs)
    - Server-side match version counter, never the device clock (backend)
    - Sync states: local only, synced, conflict resolved (backend)
    - Update [Game Rules](../GameRules.md) (docs)
    - Unit tests (tests)
12. **Sync — backend** — upload and download match states.
    - Upload endpoint with version check (backend)
    - Download endpoint for the latest state (backend)
    - Integrity checks on uploaded states (backend)
    - OpenAPI spec (backend)
    - Unit tests and Robot suite (tests)
13. **Sync — client** — sync from the desktop app.
    - Sync on start, on exit and on demand (frontend)
    - Sync status indicator (frontend)
    - Message when a local match is replaced by a newer one (frontend)
    - Unit tests (tests)
    - End-to-end test with two clients (tests)
14. **Desktop app — shell** — the game as a desktop application.
    - Desktop shell with react-game and the offline backend (frontend)
    - Online and offline modes (frontend)
    - Auto-update strategy (infra)
    - Builds for the supported systems (infra)
    - Unit tests (tests)
15. **Steam — integration** — the desktop app on Steam.
    - Steamworks basic integration (frontend)
    - Steam login linked to the Steam SSO of V2 (backend)
    - Cloud save policy vs the sync system (docs)
    - Unit tests (tests)
    - Tests on a Steam test branch (tests)
16. **Steam — release** — publish on Steam.
    - Store page, capsule images, trailer (docs)
    - Depots and build upload pipeline with Steam numbering (infra)
    - Playtest branch (tests)
    - Release notes (docs)
    - Launch checklist (all)
17. **Debian package — build** — a `.deb` for Linux.
    - Package layout, dependencies and desktop entry (infra)
    - Offline backend service handling (infra)
    - Install, upgrade and remove tests (tests)
    - Debian numbering mapped to the internal version (docs)
    - Package README (docs)
18. **Debian package — publishing** — make it installable.
    - Repository or download page (infra)
    - Package signing (infra)
    - Update channel (infra)
    - Installation guide (docs)
    - Smoke test on a clean system (tests)
19. **Admin system export and import** — backup and restore from the admin tool (old step 78).
    - Export all data to a backup file (backend)
    - Import from a backup file with validation (backend)
    - react-admin page with confirmations (frontend)
    - Admin log entries for export and import (backend)
    - Unit tests and Robot suite (tests)
20. **Free actions — engine** — some actions cost no turn (low priority).
    - Limited free actions per time (backend)
    - Which actions are free: item swaps, specific events, item use (backend)
    - Counter reset at time-start (backend)
    - Update [Game Rules](../GameRules.md) (docs)
    - Unit tests (tests)
21. **Free actions — frontend** — show the free actions left.
    - Free-action counter on the character card (frontend)
    - Buttons marked as free (frontend)
    - Story settings in react-admin (frontend)
    - Unit tests (tests)
    - Robot suite (tests)
22. **Packaged apps testing** — the same quality on every platform.
    - Robot suites against Android, desktop and Debian builds where possible (tests)
    - Manual test checklist per platform (docs)
    - Crash and error reporting from the apps (frontend)
    - Regression fixes (all)
    - Test report (docs)
23. **Reserved**
24. **Reserved**
25. **Reserved**
26. **Reserved**
27. **Reserved**
28. **Reserved**
29. **Reserved**
30. **Reserved**
31. **Reserved**
32. **Reserved**
33. **Reserved**
34. **Reserved**
35. **Reserved**
36. **Reserved**
37. **Reserved**
38. **Reserved**
39. **Reserved**
40. **Security and hardening check** — recurring.
    - Security review of apps, offline backend and sync (all)
    - Local data protection on desktop (backend)
    - Dependency scan and secrets review (all)
    - KPI report updated (backend, frontend)
    - Unit tests and Robot suites (tests)
41. **Migration from gamma and privacy check** — recurring.
    - Migration of users, stories and progression from gamma to delta (infra)
    - Privacy check including store requirements (all)
    - Dry run and rollback plan (docs)
    - Verify migrated data with Robot suites (tests)
    - Update [Environments](../Environments.md) (docs)
42. **Delta launch** — recurring.
    - New stage `delta`: own AWS stack, bucket and site; `delta.paths.games`, `delta-api.paths.games` (infra)
    - Store releases aligned with the launch (infra)
    - Content license check and i18n check (EN, IT) (docs, frontend)
    - Robot suites green on all three backends (tests)
    - Release notes (docs)
    - Launch and smoke test on every platform (all)

# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First draft of the delta version plan | September 25, 2026 |

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
