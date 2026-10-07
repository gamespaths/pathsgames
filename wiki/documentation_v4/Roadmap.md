# Paths Games V4 - Roadmap

**V4 — epsilon: multiplayer.** Draft plan of the fifth version: 42 steps released as `4.N.0`.
Rules in [Version Template](../VersionTemplate.md), all versions in the
[Global Roadmap](../Roadmap.md). This version may slip to a later number (V20 or
beyond) if new ideas arrive first. Its content comes from the old V0 roadmap steps 49-59, 60
(multiplayer parts), 61-70, 81-84 and 90-91.

Shared references: [Architecture](../Architecture.md),
[Game Rules](../GameRules.md), [Security](../Security.md),
[API Conventions](../ApiConventions.md).

- **Steps 1-2**: realtime analysis, reproducible randomness. **Steps 3-8**: realtime channel (old 49-54).
- **Steps 9-14**: multiplayer match, lobby and start (old 55-60). **Steps 15-21**: multiplayer turns, time, anti-stall, coma rescue (old 60-66).
- **Steps 22-25**: multiplayer movement and follow (old 67-70). **Steps 26-29**: multiplayer frontend and admin kick (old 79, 81-83).
- **Steps 30-33**: integration, load test, playtests (old 84, 90, 91, 94). **Steps 34-39**: reserved.
- **Steps 40-42**: recurring hardening, migration from delta, epsilon launch.


# Steps

1. **Realtime analysis** — one realtime design for three backends.
    - Java: Spring WebSocket with STOMP; Python: FastAPI WebSocket; AWS: API Gateway WebSocket API (docs)
    - Common message contract independent from the transport (docs)
    - Concurrency model: one action at a time per match (match lock) (docs)
    - Scaling notes: several instances, sticky sessions, shared broker (docs)
    - List of doubts for the owner (docs)
2. **Reproducible randomness** — extend the existing seed to every random draw.
    - `gaming_match.rng_seed` already drives weather and random events since v0.27 (docs)
    - Every remaining random draw uses the match seed (backend)
    - Replay of a match from its seed and action log (backend)
    - Admin replay check (frontend)
    - Unit tests for determinism across backends (tests)
3. **Realtime server and broker** — old step 49.
    - Realtime endpoint and topic structure: match topic, personal queue (backend)
    - Heartbeat intervals and session timeout parameters (backend)
    - Handshake checks: origin validation and rate limiting (backend)
    - CORS for realtime connections (backend)
    - Frontend realtime client wrapper with auto-reconnect (frontend)
    - Unit tests for configuration, handshake and client (tests)
4. **Realtime authentication and sessions** — old step 50.
    - JWT validation at handshake (backend)
    - Map sessions to user and active match in `gaming_user_sessions` (backend)
    - Reject invalid, expired or missing tokens (backend)
    - Session registry per user with client id, IP and device (backend)
    - Token refresh for long connections without dropping the session (backend)
    - Frontend token injection and re-auth on disconnect (frontend)
    - Unit tests (tests)
5. **Message types and payloads** — old step 51.
    - Message types: TURN_UPDATE, STATE_SYNC, EVENT_TRIGGERED, CHOICE_AVAILABLE, NOTIFICATION, … (backend)
    - Standard payload: type, matchId, timestamp, senderId, data (backend)
    - Serialisation of domain events to messages (backend)
    - Match topics and user queues (backend)
    - Frontend message dispatcher (frontend)
    - Unit tests (tests)
6. **Realtime state sync** — old step 52.
    - Broadcast turn changes, movements, events and choices (backend)
    - Broadcast weather changes and time advancement (backend)
    - Broadcast visible registry updates (backend)
    - Frontend merge of realtime updates with local state (frontend)
    - Unit tests for broadcasts and merge (tests)
7. **Reconnection and desync recovery** — old step 53.
    - Disconnection detection through heartbeat, `is_online` flag (backend)
    - Reconnection within a grace period with the same session (backend)
    - Full match state sent on reconnection (backend)
    - State version counter to detect desync (backend)
    - Disconnect and reconnect logs (backend)
    - Frontend reconnection UI and resync (frontend)
    - Unit tests (tests)
8. **Realtime logging and monitoring** — old step 54.
    - Connection, disconnection and error logs (backend)
    - Active connections per match and system-wide (backend)
    - Metrics: connection duration, throughput, error rate (backend)
    - Admin realtime status endpoint (backend)
    - Frontend connection status indicator (frontend)
    - Unit tests (tests)
