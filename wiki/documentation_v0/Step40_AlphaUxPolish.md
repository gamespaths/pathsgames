# Step 40 — Alpha UX polish

**Status: developed (v0.40.0), refined in a second pass (§8, decisions 20-31) — the new Robot
suite has NOT run against a real backend yet (§6.6, §7).** Roadmap line: *tutorial tips on card
pages, weather display fix, environment badge, resource logs check, match list restyle, roadmap
book* ([Roadmap](./Roadmap.md) step 40). Mostly react-game; the weather fix and the resource
logs also touch the three backends.

## 1. Scope

| # | Sub-point | Tag | Summary |
|---|-----------|-----|---------|
| A | Card tips | frontend | "tip" link in the footer of `page` cards opens a gold-glow hint in the description; open by default in tutorial stories |
| B | Time-start news on early time-ends (weather display fix) | backend, frontend | An action that ends the time early shows the new weather (if it changed) and the wake-up list |
| C | Environment badge | frontend | Env code from `VITE_ENV_BADGE`, shown as a translated label (`dev` → "Local version"/"Locale version") in both headers and the footer; nothing when empty |
| D | Resource logs check | backend | Every gain of items, food, magic, coin reaches the match timeline |
| E | Match list restyle | frontend | Status badge and a contextual button per small card (Resume when active, Missions + Log otherwise); Log opens the big timeline page, framed by current status and creation date |
| F | Roadmap book | frontend | Footer "Devlog" opens a book: project intro on the left, one small card per version (from `data/roadmap.json`) on the right |
| G | Tests | tests | Unit tests > 96% of new code; new Robot suite `40_alpha_ux/` (own story) for B and D |

**Out of scope**: security and KPI report (step 41, decision 9), privacy and launch (42), the
weather-linked event (`list_weather_rules.id_event`, still only logged), a weather card at
every time-start (decision 1), reordering the time-start (decision 2), "last played" date
(`tsUpdate`, V1, decision 7), AWS `tsInsert` format alignment (see §6.4), i18n beyond EN/IT.

### B — what the code does today (findings)

- **F1** v0.39.0 already orders *weather → wake-up list* on the **sleep** path
  (`useGameplayResults.js`, `[weather]` effect); no unit test covers that case.
- **F2** The weather card appears only when the weather **uuid** changes (the rule's uuid).
  Kept as is (decision 1).
- **F3** Time-start order on all three backends is recovery → pending automatic events
  (counter-zero, start-time) → **weather roll** → random event, so a counter-zero event's
  `idWeather` effect is overwritten by the roll. **Known behaviour, not changed by this step**
  (decision 2).
- **F4** A time-end **forced** by `flag_end_time` (execute-event, select-choice, an arrival
  after a move) runs the same time-start but drops its `counterZero` list: Java/Python
  `EventExecutionService.forceTimeEnd` ignore `outcome.counterZero()`, AWS discards `_fired`
  (`handler.py` ~2906, ~3640). Those events are applied but never narrated. **Fixed here**
  (decision 3).

### D — resource gains in the timeline today (findings)

| Path | Java | Python | AWS |
|------|------|--------|-----|
| execute-event and its chain (`EVENT` row `*Gain`) | ok (actor) | ok (actor) | ok (actor) |
| automatic events: arrival, counter-zero, start-time | ok (actor) | ok (actor) | **missing** (chain rows written without gains, `handler.py` ~4056) |
| party-run events: random event, mission trigger (no actor) | **missing** | **missing** | **missing** |
| select-choice effects | **missing** | **missing** | **missing** |
| items added/removed by effects (`ITEM_ADD` / `ITEM_DROP`) | ok | ok | ok |
| use-item deltas (`ITEM_USE`) | ok | ok | ok |

Choice effects add to the gain counters, but the `CHOICE_SELECTED` marker is written with
`ResourceDelta.none()` and no timeline type reads it (AWS writes it as an `AUDIT#` row, which
the timeline never reads). Every **missing** cell is fixed here (decisions 4, 5).

## 2. Endpoint APIs

No new endpoint. Changed answers, documented in the new file
`code/backend/java/adapter-rest/src/main/resources/openapi/v0.40.0-alpha-ux-api.yaml`:

| Endpoint | Change |
|----------|--------|
| `POST /api/gameplay/{uuidMatch}/action/execute-event` | new `timeEnded`; when true, `counterZero[]` (same item shape as the sleep answer) and `weather` (`weather` can still be null: the story may have no eligible weather) |
| `POST /api/gameplay/{uuidMatch}/action/select-choice` | same as execute-event |
| `POST /api/gameplay/{uuidMatch}/movements/start` (`MovementStartResponse`) | same three keys (`timeEnded`, `weather`, `counterZero[]`), set when the arrival event ended the time |
| `POST /api/gameplay/{uuidMatch}/inventory/use-item`, choice-event open (AWS) | `weather`/`counterZero` keys always present (null/empty: neither can end the time) — AWS parity fix, §6.3 |
| `GET /api/match/{uuidMatch}/logs`, admin logs | new entry type `CHOICE` with `*Cost`/`*Gain`, `idEvent`, card |

The sleep answer is unchanged. Every backend (Java, Python, AWS) answers the same shape.

## 3. DTOs and Domain Models

- `TimeStartWeather` (answer block, same fields as `WeatherResponse`): `uuid`, `idWeather`,
  `card`, `deltaEnergy`, `costMoveSafeLocation`, `costMoveNotSafeLocation`, plus
  `changed: boolean` (differs from the weather before the time-start). `null` when no time-end
  was forced or the story has no eligible weather.
- `ExecuteEventResponse`, `SelectChoiceResponse`: `weather` + `counterZero[]` (empty by default).
- `MovementStartResponse`: new `timeEnded` (boolean) plus `weather` + `counterZero[]`; `weather`
  can be null even when `timeEnded` is true (the story may have no eligible weather at that
  time-start — same rule as on the other two answers, §2).
- Java core: `TimeAdvancementService.TimeEndOutcome` gains the weather view (with `changed`);
  `EventExecutionService.Exec` keeps the forced time-end `counterZero` and weather.
- `MatchLogsPort.LogEntry`: new type constant `CHOICE` (no new field: cost/gain already exist).
- `Exec.recordGain`: with no actor (party run — random event, mission reward), the gains of
  every recipient are summed onto that **event's own `EVENT` row** (the chain's
  `MSG_EVENT_EXECUTED` marker), single-player only for now (decision 5). The top-level
  `RANDOM_EVENT` / `AUTOMATIC_EVENT` audit row (`logAutomaticEvent`, one per trigger) stays
  gain-free, as before: putting the sum there too would count it twice on the timeline.

