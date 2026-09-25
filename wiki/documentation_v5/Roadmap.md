# Paths Games V5 - Roadmap

**V5 — zeta: advanced multiplayer.** Draft plan of the sixth version: 42 steps released as
`5.N.0`. Rules in [Version Template](../VersionTemplate.md), all versions in the
[Global Roadmap](../Roadmap.md). Like V4, it may slip to a later number. Its content
comes from the old V0 roadmap steps 71-76 and from the multiplayer ideas of Step03.

Shared references: [Game Rules](../GameRules.md),
[Security](../Security.md), [Architecture](../Architecture.md).

- **Steps 1-6**: trade, chat, moderation, notifications (old 71-76).
- **Steps 7-14**: player signals, voting, group rituals, spectator mode.
- **Steps 15-16**: advanced multiplayer playtest and regression. **Steps 17-39**: reserved.
- **Steps 40-42**: recurring hardening, migration from epsilon, zeta launch.


# Steps

1. **Trade — propose, accept, reject** — old step 71.
    - Trade proposal endpoint to another character (backend)
    - Pending trades list (backend)
    - Accept or reject endpoint for the recipient (backend)
    - Cancel a trade proposal (backend)
    - Both characters in the same location, awake and not in coma (backend)
    - Personal realtime notification to the recipient (backend)
    - Unit tests (tests)
2. **Trade — validation, timeout, execution** — old step 72.
    - Offered and requested items exist in the inventories (backend)
    - Enough food, magic and coins, never negative (backend)
    - Timeout from a parameter (default 60 seconds), auto-reject (backend)
    - Atomic transfer between the two characters (backend)
    - `gaming_trades` records: PENDING → ACCEPTED / REJECTED / EXPIRED (backend)
    - TRADE_COMPLETED and TRADE_EXPIRED broadcasts (backend)
    - Unit tests (tests)
3. **In-game chat** — old step 73.
    - Send message endpoint with minimum time between messages (backend)
    - Paginated chat history (backend)
    - `chat_messages` storage (backend)
    - Chat broadcast on the match topic (backend)
    - Frontend chat panel (frontend)
    - Unit tests (tests)
4. **Chat moderation** — old step 74.
    - Configurable word filter (backend)
    - Message length limit and sanitisation against XSS (backend)
    - Admin mute of a user in a match (backend)
    - Moderation log with admin id (backend)
    - Muted state in the frontend and admin mute button (frontend)
    - Unit tests (tests)
5. **Notification queue** — old step 75.
    - `gaming_notification_queue` for trades, invitations, turns, events (backend)
    - Priorities: CRITICAL, HIGH, NORMAL, LOW (backend)
    - Delivery to connected users, storage for offline users (backend)
    - Paginated list, unread list, mark as read (backend)
    - Frontend notification centre with badge and toasts (frontend)
    - Unit tests (tests)
6. **Trade, chat and notifications UI** — old step 76.
    - Trade proposal dialog with item and resource pickers (frontend)
    - Incoming trade popup with countdown (frontend)
    - Chat in the book style (frontend)
    - Notification centre panel (frontend)
    - Visual and sound indicators for new messages (frontend)
    - Unit tests (tests)
7. **Player signals — backend** — quick non-chat communication.
    - Signal types: "follow me", "danger here", "need help" (backend)
    - Signals bound to a location and a time (backend)
    - Rate limit on signals (backend)
    - Realtime broadcast (backend)
    - Unit tests (tests)
8. **Player signals — frontend** — send and see signals.
    - Signal wheel or buttons (frontend)
    - Signals on the map (frontend)
    - Unit tests (tests)
    - Robot or integration tests with several clients (tests)
    - Update [Game Rules](../GameRules.md) (docs)
9. **Voting — backend** — the group decides critical choices together.
    - Choices marked as group votes (backend)
    - Vote collection with timeout (backend)
    - Resolution rules: majority, ties, absent players (backend)
    - Story format and validation (backend)
    - Unit tests (tests)
10. **Voting — frontend** — vote from the game board.
    - Voting dialog with live results (frontend)
    - Outcome page (frontend)
    - react-admin editor fields (frontend)
    - Unit tests (tests)
    - Integration tests with several clients (tests)
11. **Group rituals — backend** — actions that need several characters.
    - Rituals requiring characters in the same location (backend)
    - Stat sum thresholds (backend)
    - Group-unlocked events (backend)
    - Story format and validation (backend)
    - Unit tests (tests)
12. **Group rituals — authoring and UI** — build and play rituals.
    - Ritual editor in react-admin (frontend)
    - Ritual panel showing participants and thresholds (frontend)
    - Update [Game Rules](../GameRules.md) (docs)
    - Unit tests (tests)
    - Integration tests (tests)
13. **Spectator mode — backend** — watch ongoing matches.
    - Spectator connections with read-only access (backend)
    - Spoiler rules: what spectators can see (backend)
    - Public and private matches for spectators (backend)
    - Unit tests (tests)
    - Load impact check (tests)
14. **Spectator mode — frontend and ratings** — watch and rate.
    - Spectator view of the board (frontend)
    - Match rating and story rating (backend, frontend)
    - Ratings in the story catalog (frontend)
    - Unit tests (tests)
    - Robot or integration tests (tests)
15. **Advanced multiplayer playtest** — everything together.
    - Full story with 4+ players using trade, chat, signals, votes and rituals (all)
    - Concurrency checks: trade during movement, votes during timeouts (tests)
    - Bug list with severity (docs)
    - Fixes (all)
    - Playtest report (docs)
16. **Regression and polishing** — stabilise before hardening.
    - Regression fixes from the playtest (all)
    - Performance check of realtime traffic with the new messages (tests)
    - UI polishing of the new panels (frontend)
    - Robot and integration suites green (tests)
    - Documentation alignment (docs)
17. **Reserved**
18. **Reserved**
19. **Reserved**
20. **Reserved**
21. **Reserved**
22. **Reserved**
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
    - Security review of chat, trade, signals and spectators (all)
    - Abuse tests: spam, trade exploits, spectator data leaks (tests)
    - Dependency scan and secrets review (all)
    - KPI report with the new interactions (backend, frontend)
    - Unit tests and Robot suites (tests)
41. **Migration from epsilon and privacy check** — recurring.
    - Migration of users, stories and progression from epsilon to zeta (infra)
    - Privacy check: chat messages retention (all)
    - Dry run and rollback plan (docs)
    - Verify migrated data with Robot suites (tests)
    - Update [Environments](../Environments.md) (docs)
42. **Zeta launch** — recurring.
    - New stage `zeta`: own AWS stack, bucket and site; `zeta.paths.games`, `zeta-api.paths.games` (infra)
    - Content license check and i18n check (EN, IT) (docs, frontend)
    - Robot suites green on all three backends (tests)
    - Release notes (docs)
    - Launch and smoke test with several players (all)

# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First draft of the advanced multiplayer version plan | September 25, 2026 |

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