9. **Multiplayer match creation** — old step 55.
    - Match creation with minimum and maximum players (backend)
    - Validation: player limits from difficulty, story compatibility, logged creator (backend)
    - Lobby timeout through `timestamp_lock_expiration` (backend)
    - Public or private match (invite link) (backend)
    - Frontend creation form with multiplayer options (frontend)
    - Unit tests (tests)
10. **Lobby and joining** — old step 56.
    - List of matches waiting for players (backend)
    - Match list by user and status (backend)
    - Join endpoint with validations (full, already joined) (backend)
    - Maximum players from `difficulty.max_character` (backend)
    - Frontend match browser (frontend)
    - Unit tests (tests)
11. **Character selection in the lobby** — old step 57.
    - Selection flow per player reusing single-player endpoints (backend)
    - No duplicate character templates in the same match (backend)
    - Selection status per player up to READY (backend)
    - Ready endpoint that locks the selection (backend)
    - Broadcast selection updates (backend)
    - Frontend selection panel with live progress (frontend)
    - Unit tests (tests)
12. **Lobby state and readiness** — old step 58.
    - Lobby state endpoint: players, characters, readiness (backend)
    - Match can start only when all players are READY (backend)
    - Countdown before auto-start (backend)
    - Leave endpoint before start (backend)
    - Lobby broadcasts: joined, left, ready, countdown (backend)
    - Unit tests (tests)
13. **Multiplayer match start** — old step 59.
    - Start endpoint (creator or auto-start) (backend)
    - Validate locked characters and minimum players (backend)
    - Initialise every character at the start location (backend)
    - Turn queue with the priority formula for all characters (backend)
    - Status CREATED → RUNNING, `MATCH_STARTED` broadcast (backend)
    - Unit tests (tests)
14. **Lobby frontend** — old step 60, frontend part.
    - Lobby page with realtime player list (frontend)
    - Character selection carousel with status badges (frontend)
    - Countdown overlay (frontend)
    - Creator controls: start, kick player, cancel match (frontend)
    - Responsive layout for 2-10 players (frontend)
    - Unit tests (tests)
15. **Multiplayer turn cycle** — old step 61.
    - Turn engine for several characters in `gaming_turn_queue` (backend)
    - Current character in `gaming_match.id_character_current_turn` with broadcast (backend)
    - Turn advancement and passing (backend)
    - Round completion detection (backend)
    - Frontend turn order panel (frontend)
    - Unit tests (tests)
16. **Out-of-turn blocking and match lock** — old step 62.
    - Guard: only the current character's player can act (backend)
    - Read-only actions always allowed: inventory, map, registry (backend)
    - Clear error with the current player's info (backend)
    - One action at a time per match (lock) (backend)
    - Frontend disables actions and shows "waiting for …" (frontend)
    - Unit tests (tests)
17. **Turn timeout and automatic pass** — old step 63.
    - Timeout per match from difficulty or parameter (backend)
    - Timer stored in `gaming_turn_queue.timestamp_end` (backend)
    - Scheduled check of expired turns (backend)
    - Auto-pass with log and consecutive pass counter (backend)
    - Frontend countdown with warnings at 25% and 10% (frontend)
    - Unit tests (tests)
18. **Turn notifications** — old step 64.
    - TURN_CHANGED with next player and deadline (backend)
    - TURN_TIMEOUT and ROUND_COMPLETE (backend)
    - TIME_ADVANCING with new weather and recovery (backend)
    - Personal queue position notice (backend)
    - Frontend turn panel updates (frontend)
    - Unit tests (tests)
19. **Multiplayer time advancement** — old step 65.
    - Time advances only when all characters are out of energy or sleeping (backend)
    - Recovery per character at time-start (backend)
    - Queue priorities recalculated (backend)
    - Mixed states: sleeping and exhausted characters (backend)
    - Random events at time-start for the whole party (backend)
    - TIME_STARTED broadcast (backend)
    - Unit tests (tests)
20. **Anti-stall rules** — old step 66 and the anti-stall idea from Step03.
    - Consecutive pass counters per character and per match (backend)
    - Warning at a configurable threshold (backend)
    - Game over when the maximum from difficulty is exceeded (backend)
    - Inactivity penalties or micro-events after N minutes (backend)
    - Frontend stall warning banner (frontend)
    - Unit tests (tests)
21. **Coma rescue and multiplayer game over** — old step 60, game part.
    - `ask-help` action: a request to every character (backend)
    - `help-player` action: rescue from coma in the same location (backend)
    - Game over when the match cannot continue (backend)
    - Update [Game Rules](../GameRules.md) (docs)
    - Unit tests and Robot suite (tests)
22. **Multiplayer movement** — old step 67.
    - PLAYER_MOVED broadcast with from, to and remaining energy (backend)
    - Location capacity with every character considered (backend)
    - Concurrent moves to a limited location: first come, first served (backend)
    - Frontend tokens moving in realtime (frontend)
    - Unit tests (tests)