## 4. Roles and Authentication

No change. Player answers keep the guest JWT and ownership checks; admin logs stay on port
8044. Tips, badge and books are client-only and need no token.

## 5. Database Tables

- **SQLite / PostgreSQL**: no migration. `log_events` has `energy_gain`…`coin_gain` since
  `V0.35.4`; the `CHOICE_SELECTED` marker row simply starts filling them and the timeline
  maps it to `CHOICE`.
- **DynamoDB**: the `CHOICE_SELECTED` marker stays an `AUDIT#` row (ONCE/open-cycle
  accounting); a new `LOG#` row of type `CHOICE` carries the gains for the timeline. Automatic
  chain `LOG#` rows get the `*Gain` attributes. No GSI change.

## 6. Components

### 6.1 Java (reference)

- `TimeAdvancementService.forceTimeEnd` / `advanceTime`: return the weather in force after the
  time-start (`WeatherSelectionService.applyAtTimeStart` already returns it) and whether it
  changed. Time-start order unchanged.
- `EventExecutionService.forceTimeEnd`: keep `outcome.counterZero()` (described for the actor)
  and the weather on `Exec`; `buildResult` copies them to the execute-event, select-choice and
  movement answers.
- `EventExecutionService`: `writeResolutionMarkers` logs the choice's `gainsSince` mark;
  `recordGain` sums all recipients when `x.actor == null`, and the sum lands on the triggered
  event's own `EVENT` row (chain), never on the `RANDOM_EVENT`/`AUTOMATIC_EVENT` audit row.
- `MatchLogsService.assembleTimeline`: `MSG_CHOICE_SELECTED` → type `CHOICE`, one row per
  chosen option, enriched with the owning event's card; the `RANDOM_EVENT`/`AUTOMATIC_EVENT`
  builders read no gain columns (unchanged) — the gains sit on the paired `EVENT` row instead.
- DTOs: `ExecuteEventResponse`, `SelectChoiceResponse`, `MovementStartResponse`; OpenAPI
  `v0.40.0-alpha-ux-api.yaml`.

### 6.2 Python

Mirror of 6.1: `time_advancement_service.py`, `event_service.py` (`_force_time_end`,
`record_gain`, choice marker), `match_logs_service.py`, REST DTO mapping.

### 6.3 AWS

- `match/handler.py`: `_advance_time`/`_force_time_end_news` return the weather + `counterZero`
  block (`_time_start_weather`, `_describe_for_recipient`); automatic chain rows write
  `_gains_since`; party runs (random event, mission) sum all characters onto the event's own
  `EVENT` row, matching Java/Python (§6.1).
- **Arrival `flagEndTime` fix**: an ARRIVAL event with `flagEndTime` now ends the time on AWS
  too (`~4372`, `trigger in _ARRIVAL_TRIGGERS`) — AWS used to ignore it, Java/Python already
  didn't. `MovementStartResponse`'s AWS shape gains `weather`/`counterZero` from that pass.
