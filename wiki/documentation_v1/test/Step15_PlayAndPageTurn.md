# Step 15 — Play and page turn: test list

**Status: to test (November 26, 2026), version 1.15.0.** Step file: [Step15_PlayAndPageTurn.md](../Step15_PlayAndPageTurn.md);
also step 16 part A, the one-tree mobile switch ([Step16_MobileBookAndPreferences.md](../Step16_MobileBookAndPreferences.md) §6.3),
built first in the same run because the book chain's development order asks for it.
Version 1.14.0 built the step (items 1–48, some updated below); version 1.15.0 adds the four §9 to-dos: a fade instead of a
turn when a play does not move (items 49–51), the book change between routes (items 52–81), the bookmarks per screen size
(items 82–94) and the start-match success line (items 95–98).
Developed in react-game only. Java, Python, AWS, react-admin, OpenAPI, Flyway and Robot suites are unchanged. 1.15.0 adds two
env keys (`VITE_ANIM_COVER`, `VITE_ANIM_COVER_MAX_S`, in react-game `.env.example` and the alpha workflow) and two i18n keys
(`book.coverSub`, `preferences.rows.cover`).
Unit tests and build are green (run again by the tester on November 26); every manual check below is still to do (the
developer opened no browser and no phone). Steps 14 and 16 are in the same working tree and still being tested: their lists
stay [Step14_HomeBookAndCardFaces.md](./Step14_HomeBookAndCardFaces.md) and
[Step16_MobileBookAndPreferences.md](./Step16_MobileBookAndPreferences.md) (to-do 3 replaces its sticky pills row, §3).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` covered by unit tests ·
`[ ROBOT ]` covered by Robot suites · `[ NOT TESTABLE ]` with the reason.
For each point: **Done** = what changed, **Test** = what to try, **Expected** = the expected result.

---

## 0. Before starting

- **Environment variables:** two new keys in 1.15.0. On November 26 `.env`, `.env.test` and `.env.alpha` of react-game still
  have no `VITE_ANIM_*` key (0 each), so the code defaults below apply. To try a switch, add the key to react-game `.env` and
  restart `npm run dev` (Vite reads `.env` only at start); remove it afterwards. The agent never edits `.env*`. A choice saved
  in the Preferences card (step 16, localStorage `pathsgames.preferences`) wins over the env value: reset it before an env
  test; the OS reduced motion wins over both.

  | Variable | Where | Who reads it | Value | When needed |
  |---|---|---|---|---|
  | `VITE_ANIM_COVER` (new) | react-game `.env`, `.env.test`, `.env.alpha`; GitHub `alpha` variables (`alpha-deploy-website.yml`) | `src/constants/animations.js` → `RouteBook` (book change and first-load opening); Preferences row "Book cover" | `true` (default) | items 64, 65 |
  | `VITE_ANIM_COVER_MAX_S` (new) | same | same → `bookSwap.swapTimings` (env only, no preference row) | `10` (default); `0` = no limit; negative or text → 10 | item 66 |
  | `VITE_ANIM_PLAY` | same | `animations.js` → `PlayContext` | `true` (default) | items 25, 27 |
  | `VITE_ANIM_TURN` | same | same → `BookPages`, `useGameplayResults`, `FadeIn`, `RouteBook` (route turns) | `true` (default) | items 24, 27, 69 |
  | `VITE_ANIM_TURN_MODE` | same | same → `pageTurn.pickStrategy`, `bookSwap` | `full` (default) or `simple`; any other value is `full` | items 22, 23, 68, 72 |
  | `VITE_ANIM_SPEED` | same | same; clamped to 0.1–4, invalid → 0.25 | `0.25` (default) | items 26, 67 |
  | `VITE_ANIM_DEAL` / `VITE_ANIM_DECK` | same | step 14 deal and desktop pile | `true` / `under` (defaults); `over` puts the pile on the cover | item 86 |

  **Owner set-up before the next alpha deploy:** add `VITE_ANIM_COVER=true` and `VITE_ANIM_COVER_MAX_S=10` to react-game
  `.env`, `.env.test`, `.env.alpha` and to the GitHub `alpha` variables. `code/scripts/alpha/deploy_website.sh --check-only`
  (run by the workflow) stops with "Refusing to build: every VITE_* key of .env.example must have its alpha value." when
  any `VITE_*` key of `.env.example` is missing from `.env.alpha`: step 14's seven `VITE_ANIM_*` keys are still missing too.
  `fade` is not a turn mode: it is the transition of previews, news chain arrows, the error page and (1.15.0) the release of
  a play that does not move.
- **Turnstile (items 30, 37, 95–97):** `VITE_CF_TURNSTILE_KEY=1x00000000000000000000AA` (Cloudflare test key, from
  `.env.example`) in react-game `.env`, and delete the `pathsgames.turnstilePass` cookie before reloading.
- **Servers** (start them yourself):
  - a backend on 8042: `cd code/backend/java && mvn -pl ms-launcher spring-boot:run`
    or `source .venv/bin/activate && cd code/backend/python && python3 -m app.launcher`;
  - react-game: `cd code/frontend/react-game && npm run dev` → http://localhost:5174. For a real phone on the same network:
    `npm run dev -- --host`, then `http://<PC address>:5174` (Google sign-in only on http://localhost:5174 and the alpha site).
- **Game data:** a running match where you can move, do an action that does not move, sleep and use or drop an item; a story
  with choices, training, an end game, missions and (item 49) an event with a forced movement; two stories; a Google user for
  items 60, 80, 96. Two browser tabs on the same match for item 13 B.
- **Timings at the default speed 0.25** (on `<html>` as `--t-*`): lift 0.96 s, flight 2.24 s, fall 1.28 s (0.2 s between
  cards), full flip 3.6 s, simple swing 2.08 s, phone sheet 2.48 s, fade 0.8 s, opening 2.6 s, close 1.04 s, slide 2.4 s.
  Book change: desktop `full` 2 × (fade + flip + slide) = 13.6 s, capped to 10 s (every phase × 0.735: fade 0.59 s, fold
  2.65 s, slide 1.76 s); phone 2 × (sheet + slide) = 9.76 s (under the cap); `simple` close + open = 3.64 s. At 1×: 3.4 s,
  2.44 s and 0.91 s. The first-load opening is not capped. A local API answers in a few ms: use DevTools Network →
  "Slow 3G" to watch the lift and the hold.
- **Test hooks:** `.book-wrapper` carries `data-direction` (`forward`, `back`, `fade`; absent for no turn), `data-page-key` and
  (1.15.0) `data-cover-title`; `.book-stage` gets `is-busy` while a card is played, plus `book-stage--game-tabs`,
  `book-stage--home-tab` or `book-stage--no-tabs`. During a book change `<body>` holds `div.book-swap` (desktop: the copies,
  `.book-flap`, `.cover-face` with `.cover-title` and `.cover-sub`) or, on phones, `div.m-sheet.m-cover` and `div.m-blocker`
  with `<html class="is-turning">`; the routes' container `div.route-book` gets `is-swapping` while the live book is hidden.
- **Devices:** desktop 1920×1080, 1440×900, 1280×800 and 1200×700 (side tabs, wider than 1120px), tablet 1024×768 and
  800×1000 (top tabs); DevTools touch presets 390×844, 320×640 and sideways 844×390 (or a real phone). Keep DevTools
  undocked on desktop items (a window at most 500px high counts as a phone sideways). Reduced motion: DevTools → Rendering →
  "Emulate CSS media feature prefers-reduced-motion: reduce", or the OS setting. Dev mode runs React StrictMode (effects
  twice): count DOM nodes, not network requests, when checking "rendered once".
- **Git:** nothing staged, nothing committed. 1.15.0 is unstaged on top of the 1.14.0 commit `eecbe160`, plus untracked new
  files: `components/book/RouteBook.jsx`, `components/book/bookSwap.js`, `components/ui/AntibotSuccess.jsx`,
  `test/RouteBook.test.jsx`, `test/bookSwap.test.js`, `test/NavbarRouteBook.test.jsx` and the concept folder `wiki/documentation_v1/website_concepts_v0/v1.15.0/`.
  Also changed: react-game `.env.example`, `.github/workflows/alpha-deploy-website.yml`. The pom.xml, package.json,
  `Footer.jsx`, `FooterBar.jsx`, `template.yaml`, echo handler, `application.yml`, `config.py`, `pyproject.toml` and root
  `.env.example` changes are the owner's 1.15.0 version bump.

---

## 1. Steps, in order