23. **Group movement — follow invitations** — old step 68.
    - Follow invitation when a group move is requested (backend)
    - `gaming_movement_invites` records with state and timeout (backend)
    - Pending invitations endpoint (backend)
    - Accept endpoint: free move to the sender's location (backend)
    - Frontend invitation popup (frontend)
    - Unit tests (tests)
24. **Invitation timeout** — old step 69.
    - Timeout from a parameter (default 30 seconds) (backend)
    - Scheduled expiry to EXPIRED (backend)
    - Cancel invitations on time advance or turn change (backend)
    - INVITE_EXPIRED broadcast (backend)
    - Frontend auto-dismiss with countdown (frontend)
    - Unit tests (tests)
25. **Movement and follow UI** — old step 70.
    - Map with every character's position (frontend)
    - Direction buttons with energy cost preview (frontend)
    - "Invite to follow" panel (frontend)
    - Movement animations (frontend)
    - Capacity warnings (frontend)
    - Unit tests (tests)
26. **Multiplayer game board** — old step 81.
    - Board with every character's position, stats and actions (frontend)
    - Top bar with all players and the active one highlighted (frontend)
    - Other players' events shown without spoiling their options (frontend)
    - Debounce of rapid state changes (frontend)
    - Unit tests (tests)
27. **Turn indicators and player panels** — old step 82.
    - "Your turn" / "Waiting for …" banner (frontend)
    - Circular countdown timer (frontend)
    - Player panels: class, energy, life, location, sleep and coma (frontend)
    - Turn history sidebar (frontend)
    - Unit tests (tests)
28. **Reconnection UI and error handling** — old step 83.
    - Connection indicator: connected, reconnecting, disconnected (frontend)
    - Reconnection overlay with exponential backoff (frontend)
    - Error toasts for API, realtime and rule errors (frontend)
    - "Sync required" banner on stale state (frontend)
    - Unit tests (tests)
29. **Admin — kick and multiplayer control** — old step 79, match part.
    - Kick a user from a match and stop their activity (backend)
    - Force-unlock of stuck multiplayer matches (backend)
    - Admin log entries (backend)
    - react-admin controls with confirmation (frontend)
    - Unit tests and Robot suite (tests)
30. **Multiplayer integration testing** — old step 84.
    - Full lifecycle: lobby → join → select → start → play → end (tests)
    - Realtime scenarios: connect, update, disconnect, reconnect (tests)
    - Concurrent actions and edge cases (tests)
    - Several simulated clients against a running backend (tests)
    - Integration test report (docs)
31. **Realtime load test** — old step 94, realtime part.
    - Targets: concurrent matches and connections (all)
    - Load tool with simulated players (tests)
    - Broadcast latency and error rates (tests)
    - Bottleneck fixes (backend)
    - Load test report (docs)
32. **Multiplayer playtest** — old step 90.
    - Full story with 4+ players (all)
    - Turn rotation, timeouts and anti-stall (all)
    - Group movement and same-location events (all)
    - Disconnect and reconnect mid-turn (all)
    - Bug list with severity (docs)
33. **Edge case testing** — old step 91.
    - All players disconnect at once (tests)
    - Timeout cascade with all players away (tests)
    - Coma scenarios and rescue (tests)
    - Stall until game over (tests)
    - Data integrity after each case (tests)
34. **Reserved**
35. **Reserved**
36. **Reserved**
37. **Reserved**
38. **Reserved**
39. **Reserved**
40. **Security and hardening check** — recurring.
    - Realtime authentication penetration tests: no token, expired token, impersonation (tests)
    - Rate limits on realtime messages (backend)
    - Dependency scan and secrets review (all)
    - KPI report with multiplayer metrics (backend, frontend)
    - Unit tests and Robot suites (tests)
41. **Migration from delta and privacy check** — recurring.
    - Migration of users, stories and progression from delta to epsilon (infra)
    - Privacy check: session and connection data (all)
    - Dry run and rollback plan (docs)
    - Verify migrated data with Robot suites (tests)
    - Update [Environments](../Environments.md) (docs)
42. **Epsilon launch** — recurring.
    - New stage `epsilon`: own AWS stack, bucket and site; `epsilon.paths.games`, `epsilon-api.paths.games` (infra)
    - Content license check and i18n check (EN, IT) (docs, frontend)
    - Robot suites green on all three backends (tests)
    - Release notes (docs)
    - Launch and smoke test with several players (all)

# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First draft of the multiplayer version plan | September 25, 2026 |

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