- **select-choice linked events now log their gains**: `_resolve_choice` writes the picked
  option's own rows into the new `CHOICE` `LOG#` row (`choice_gains`, `_gains_since`), and
  every linked event `_run_linked_event` → `_run_event_chain` runs writes its **own** `EVENT`
  row with gains — before this session AWS silently dropped them; now it matches Java/Python.
- **Parity — weather + counterZero always present**: execute-event, select-choice, use-item
  (`_use_item`) and a choice-event's open re-serve (`_execute_choice_event`) all spread
  `_no_time_end_news()` (`{"weather": None, "counterZero": []}`) into their answer, so the two
  keys are never missing even when the action cannot end the time.
- `match/choices.py` / `logbook.py`: `CHOICE` `LOG#` row beside the `AUDIT#` marker; the
  timeline reader maps it.

### 6.4 react-game

- **A — tips** (only `Card` `variant="page"`, no memory: no `localStorage`, no reset button):
  - **Texts**: `tips.<entityType>` in `en.json` / `it.json` (`location`, `event`, `item`,
    `movement`, `action`, `class`, `character`, `missions`, `missionStep` (own type for a
    mission step — `MissionStepsCards.jsx`), `registry`, `map`, …). A type without a text
    (`t()` returns the key, as for `typeBadgeLabel`) shows no link and no tip. `tips.matchlog`
    was **removed** (refinement): the History page shows no tip and no description.
  - **Link**: `CardCreditsBar.jsx` shows a "tip" link (`fa-lightbulb`) right after the type
    label (Action / Trait / Location…). The bar renders (no longer returns `null`) whenever
    there is author credit, image credit, **or** a tip.
  - **Open**: the tip is appended at the end of `book-page-desc` in a `TipNote` block
    (`components/ui/TipNote.jsx`), then `scrollIntoView({ block: 'nearest', behavior: 'smooth' })`
    and focus on it (`tabIndex=-1`), so a long description scrolls down to the new text.
  - **Hide**: an icon button (`fa-eye-slash`, label `card.hideTip` as `aria-label`/`title`),
    absolutely positioned in the bottom-right corner of the tip box, its `bottom` set to the
    box's own bottom padding so it sits on the last line of text — no icon-only empty row.
    Clicking "tip" again reopens it. State is a local `useState` in `Card`, reset when the card
    (uuid/type) changes.
  - **Tutorial**: when `story.category` equals `TUTORIAL_CATEGORY` (case-insensitive) the tip
    starts open on every page, with its hide icon; hiding is not remembered, the next page
    opens it again. `TUTORIAL_CATEGORY` in `constants/features.js` from build-time
    `VITE_TUTORIAL_CATEGORY`, default `tutorial` (the seed stories use lowercase `tutorial`).
    The dev agent checks that the `story` passed to the page cards carries `category`.
  - **Style**: `.pg-tip` in the medieval theme — gold border, gold glow (`box-shadow`),
    lightbulb icon, short fade-in; no animation under `prefers-reduced-motion`.
  - **Book labels** (refinement, unrelated to the tip text): `book.missionStep` = "Mission
    step" was added for the new entity type; `book.missions` = "Mission" was missing and is
    now added too — both feed `typeBadgeLabel` (`Card.jsx`, `book.<entityType>`) as well as the
    tip.
- **B — early time-end news**: `handleEventExecuted`, `handleSelectChoice` and
  `handleMovementDone` in `useGameplayResults.js` read `counterZero[]` and `weather` from the
  answer when `timeEnded` is true: the action's own card first → forward arrow → the weather
  card **only if `weather.changed`** → the wake-up list. They pre-set `prevWeatherUuidRef` so
  the `[weather]` effect does not show the card twice. The sleep path is unchanged (F1 gets a
  test). Edge states and pending choices still outrank it.