- [ UNIT ] **1. Unit tests** (green, run again only after a change)
  - `cd code/frontend/react-game && npx vitest run --coverage`
  - Result on November 26 after the three fixes of §3 (run again by the tester, same numbers as the dev): `npx vitest run`
    192 files, 2267 passed, 0 failed, 3 skipped (dev run B: 191 files, 2255 passed; dev run A, to-dos 1, 3 and 4: 189 files,
    2170 passed; 1.14.0: 185 files, 2067 passed). New suite `NavbarRouteBook` (3), `RouteBook` extended.
  - Coverage run (November 26, after the fixes): `npx vitest run --coverage` green twice in a row, 192 files, 2267 passed,
    0 failed, 3 skipped; statements 99.2%, branches 95.8%, functions 99.47%, lines 99.69%. The `useGameplayResultsPlay`
    test that failed under coverage (it checked "not released yet" one tick too early) was hardened: the release order
    after the news stays checked by the weather test.
  - New modules: `RouteBook.jsx` 87/87 lines, 91/91 branches, 36/36 functions; `bookSwap.js` 242/242, 149/149, 56/56;
    `AntibotSuccess.jsx` 2/2 lines, 1/1 function (100%). Changed files at 100% lines and branches: `chromeScope.js`,
    `mobileTurn.js`, `mobileView.js`, `animations.js`, `settings.js`, `AnimationContext.jsx`, `Book.jsx`, `routes.jsx`,
    `useDeal.js`, `DealtList.jsx`. Others: `BookPages.jsx` 84/86 branches (lines 86, 97), `BookBookmarks.jsx` 27/28,
    `TooltipLayer.jsx` 102/106, `Navbar.jsx` 48/50 (lines 53–55), `useAntibot.js` 16/17 (line 45), `PolicyBookContext.jsx`
    28/31 branches, `EndGameBook.jsx` 26/28, `GamePage.jsx` 61/68, `StartMatchFlow.jsx` 104/120 branches (lines 100%),
    `GameBook.jsx` 69/70 lines (line 203), `useGameplayResults.js` 224/225 lines, all lines of the new code covered.
  - New suites: `bookSwap` (27 cases, some table-driven) and `RouteBook` (28); updated: `chromeScope`,
    `useGameplayResultsPlay`, `GameBookTurns`, `Book`, `BookBookmarks`, `GameBookBookmarks`, `TooltipLayer`, `MobileView`,
    `mobileTurn`, `BookPages`, `PlayContext`, `routes`, `Navbar`, `GamePage`, `EndGameBookMissions`, `animations`,
    `AnimationContext`, `preferencesSettings`, `PreferencesCards`, `DealtList`, `useAntibot`, `StartMatch*` and others.