- **C — badge**: `components/layout/EnvBadge.jsx`, used in `Navbar.jsx` and in the footer's
  alpha warning line (below). Build-time `VITE_ENV_BADGE` holds the env **code** (`dev`,
  `test`, `alpha`, `beta`, …); the exported `envBadgeLabel(code, t)` helper resolves the
  translated label `envBadge.<code>` (EN/IT), reused by both call sites: `dev` → "Local
  version" / "Locale version", `test` → "Test version", `alpha` → "Alpha version", `beta` →
  "Beta version" (owner's later edit; the IT strings keep the English word "version"). Unknown
  code → the code in upper case; empty/unset or `prod` → nothing (`envBadgeLabel` returns
  `null`). `.env.example` documents it; the owner sets the values (see §6.7).
- **D — logs**: `MatchLogCard.jsx` `TYPE_ICON`/`TYPE_COLOR` for `CHOICE`; i18n
  `matchLog.types.CHOICE` (EN/IT).
- **E — match list** (no backend change):
  - **List**: `UserMatchesList.jsx` keeps the grid of small `MatchCard`s
    (`features/matches/MatchCard.jsx`). Order: active (`CREATED`/`RUNNING`) → `PAUSED` →
    finished (`ENDED`/`GAMEOVER`), newest first in each group (`sortMatchesForList`,
    `utils/matchStatus.js`).
  - **Status badge**: `features/matches/MatchStatusBadge.jsx` (its own file, shared by
    `MatchCard` and `MatchLogCard`'s history rows — `inline` prop for the latter). Markup
    classes `story-card-status story-card-status--<tone> stat-badge bonus-badge` (+
    `story-card-status--center` centred on the picture, or `story-card-status--inline` in a
    history row); `MATCH_STATUS_BADGE` in `utils/matchStatus.js` maps status → tone + glyph:
    `RUNNING`/`CREATED` → `active` ▶, `PAUSED` → `paused` ⏸, `ENDED` → `completed` ✓ (green
    `#4ade80`), `GAMEOVER` → `completed` ☠ (red `#ef4444`); text `matches.status.*` (EN/IT). The
    `.story-card-status` CSS now only **positions** the badge (absolute, top-left, or centred /
    inline); the visual look everywhere is `.stat-badge.bonus-badge`, the same class pair every
    other badge in the game uses — including the home story-card status badge. The Roadmap
    book's "In progress" badge (§F below) reuses the same class pair.
  - **Buttons under the card** (`CardButtons`, new optional `selectIcon` prop): active match →
    (i) + **Resume** (`matches.resume` = "Resume", goes to the match, as today); any other
    (`PAUSED`/`ENDED`/`GAMEOVER`) → a small **Missions** icon (`fas fa-clipboard-list`) takes
    the (i) slot (`onPreviewCard({ ..., missionsOnly: true })`, opens the missions view but
    `GuestUserModal.jsx` skips rendering the small `MatchHistoryCard` when `missionsOnly` is
    set) + a wide **Log** button (new key `matches.logOpen` = "Log", icon `fa-history` via
    `selectIcon`) opening the big History page directly (`openPreview` +
    `setMatchView('history')`): story card on the left page, the big `MatchLogCard` page on the
    right. Its back arrow returns to the list, not to the missions view.
  - **History page** (`MatchLogCard.jsx`, still newest-first): keeps the entry tiles and gains
    two client-side tiles built from the match summary (new `match` prop, no API change):
    first tile = **current status** (`MatchStatusBadge` `inline`); last tile = **"Creation"**
    badge with the creation date, shown only once the last page is loaded (no more "load more").
  - **Date formatter** in `utils/`: accepts ISO strings and epoch-ms numbers (AWS answers
    `tsInsert` as a number), locale from the active language; missing/invalid → no date.
  - In the game book (`PageRight.jsx`) the same two tiles appear when the match info carries
    status and creation date; the dev agent checks that `tsInsert` is there, otherwise the
    Creation tile is skipped in game.
- **F — roadmap book**: `PolicyBookContext` gains kind `roadmap` (`POLICY_KINDS`); the footer
  "Devlog" link (`Footer.jsx`, today a GitHub link) calls `policyLink('roadmap')`.
  - **Left page**: `Card variant="page"`, title "paths.games", image `home`, a short project
    intro (max 4 lines, `modals.roadmap.intro`, EN/IT; final text below, edited by the owner).
  - **Right page**: a grid of small `Card`s, one per version, laid out like `CreditsCards`.
    Each card: title = the version's own stage name (see the table below), image = `imgId` from
    `images.json` (like the left page's own `home` card), the "In progress" badge (same
    `story-card-status--active` style, centred) on the current version only, a **Roadmap**
    button opening the version's GitHub roadmap in a new tab. Order: completed versions, then the current one,
    then the planned ones (json order inside each group).
  - **Data**: `src/data/roadmap.json`, the single place to edit when a version changes state
    (e.g. planned → current); six cards, V0-V5 (V6 left out for now, added back when needed).
    The owner renamed the stages and swapped some images after the first draft — actual content:

    | id | title | status | imgId | link |
    |----|-------|--------|-------|------|
    | v0 | Star project | current | `phase-creating` | `…/wiki/documentation_v0/Roadmap.md` |
    | v1 | Single-player | planned | `person` | `…/wiki/documentation_v1/Roadmap.md` |
    | v2 | A living world | planned | `map-alternative-2` | `…/wiki/documentation_v2/Roadmap.md` |
    | v3 | App and desktop | planned | `phase-running` | `…/wiki/documentation_v3/Roadmap.md` |
    | v4 | Multiplayer | planned | `phase-joining` | `…/wiki/documentation_v4/Roadmap.md` |
    | v5 | To Infinity | planned | `phase-created` | `…/wiki/documentation_v5/Roadmap.md` |

    `…` = `https://github.com/gamespaths/pathsgames/blob/develop` (same branch as today's
    Devlog link). `status` ∈ `completed` | `current` | `planned`; an unknown status counts as
    planned; a missing `imgId` falls back to `home`. Titles are stage names, not translated.
  - **Texts** `modals.roadmap.*` (EN/IT): book title "Devlog", intro, badge "In progress" / "In
    corso", button "Roadmap". Intro, rewritten by the owner from the draft (three short
    paragraphs — open source, licences, fun):
    - EN: *paths.games is an open-source project: anyone can read, study and improve it. The
      code is released under the GNU GPL v3 license, while the stories are under CC BY-NC-ND
      4.0. Above all, it is a project made to have fun: playing, writing and building it
      together.*
    - IT: *paths.games è un progetto open source: chiunque può leggerlo, studiarlo e
      migliorarlo. Il codice è rilasciato con licenza GNU GPL v3, mentre le storie con licenza
      CC BY-NC-ND 4.0. Prima di tutto è un progetto per divertirsi: giocando, scrivendo e
      costruendolo insieme.*

- **Missions — closed missions unlocked, shared badges** (refinement, `utils/missions.js`,
  `MissionStepCard.jsx`, `MissionStepsCards.jsx`): a closed mission (`COMPLETED`/`FAILED`) is no
  longer locked — its own little card shows the status badge over the image (like the progress
  badge) and keeps the plain wide (i) footer, exactly as an open mission's card does. A
  `COMPLETED` badge is drawn in `MISSION_CHECK_COLOR` (`#4ade80`, the same green as the story
  list's completed check). A done mission **step** is no longer locked either: it wears the
  Completed badge instead. Step **pages** (the mission's own reading page and each step's) now
  carry the same badges as the little cards — `missionPageStats` composes `missionStatusBadge`
  (status; `keepZero: true` so the word is never dropped by the zero filter) with the new
  `missionStepsBadge` (the "n/m" progress, reusing the little card's icon) — so a page badge is
  never plain grey any more. Reused wherever a mission or its steps are read: the guest book
  (`GuestUserModal.jsx`), in game (`PageRight.jsx`) and the end-game book (`EndGameBook.jsx`).
- **Card page credits bar — one line** (refinement, `CardCreditsBar.jsx`, `.gc-credits` /
  `.gc-credits__text` in `main.css`): the bar is `flex-wrap: nowrap` and never grows past one
  line; the credits text (`gc-credits__text`) is cut with `text-overflow: ellipsis` on the
  right, with the untruncated text as its `title` tooltip; the type-badge label
  (`gc-type-badge-credits`) and the "tip" link (`gc-credits__tip`) both keep `flex-shrink: 0`
  so they never shrink to make room for the credits text.
- **Page description blank lines — halved height** (refinement, `utils/sanitizeHtml.js`,
  `components/ui/SafeHtml.jsx`): a run of 2+ consecutive `<br>` in a page description is authored
  as a paragraph break, but rendered it looked like a full blank line. `halveBlankLines(html)`
  turns every `<br>` past the first of such a run into one `<span class="book-page-gap">` block
  (CSS: `height: 0.5lh`, `0.75em` fallback for browsers without `lh` support), so the gap is half
  a line high. `SafeHtml` gained a `halfBlankLines` boolean prop (default off); only the page
  description (`Card.jsx`, `book-page-desc`) passes it — every other `SafeHtml` caller is
  unaffected.
- **Footer rewrite** (refinement, `Footer.jsx`, `EnvBadge.jsx`, `mobile.css`):
  - The alpha warning is now built from pieces: `footer.alphaPrefix` ("This is only the") +
    `<EnvBadge />` + line break, only when `envBadgeLabel(ENV_BADGE, t)` is non-null (empty/prod
    build → the whole first sentence is dropped); then a fixed `v0.40.0` line ("CRAFTED WITH ♥
    BY THE PATHS GAMES DEV TEAM", from `footer.madeWith`/`footer.byTeam`); then a line break and
    `footer.serversWarning` ("Servers may be unavailable or reset at any time."); then the
    server row. The old key `footer.alpha` was replaced by `footer.alphaPrefix` +
    `footer.serversWarning`.
  - **Server row**: no box, same font/size as the rest of the footer; `footer.serverSelect`
    ("Server") as a plain label, then the server name — a fixed `<span>` (no drop-down) when
    `VITE_DEFAULT_SERVERS` resolves to exactly one server, a `<select>` otherwise — then a
    status dot sized `0.6em`.
  - **Mobile**: the Instagram/YouTube footer links (`.footer-social-link`) hide below 768px in
    `mobile.css`, mirroring the navbar's own social icons (`.navbar-social`); both rules are
    doubled selectors (`.footer-social-link.footer-social-link`) because `mobile.css` is
    imported before `main.css` and needs the extra specificity to win.
- **Start-match locked cards keep their titles** (refinement, `book.singlePlayer` =
  "Locked"/"Bloccato", `book.guestLock` = "Locked"/"Bloccato"): the locked "Single player" and
  "Guest user" cards on the start-match page still show their own title; only the lock text
  (via `CardButtons`' `lockInfo`) reads "Locked", instead of the lock text replacing the title.

### 6.5 react-admin

- `EnvBadge` in `components/layout/Navbar.jsx` with the same build-time `VITE_ENV_BADGE` and
  the same code → label map. react-admin has no i18n: English labels only ("Local", "Test"…).
- `components/match/detail/MatchLogsCard.jsx`: `TYPE_META.CHOICE` and its detail case.

### 6.6 Robot

New suite `code/tests/robot/tests/40_alpha_ux/`, same pattern as `39_random_events`:

- **`story_alpha_ux.json`**: own story, PRIVATE, category `robottest`, imported in the Suite
  Setup and deleted in the Suite Teardown; matches use `rngSeed=42`. Deterministic test-bed,
  every case switched through the admin registry (`Set Scenario`, as in 39):
  - two weather rules gated on `scenario=sun` / `scenario=rain` (100% each), so the roll is
    forced: same scenario → same weather (`changed: false`), switched scenario → new weather
    (`changed: true`);
  - a start location with a counter of 1 and a counter-zero event granting +1 food, so every
    first time-start fires it;
  - one 100% random event on `scenario=random` granting +1 coin to the party;
  - a FREE event with `flagEndTime` and a coin gain (execute-event case);
  - a choice-event whose option runs an event with `flagEndTime` (select-choice case), and a
    choice-event whose options carry food/coin gains and no time-end (logs case);
  - a neighbour location whose FIRST (arrival) event has `flagEndTime` (movement case);
  - a mission whose completion event grants +1 magic (mission case);
  - an event whose effect sets `idWeather` to the other weather, fired by counter-zero (known
    behaviour case).
- **`alpha_ux_common.resource`**: setup/teardown, `Fresh Alpha Match`, `Set Scenario`,
  `Rows Of Type`, `Gains Of`, `Forced Time End By` (event | choice | movement).

**`time_end_news.robot`** (point B):
1. execute-event with `flagEndTime` → `timeEnded: true`, `counterZero[]` carries the
   counter-zero event (`COUNTER_ZERO`, visibility, card) and `weather` is present.
2. select-choice whose option ends the time → same `counterZero[]` and `weather`.
3. movement whose arrival event ends the time → same, on `MovementStartResponse`; asserted
   against the **destination's own start-time event** (the Tower's `CHARACTER_START_TIME`),
   not the origin's counter — the time-start that follows an arrival runs where the party now
   stands, so pinning it on the old location's counter would test the wrong fixture.
4. same scenario → `weather.changed: false`, same `idWeather` as before.
5. scenario switched before the action → `weather.changed: true`, new `idWeather`, card and
   `deltaEnergy` present.
6. `scenario=random` → the `RANDOM_EVENT` also sits in `counterZero[]` of a forced time-end.
7. an action that does NOT end the time → `weather: null`, `counterZero: []` (new keys always
   present, same shape on the three backends).
8. regression: the sleep answer is unchanged (its `counterZero[]`, no new `weather` block).
9. known behaviour pinned: the roll runs after counter-zero, so the counter-zero event's
   `idWeather` is overwritten — documented, asserted, so a future change is deliberate.
10. regression: a time-end that pushes the actor into coma still reports the edge state first.

**`resource_logs.robot`** (point D), reading `GET /api/matches/{uuid}/logs` and the admin logs:
1. select-choice with food/coin gains → exactly one `CHOICE` row, with `foodGain`/`coinGain`,
   `idEvent` of the owning event and a card.
2. a choice with no resource effect → one `CHOICE` row, all gains 0.
3. two picks in two cycles of a NORMAL choice-event → two `CHOICE` rows.
4. regression (risk of §6.1): after the `CHOICE` row, a ONCE choice-event is still
   `ONCE_ALREADY_CONSUMED` and a second select-choice still answers `CHOICE_NOT_OPEN`.
5. random event → one `RANDOM_EVENT` audit row (no gains, as before) **and** one `EVENT` row
   for the fired event carrying the summed `coinGain` (no actor) — the sum sits on the event's
   own row, beside the audit row, never duplicated onto the audit row itself (§3, §6.1).
6. mission completion → same split: no gain on the mission's automatic-event audit row, the
   `magicGain` on its own `EVENT` row.
7. counter-zero / automatic event → its `EVENT` row carries `foodGain` on every backend
   (the AWS gap, §6.3).
8. regression: execute-event `EVENT` row gains and `ITEM_*` rows unchanged.
9. the admin logs endpoint (port 8044) answers the same `CHOICE` row.

**Run status**: the suite has been replayed in-process against the Python backend only (19/19
green); it has **not** yet been run against a real Java, Python or AWS deployment. None of the
existing suites listed below have been re-run for this step.

**Existing suites to re-run and adapt if needed** (only after asking the owner, as for every
existing Robot test): `28_movement/match_logs*.robot` (row counts), `29_events/resource_costs.robot`
(`EVENT` rows), `32_choice_resolution` (`CHOICE_SELECTED` markers), `33_location_events`,
`39_random_events` (`counterZero[]`, timeline), `34_inventory/item_logs.robot`.

Tips, badge, match list and books are UI-only: covered by vitest, not Robot.

### 6.7 Environment keys (owner sets them; agents never edit `.env` / `.env.test`)

| File | Key | Value |
|------|-----|-------|
| `code/frontend/react-game/.env` | `VITE_ENV_BADGE` | `dev` (local) |
| `code/frontend/react-game/.env.test` | `VITE_ENV_BADGE` | `test` |
| `code/frontend/react-admin/.env` | `VITE_ENV_BADGE` | `dev` |
| `code/frontend/react-admin/.env.test` | `VITE_ENV_BADGE` | `test` |
| production / future stage builds | `VITE_ENV_BADGE` | empty in prod, `alpha` on the alpha stage |
| react-game, any env (optional) | `VITE_TUTORIAL_CATEGORY` | not needed: code default `tutorial` |

`.env.example` of both apps gets the keys with an empty default (done by the dev agent).

## 7. Tests

- **Java**: `TimeAdvancementServiceTest` (weather view and `changed` flag on forced time-end),
  `EventExecutionServiceTest` (forced time-end `counterZero` + `weather` on execute-event,
  select-choice, arrival, movement's `timeEnded`; choice gains; party-run gains summed onto the
  event's own row), `MatchLogsServiceTest` (`CHOICE`), DTO mapping tests
  (`TimeStartWeatherResponseTest`). JaCoCo > 96% of new code (CLAUDE.md coverage bar raised
  from > 95%).
- **Python**: pytest mirrors of the same cases, `--cov` > 96% of new code.
- **AWS**: `test_step40_alpha_ux.py` (11 tests, mirrors the Java/Python test files) covers
  forced time-end news on execute-event/select-choice/movement (including the arrival
  `flagEndTime` fix), a scenario-changed vs unchanged weather, no-time-end answers, and the
  party-run and counter-zero gains summed onto the event's own row. **Gap**: select-choice's
  linked-event gains and the `weather`/`counterZero` parity on use-item and a choice-event's
  open re-serve are verified by code review (§6.3) but have no dedicated pytest case yet.
- **react-game** (vitest, 1463 passed / 3 skipped, all green): tips (link only on `page` with a
  text, open/scroll/focus, hide icon position and click, reopen, reset on card change, open by
  default in a tutorial story, credits bar shown for a tip alone, `tips.matchlog` removed),
  `TipNote`, `EnvBadge` (`envBadgeLabel` code → EN/IT label, unknown, empty, `prod`),
  `PolicyBook` roadmap kind (left intro page, one card per `roadmap.json` entry, order completed
  → current → planned, badge only on current, Roadmap button link, unknown status, missing image
  → `home`) and footer Devlog link, `MatchCard` (badge per status, Resume vs Missions+Log,
  `selectIcon`), list order, History opening the big page directly and back to the list,
  `MatchLogCard` status tile first and Creation tile last (only after the last page), date
  formatter (ISO, number, null, invalid), `useGameplayResults` (sleep with `counterZero` and a
  changed weather — F1; forced time-end with changed and unchanged weather; movement's
  `timeEnded`), `MatchLogCard` `CHOICE`, `MatchStatusBadge` (tone/glyph per status, `inline`),
  `missions.js` (`missionStatusBadge` keepZero, `missionStepsBadge`, `missionPageStats`,
  `MISSION_CHECK_COLOR`), `sanitizeHtml.halveBlankLines` and `SafeHtml`'s `halfBlankLines`,
  `Footer` (alpha line built/dropped from `envBadgeLabel`, server row with fixed name / dot).
- **react-admin** (vitest): `EnvBadge`, `MatchLogsCard` `CHOICE`.
- **Robot**: `40_alpha_ux/` (10 time-end cases + 9 log cases, §6.6) written and replayed
  in-process on Python only (19/19 green) — **not yet run against a real Java, Python or AWS
  deployment**; none of the potentially-exposed existing suites (`27_weather`, `28_movement`,
  `32_choice_resolution`, `33_location_events`, `34_inventory`, `39_random_events`) have been
  re-run for this step.

## 8. Decisions (all doubts resolved)

1. Weather card only when the weather actually changes: current behaviour kept, no "every time-start" card.
2. Weather roll stays after the counter-zero/start-time events; the roll overwriting an event's weather is known behaviour.
3. Execute-event, select-choice and move answers that end the time early carry `counterZero[]` and `weather`, shown after the action's card.
4. Choice gains go on a new timeline row type `CHOICE`, one per chosen option.
5. Random and mission events log the sum of all recipients' gains (single-player only for now).
6. Build-time `VITE_ENV_BADGE` in react-game and react-admin, empty = no badge; the owner sets the keys in §6.7.
7. No "last played" date (`tsUpdate`) in V0: postponed to V1; the creation date lives in the History page (decision 15).
8. Roadmap book: left page "paths.games" + `home` image + 4-line intro; right page one small card per version from `data/roadmap.json` (status, title, image, GitHub link); footer "Devlog" opens it.
9. V0 stays as it is: no security or KPI work in step 40, they belong to step 41.
10. Tips only on `page` cards: a "tip" link beside the card type in the footer appends the tip to the description, scrolls to it and has a hide icon in its bottom-right corner.
11. No memory of tips: no "once per browser", no reset button; tutorial stories (`category` = `VITE_TUTORIAL_CATEGORY`, default `tutorial`) open the tip on every page.
12. The tip is highlighted with a gold border and glow in the medieval theme.
13. Environment badge: `VITE_ENV_BADGE` sets the env code, the header and footer show its EN/IT label (`dev` → "Local version"/"Locale version").
14. Match list keeps the small cards, adds the status badge and a contextual button: Resume for an active match, Missions + Log otherwise.
15. History opens the big history page directly (no small History card step); newest tile = current status, last tile = "Creation" with its date.
16. List order: active, paused, finished; newest first in each group.
17. Roadmap versions live in `src/data/roadmap.json` (id, title, status, imgId, link): moving beta to current is a one-line change, no code.
18. Roadmap book shows six cards (V0-V5); V6 stays out of `roadmap.json` for now.
19. Points B and D get a new Robot suite `40_alpha_ux/` with its own deterministic story (§6.6); existing suites are only re-run, changed after asking the owner.
20. Random/mission gains land on the fired event's own `EVENT` row, never duplicated onto the `RANDOM_EVENT`/`AUTOMATIC_EVENT` audit row — one row would otherwise double-count the party's take.
21. Movement answers (`MovementStartResponse`) carry `timeEnded` alongside `weather`/`counterZero`; `weather` can still be null on a `timeEnded: true` answer when the story has no eligible weather.
22. AWS parity fix: an arrival event's `flagEndTime` now ends the time, as Java/Python already did — AWS used to ignore it.
23. AWS parity fix: select-choice's linked events log their own gains on their own `EVENT` rows, matching Java/Python.
24. AWS parity fix: execute-event, select-choice, use-item and a choice-event's open re-serve all carry the `weather`/`counterZero` keys (null/empty when the action cannot end the time), not just the two that could already end it.
25. Tip hide icon sits on the tip box's own last text line (no separate empty row); `tips.matchlog` is removed (the History page has no tip); a new `tips.missionStep` tip was added for the mission-step entity type.
26. `MatchStatusBadge` is its own shared component (`features/matches/`); `.story-card-status` CSS only positions the badge, its look is the shared `.stat-badge.bonus-badge` pair used by every badge in the game.
27. A non-active match's small card offers a Missions icon (opens the missions view without the small History card) plus a wide Log button, replacing the single "History" button of the first draft.
28. Closed missions and their done steps are no longer locked (status badge instead); their reading pages (guest book, in game, end-game book) carry the same status + step-progress badges as the little cards.
29. Card credits bar stays one line with a trailing ellipsis (full text in the tooltip); a page description's blank line is rendered at half height (`.book-page-gap`) instead of a full blank line.
30. Footer rewritten: the alpha-build line is assembled from `footer.alphaPrefix` + `EnvBadge` and dropped entirely without a badge; the server row is plain text (no box) with a fixed server name when only one server is configured.
31. Roadmap book's intro text and the six version cards (title, image, status) follow the owner's final edit of `src/data/roadmap.json`, not the step's original draft.

# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First analysis of the alpha polish step, refined after development | September 25, 2026 |

- **Last Updated**: September 25, 2026 (v0.40.0)
- **Status**: Developed; Robot suite `40_alpha_ux` not yet run against a real backend

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