- [ UNIT ] **2. Build:** `npx vite build` passes (run by the tester on November 26, also after the fixes; only the "chunks
  larger than 500 kB" warning, as before).
- [ ] **3. Robot regression** (optional: no suite written or changed, every suite is API-only and no endpoint changed)
  - `code/scripts/dev/run_robots/run_robot_with_local_java.sh`
  - `code/scripts/dev/run_robots/run_robot_with_local_python.sh`
  - Expected: all green as in 1.14.0.
- [ ] **4. Env set-up:** the two new keys in `.env` for the local test (section 0), then in `.env.test`, `.env.alpha` and the
  GitHub `alpha` variables before the deploy.
- [ ] **5. Manual tests** of section 2: desktop at four sizes, tablet, phone portrait and sideways, both languages.
- [ ] **6. Alpha deploy** (when you release): the nine `VITE_ANIM_*` variables must be set (step 14's seven plus the two of
  1.15.0), or the alpha check refuses to build. After it, items 52, 70 and 82 on the alpha site.
- [ ] **7. Documentation:** `/doc-update`. To update: react-game `README.md` (the 1.14.0 list below, plus `RouteBook`,
  `bookSwap`, `AntibotSuccess`, `useAntibotSuccess`, the two new env keys, the bookmarks per screen size); 1.14.0 list:
  the `modals/` line still names `CardPreviewModal`; `start-book/` and `gameplay/` lines name `StartBookMobile` and
  `GameBookMobile`; the Story page paragraph says "`StartBookMobile` vertical list (mobile)"; the (i) paragraph says mobile
  opens `CardPreviewModal`; new modules `PlayContext`, `BookPages`, `pageTurn`, `FadeIn`, `useBookTurn`, `bookTurns`.
  `wiki/documentation_v1/INDEX.md` still describes Step15 as "Developed 1.14.0 … four to-dos open".

---

## 2. Manual tests

Desktop items run at 1440×900 (side tabs, 1.15.0) with the defaults (play on, turn on, cover on, `full`, speed 0.25, max
10 s) unless the item changes one.

### Play effect (desktop)

- [ ] **1. Lift and glow during the call** (a reading page)
  - Done: the played card lifts and glows while the API answers (`PlayContext`, `.is-playing`).
  - Test: in a match set Network → "Slow 3G". On the right page press the (i) of a movement card (it reads "Move" / "Muovi");
    on the reading page that fades in, press "Move".
  - Expected: the button becomes a spinner "Executing" / "Esecuzione"; the page's picture rises a little and grows slightly,
    with a bright gold border and a gold glow pulsing about once a second, for as long as the call runs. The page itself
    does not move and no small card dims.
- [ ] **2. Flight, hold and ONE forward turn** (movement)
  - Done: on the answer the whole card flies to the story, the old pages are held while the board reloads, then one turn.
  - Test: same as item 1 with no throttling; watch the whole sequence.
  - Expected: the picture leaves its frame (the frame stays empty) and flies in an arc, up then down, to the location
    picture on the left page, tilting, shrinking and fading out there (about 2.2 s). The emptied pages stay still while the
    board reloads. Then ONE forward turn: the right page lifts on the spine and swings over to the left, showing the new
    location on its back; it darkens as it rises and a shadow fades on the page under it (about 3.6 s). The sheet passes
    under the spine and the gold corners. The new board's cards wait and are dealt from the pile only after the sheet has
    landed. `data-direction="forward"`.
- [ ] **3. Movement from the map**
  - Test: "Map" tab → click a reachable node (its page fades in on the right) → "Move".
  - Expected: the whole card flies to the centre of the left page (the map has no picture), then the same hold and forward turn.
- [ ] **4. Action that does not move: a fade** (changed in 1.15.0, to-do 1)
  - Done: `handleEventExecuted` turns forward only when `movedBy(answer)` (`movementApplied` or a non-empty
    `locationChanges`), else the held pages fade.
  - Test: press the (i) of an action card ("Do" / "Agisci") that leaves you where you are → on its reading page press "Do" /
    "Agisci".
  - Expected: the picture lifts, then the whole card flies (no card dims); the emptied pages are held while the board
    reloads; then NO sheet: the held pages fade out over the new ones in about 0.8 s and the right page shows the effect.
    `data-direction="fade"`. For an action that moves you, item 49.
- [ ] **5. Choice "Do" on the small card: the others dim and fall, then a fade** (release changed in 1.15.0)
  - Test: do an action that offers choices; on the list press "Do" / "Scegli" on one option that does not move you (Slow 3G
    to watch the lift). Then, on a new list, open an option's (i) and press "Do" on its reading page.
  - Expected: the option rises (about 14px) and grows (8%), bright gold border, pulsing glow and a light band sweeping across
    its face; every other small card of the book dims (grey, 40% opacity, a little lower and smaller). The lifted card is
    whole, also in the first row (its top not cut by the list's edge). On the answer the others fall one after the other
    (about 0.2 s apart; from the ninth on together), each with a small random tilt, and vanish; the option flies to the left
    picture; then ONE fade (0.8 s, `data-direction="fade"`), no sheet. From the reading page: the whole reading card flies
    (its place stays empty until the fade), nothing dims or falls. A choice that moves you turns forward (item 49).
- [ ] **6. Sleep: always a fade** (changed in 1.15.0)
  - Test: open the sleep card's page (on the board when energy is low, or on the "Information" page) → "Sleep" / "Dormi".
    Repeat with a sleep that advances time and changes the weather.
  - Expected: the whole card flies, the pages are held, then ONE fade (0.8 s), never a sheet: `data-direction="fade"`. With
    a weather change the weather card is already on the new right page when the fade ends (it lands inside the one fade); no
    second fade or turn follows.
- [ ] **7. Item use: ONE back turn** (kept in 1.15.0)
  - Test: "Backpack" tab → (i) of a usable item → "Use" / "Usa"; also an item whose effect moves you, if the story has one.
  - Expected: the whole card flies to the left picture; then ONE back turn (the left page lifts on the spine and swings to the
    right: the bag closes); the right page shows the item's effect. `data-direction="back"`, also when the item moved you.
- [ ] **8. Training: dim, fall, ONE back turn** (kept in 1.15.0)
  - Test: board → the experience card ("Train" / "Allenati") → on the training page press "Improve" / "Migliora" on a stat.
  - Expected: as item 5 (the stat card lifts, the others dim, then fall, the card flies), then ONE back turn (never a fade);
    the right page shows "Trained" / "Allenato".
- [ ] **9. Drop: no play, no turn**
  - Test: "Backpack" → (i) of an item → "Drop" / "Getta".
  - Expected: nothing lifts or flies; the right page shows the loading page, then the bag again, with no turn and no fade
    (no `data-direction` on `.book-wrapper`).
- [ ] **10. End game in the same book; its home goes home in the app** (home changed in 1.15.0)
  - Done: the end pages moved into GameBook's own Book (`useEndGamePages`): entering them is a turn, not a second book. 1.15.0:
    "Close" and the house tab go to the Home with `navigate('/')` (it was a reload), so the book changes (items 52, 59).
  - Test: at an end-game location press the small card "End Game" / "Termina Partita" (flag icon) → on its page "End Game".
    With missions: open a mission, a step (i), its back arrow, the mission's back arrow, the missions card's back arrow.
    Then the house tab, or "Close" / "Chiudi".
  - Expected: the whole card flies, then ONE forward turn to the end pages; the book does not close and open again. With
    missions: missions card left, grid right; a mission turns forward, a step (i) fades, every back arrow turns back; the
    missions card's arrow turns back to the ending (story card left, end card right with "Close" / "Chiudi"). Without
    missions: straight to the ending. The game tabs are gone; the house tab goes straight to the Home (no close card).
    The house tab and "Close": the story book closes with the story title on its cover and the Home book opens (item 52's
    sequence), with no page reload (no new document in DevTools Network → "Doc").
- [ UNIT ] **11. Buttons that never play:** the (i), "Drop", the status card shortcuts and every secondary action; no play id or
  no provider = 1.13.0 buttons (`CardPlay` tests). A reading page without a picture lands with no flight; leaving the page
  mid-flight removes the flying copy (`PlayContext` tests).
- [ ] **12. The book is busy while a card plays**
  - Test: Slow 3G; while a card is lifted hover other cards, then click another card's button, a page arrow, a game tab and
    the house tab; then click the navbar user button.
  - Expected: no hover lift and no reaction inside the book, tabs and house tab included (the Book's root has `inert` and
    `aria-busy="true"`, `.book-stage` has `is-busy`, until the flight ends); keyboard Enter on a focused button inside the
    book does nothing either. The navbar still reacts: the URL changes at once, but the book stays on the game until the
    play, the hold and the turn have ended, then it changes (1.15.0, item 73).
- [ ] **13. API error during a play**
  - Test A: open a movement's reading page, stop the backend, press "Move". Test B: the same match in two tabs; move in
    tab 1; in tab 2 press "Move" or "Do" on a reading page.
  - Expected A: the picture lifts, then comes down when the call fails; no flight, no hold, no turn; the right page fades to
    the error page "Match Error" / "Errore Match" with "Close" / "Chiudi"; "Close" fades back. Expected B: the card comes
    down, the board reloads with no turn (the pages change at once), then the "Refreshing" / "Aggiornamento" card fades in on
    the right page.

### Page turns (desktop)

- [ ] **14. Tabs by bookmark order**
  - Done: `turnFor` (`js/bookTurns.js`) gives each view change its direction; the order is Position, Information, Backpack,
    Map, Missions (1.15.0: top to bottom in the desktop side column, left to right on a tablet).
  - Test: on the board click "Information", "Backpack", "Map", "Missions" ("Informazioni", "Zaino", "Mappa", "Missioni"),
    then "Map" again, then "Position" / "Posizione"; click the tab you are on. Repeat at 1024×768.
  - Expected: a tab after the current one (lower in the column, to the right on the tablet) turns forward (right page over to
    the left); one before it turns back (left page over to the right); "Position" turns back to the board. The current tab:
    no turn ("Information" redraws its page with a short fade).
- [ ] **15. Other views turn forward, their back arrows back**
  - Test: on the "Information" page the registry and the match history ("History" / "Cronologia"); the training page; on
    "Missions" one mission; then each page's back arrow ("Back" / "Indietro").
  - Expected: each one opens with a forward turn; each back arrow turns back.
- [ ] **16. Fades**
  - Test: the (i) of a movement or action card and its back arrow; a node on the map; the error page (item 13 A); the
    "Refreshing" card (item 13 B).
  - Expected: no sheet: the old page fades out over the new one in about 0.8 s (`data-direction="fade"`); the reading page
    has no extra fade of its own (no double fade).
- [ ] **17. News chain arrows fade**
  - Test: an action whose effect also changes the weather or completes a mission; press the forward arrow "Go" / "Vai" on
    the effect card, then on the next card.
  - Expected: each arrow fades (0.8 s), never a full turn.
- [ ] **18. Slow reload**
  - Test: Network "Slow 3G"; move. Then sleep.
  - Expected: after the flight the pages are held about 1 s; then ONE forward turn to the loading page ("Loading…" /
    "Caricamento…" with the story picture); the new board then appears with no second turn. The sleep: the same 1 s hold,
    then ONE fade (not a turn) to the loading page, then the board with no second change.
- [ ] **19. Clicks during a turn and a hold**
  - Test: click a tab and, while the sheet turns, click cards and arrows on both pages; then click another tab mid-turn.
    Repeat during a fade and during the hold of item 18.
  - Expected: clicks on the pages do nothing while a turning sheet, a fading copy or a held copy is up, and no drawn tooltip
    shows over it. The tabs and the house tab are busy too until the turn or hold ends (the whole Book is `inert`); a tab
    clicked right after works normally. The navbar works throughout (its navigation waits, item 74).
- [ ] **20. Keyboard focus**
  - Test: keyboard only: Tab to "Backpack", Enter; keep pressing Tab while it turns; then Enter on the bag's back arrow and
    Tab again.
  - Expected: the focus ring never lands inside the book while it turns (the whole Book is inert then: Tab goes to the
    navbar or the footer); after the turn Tab reaches the new page's tabs and buttons; a card still waiting for its deal
    lands at once when Tab reaches it. Watch where the focus goes once the turn ends: an inert ancestor drops the focus of
    the pressed tab, so a lost focus (Tab restarting from the navbar) is worth reporting. After the back arrow (its page
    replaced) the next Tab starts again from the top of the page, as in 1.13.0.
- [ UNIT ] **21. Mapping and engine details:** every row of the step's direction tables, coma / sadness closing back, choices
  closed back, a refetch during a hold released with no turn, the 10 s hold safety, a change during a turn finishing it at
  once, copies without `id`, `data-testid`, `data-tip`, iframes as empty boxes, scroll positions copied (`bookTurns`,
  `BookPages`, `pageTurn`, `GameBookTurns`, `useGameplayResultsPlay` tests).
- [ ] **22. Simple mode**
  - Test: `VITE_ANIM_TURN_MODE=simple`, restart (or Preferences "Turn style" → "Simple" / "Semplice"); repeat item 14 and a
    movement.
  - Expected: no sheet and no copy: at once the new left page fades in from a light blur and the new right page swings in
    from 35° around its left edge (forward) or its right edge (back), about 2.1 s. Previews, news and a sleep still fade.
- [ ] **23. Other turn mode values**
  - Test: `VITE_ANIM_TURN_MODE=fade`, then `=abc`, restarting each time; click a tab.
  - Expected: a full turn both times (only `simple` changes the mode).
- [ ] **24. Turn off**
  - Test: `VITE_ANIM_TURN=false`, restart; tabs, an (i), a movement, a sleep, the story page "Change", a phone preview (390
    wide).
  - Expected: pages change at once everywhere, no fade, also on the phone; a play still lifts and flies, then the loading
    page shows on the right and the new board appears (1.13.0 behaviour); its cards are dealt right away. A book change
    between routes still runs (it follows `VITE_ANIM_COVER`, item 69).
- [ ] **25. Play off**
  - Test: `VITE_ANIM_PLAY=false`, restart; a movement, a choice "Do", a sleep, an item use.
  - Expected: no lift, glow, dim, fall or flight: the button shows "Executing" / "Esecuzione"; the old pages stay still while
    the board reloads; then ONE change: a forward turn for the movement, a fade for the choice that does not move and the
    sleep, a back turn for the item.
- [ ] **26. Speed**
  - Test: in DevTools look at the `style` of `<html>`; then `VITE_ANIM_SPEED=1`, restart, look again and click a tab.
  - Expected: default `--t-lift: 960ms`, `--t-fly: 2240ms`, `--t-discard: 1280ms`, `--t-flip: 3600ms`, `--t-simple: 2080ms`,
    `--t-fade: 800ms`, and (1.15.0) `--t-open: 2600ms`, `--t-close: 1040ms`, `--t-slide: 2400ms`; at speed 1: 240, 560,
    320, 900, 520, 200, 650, 260 and 600 ms, and a turn four times faster. The glow pulse (1 s) and the light sweep (1.2 s)
    keep their beat at every speed.
- [ ] **27. Reduced motion (OS)**
  - Test: in a match turn on "prefers-reduced-motion: reduce" without reloading; move, open a tab and an (i); go to the Home
    and back to a story; turn it off and repeat.
  - Expected: `<html>` gets `data-pg-reduced="true"`; no lift, glow, fall, flight, turn, fade, book change or opening: the
    spinner, then the loading page, and pages and books change at once. Turned off (no reload), the next play, tab and book
    change animate again.

### Other books (desktop)

- [ ] **28. Story set-up** (`/story/<id>`)
  - Test: "Change" / "Cambia" on the class card; the (i) of an option; pick an option; "Change" again and the left page's
    back arrow; the trait picker: toggle two traits; the (i) of a card with a single option and its back arrow.
  - Expected: "Change" turns forward (picker on the right, the chosen class on the left); an option (i) fades the left page;
    picking an option turns back to the loadout; the back arrow turns back; trait toggles: no turn; the single-option (i)
    fades its detail in on the right page, its back arrow fades back.
- [ ] **29. Player page** (`/player`)
  - Test: the (i) of a match; a mission; a step (i); the "History" card ("Cronologia"); every back arrow.
  - Expected: a match turns forward (story card left, missions right); a mission and the history turn forward; a step (i)
    fades; each back arrow turns back. While the missions load, the loading page is replaced by them with no turn.
- [ ] **30. Start-match preview with a back arrow** (Turnstile key set, cookie deleted)
  - Done: deviation: the preview carries a back arrow on desktop too (one tree).
  - Test: `/start-match/<id>`: the (i) of the story card, of the game type card and of the login card; the back arrow; then
    accept the terms and "Start" / "Inizia".
  - Expected: the left page fades to the card (0.8 s) with a back arrow "Back" / "Indietro" at its top left; the arrow fades
    back to the story card. The login card's (i) shows the Google login page on the left page. During each fade no second
    Turnstile loads (the copy shows an empty box where the widget is). The phase cards after "Start" appear with no turn;
    once the match is created the game opens with ONE forward turn of the story book (1.15.0, item 56).
- [ ] **31. Policy chapter**
  - Test: on `/story/<id>` open "Privacy Policy" from the footer, close it; open "Devlog" and its "credits page" link
    ("pagina crediti"); on the Home open and close "Credits".
  - Expected: opening a chapter turns forward, closing turns back, Devlog → credits turns forward. Same on the Home.
- [ ] **32. House tab from a policy chapter in a match**
  - Test: in a match open "Privacy Policy" from the footer, then press the house tab; repeat with the navbar brand.
  - Expected: ONE fade from the chapter to the close card "Exit to Home" / "Torna alla Home" ("You closed the game book
    without finishing it…" / "Hai chiuso il libro del gioco senza concluderla…"); no back turn before it and no book change
    (the brand obeys the match's home handler). "Exit to Home" then changes the book (item 59).

### Phones: one tree (step 16 part A) and step 15 on phones

The phone book graphics, the mobile page turn and the page deck are step 16's (its items 1–2, 11–25); 1.15.0 replaced its
sticky pills row with icon tabs on the book's edges (items 88–90 here).

- [ ] **33. The game, rendered once** (390×844)
  - Done: `Book` lost its `mobile` prop; `GameBookMobile`, `StartBookMobile` and the inline stacks are deleted; `mobile.css`
    stacks the same `.book-wrapper` under the phone media query.
  - Test: open `/play/<id>`; in DevTools Elements search `.book-mobile-layout` and count `.book-wrapper`; scroll the page.
  - Expected: no `.book-mobile-layout`, one `.book-wrapper`. One column: the icon game tabs standing on the book's top edge
    and the house tab hanging under its bottom edge (1.15.0, item 88), the location (picture a third of the screen high, the
    description below), then the action cards in 2 columns; no status card by default (step 16 item 9). The upper page
    rounded at the top, the lower page at the bottom; the leather cover with its gold frame and stitching wraps both, gold
    corners at its four corners. The book spans the screen less about 16px. The navbar stays on top while scrolling; no
    horizontal scroll.
- [ ] **34. Play on a phone** (changed by step 16 and 1.15.0)
  - Test: the (i) of a movement (its page opens below the location) → "Move" / "Muovi"; a sleep "Sleep" / "Dormi" from the
    middle of the page; later an option "Do" / "Scegli".
  - Expected: the picture lifts and glows, then the whole card flies to the top centre of the screen, just under the navbar.
    The movement: the view is held, then ONE forward sheet turn that lands at the very top of the page (the tabs on the book's
    edge in view). The sleep and an option that does not move: no sheet; the page jumps to the very top under the held copy,
    which then fades out (0.8 s). On "Do" the other small cards dim and fall as on desktop.
- [ ] **35. Previews on a phone: no modal** (scroll target changed in 1.15.0)
  - Test: a movement or action (i) from the middle of the board; a loadout card's (i) on `/story/<id>`; the back arrows.
  - Expected: no dark backdrop, no modal. A game card's page opens below the location, fades in (0.8 s) and the page scrolls
    to it (right page, unchanged). A left preview (the loadout card) takes the top card's place with the same fade and the
    page goes back to the very top (1.15.0: not to the left page under the tabs). Each back arrow closes its page.
- [ ] **36. Story set-up on a phone**
  - Test: `/story/<id>`: scroll; the (i) of a loadout card and its back arrow; "Change" / "Cambia".
  - Expected: no game tabs; the house tab hangs under the book's bottom edge, at the right (1.15.0); the story card on top (no
    gold "Start Game" on it), the loadout below in 2 columns, the "Start Game" / "Inizia Gioco" button at the end. The (i)
    puts the card in the story card's place, fading in, and the page goes back to the very top; its back arrow brings the
    story card back. "Change": the picker below, the top card carries the back arrow (no extra arrow button above the list).
- [ ] **37. Start match on a phone** (Turnstile key set, cookie deleted)
  - Test: `/start-match/<id>`; DevTools Elements: search `challenges.cloudflare.com`; the (i) of a card; its back arrow.
  - Expected: the story card on top, the fixed cards below, then the anti-bot widget and "Start". One Turnstile iframe (1.13.0
    had two). The (i) puts the card on top, fading in, the page goes back to the very top, the back arrow "Back" / "Indietro"
    closes it. The success line: item 97.
- [ ] **38. End game on a phone**
  - Test: end a match (item 10) at 390 wide, with and without missions.
  - Expected: the ending shows the end card with "Close" / "Chiudi" on top and the story card below; with missions first
    the missions card on top and the grid below. Entering the end pages and every mission turn is a phone sheet turn
    (step 16) landing at the very top. "Close" changes the book with the phone cover (item 70), no reload.
- [ ] **39. Player page on a phone** (`/player`)
  - Expected: the user card on top, then the anti-bot and the matches in 2 columns; a match's (i) puts the story card on top
    and the missions below; one `.book-wrapper` in the DOM; the house tab under the book's bottom edge.
- [ ] **40. Policy chapter on a phone**
  - Test: footer "Privacy" on `/story/<id>` and in a match; scroll; close.
  - Expected: the manifesto card on top, the policy text below, shown once; closing brings the page back.
- [ ] **41. Home on a phone**
  - Done: step 14's Home-only rules became the generic stack.
  - Expected: as step 14 item 31: intro on top, the stories in 2 columns below, no house tab, one widget, no horizontal
    scroll.
- [ ] **42. Phone sideways** (844×390)
  - Test: the game, the story page, start match, `/player`.
  - Expected: pages stacked; a page with picture and description shows them side by side (picture about 40% of the width);
    card grids in 3 columns; icon game tabs on the top edge and the house tab under the bottom edge (1.15.0); no horizontal
    scroll bar.
- [ ] **43. Width switch**
  - Test: open a match at 1440, narrow the window step by step under 767px, then widen it again.
  - Expected: the same book restacks with nothing reloaded and the open page kept; the tabs go from the right column (over
    1120px) to the top edge (768–1120px) to the phone edges; on the phone layout turns are phone sheets; back on desktop the
    desktop turns work again.
- [ ] **44. Desktop and tablet layouts** (changed in 1.15.0)
  - Test: 1440×900 and 800×1000 on the game, the story page and `/player`.
  - Expected: two pages with spine and headbands, the status card not shown on the board. 1440: the tabs in the side column
    (item 82). 800×1000 (tablet): game tabs at the top left and the house tab at the top right, as in 1.14.0 (item 87).
- [ UNIT ] **45. One-tree checks:** one home tab last in its row, no `.book-mobile-*` node, one anti-bot and one card grid on
  start match, the player page and the story set-up rendered once, previews in the top card scrolled into view (`Book`,
  `StartMatchFlowCoverage`, `PlayerBookMobile`, `StartBook*` tests).

### Languages

- [ ] **46. IT/EN texts**
  - Test: items 1, 5, 7, 8, 10, 13, 32, 52, 65 and 95 in Italian, then in English.
  - Expected: Italian "Esecuzione", "Muovi", "Agisci", "Scegli", "Dormi", "Usa", "Getta", "Migliora", "Termina Partita",
    "Chiudi", "Indietro", "Vai", "Caricamento…", "Errore Match", "Aggiornamento", "Torna alla Home"; 1.15.0: the cover
    subtitle "Librogame web", the preference row "Copertina" ("Attivo" / "Spento"), "Verifica superata! Sei umano.".
    English "Executing", "Move", "Do", "Do", "Sleep", "Use", "Drop", "Improve", "End Game", "Close", "Back", "Go",
    "Loading…", "Match Error", "Refreshing", "Exit to Home"; "Web gamebook", "Book cover" ("On" / "Off"), "Success! You
    are human.". The brand "Paths Games" on the Home book's cover in both; a story cover shows the story title in the current
    language.

### Regressions

- [ ] **47. Card special components** (step 13, 6.3.16), desktop and phone
  - Test: a match, the story page and start match; also look at a turning sheet, a flying card and a book change copy.
  - Expected: page arrows, bonus badges on the picture and by the title, tip note, extra content, credits bar, "view
    original" link, type badge on hover, (i), select and selected state, spinner, secondary buttons and the locked label
    with its icon: same place and size as in 1.13.0; the sheet, the flying copy and the swap copies look like the page they
    copy.
- [ ] **48. Things that must not change**
  - Test: one full tour of the game.
  - Expected: the book opening on first load (1.15.0: a WAAPI animation, 2.6 s at ¼×, item 64); the deal of every list
    (step 14, after a turn or a book change); drawn tooltips on hover; the cookie banner; the sticky navbar on phones; on
    desktop a held right page keeps its scroll position (no jump to the top; phones now go to the very top, item 90).

### Plays that do not move: a fade (§9 to-do 1, 1.15.0)

- [ ] **49. A forced movement turns forward**
  - Done: `movedBy(result)` (`chromeScope.js`): `movementApplied: true`, a `toLocationUuid` or a non-empty
    `locationChanges[]`; used by events, choices and the chrome refresh.
  - Test: an action ("Do" / "Agisci") or a choice whose event moves the character to another location (forced movement).
  - Expected: after the flight and the hold ONE forward turn (sheet), with the new location on the left page;
    `data-direction="forward"`. The same play on a phone: a forward sheet turn landing at the very top.
- [ ] **50. Phone: the fade release goes to the top** (390×844)
  - Test: scroll to the bottom of the board; press a sleep or an action that does not move (from its (i) reading page).
  - Expected: the card flies, the view is held (no scrolling, `<html class="is-turning">`); then the page jumps to the very
    top under the held copy (the tabs on the book's edge in view) and the copy fades out in 0.8 s; no sheet swings. The news
    of the answer (weather) is already on the page when the fade ends.
- [ UNIT ] **51. Rules:** `movedBy` (movement, `movementApplied`, forced movement, no move, empty or missing answer); a sleep and
  a non-moving action release with a fade, a forced-movement event and a moving choice turn forward, item and exp still turn
  back; the phone fade lands at the top (`chromeScope`, `useGameplayResultsPlay`, `GameBookTurns`, `mobileTurn` tests).

### Book change between routes: desktop (§9 to-do 2, 1.15.0)

Books: the Home book (`/` rank 0, `/player` rank 1) and one story book per story (`/story/<id>` 1, `/start-match/<id>` 2,
`/play/<id>` 3, end game included). Another book = a book change; the same book = a turn by rank.

- [ ] **52. Home → story set-up: the full book change**
  - Done: `RouteBook` wraps the routes; before the new route reaches the DOM it copies the old `.book-wrapper`; the change
    runs on copies in a fixed `div.book-swap` on `<body>` while the live new book is hidden (`.route-book.is-swapping`).
  - Test: on the Home click a story card; once also "Play the tutorial" / "Gioca il tutorial". Watch with a stopwatch.
  - Expected, in order (the URL is `/story/<id>` at once): the page is at its top; the Home book's right half folds over the
    spine to the left, darkening, and shows on its back the front cover: tooled leather, gold frame, the gold d20, the title
    "Paths Games" and under it "Web gamebook" / "Librogame web" in small gold capitals (about 2.65 s); the closed book slides
    out to the left, off screen (about 1.76 s); a closed book with the story's title (current language) and "Paths Games"
    under it slides in from the right edge of the screen to the story book's place; its cover opens, swinging from the left
    half back over to the right and showing the loadout page (about 2.65 s); the house tab fades in at the foot of the right
    column (about 0.59 s). Total about 10 s. No deck pile on the moving copies; the live book and its pile show only at the
    end, then the loadout cards are dealt from the pile. `div.book-swap` is gone at the end; the navbar stays on top and
    usable throughout. No page reload.
- [ ] **53. Story set-up → Home: book change**
  - Test: from `/story/<id>`: the house tab; the navbar brand "Paths Games"; the browser Back (after item 52); open
    `/story/not-a-story` and press "Close" / "Chiudi" on "This story could not be loaded." / "Non è stato possibile caricare
    questa storia.".
  - Expected: each one is item 52 reversed: the story book closes showing its title (the story-not-found book shows the d20
    alone, no title), slides out left, the Home book comes in closed with "Paths Games" / "Web gamebook" and opens.
- [ ] **54. Home → game with "Resume": book change**
  - Test: on the Home, a story with a running match: its "Resume" / "Riprendi" badge.
  - Expected: a book change (not a turn): the incoming closed book shows the story's title (the loading book has none yet:
    it comes from the Resume's router state); after it the game board; no second opening.
- [ ] **55. Home ↔ `/player`: a turn of the Home book, no sideways shift**
  - Test: on the Home (scrolled halfway down) click the navbar user button ("Guest" / "Ospite" or your name); then the house
    tab; then browser Back and Forward; then the navbar brand from `/player`.
  - Expected: no cover: `/player` comes with ONE forward turn (the Home's right page swings over to the left) and the house
    tab, the Home with ONE back turn (the brand on `/player` too: it runs the player page's close); Back / Forward the same
    by direction. The book keeps its place left and right (the
    right column is kept on the Home too); the page is scrolled to the top first; the new page's cards are dealt after the
    turn.
- [ ] **56. Story set-up → start match → game: two forward turns**
  - Test: on `/story/<id>` press "Start Game" / "Inizia Gioco"; on start match pass the check, accept, "Start" / "Inizia".
  - Expected: ONE forward turn to start match; the phase cards with no turn; then ONE forward turn to the game (the loading
    page, then the board with no second turn). No cover anywhere: the same story book.
- [ ] **57. Back turns inside the story book**
  - Test: on start match the story card's button "Back" / "Indietro"; in a match reached through start match press the
    browser Back.
  - Expected: ONE back turn to the story set-up in both cases (start match replaced its history entry when the match was
    created, so Back from the game lands on the set-up).
- [ ] **58. Start match → Home: book change**
  - Test: on `/start-match/<id>` the house tab; again with the navbar brand.
  - Expected: a book change to the Home (story title on the outgoing cover, "Paths Games" on the incoming one).
- [ ] **59. Game and end game → Home in the app**
  - Done: GamePage `gotoHomePage` and `useEndGamePages` `onHome` call `navigate('/')` (they were `window.location.href = '/'`).
  - Test: in a match: the house tab → close card → "Exit to Home" / "Torna alla Home"; an ended match: "Close" / "Chiudi" and
    the house tab; a fatal error page: stop the backend, open a match from the Home ("Resume"), then press "Close" /
    "Chiudi" on the error page (start the backend again before it, or not).
  - Expected: each time a book change from the story book to the Home, with no page reload (item 78). With the backend up
    the Home is fresh: the left match shows "Resume" / "Riprendi"; the ended one "Replay" / "Rigioca" or "Completed" /
    "Completata".
- [ ] **60. Story pages ↔ `/player`: book change**
  - Test: from `/story/<id>` the navbar user button; on start match, as a Google user, the (i) of the login card with your
    name; on `/player` the match's "Play" / "Gioca"; then the browser Back.
  - Expected: a book change each time (story book ↔ Home book), titles as in items 52–53.
- [ ] **61. Two stories through Back and Forward**
  - Test: `/story/A` → house tab → Home → story B; then Back, Back, Forward, Forward.
  - Expected: four book changes; every cover shows the right title (B → "Paths Games" → A and back). A direct A ↔ B entry
    pair has no link in the UI: `[ UNIT ]` (`bookSwap` route table).
- [ ] **62. Redirects and same-path changes: nothing**
  - Test: open `http://localhost:5174/not-a-page`; open `/start-match/<id>` directly (new tab); as a new guest open
    `/play/<id>` of a story with no match; on `/story/<id>` press "Start Game" and watch the moment the loadout is saved.
  - Expected: `/not-a-page` → the Home and `/start-match` → `/story/<id>` at once, then the first-load opening of the page
    they land on (once), no cover and no turn. The `/play` with no match: the loading page opens first (2.6 s at ¼×), then
    the story page appears with no cover, no turn and no second opening (the redirect waits for the opening, §3). The save of
    the loadout (same path, new state) is applied at once and runs nothing of its own.
- [ ] **63. Policy chapter and the route change**
  - Done: `PolicyBookContext` remembers the page a chapter opened on; the new route's book mounts without it.
  - Test: A: on `/story/<id>` open "Privacy Policy" from the footer, then press the house tab. B: open
    `http://localhost:5174/?policy=privacy` (also `terms`, `cookies`, `roadmap`); then the navbar user button; then Back.
    C: `http://localhost:5174/not-a-page?policy=cookies`. D: `/story/<id>?policy=terms`, then the house tab.
  - Expected: A: the outgoing copy shows the chapter, the Home arrives without it, no back turn plays under the incoming
    cover. B: the Home loads with the chapter open (one opening), `?policy=` is dropped from the URL when it closes; the user
    button turns forward to `/player` without the chapter; Back turns back to the Home without it. C: the redirect keeps the
    chapter open on the Home. D: the chapter opens on the story page; the house tab changes the book to the Home, no chapter.
- [ ] **64. First load: one opening**
  - Done: the CSS `bookOpen` (`.book-shell`, 0.6 s, never scaled) is gone; `RouteBook` runs its keyframes with WAAPI on the
    first book only, gated by `cover`, scaled by the speed.
  - Test: reload `/`, `/player`, `/story/<id>` and a running match from the Home then reload `/play/<id>`; in DevTools
    Elements check `.book-shell` (no CSS `animation`), and the Animations panel.
  - Expected: the book rises from a tilted, smaller, transparent state into place once, in about 2.6 s at ¼× (0.65 s at 1×),
    also on phones; never a second time when the loading page is replaced by the board. The book is busy during it (cards
    dealt only after it, clicks inside ignored). Later route changes never replay it.

### Book change settings (1.15.0)

- [ ] **65. Cover off: env and preference row**
  - Test: `VITE_ANIM_COVER=false`, restart; Home → a story, the house tab, a reload; remove the key; then Preferences "Book
    cover" / "Copertina" → "Off" / "Spento", repeat, then "On" / "Attivo"; with reduced motion on, look at the row.
  - Expected: off: the new book appears at once, no cover, no opening on reload; Home ↔ `/player` and story → start match
    still turn (they follow "Page turn"). The row sits with the other animation rows of the editor and wins over the env
    value; with reduced motion it is disabled. "On" brings the change back with no reload.
- [ ] **66. Longest change: `VITE_ANIM_COVER_MAX_S`** (stopwatch, or the life of `div.book-swap` in Elements)
  - Test: Home → story at ¼× with: no key (10); `=0`; `=5`; `=abc`; `=-3`; restart each time. Repeat `=5` and `=0` on a
    phone (390×844).
  - Expected: desktop about 10 s (default, `abc` and `-3`), 13.6 s with `0` (fold 3.6 s, slide 2.4 s, tab fade 0.8 s), 5 s
    with `5`; every phase shorter by the same factor, the sequence unchanged. Phone: 9.8 s with `0` and the default (under
    the cap), 5 s with `5`. The preferences have no row for it.
- [ ] **67. Speed 1×**
  - Test: Preferences "Speed" / "Velocità" 1× (or `VITE_ANIM_SPEED=1`); Home → story on desktop and phone; `simple` too.
  - Expected: desktop 3.4 s, phone 2.4 s, simple 0.9 s (none capped); the first-load opening 0.65 s.
- [ ] **68. Simple mode (desktop)**
  - Test: `VITE_ANIM_TURN_MODE=simple` (or "Turn style" → "Simple" / "Semplice"); Home → story, story → Home, Home → `/player`.
  - Expected: a book change: the old book fades, tilts back a little and shrinks (about 1 s), then the new book appears and
    opens with the first-load zoom (2.6 s); no cover, no fold, no slide. Home → `/player`: the simple page turn of item 22.
- [ ] **69. Page turn off; reduced motion**
  - Test: `VITE_ANIM_TURN=false`: Home ↔ `/player`, story → start match, Home → story. Then reduced motion on (item 27).
  - Expected: turn off: the same-book changes happen at once, the book changes still run with the cover. Reduced motion:
    nothing animates, the new book just appears.

### Book change on phones (1.15.0)

- [ ] **70. Phone cover** (390×844)
  - Test: Home → a story; the story's house tab → Home; Home → Resume a match.
  - Expected: what is on screen under the navbar (the tabs over the book included) freezes; a leather cover with rounded
    corners (12px), the gold frame and d20, "Paths Games" / "Web gamebook", closes over it swinging in from its left edge
    (about 2.5 s); it slides out to the left (2.4 s); the page goes to the very top; the cover, now with the new title, slides
    in from the right (2.4 s), the live book appears under it (deviation, §3) and the cover swings open on its left edge
    (2.5 s); about 9.8 s. During it `<html class="is-turning">`, `div.m-blocker` and `div.m-sheet.m-cover` on `<body>`; the
    page does not scroll; the navbar stays usable; after it all three are gone and the page scrolls normally.
- [ ] **71. Phone cover from a scrolled page, 320 wide and sideways**
  - Test: scroll to the bottom of `/story/<id>` and press the house tab under the book; repeat at 320×640 and 844×390.
  - Expected: the cover closes over exactly what was on screen (the hanging house tab included when visible), then the new
    book comes at the very top of the page. Sideways: the same sequence, no horizontal scroll bar.
- [ ] **72. Phone simple mode**
  - Test: `simple` mode at 390×844; Home → story.
  - Expected: the copy of the screen fades, tilts and shrinks (about 1 s), the page goes to the top, the new book shows and
    opens with the zoom (2.6 s); no cover.

### Navigation waits for the book (1.15.0)

- [ ] **73. Navbar during a play**
  - Test: in a match with Slow 3G, press "Move" and, while the card is lifted, click the navbar user button.
  - Expected: the URL becomes `/player` at once, the navbar is not blocked; the book stays on the game: the lift, the flight,
    the hold and the turn run to the end; then the book changes to `/player` (story book → Home book). It never waits more
    than 15 s from the click (item 76).
- [ ] **74. Browser Back during a turn or a fade**
  - Test: in a match opened from the Home ("Resume") click "Backpack" and press the browser Back while the sheet turns; then
    open an (i) and press Back during its fade.
  - Expected: the turn (or fade) ends first, then the book changes to the Home; the page under the closing cover is the
    settled one (no half-turned sheet in the copy).
- [ ] **75. During a book change; the latest one wins**
  - Test: A: Home → story; during the change click the navbar user button, then at once the brand. B: Home → `/player` (turn);
    during the turn press Back, then Forward. C: Home → story; during the change press Back.
  - Expected: A: the change to the story ends, then ONE more book change straight to the Home (the `/player` click is
    dropped). B: after the turn nothing else happens (Forward lands on the shown path: applied at once, the pending Back
    dropped). C: the change ends, then a second change back to the Home.
- [ ] **76. During a hold; a play that never answers: 15 s at most** (fixed November 26)
  - Done: `NAV_WAIT_MAX_MS = 15000` (`RouteBook.jsx`): a pending route waits at most 15 s, counted from the first pending
    click (a later click does not extend it); then RouteBook ends its running change, drops the Book's busy reports and
    shows the latest pending route with its normal animation.
  - Test: A: Slow 3G, move, and click the navbar user button right after the flight (during the hold). B: DevTools Network →
    custom throttling profile with 60000 ms latency; press "Move", then the navbar user button, after 5 s the browser Back
    and Forward again; time it from the first click.
  - Expected: A: the hold (at most 10 s) and the turn end, then the book changes; if the whole play passes 15 s from the
    click, the change starts at the 15 s mark and the running turn ends at once. B: the URL changes at once, the book stays
    on the game with the lifted card for 15 s from the first click (not 20: the later clicks do not extend it), then the
    book changes to `/player` with the cover. When the answer arrives later: no error page, no flying copy left on `<body>`
    (`.flying-card`), no `inert` left on the new book.
- [ ] **77. Direct load of `/play`: the match lookup does not wait** (fixed November 26)
  - Done: a same-path change (same pathname, only state or query) is applied at once and never animates, also during the
    opening, a turn, a hold or a book change.
  - Test: on a running match reload `/play/<id>` (no router state) at ¼×.
  - Expected: the first-load opening (2.6 s) starts on the loading page; the match lookup is applied at once, so the board
    can replace the loading page while the book is still opening; no turn, no cover, no second opening; the board's cards are
    dealt once the opening time is over. Watch the remount: if the zoom stops or jumps when the board arrives, report it.

### Home in the app, reloads kept (1.15.0)

- [ ] **78. No reload**
  - Test: DevTools Network filter "Doc", "Preserve log" on; do items 53 (brand, house tab), 58 and 59 (Leave, end game
    "Close", fatal error "Close").
  - Expected: no new document request; the language, the Preferences and the cookie banner state stay; the Home shows fresh
    match badges.
- [ ] **79. The brand on the Home, modifier clicks, a second click** (second click fixed November 26)
  - Done: `routeBookStatus()` (`RouteBook.jsx`: the shown pathname and `settled`); `Navbar.onBrandClick` reloads only when
    the Home is the shown page and its book is settled.
  - Test: on `/` (opening over, nothing turning) click the brand; on `/story/<id>` Ctrl+click and middle click the brand; on
    `/story/<id>` click the brand twice quickly; reload `/` and click the brand during the first-load opening.
  - Expected: on a settled Home the brand reloads the site (a document request, the first-load opening again: owner).
    Ctrl / middle click opens `/` in a new tab and the current page stays. Two quick clicks: the first starts the book change
    to the Home, the second does nothing (no document request) and the running change goes on to its end. During the
    opening: nothing, no reload.
- [ ] **80. Account deletion and sign-out still reload**
  - Test: as a Google user on `/player` delete the account and close the player page; on another session sign out.
  - Expected: both reload the site (a document request, the first-load opening), no book change.
- [ UNIT ] **81. Engine:** `bookOf` per route, every row of the route table (swap, forward, back, none for the same path and
  redirects), cover title order (attribute, router state, d20 alone), `swapTimings` (1× unchanged, ¼× desktop capped to 10 s
  by one factor, phone and simple under the cap, `maxMs` 0 = no limit), the copy taken before the commit (stripped, turn layer
  emptied), live book hidden then shown, desktop, simple and phone sequences, route turns with the rank direction, flags off
  and reduced motion, a navigation during a change, a route turn or a busy Book kept as pending (latest wins), a same-path
  change applied at once (pending dropped), the 15 s wait limit from the first pending route, the chapter closing on the
  shown pathname, the first-load opening once, unmount clean-up; `routeBookStatus()` and the brand rules (reload only on a
  settled Home); `VITE_ANIM_COVER` and `VITE_ANIM_COVER_MAX_S` parsing; in-app home in `GamePage`, `EndGameBook`, `Navbar`
  (`bookSwap`, `RouteBook`, `NavbarRouteBook`, `routes`, `animations`, `preferencesSettings`, `GamePage`,
  `EndGameBookMissions`, `Navbar` tests).

### Bookmarks per screen size (§9 to-do 3, 1.15.0)

- [ ] **82. Desktop 1920×1080: the side column in a match**
  - Done: over 1120px the tabs hang down the cover's right edge (`book.css` `@media (min-width: 1121px)`).
  - Test: a match board with a stat badge on Information and a weight badge on Backpack; DevTools: measure the tabs.
  - Expected: the book 16px under the navbar, at most 1080px wide, centred in the space left of a 94px column. Right of the
    cover, from 42px under its top: Position, Information, Backpack, Map, Missions, one under the other, icon on top with the
    badges stacked under it; every tab 74px wide (also those without badges); the house tab alone at the foot, its bottom
    42px above the cover's bottom; the deck pile just above the house tab, its lowest card a little behind it, and under
    every tab. The tabs touch the cover's right edge (deviation: they do not tuck under it).
- [ ] **83. Desktop 1280×800 and 1200×700: smaller pile, house tab at the foot**
  - Test: the same board at 1280×800, then 1200×700; also 1440×900.
  - Expected: 1440×900: pile at full size. 1280×800 and 1200×700: the pile at 70% (`--pile-scale: 0.7`), partly under the
    game tabs; the house tab always at the foot, never over the game tabs; no tab cut by the screen edge; the deal leaves from
    the pile where it is now.
- [ ] **84. The column on every page; no sideways shift**
  - Test: at 1440×900 the Home, `/player`, `/story/<id>`, `/start-match/<id>`, a policy chapter in a match, the end pages;
    switch Home ↔ `/player` several times and compare the cover's left edge (DevTools ruler or a screenshot).
  - Expected: every page keeps the right column; pages without game tabs show the house tab alone at the foot; the Home shows
    none. The book does not move sideways between the Home and `/player`.
- [ ] **85. Tooltips on the left**
  - Test: hover each side tab, the top one and the house tab included; then at 1024×768 hover a tab.
  - Expected: over 1120px the drawn tooltip opens 8px to the left of the tab, over the cover, vertically centred on it, its
    arrow on its right edge pointing at the tab; near the navbar or the screen bottom it stays inside the screen. Texts:
    "Position" / "Posizione", "Information" / "Informazioni", "Backpack" / "Zaino", "Map" / "Mappa", "Missions" /
    "Missioni", "Back to the home page" / "Torna alla pagina iniziale". At 1024×768: above or below the tab as before.
- [ ] **86. Pile with the deal off, and `over`**
  - Test: `VITE_ANIM_DEAL=false`; then `VITE_ANIM_DECK=over` (deal on); restart each time; 1440×900.
  - Expected: deal off: no pile, the house tab still at the foot. `over`: the pile lies over the cover's edge and over the
    tabs.
- [ ] **87. Tablet 1024×768 and 800×1000** (as in 1.14.0)
  - Expected: the book 46px under the navbar; game tabs on the top edge over the left page, the house tab at the end of the
    right row; badges shown; tabs about the same size as in 1.14.0, the band open at the bottom against the page edge.
- [ ] **88. Phone 390×844: icon tabs on the book's edges**
  - Done: step 16's sticky pills row is gone; the game tabs stand on the book's top edge, the house tab hangs under it.
  - Test: a match board; scroll down and up; `/story/<id>`; the Home.
  - Expected: icon-only game tabs (no names, no badges) on the cover's top edge, from 42px (clear of the top-left gold corner),
    in one row; they scroll away with the book (nothing sticky under the navbar). The house tab hangs under the bottom edge,
    72px from the right (left of the ribbon and the bottom-right corner), upside down (band on the sides and bottom), touching
    the cover (deviation: not tucked under it). Room above the book only with game tabs, 46px under it only with the house
    tab; the Home has neither. A tap opens its page; a long press shows the tooltip only (step 16 item 7).
- [ ] **89. Phone 320×640 and sideways 844×390**
  - Expected: 320: the five game tabs stay on the book (narrower sides, 3px), one line, no sideways scroll. 844×390: the phone
    layout of item 88 (not the side column), no horizontal scroll bar.
- [ ] **90. Phone: every page change goes back to the very top**
  - Test: at 390×844 scroll to the bottom of the board each time, then: tap Backpack; tap Position; the bag's back arrow; a
    left preview on `/story/<id>`; a game (i) (right page); a movement. Then `VITE_ANIM_TURN=false` and repeat a tab and an (i).
  - Expected: after each turn, left preview and reload the page lands at the document top, the tabs on the book's edge in
    view (step 16 landed on the right page's top instead). The game (i) scrolls to its page on the right (unchanged). Turn
    off: a tab still jumps to the very top; an (i) fade never jumps.
- [ ] **91. Tab look in every state** (1920×1080, 1024×768, 390×844)
  - Done: light tan inside framed by a 6px band of the cover's dark tooled leather, a gold line and a dashed stitching
    inside the band; the side under the cover open.
  - Test: look closely at a tab, hover one (mouse), look at the active one; DevTools: `.book-bookmark` padding.
  - Expected: light tan inside, dark leather band with the cover's grain on the outer sides, a thin gold line and a faint
    dashed stitching just inside it; no band, line or stitching on the side against the cover (desktop: left; tablet: bottom;
    phone game tabs: bottom; phone house tab: top). Icon dark brown, no text shadow; hover: lighter inside, darker icon;
    active: parchment-light inside, brighter gold line. Paddings (deviation): tablet `3px 9px 10px`, desktop `9px 7px 9px
    12px`, phone `6px 10px 12px`, phone house tab `12px 10px 6px`, under 360px `3px` on the sides.
- [ ] **92. Red and gold tabs on every screen**
  - Test: a critical stat (Information), an overloaded bag (Backpack), a mission just changed (Missions); at 1920, 1024 and
    390; then open each.
  - Expected: red Information and Backpack tabs, gold Missions tab, with their glow, inside the leather band, also on phones
    (icon only); active variants brighter; opening Missions puts the gold out.
- [ ] **93. A book change with the side column**
  - Test: at 1440×900 the house tab on `/story/<id>` (item 53).
  - Expected: the tabs of the outgoing copy fade out beyond the cover's right edge before the fold, never cut; those of the
    incoming book fade in at the end; on phones the cover starts at the tabs over the book.
- [ UNIT ] **94. Markup and placement:** both groups in one `.book-bookmarks-row` inside `.book-wrapper`, home last, no
  `.book-bookmark__label`, `data-tip-side="left"` on every tab, badges still rendered, stage classes; tooltip `left` placement
  (position, vertical clamp, arrow), fallback without room, ignored under 1121px; `SIDE_TABS_MQ`, `scrollBookToTop` on phones
  only and not under a turn; phone landings at the top; phone flight target under the navbar (`Book`, `BookBookmarks`,
  `GameBookBookmarks`, `TooltipLayer`, `MobileView`, `mobileTurn`, `BookPages`, `PlayContext` tests). Column, pile, look and
  phone tabs are CSS: manual only (items 82–93).

### Start match success line (§9 to-do 4, 1.15.0)

- [ ] **95. Desktop: the line after the check** (Turnstile key set, cookie deleted)
  - Done: `useAntibotSuccess(phase)` (true for 4 s after `checking` → `ready`) and `AntibotSuccess`, shared with the Home.
  - Test: `/start-match/<id>`; wait for the check.
  - Expected: while checking, the spinner and the widget in the right page's footer, no line. Once passed, under the story
    card's text on the left page: a check icon and "Success! You are human." / "Verifica superata! Sei umano."; after 4 s it
    fades out and is gone; the widget hides as before. Leave and come back (a fresh check): the line shows again.
- [ ] **96. Guest login page**
  - Test: as a guest, with Google sign-in enabled on the backend, open `/start-match/<id>`.
  - Expected: the left page is the "Guest user" / "Ospite" login card; the line shows under its text, then goes after 4 s.
- [ ] **97. Preview, no key, phone, reduced motion**
  - Test: open a card's (i) within the 4 s; `VITE_CF_TURNSTILE_KEY=` empty and restart; 390×844; reduced motion.
  - Expected: the preview covers the line (closing it after 4 s shows no line); with no key no line (the dev bypass starts
    ready); on the phone the line is under the top card's text; with reduced motion it disappears after 4 s with no fade. The
    Home's line behaves as in step 14.
- [ UNIT ] **98. Rules:** no line while checking, the line inside the left card's `.book-page-desc` after success, gone after
  4 s, again after a retry or an expired token, on the guest page too, none behind a preview, never when it starts ready,
  timer cleared on unmount (`useAntibot`, `StartMatchTurnstileRetry`, `StartMatchFlowCoverage`, `HomePage` tests).

---

## 3. Notes from development

- Built first, step 16 part A (§6.3, one tree). Step 16 part B (vertical book graphics, mobile page turn, page deck,
  preferences) followed in the 1.14.0 commit and has its own list.
- Deviation 1: the end game has no hold: after the card lands, the end pages and their forward turn go in one commit
  (nothing reloads in between).
- Deviation 2: the start-match preview has a back arrow on desktop too (one tree, item 30).
- Deviation 3: `inert` sits on each copied page, not on the turn layer; the layer takes the clicks while it holds a copy.
  The layer is z-index 9, under the spine (10) and the cover ornaments (11).
- Deviation 4: a drop reopens the bag with an explicit "no turn"; `turnFor` takes an optional third argument (the reducer's
  result) for the right-page changes.
- The Home on phones: its 6px top padding comes from the generic stack rule `.book-wrapper .config-cards-area` (mobile.css),
  no Home-only rule.
- Review fixes (November 25, after the tester read the code):
  - News in the same answer (the weather or missions change after a sleep or a move) now lands inside the one turn: the
    hold is released one task after those effects (`useGameplayResults`). News that really arrives later (a fetched item
    card) still fades after the turn, as the step file allows (item 6).
  - The whole Book (tabs and home tab included) is busy while a page turns or holds (`BookPages` tells `Book`), as step 16
    §6.5 asks.
  - The Book's root gets the real `inert` attribute plus `aria-busy` while a card plays, turns or holds: keyboard Enter on a
    focused button does nothing then; the navbar stays live. The pointer CSS stays as a fallback.
  - Kept: in `simple` mode the live `.page-inner`s swing (step file line 141); the inert Book makes them unclickable.
  - Owner's test: the flying copy never showed (picture hidden, then the turn). `main.css`, imported after
    `animations.css`, gave `.pg-card` / `.book-page-img` `position: relative`, which beat `.flying-card { position: fixed }`
    and put the copy at the bottom of the page; now `body > .flying-card` (items 2–8).
  - Owner's choice: a reading-page play flies the whole card (`.book-page-content`, on the page's paper with a gold glow),
    not only its picture; the card's place stays empty until the turn. A reading page with no picture flies too.
- `VITE_ANIM_TURN_MODE` reads only `full` and `simple`; the fade is not a mode (section 0).
- Step 14's list predates this run: its item 34 (hidden mobile copy) now sees one tree, and item 37's "mobile (i) modals
  still open" no longer holds (the modal is gone, items 35–37 here).
- **1.15.0, the four §9 to-dos (November 26, two dev runs):**
  - Run A (to-dos 1, 3, 4): 189 files, 2170 passed. Deviations: the tab paddings per layout (item 91); desktop tabs and the
    phone house tab touch the cover's edge instead of tucking under it (items 82, 88); hover colour `#2e1406`; with the turn
    engine off `BookPages` does not jump to the top on a policy chapter (only page turns, item 90); GameBook's four close
    handlers merged into `handleBackOrClose`.
  - Run B (to-do 2): 191 files, 2255 passed, 0 failed, 3 skipped; new `bookSwap.js` and `RouteBook.jsx` (100%). Deviations:
    `useEndGamePages` takes `onHome` (GameBook passes `onClose`, the stand-alone `EndGameBook` navigates); the brand still
    reloads when already on the Home (item 79); on phones and in `simple` mode the live book shows just before it opens
    (items 68, 70, 72); desktop `full` keeps it hidden to the end.
  - Risk 1, fixed (November 26): a same-path change (same pathname, only state or query) is now applied at once and never
    animates, also during the opening, a turn, a hold or a book change: the direct-load match lookup no longer waits (item
    77). Still waiting by design (owner decision pending): the redirect guards that change the pathname (GamePage and
    StartMatchPage → `/story/:id` with `REDIRECT_STATE`) wait for the opening, so a direct `/play/<id>` with no resumable
    match shows the story page only after the loading page's opening, up to 2.6 s at ¼× (item 62). StartMatchPage renders
    no book on a direct load, so its redirect has no opening to wait for.
  - Risk 2, limited (November 26): the gameplay API calls still have no timeout, but a pending route waits at most
    `NAV_WAIT_MAX_MS = 15000` (`RouteBook.jsx`, counted from the first pending route); then RouteBook ends its running
    change, drops the Book's busy reports and shows the latest route with its normal animation (item 76). The hold itself
    keeps its 10 s safety; a slow play plus its hold and turn can pass 15 s and be cut at that mark.
  - Owner set-up: the two new keys in react-game `.env`, `.env.test`, `.env.alpha` and the GitHub `alpha` variables
    (section 0); on November 26 none of the three files has any `VITE_ANIM_*` key, so the alpha check refuses to build.
- Noticed by the tester (code read, not seen in a browser):
  - Fixed (November 26): `Navbar.onBrandClick` compared the router pathname, already `/` while a change to the Home runs
    or waits, so a second brand click reloaded the site; it now asks `routeBookStatus()` and reloads only on a settled Home
    (item 79).
  - With the same-path rule a match lookup can replace the loading book while the first-load opening runs on it (a
    remount): the zoom may stop half-way on that load (item 77, to watch).
  - Policy deep-link kinds are `privacy`, `cookies`, `terms` and `roadmap` (`utils/policyDeepLink.js`); `?policy=credits` is
    ignored.
  - Sign-out uses the same `reloadHome()` as the account deletion: it reloads too (item 80).
  - The Step 16 list (§6.4 "Sticky pills row", items 3–8 and 26; the landing rule of items 14–15 and 25; "about 60px under
    the pills row" in item 18) describes the layout 1.15.0 replaced; items 88–90 here are the current expectations.
- Known noise: the "chunks larger than 500 kB" build warning; StrictMode doubles dev-mode requests.
- Not seen in a browser by the developer: the turn geometry (full, simple, fade), the flight arc, the hold timing, the book
  change (fold, slide, cover text, phone cover), the side column, the pile positions, the tab look and the phone tabs.

---

# Version Control
- **Document Version**: 1.15.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.14.0 | Test list for card play, page turns and phone book | November 25, 2026 |
  | 1.15.0 | Book change, bookmarks per screen, fades and success line | November 26, 2026 |

- **Last Updated**: November 26, 2026 (v1.15.0)
