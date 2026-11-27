# Step 15 — Play and page turn: test list

**Status: tested and closed by the owner (November 27, 2026), version 1.15.0.** Step file: [Step15_PlayAndPageTurn.md](../Step15_PlayAndPageTurn.md);
also step 16 part A, the one-tree mobile switch ([Step16_MobileBookAndPreferences.md](../Step16_MobileBookAndPreferences.md) §6.3),
built first in the same run because the book chain's development order asks for it. Part A of step 16 is tested in this list, so it is covered here.
Version 1.14.0 built the step (items 1–48, some updated below); version 1.15.0 adds the four §9 to-dos: a fade instead of a
turn when a play does not move (items 49–51), the book change between routes (items 52–81), the bookmarks per screen size
(items 82–94) and the start-match success line (items 95–98). The §9 "Second round" (November 27, still 1.15.0) adds seven
to-dos: map centred during a turn (items 99–103), phone single page (104–106), home tab per screen (107–111), piles centred
beside the book (112–115), the face-up played pile (116–127), the book change zoom (128–133) and the phone shuffle
(134–142), plus regressions (143); the older items it changes are listed before item 99. The §9 "Third round" (November 27,
still 1.15.0) adds four to-dos: the deck still on the table during a book change (items 144–148), the deck lowered onto the
played pile (149–152), a readable title on the played cards (153–155) and the deal flight from the table deck on a copy over
the page (156–167), plus regressions (168); the older items it changes are listed before item 144. The §9 "Fourth round"
(November 27, still 1.15.0) adds three to-dos: the piles inverted, the deck at the foot and the played pile on it (items
169–175), the bookmarks only on an open book (176–186) and the dealt copy following its slot while the page scrolls
(187–193), plus regressions (194); the older items it changes are listed before item 169.
Developed in react-game only. Java, Python, AWS, react-admin, OpenAPI, Flyway and Robot suites are unchanged. 1.15.0 adds two
env keys (`VITE_ANIM_COVER`, `VITE_ANIM_COVER_MAX_S`, in react-game `.env.example` and the alpha workflow) and two i18n keys
(`book.coverSub`, `preferences.rows.cover`); the second round adds no env key and one i18n key (`game.playedPile.last`); the
third round adds no env key and no i18n key (CSS, `useDeal.js` and tests only); the fourth round neither (`animations.css`,
`bookSwap.js`, `RouteBook.jsx`, `useDeal.js` and tests only).
Unit tests and build are green; the owner ran every manual check below (each item is `[ DONE ]`, `[ UNIT ]` or `[ NOT TESTABLE ]`). Step 14 is closed; step 16 is still to test: its list stays
[Step16_MobileBookAndPreferences.md](./Step16_MobileBookAndPreferences.md) (to-do 3 replaces its sticky pills row, §3).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` covered by unit tests ·
`[ ROBOT ]` covered by Robot suites · `[ NOT TESTABLE ]` with the reason.
For each point: **Done** = what changed, **Test** = what to try, **Expected** = the expected result.

---

## 0. Before starting

- **Environment variables:** two new keys in 1.15.0, none in the second, third and fourth rounds. On November 27 `.env`, `.env.test` and
  `.env.alpha` of react-game still have no `VITE_ANIM_*` key (0 each), so the code defaults below apply. To try a switch, add the key to react-game `.env` and
  restart `npm run dev` (Vite reads `.env` only at start); remove it afterwards. The agent never edits `.env*`. A choice saved
  in the Preferences card (step 16, localStorage `pathsgames.preferences`) wins over the env value: reset it before an env
  test; the OS reduced motion wins over both.

  | Variable | Where | Who reads it | Value | When needed |
  |---|---|---|---|---|
  | `VITE_ANIM_COVER` (new) | react-game `.env`, `.env.test`, `.env.alpha`; GitHub `alpha` variables (`alpha-deploy-website.yml`) | `src/constants/animations.js` → `RouteBook` (book change and first-load opening); Preferences row "Book cover" | `true` (default) | items 64, 65, 183 |
  | `VITE_ANIM_COVER_MAX_S` (new) | same | same → `bookSwap.swapTimings` (env only, no preference row) | `10` (default); `0` = no limit; negative or text → 10 | items 66, 129, 182 |
  | `VITE_ANIM_PLAY` | same | `animations.js` → `PlayContext` | `true` (default) | items 25, 27, 126 |
  | `VITE_ANIM_TURN` | same | same → `BookPages`, `useGameplayResults`, `FadeIn`, `RouteBook` (route turns) | `true` (default) | items 24, 27, 69, 140 |
  | `VITE_ANIM_TURN_MODE` | same | same → `pageTurn.pickStrategy`, `bookSwap` | `full` (default) or `simple`; any other value is `full` | items 22, 23, 68, 72, 100, 132, 138, 180 |
  | `VITE_ANIM_SPEED` | same | same; clamped to 0.1–4, invalid → 0.25 | `0.25` (default) | items 26, 67, 128, 130, 182 |
  | `VITE_ANIM_DEAL` / `VITE_ANIM_DECK` | same | step 14 deal and desktop pile | `true` / `under` (defaults); `over` puts the deck on the cover | items 86, 124, 125, 138, 152, 160, 166, 174 |
  | `VITE_ANIM_DEAL_FACEDOWN` (step 14) | same | same → `useDeal` (`data-deal-face` on the flying card or its copy); Preferences row "Face-down deal" / "Distribuzione coperta" | `true` (default); `false` = face up | item 159 |

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
  cards), full flip 3.6 s, simple swing 2.08 s, phone sheet 2.48 s, fade 0.8 s, opening 2.6 s, close 1.04 s, slide 2.4 s;
  second round: zoom 1.28 s, gather 1.68 s, gatherStep 0.24 s; the deal (step 14, used by the third round): 2.48 s per card,
  0.44 s between cards, from the eighth card on together (at 1×: 0.62 s and 0.11 s). Book change (second round, with the zoom): desktop `full`
  2 × (fade + flip + zoom + slide) = 16.16 s, capped to 10 s (every phase × 0.619: fade 0.5 s, fold 2.23 s, zoom 0.79 s,
  slide 1.49 s); phone 2 × (sheet + zoom + slide) = 12.32 s, capped to 10 s (× 0.812: cover 2.01 s, zoom 1.04 s, slide
  1.95 s); `simple` close + open = 3.64 s (no zoom). At 1×: 4.04 s, 3.08 s and 0.91 s. (Before the second round: 13.6 s →
  10 s, 9.76 s, at 1× 3.4 s and 2.44 s.) Fourth round: every mode fades the tabs out before and in after the change, so
  the phone change is 2 × (fade + sheet + zoom + slide) = 13.92 s, capped to 10 s (× 0.718: tab fade 0.57 s, cover 1.78 s,
  zoom 0.92 s, slide 1.72 s; up to 4 ms over by rounding) and `simple` is fade + close + open + fade = 5.24 s; at 1×
  desktop 4.04 s (unchanged), phone 3.48 s, simple 1.31 s; the first-load opening is followed by a tab fade: 2.6 + 0.8 =
  3.4 s at ¼× (0.85 s at 1×). The first-load opening is not capped. A local API answers in a few ms: use DevTools Network →
  "Slow 3G" to watch the lift and the hold.
- **Test hooks:** `.book-wrapper` carries `data-direction` (`forward`, `back`, `fade`; absent for no turn), `data-page-key` and
  (1.15.0) `data-cover-title`; `.book-stage` gets `is-busy` while a card is played, plus `book-stage--game-tabs`,
  `book-stage--home-tab` or `book-stage--no-tabs`. During a book change `<body>` holds `div.book-swap` (desktop: the copies,
  `.book-flap`, `.cover-face` with `.cover-title` and `.cover-sub`) or, on phones, `div.m-sheet.m-cover` and `div.m-blocker`
  with `<html class="is-turning">`; the routes' container `div.route-book` gets `is-swapping` while the live book is hidden.
  Second round: `.book-shell > .played-pile` (in a match, deal on) with `.played-card` children (`.played-card--story` first,
  `.played-card--top` last) and its `data-tip`; `.book-shell > .deck-pile` (the deck); the phone page deck
  `.book-page-right > .deck`; the map world `.game-map-world`. Third round: each flying copy of a dealt card is a
  `body > div.pg-card.deal-copy` (`inert`, `aria-hidden="true"`, `data-deal="flying"`, `data-deal-face`), its real card
  in the list carries `data-deal="flying"` and `data-deal-copy="on"` until it lands (`data-deal="landed"`); count the
  copies in the Console with `document.querySelectorAll('.deal-copy').length`. Fourth round: `div.route-book` also gets
  `is-tabless` from the start of a book change or of the first-load opening until the live tabs have faded back in; the
  swap layer `div.book-swap` (desktop) or the phone slice `div.m-sheet.m-sheet--tabs` gets `is-tabless` right after the
  tabs' fade-out (`.is-tabless .book-bookmarks { opacity: 0 }`); the tab fades are opacity animations on each
  `.book-bookmarks` group (DevTools → Animations panel), never on `.book-bookmarks-row`; while a copy follows its slot its
  inline `left` / `top` change at every frame (select the `body > .deal-copy` in Elements).
- **Devices:** desktop 1920×1080, 1440×900, 1280×800 and 1200×700 (side tabs, wider than 1120px), tablet 1024×768 and
  800×1000 (top tabs); DevTools touch presets 390×844, 320×640 and sideways 844×390 (or a real phone). Second round also:
  DevTools responsive 1920, 1440, 1366, 1180, 1024 and 900 wide × 800 high (items 112–114), phones 320, 360, 390 and 430 wide
  (item 110), and a real phone for the shuffle (items 134–141). Third round: desktop 1440×900 and 1366×768, tablet
  1024×768 (items 144–168), phone 390×844 for the "unchanged" checks. Fourth round: desktop 1440×900 and 1366×768, tablet
  1024×768 (the owner's case), phone 390×844 and sideways 844×390 (items 169–194); a mouse wheel or touchpad for the scroll
  items (187–191). Keep DevTools
  undocked on desktop items (a window at most 500px high counts as a phone sideways). Reduced motion: DevTools → Rendering →
  "Emulate CSS media feature prefers-reduced-motion: reduce", or the OS setting. Dev mode runs React StrictMode (effects
  twice): count DOM nodes, not network requests, when checking "rendered once".
- **Git (November 27):** nothing staged. The first 1.15.0 round is committed (`83c9fade`, "Play and page turn"). The second
  and third rounds, and the fourth, are unstaged on top of it: 30 modified react-game files (`README.md`; components
  `Book`, `bookSwap`, `RouteBook` (fourth round), `mobileTurn`, `Card`, `CardButtons`, `Map`, `animations.js`, `GameBook`,
  `PlayContext`, the hook `useDeal.js` (third round); the two i18n files, four CSS files, twelve test suites), plus the untracked `components/book/PlayedPile.jsx` and
  `test/PlayedPile.test.jsx`. The third round touched `useDeal.js`, `animations.css`, `book.css`, `PlayedPile.jsx`
  (markup unchanged) and the `DealtList`, `PlayedPile`, `RouteBook` tests; the fourth round `animations.css`,
  `bookSwap.js`, `RouteBook.jsx`, `useDeal.js` and the `bookSwap`, `RouteBook`, `DealtList` tests. Unstaged in the wiki: the step file, `Roadmap.md`, `INDEX.md`, this
  list, the reworked concept `website_concepts_v0/v1.15.0/` (a screenshot deleted) and the untracked
  `website_concepts_v0/v1.14.0/` (the former `v1.15.0` folder).

---

## 1. Steps, in order

- [ UNIT ] **1. Unit tests** (green, run again only after a change)
  - `cd code/frontend/react-game && npx vitest run --coverage`
  - Fourth round (November 27, dev run, then run again by the tester with coverage, same counts): 193 files, 2303 passed,
    0 failed, 3 skipped; all files statements 99.22%, branches 95.9%, functions 99.49%, lines 99.7%. Seven more passing
    cases than the third round (2296); new or rewritten cases: `bookSwap` (tab groups faded, not the row; the layer or the phone slice marked `is-tabless` after the fade-out,
    later copies carrying hidden tabs; a book with no tabs skips the fades; new `runOpening` describe, 3 cases: tabs
    hidden, opening, fade in; stopped while opening or fading in → tabs shown at once; no tabs), `RouteBook` (the real
    CSS hides the groups, not the row, of the live book and every later copy; `is-tabless` per mode and layout, first
    load, cover off / reduced motion, route turns, unmount), `DealtList` 3 (a slot moved mid-flight followed on the next
    frame and on a scroll, all stopped after the last landing; unmount or hold stops the loop and the listener; phones:
    no loop). At 100% statements, branches, functions and lines: `useDeal.js` (114/114 lines, 63/63 branches),
    `bookSwap.js` (276/276, 171/171), `RouteBook.jsx` (112/112, 104/104). All lines of the new code covered. No test
    asserts the piles' places (CSS only).
  - Third round (November 27, dev run, then run again by the tester with coverage, same numbers): 193 files, 2296 passed,
    0 failed, 3 skipped; all files statements 99.21%, branches 95.91%, functions 99.48%, lines 99.7%. Ten new cases:
    `DealtList` 8 (the copy on `<body>`, face up, inherited text styles, landing on the copy's end, safety timer, unmount,
    hold, keyboard) plus its two `dealOrigin` cases rewritten, `RouteBook` 1 (deck visible during the change), `PlayedPile` 1
    (title bar). At 100% statements, branches, functions and lines: `useDeal.js`, `DealtList.jsx`, `PlayedPile.jsx`,
    `RouteBook.jsx`, `pageTurn.js`. All lines of the new code covered.
  - Second round (November 27, dev run, then run again by the tester with coverage, same numbers): 193 files, 2286 passed,
    0 failed, 3 skipped; all files statements 99.21%, branches 95.88%, functions 99.48%, lines 99.69%. New suite
    `PlayedPile` (3 cases); new or rewritten cases in `Map` (7), `PlayContext` (5), `mobileTurn` (5), `bookSwap` (5), `GameBookTurns` (3),
    `RouteBook` (2), `Book`, `CardPlay`, `BookPages`, `animations` (1 each). At 100% statements, branches, functions and
    lines: `PlayedPile.jsx`, `mobileTurn.js`, `bookSwap.js`, `PlayContext.jsx`, `Book.jsx`, `animations.js`. `Map.jsx`:
    lines and functions 100%, statements 97.31%, branches 92.3% (the uncovered branches are older guards: lines 58, 95, 97,
    108, 120, 138, 152, 252–254); `Card.jsx` and `CardButtons.jsx` lines 100% (older branches); `GameBook.jsx` 98.59% lines
    (line 204, as before). All lines of the new code covered.
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
- [ UNIT ] **2. Build:** `npx vite build` passes (run by the tester on November 26, also after the fixes, and again on
  November 27 after the second round and by the developer after the third and the fourth; only the "chunks larger than
  500 kB" warning, as before).
- [ DONE ] **3. Robot regression** (optional: no suite written or changed, every suite is API-only and no endpoint changed)
  - `code/scripts/dev/run_robots/run_robot_with_local_java.sh`
  - `code/scripts/dev/run_robots/run_robot_with_local_python.sh`
  - Expected: all green as in 1.14.0 (the second, third and fourth rounds changed react-game only: no need to run them
    again for them).
- [ DONE ] **4. Env set-up:** the two new keys in `.env` for the local test (section 0), then in `.env.test`, `.env.alpha` and the
  GitHub `alpha` variables before the deploy.
- [ DONE ] **5. Manual tests** of section 2: desktop at four sizes, tablet, phone portrait and sideways, both languages; second
  round items 99–143 (pile centring at six widths × 800 high, phone tab row at four widths, the shuffle on a real phone);
  third round items 144–168 (1440×900, 1366×768, 1024×768; phone 390×844 only for "unchanged"); fourth round items
  169–194 (1440×900, 1366×768, the tablet 1024×768 first, phones for the tabs; ¼× and 1×).
- [ NOT TESTABLE ] **6. Alpha deploy** (when you release): the nine `VITE_ANIM_*` variables must be set (step 14's seven plus the two of
  1.15.0), or the alpha check refuses to build. After it, items 52, 70 and 82 on the alpha site.
- [ DONE ] **7. Documentation:** `/doc-update`. To update: react-game `README.md` (the 1.14.0 list below, plus `RouteBook`,
  `bookSwap`, `AntibotSuccess`, `useAntibotSuccess`, the two new env keys, the bookmarks per screen size); 1.14.0 list:
  the `modals/` line still names `CardPreviewModal`; `start-book/` and `gameplay/` lines name `StartBookMobile` and
  `GameBookMobile`; the Story page paragraph says "`StartBookMobile` vertical list (mobile)"; the (i) paragraph says mobile
  opens `CardPreviewModal`; new modules `PlayContext`, `BookPages`, `pageTurn`, `FadeIn`, `useBookTurn`, `bookTurns`.
  `wiki/documentation_v1/INDEX.md` still describes Step15 as "… four to-dos developed, seven planned" (now developed).
  Second round: react-game `README.md` (`PlayedPile`, the shuffle replacing the phone turn, the desktop without house tab,
  the book change zoom); step file §9 (the phone totals, see section 3). Third round: step file §9 "Third round" still says
  "analysed, to develop" (to mark developed, with its code-vs-spec notes, section 3); react-game `README.md` (the deal flight
  on a copy from the table deck). Fourth round: step file §9 "Fourth round" heading still says "(analysed, to develop)" (to
  mark developed, with the deviation and the notes of section 3); react-game `README.md` has no word on the inverted
  piles, the tabs hidden during a change or opening (`is-tabless`, `runOpening`) or the copies following their slots.

---

## 2. Manual tests

Desktop items run at 1440×900 (side tabs, 1.15.0) with the defaults (play on, turn on, cover on, `full`, speed 0.25, max
10 s) unless the item changes one.

### Play effect (desktop)

- [ DONE ] **1. Lift and glow during the call** (a reading page)
  - Done: the played card lifts and glows while the API answers (`PlayContext`, `.is-playing`).
  - Test: in a match set Network → "Slow 3G". On the right page press the (i) of a movement card (it reads "Move" / "Muovi"); on the reading page that fades in, press "Move".
  - Expected: the button becomes a spinner "Executing" / "Esecuzione"; the page's picture rises a little and grows slightly, with a bright gold border and a gold glow pulsing about once a second, for as long as the call runs. The page itself does not move and no small card dims.
- [ DONE ] **2. Flight, hold and ONE forward turn** (movement)
  - Done: on the answer the whole card flies to the story, the old pages are held while the board reloads, then one turn.
  - Test: same as item 1 with no throttling; watch the whole sequence.
  - Expected: the picture leaves its frame (the frame stays empty) and flies in an arc, up then down, to the location
    picture on the left page, tilting, shrinking and fading out there (about 2.2 s). The emptied pages stay still while the board reloads. Then ONE forward turn: the right page lifts on the spine and swings over to the left, showing the new location on its back; it darkens as it rises and a shadow fades on the page under it (about 3.6 s). The sheet passes under the spine and the gold corners. The new board's cards wait and are dealt from the pile only after the sheet has landed. `data-direction="forward"`.
- [ DONE ] **3. Movement from the map**
  - Test: "Map" tab → click a reachable node (its page fades in on the right) → "Move".
  - Expected: the whole card flies to the centre of the left page (the map has no picture), then the same hold and forward turn.
- [ DONE ] **4. Action that does not move: a fade** (changed in 1.15.0, to-do 1)
  - Done: `handleEventExecuted` turns forward only when `movedBy(answer)` (`movementApplied` or a non-empty
    `locationChanges`), else the held pages fade.
  - Test: press the (i) of an action card ("Do" / "Agisci") that leaves you where you are → on its reading page press "Do" / "Agisci".
  - Expected: the picture lifts, then the whole card flies (no card dims); the emptied pages are held while the board
    reloads; then NO sheet: the held pages fade out over the new ones in about 0.8 s and the right page shows the effect.
    `data-direction="fade"`. For an action that moves you, item 49.
- [ DONE ] **5. Choice "Do" on the small card: the others dim and fall, then a fade** (release changed in 1.15.0)
  - Test: do an action that offers choices; on the list press "Do" / "Scegli" on one option that does not move you (Slow 3G to watch the lift). Then, on a new list, open an option's (i) and press "Do" on its reading page.
  - Expected: the option rises (about 14px) and grows (8%), bright gold border, pulsing glow and a light band sweeping across its face; every other small card of the book dims (grey, 40% opacity, a little lower and smaller). The lifted card is whole, also in the first row (its top not cut by the list's edge). On the answer the others fall one after the other (about 0.2 s apart; from the ninth on together), each with a small random tilt, and vanish; the option flies to the left picture; then ONE fade (0.8 s, `data-direction="fade"`), no sheet. From the reading page: the whole reading card flies (its place stays empty until the fade), nothing dims or falls. A choice that moves you turns forward (item 49).
- [ DONE ] **6. Sleep: always a fade** (changed in 1.15.0)
  - Test: open the sleep card's page (on the board when energy is low, or on the "Information" page) → "Sleep" / "Dormi".
    Repeat with a sleep that advances time and changes the weather.
  - Expected: the whole card flies, the pages are held, then ONE fade (0.8 s), never a sheet: `data-direction="fade"`. With a weather change the weather card is already on the new right page when the fade ends (it lands inside the one fade); no second fade or turn follows.
- [ DONE ] **7. Item use: ONE back turn** (kept in 1.15.0)
  - Test: "Backpack" tab → (i) of a usable item → "Use" / "Usa"; also an item whose effect moves you, if the story has one.
  - Expected: the whole card flies to the left picture; then ONE back turn (the left page lifts on the spine and swings to the right: the bag closes); the right page shows the item's effect. `data-direction="back"`, also when the item moved you.
- [ DONE ] **8. Training: dim, fall, ONE back turn** (kept in 1.15.0)
  - Test: board → the experience card ("Train" / "Allenati") → on the training page press "Improve" / "Migliora" on a stat.
  - Expected: as item 5 (the stat card lifts, the others dim, then fall, the card flies), then ONE back turn (never a fade); the right page shows "Trained" / "Allenato".
- [ DONE ] **9. Drop: no play, no turn**
  - Test: "Backpack" → (i) of an item → "Drop" / "Getta".
  - Expected: nothing lifts or flies; the right page shows the loading page, then the bag again, with no turn and no fade
    (no `data-direction` on `.book-wrapper`).
- [ DONE ] **10. End game in the same book; its home goes home in the app** (home changed in 1.15.0)
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
- [ DONE ] **12. The book is busy while a card plays**
  - Test: Slow 3G; while a card is lifted hover other cards, then click another card's button, a page arrow, a game tab and
    the house tab; then click the navbar user button.
  - Expected: no hover lift and no reaction inside the book, tabs and house tab included (the Book's root has `inert` and
    `aria-busy="true"`, `.book-stage` has `is-busy`, until the flight ends); keyboard Enter on a focused button inside the
    book does nothing either. The navbar still reacts: the URL changes at once, but the book stays on the game until the
    play, the hold and the turn have ended, then it changes (1.15.0, item 73).
- [ DONE ] **13. API error during a play**
  - Test A: open a movement's reading page, stop the backend, press "Move". Test B: the same match in two tabs; move in
    tab 1; in tab 2 press "Move" or "Do" on a reading page.
  - Expected A: the picture lifts, then comes down when the call fails; no flight, no hold, no turn; the right page fades to
    the error page "Match Error" / "Errore Match" with "Close" / "Chiudi"; "Close" fades back. Expected B: the card comes
    down, the board reloads with no turn (the pages change at once), then the "Refreshing" / "Aggiornamento" card fades in on
    the right page.

### Page turns (desktop)

- [ DONE ] **14. Tabs by bookmark order**
  - Done: `turnFor` (`js/bookTurns.js`) gives each view change its direction; the order is Position, Information, Backpack,
    Map, Missions (1.15.0: top to bottom in the desktop side column, left to right on a tablet).
  - Test: on the board click "Information", "Backpack", "Map", "Missions" ("Informazioni", "Zaino", "Mappa", "Missioni"),
    then "Map" again, then "Position" / "Posizione"; click the tab you are on. Repeat at 1024×768.
  - Expected: a tab after the current one (lower in the column, to the right on the tablet) turns forward (right page over to
    the left); one before it turns back (left page over to the right); "Position" turns back to the board. The current tab:
    no turn ("Information" redraws its page with a short fade).
- [ DONE ] **15. Other views turn forward, their back arrows back**
  - Test: on the "Information" page the registry and the match history ("History" / "Cronologia"); the training page; on
    "Missions" one mission; then each page's back arrow ("Back" / "Indietro").
  - Expected: each one opens with a forward turn; each back arrow turns back.
- [ DONE ] **16. Fades**
  - Test: the (i) of a movement or action card and its back arrow; a node on the map; the error page (item 13 A); the
    "Refreshing" card (item 13 B).
  - Expected: no sheet: the old page fades out over the new one in about 0.8 s (`data-direction="fade"`); the reading page
    has no extra fade of its own (no double fade).
- [ DONE ] **17. News chain arrows fade**
  - Test: an action whose effect also changes the weather or completes a mission; press the forward arrow "Go" / "Vai" on
    the effect card, then on the next card.
  - Expected: each arrow fades (0.8 s), never a full turn.
- [ DONE ] **18. Slow reload**
  - Test: Network "Slow 3G"; move. Then sleep.
  - Expected: after the flight the pages are held about 1 s; then ONE forward turn to the loading page ("Loading…" /
    "Caricamento…" with the story picture); the new board then appears with no second turn. The sleep: the same 1 s hold,
    then ONE fade (not a turn) to the loading page, then the board with no second change.
- [ DONE ] **19. Clicks during a turn and a hold**
  - Test: click a tab and, while the sheet turns, click cards and arrows on both pages; then click another tab mid-turn.
    Repeat during a fade and during the hold of item 18.
  - Expected: clicks on the pages do nothing while a turning sheet, a fading copy or a held copy is up, and no drawn tooltip
    shows over it. The tabs and the house tab are busy too until the turn or hold ends (the whole Book is `inert`); a tab
    clicked right after works normally. The navbar works throughout (its navigation waits, item 74).
- [ DONE ] **20. Keyboard focus**
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
- [ DONE ] **22. Simple mode**
  - Test: `VITE_ANIM_TURN_MODE=simple`, restart (or Preferences "Turn style" → "Simple" / "Semplice"); repeat item 14 and a movement.
  - Expected: no sheet and no copy: at once the new left page fades in from a light blur and the new right page swings in
    from 35° around its left edge (forward) or its right edge (back), about 2.1 s. Previews, news and a sleep still fade.
- [ DONE ] **23. Other turn mode values**
  - Test: `VITE_ANIM_TURN_MODE=fade`, then `=abc`, restarting each time; click a tab.
  - Expected: a full turn both times (only `simple` changes the mode).
- [ DONE ] **24. Turn off**
  - Test: `VITE_ANIM_TURN=false`, restart; tabs, an (i), a movement, a sleep, the story page "Change", a phone preview (390
    wide).
  - Expected: pages change at once everywhere, no fade, also on the phone; a play still lifts and flies, then the loading
    page shows on the right and the new board appears (1.13.0 behaviour); its cards are dealt right away. A book change
    between routes still runs (it follows `VITE_ANIM_COVER`, item 69).
- [ DONE ] **25. Play off**
  - Test: `VITE_ANIM_PLAY=false`, restart; a movement, a choice "Do", a sleep, an item use.
  - Expected: no lift, glow, dim, fall or flight: the button shows "Executing" / "Esecuzione"; the old pages stay still while
    the board reloads; then ONE change: a forward turn for the movement, a fade for the choice that does not move and the
    sleep, a back turn for the item.
- [ DONE ] **26. Speed**
  - Test: in DevTools look at the `style` of `<html>`; then `VITE_ANIM_SPEED=1`, restart, look again and click a tab.
  - Expected: default `--t-lift: 960ms`, `--t-fly: 2240ms`, `--t-discard: 1280ms`, `--t-flip: 3600ms`, `--t-simple: 2080ms`,
    `--t-fade: 800ms`, and (1.15.0) `--t-open: 2600ms`, `--t-close: 1040ms`, `--t-slide: 2400ms`; at speed 1: 240, 560,
    320, 900, 520, 200, 650, 260 and 600 ms, and a turn four times faster. The glow pulse (1 s) and the light sweep (1.2 s)
    keep their beat at every speed.
- [ NOT TESTABLE ] **27. Reduced motion (OS)**
  - Test: in a match turn on "prefers-reduced-motion: reduce" without reloading; move, open a tab and an (i); go to the Home and back to a story; turn it off and repeat.
  - Expected: `<html>` gets `data-pg-reduced="true"`; no lift, glow, fall, flight, turn, fade, book change or opening: the spinner, then the loading page, and pages and books change at once. Turned off (no reload), the next play, tab and book change animate again.

### Other books (desktop)

- [ DONE ] **28. Story set-up** (`/story/<id>`)
  - Test: "Change" / "Cambia" on the class card; the (i) of an option; pick an option; "Change" again and the left page's
    back arrow; the trait picker: toggle two traits; the (i) of a card with a single option and its back arrow.
  - Expected: "Change" turns forward (picker on the right, the chosen class on the left); an option (i) fades the left page;
    picking an option turns back to the loadout; the back arrow turns back; trait toggles: no turn; the single-option (i)
    fades its detail in on the right page, its back arrow fades back.
- [ DONE ] **29. Player page** (`/player`)
  - Test: the (i) of a match; a mission; a step (i); the "History" card ("Cronologia"); every back arrow.
  - Expected: a match turns forward (story card left, missions right); a mission and the history turn forward; a step (i)
    fades; each back arrow turns back. While the missions load, the loading page is replaced by them with no turn.
- [ DONE ] **30. Start-match preview with a back arrow** (Turnstile key set, cookie deleted)
  - Done: deviation: the preview carries a back arrow on desktop too (one tree).
  - Test: `/start-match/<id>`: the (i) of the story card, of the game type card and of the login card; the back arrow; then accept the terms and "Start" / "Inizia".
  - Expected: the left page fades to the card (0.8 s) with a back arrow "Back" / "Indietro" at its top left; the arrow fades back to the story card. The login card's (i) shows the Google login page on the left page. During each fade no second Turnstile loads (the copy shows an empty box where the widget is). The phase cards after "Start" appear with no turn; once the match is created the game opens with ONE forward turn of the story book (1.15.0, item 56).
- [ DONE ] **31. Policy chapter**
  - Test: on `/story/<id>` open "Privacy Policy" from the footer, close it; open "Devlog" and its "credits page" link
    ("pagina crediti"); on the Home open and close "Credits".
  - Expected: opening a chapter turns forward, closing turns back, Devlog → credits turns forward. Same on the Home.
- [ DONE ] **32. House tab from a policy chapter in a match**
  - Test: in a match open "Privacy Policy" from the footer, then press the house tab; repeat with the navbar brand.
  - Expected: ONE fade from the chapter to the close card "Exit to Home" / "Torna alla Home" ("You closed the game book
    without finishing it…" / "Hai chiuso il libro del gioco senza concluderla…"); no back turn before it and no book change
    (the brand obeys the match's home handler). "Exit to Home" then changes the book (item 59).

### Phones: one tree (step 16 part A) and step 15 on phones

The phone book graphics, the mobile page turn and the page deck are step 16's (its items 1–2, 11–25); 1.15.0 replaced its
sticky pills row with icon tabs on the book's edges (items 88–90 here).

- [ DONE ] **33. The game, rendered once** (390×844)
  - Done: `Book` lost its `mobile` prop; `GameBookMobile`, `StartBookMobile` and the inline stacks are deleted; `mobile.css` stacks the same `.book-wrapper` under the phone media query.
  - Test: open `/play/<id>`; in DevTools Elements search `.book-mobile-layout` and count `.book-wrapper`; scroll the page.
  - Expected: no `.book-mobile-layout`, one `.book-wrapper`. One column: the icon game tabs standing on the book's top edge and the house tab hanging under its bottom edge (1.15.0, item 88), the location (picture a third of the screen high, the description below), then the action cards in 2 columns; no status card by default (step 16 item 9). The upper page rounded at the top, the lower page at the bottom; the leather cover with its gold frame and stitching wraps both, gold corners at its four corners. The book spans the screen less about 16px. The navbar stays on top while scrolling; no horizontal scroll.
- [ DONE ] **34. Play on a phone** (changed by step 16 and 1.15.0)
  - Test: the (i) of a movement (its page opens below the location) → "Move" / "Muovi"; a sleep "Sleep" / "Dormi" from the middle of the page; later an option "Do" / "Scegli".
  - Expected: the picture lifts and glows, then the whole card flies to the top centre of the screen, just under the navbar. The movement: the view is held, then ONE forward sheet turn that lands at the very top of the page (the tabs on the book's edge in view). The sleep and an option that does not move: no sheet; the page jumps to the very top under the held copy, which then fades out (0.8 s). On "Do" the other small cards dim and fall as on desktop.
- [ DONE ] **35. Previews on a phone: no modal** (scroll target changed in 1.15.0)
  - Test: a movement or action (i) from the middle of the board; a loadout card's (i) on `/story/<id>`; the back arrows.
  - Expected: no dark backdrop, no modal. A game card's page opens below the location, fades in (0.8 s) and the page scrolls
    to it (right page, unchanged). A left preview (the loadout card) takes the top card's place with the same fade and the
    page goes back to the very top (1.15.0: not to the left page under the tabs). Each back arrow closes its page.
- [ DONE ] **36. Story set-up on a phone**
  - Test: `/story/<id>`: scroll; the (i) of a loadout card and its back arrow; "Change" / "Cambia".
  - Expected: no game tabs; the house tab hangs under the book's bottom edge, at the right (1.15.0); the story card on top (no
    gold "Start Game" on it), the loadout below in 2 columns, the "Start Game" / "Inizia Gioco" button at the end. The (i)
    puts the card in the story card's place, fading in, and the page goes back to the very top; its back arrow brings the
    story card back. "Change": the picker below, the top card carries the back arrow (no extra arrow button above the list).
- [ DONE ] **37. Start match on a phone** (Turnstile key set, cookie deleted)
  - Test: `/start-match/<id>`; DevTools Elements: search `challenges.cloudflare.com`; the (i) of a card; its back arrow.
  - Expected: the story card on top, the fixed cards below, then the anti-bot widget and "Start". One Turnstile iframe (1.13.0
    had two). The (i) puts the card on top, fading in, the page goes back to the very top, the back arrow "Back" / "Indietro"
    closes it. The success line: item 97.
- [ DONE ] **38. End game on a phone**
  - Test: end a match (item 10) at 390 wide, with and without missions.
  - Expected: the ending shows the end card with "Close" / "Chiudi" on top and the story card below; with missions first
    the missions card on top and the grid below. Entering the end pages and every mission turn is a phone sheet turn
    (step 16) landing at the very top. "Close" changes the book with the phone cover (item 70), no reload.
- [ DONE ] **39. Player page on a phone** (`/player`)
  - Expected: the user card on top, then the anti-bot and the matches in 2 columns; a match's (i) puts the story card on top
    and the missions below; one `.book-wrapper` in the DOM; the house tab under the book's bottom edge.
- [ DONE ] **40. Policy chapter on a phone**
  - Test: footer "Privacy" on `/story/<id>` and in a match; scroll; close.
  - Expected: the manifesto card on top, the policy text below, shown once; closing brings the page back.
- [ DONE ] **41. Home on a phone**
  - Done: step 14's Home-only rules became the generic stack.
  - Expected: as step 14 item 31: intro on top, the stories in 2 columns below, no house tab, one widget, no horizontal
    scroll.
- [ DONE ] **42. Phone sideways** (844×390)
  - Test: the game, the story page, start match, `/player`.
  - Expected: pages stacked; a page with picture and description shows them side by side (picture about 40% of the width);
    card grids in 3 columns; icon game tabs on the top edge and the house tab under the bottom edge (1.15.0); no horizontal
    scroll bar.
- [ DONE ] **43. Width switch**
  - Test: open a match at 1440, narrow the window step by step under 767px, then widen it again.
  - Expected: the same book restacks with nothing reloaded and the open page kept; the tabs go from the right column (over
    1120px) to the top edge (768–1120px) to the phone edges; on the phone layout turns are phone sheets; back on desktop the
    desktop turns work again.
- [ DONE ] **44. Desktop and tablet layouts** (changed in 1.15.0)
  - Test: 1440×900 and 800×1000 on the game, the story page and `/player`.
  - Expected: two pages with spine and headbands, the status card not shown on the board. 1440: the tabs in the side column
    (item 82). 800×1000 (tablet): game tabs at the top left and the house tab at the top right, as in 1.14.0 (item 87).
- [ UNIT ] **45. One-tree checks:** one home tab last in its row, no `.book-mobile-*` node, one anti-bot and one card grid on
  start match, the player page and the story set-up rendered once, previews in the top card scrolled into view (`Book`,
  `StartMatchFlowCoverage`, `PlayerBookMobile`, `StartBook*` tests).

### Languages

- [ DONE ] **46. IT/EN texts**
  - Test: items 1, 5, 7, 8, 10, 13, 32, 52, 65 and 95 in Italian, then in English.
  - Expected: Italian "Esecuzione", "Muovi", "Agisci", "Scegli", "Dormi", "Usa", "Getta", "Migliora", "Termina Partita",
    "Chiudi", "Indietro", "Vai", "Caricamento…", "Errore Match", "Aggiornamento", "Torna alla Home"; 1.15.0: the cover
    subtitle "Librogame web", the preference row "Copertina" ("Attivo" / "Spento"), "Verifica superata! Sei umano.".
    English "Executing", "Move", "Do", "Do", "Sleep", "Use", "Drop", "Improve", "End Game", "Close", "Back", "Go",
    "Loading…", "Match Error", "Refreshing", "Exit to Home"; "Web gamebook", "Book cover" ("On" / "Off"), "Success! You
    are human.". The brand "Paths Games" on the Home book's cover in both; a story cover shows the story title in the current
    language.

### Regressions

- [ DONE ] **47. Card special components** (step 13, 6.3.16), desktop and phone
  - Test: a match, the story page and start match; also look at a turning sheet, a flying card and a book change copy.
  - Expected: page arrows, bonus badges on the picture and by the title, tip note, extra content, credits bar, "view
    original" link, type badge on hover, (i), select and selected state, spinner, secondary buttons and the locked label
    with its icon: same place and size as in 1.13.0; the sheet, the flying copy and the swap copies look like the page they
    copy.
- [ DONE ] **48. Things that must not change**
  - Test: one full tour of the game.
  - Expected: the book opening on first load (1.15.0: a WAAPI animation, 2.6 s at ¼×, item 64); the deal of every list
    (step 14, after a turn or a book change); drawn tooltips on hover; the cookie banner; the sticky navbar on phones; on
    desktop a held right page keeps its scroll position (no jump to the top; phones now go to the very top, item 90).

### Plays that do not move: a fade (§9 to-do 1, 1.15.0)

- [ DONE ] **49. A forced movement turns forward**
  - Done: `movedBy(result)` (`chromeScope.js`): `movementApplied: true`, a `toLocationUuid` or a non-empty
    `locationChanges[]`; used by events, choices and the chrome refresh.
  - Test: an action ("Do" / "Agisci") or a choice whose event moves the character to another location (forced movement).
  - Expected: after the flight and the hold ONE forward turn (sheet), with the new location on the left page;
    `data-direction="forward"`. The same play on a phone: a forward sheet turn landing at the very top.
- [ DONE ] **50. Phone: the fade release goes to the top** (390×844)
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

- [ DONE ] **52. Home → story set-up: the full book change**
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
- [ DONE ] **53. Story set-up → Home: book change**
  - Test: from `/story/<id>`: the house tab; the navbar brand "Paths Games"; the browser Back (after item 52); open
    `/story/not-a-story` and press "Close" / "Chiudi" on "This story could not be loaded." / "Non è stato possibile caricare
    questa storia.".
  - Expected: each one is item 52 reversed: the story book closes showing its title (the story-not-found book shows the d20
    alone, no title), slides out left, the Home book comes in closed with "Paths Games" / "Web gamebook" and opens.
- [ DONE ] **54. Home → game with "Resume": book change**
  - Test: on the Home, a story with a running match: its "Resume" / "Riprendi" badge.
  - Expected: a book change (not a turn): the incoming closed book shows the story's title (the loading book has none yet:
    it comes from the Resume's router state); after it the game board; no second opening.
- [ DONE ] **55. Home ↔ `/player`: a turn of the Home book, no sideways shift**
  - Test: on the Home (scrolled halfway down) click the navbar user button ("Guest" / "Ospite" or your name); then the house
    tab; then browser Back and Forward; then the navbar brand from `/player`.
  - Expected: no cover: `/player` comes with ONE forward turn (the Home's right page swings over to the left) and the house
    tab, the Home with ONE back turn (the brand on `/player` too: it runs the player page's close); Back / Forward the same
    by direction. The book keeps its place left and right (the
    right column is kept on the Home too); the page is scrolled to the top first; the new page's cards are dealt after the
    turn.
- [ DONE ] **56. Story set-up → start match → game: two forward turns**
  - Test: on `/story/<id>` press "Start Game" / "Inizia Gioco"; on start match pass the check, accept, "Start" / "Inizia".
  - Expected: ONE forward turn to start match; the phase cards with no turn; then ONE forward turn to the game (the loading
    page, then the board with no second turn). No cover anywhere: the same story book.
- [ DONE ] **57. Back turns inside the story book**
  - Test: on start match the story card's button "Back" / "Indietro"; in a match reached through start match press the
    browser Back.
  - Expected: ONE back turn to the story set-up in both cases (start match replaced its history entry when the match was
    created, so Back from the game lands on the set-up).
- [ DONE ] **58. Start match → Home: book change**
  - Test: on `/start-match/<id>` the house tab; again with the navbar brand.
  - Expected: a book change to the Home (story title on the outgoing cover, "Paths Games" on the incoming one).
- [ DONE ] **59. Game and end game → Home in the app**
  - Done: GamePage `gotoHomePage` and `useEndGamePages` `onHome` call `navigate('/')` (they were `window.location.href = '/'`).
  - Test: in a match: the house tab → close card → "Exit to Home" / "Torna alla Home"; an ended match: "Close" / "Chiudi" and
    the house tab; a fatal error page: stop the backend, open a match from the Home ("Resume"), then press "Close" /
    "Chiudi" on the error page (start the backend again before it, or not).
  - Expected: each time a book change from the story book to the Home, with no page reload (item 78). With the backend up
    the Home is fresh: the left match shows "Resume" / "Riprendi"; the ended one "Replay" / "Rigioca" or "Completed" /
    "Completata".
- [ DONE ] **60. Story pages ↔ `/player`: book change**
  - Test: from `/story/<id>` the navbar user button; on start match, as a Google user, the (i) of the login card with your
    name; on `/player` the match's "Play" / "Gioca"; then the browser Back.
  - Expected: a book change each time (story book ↔ Home book), titles as in items 52–53.
- [ DONE ] **61. Two stories through Back and Forward**
  - Test: `/story/A` → house tab → Home → story B; then Back, Back, Forward, Forward.
  - Expected: four book changes; every cover shows the right title (B → "Paths Games" → A and back). A direct A ↔ B entry
    pair has no link in the UI: `[ UNIT ]` (`bookSwap` route table).
- [ DONE ] **62. Redirects and same-path changes: nothing**
  - Test: open `http://localhost:5174/not-a-page`; open `/start-match/<id>` directly (new tab); as a new guest open
    `/play/<id>` of a story with no match; on `/story/<id>` press "Start Game" and watch the moment the loadout is saved.
  - Expected: `/not-a-page` → the Home and `/start-match` → `/story/<id>` at once, then the first-load opening of the page
    they land on (once), no cover and no turn. The `/play` with no match: the loading page opens first (2.6 s at ¼×), then
    the story page appears with no cover, no turn and no second opening (the redirect waits for the opening, §3). The save of
    the loadout (same path, new state) is applied at once and runs nothing of its own.
- [ DONE ] **63. Policy chapter and the route change**
  - Done: `PolicyBookContext` remembers the page a chapter opened on; the new route's book mounts without it.
  - Test: A: on `/story/<id>` open "Privacy Policy" from the footer, then press the house tab. B: open
    `http://localhost:5174/?policy=privacy` (also `terms`, `cookies`, `roadmap`); then the navbar user button; then Back.
    C: `http://localhost:5174/not-a-page?policy=cookies`. D: `/story/<id>?policy=terms`, then the house tab.
  - Expected: A: the outgoing copy shows the chapter, the Home arrives without it, no back turn plays under the incoming
    cover. B: the Home loads with the chapter open (one opening), `?policy=` is dropped from the URL when it closes; the user
    button turns forward to `/player` without the chapter; Back turns back to the Home without it. C: the redirect keeps the
    chapter open on the Home. D: the chapter opens on the story page; the house tab changes the book to the Home, no chapter.
- [ DONE ] **64. First load: one opening**
  - Done: the CSS `bookOpen` (`.book-shell`, 0.6 s, never scaled) is gone; `RouteBook` runs its keyframes with WAAPI on the
    first book only, gated by `cover`, scaled by the speed.
  - Test: reload `/`, `/player`, `/story/<id>` and a running match from the Home then reload `/play/<id>`; in DevTools
    Elements check `.book-shell` (no CSS `animation`), and the Animations panel.
  - Expected: the book rises from a tilted, smaller, transparent state into place once, in about 2.6 s at ¼× (0.65 s at 1×),
    also on phones; never a second time when the loading page is replaced by the board. The book is busy during it (cards
    dealt only after it, clicks inside ignored). Later route changes never replay it.

### Book change settings (1.15.0)

- [ DONE ] **65. Cover off: env and preference row**
  - Test: `VITE_ANIM_COVER=false`, restart; Home → a story, the house tab, a reload; remove the key; then Preferences "Book
    cover" / "Copertina" → "Off" / "Spento", repeat, then "On" / "Attivo"; with reduced motion on, look at the row.
  - Expected: off: the new book appears at once, no cover, no opening on reload; Home ↔ `/player` and story → start match
    still turn (they follow "Page turn"). The row sits with the other animation rows of the editor and wins over the env
    value; with reduced motion it is disabled. "On" brings the change back with no reload.
- [ DONE ] **66. Longest change: `VITE_ANIM_COVER_MAX_S`** (stopwatch, or the life of `div.book-swap` in Elements)
  - Test: Home → story at ¼× with: no key (10); `=0`; `=5`; `=abc`; `=-3`; restart each time. Repeat `=5` and `=0` on a
    phone (390×844).
  - Expected: desktop about 10 s (default, `abc` and `-3`), 13.6 s with `0` (fold 3.6 s, slide 2.4 s, tab fade 0.8 s), 5 s
    with `5`; every phase shorter by the same factor, the sequence unchanged. Phone: 9.8 s with `0` and the default (under
    the cap), 5 s with `5`. The preferences have no row for it.
- [ DONE ] **67. Speed 1×**
  - Test: Preferences "Speed" / "Velocità" 1× (or `VITE_ANIM_SPEED=1`); Home → story on desktop and phone; `simple` too.
  - Expected: desktop 3.4 s, phone 2.4 s, simple 0.9 s (none capped); the first-load opening 0.65 s.
- [ DONE ] **68. Simple mode (desktop)**
  - Test: `VITE_ANIM_TURN_MODE=simple` (or "Turn style" → "Simple" / "Semplice"); Home → story, story → Home, Home → `/player`.
  - Expected: a book change: the old book fades, tilts back a little and shrinks (about 1 s), then the new book appears and
    opens with the first-load zoom (2.6 s); no cover, no fold, no slide. Home → `/player`: the simple page turn of item 22.
- [ DONE ] **69. Page turn off; reduced motion**
  - Test: `VITE_ANIM_TURN=false`: Home ↔ `/player`, story → start match, Home → story. Then reduced motion on (item 27).
  - Expected: turn off: the same-book changes happen at once, the book changes still run with the cover. Reduced motion:
    nothing animates, the new book just appears.

### Book change on phones (1.15.0)

- [ DONE ] **70. Phone cover** (390×844)
  - Test: Home → a story; the story's house tab → Home; Home → Resume a match.
  - Expected: what is on screen under the navbar (the tabs over the book included) freezes; a leather cover with rounded
    corners (12px), the gold frame and d20, "Paths Games" / "Web gamebook", closes over it swinging in from its left edge
    (about 2.5 s); it slides out to the left (2.4 s); the page goes to the very top; the cover, now with the new title, slides
    in from the right (2.4 s), the live book appears under it (deviation, §3) and the cover swings open on its left edge
    (2.5 s); about 9.8 s. During it `<html class="is-turning">`, `div.m-blocker` and `div.m-sheet.m-cover` on `<body>`; the
    page does not scroll; the navbar stays usable; after it all three are gone and the page scrolls normally.
- [ DONE ] **71. Phone cover from a scrolled page, 320 wide and sideways**
  - Test: scroll to the bottom of `/story/<id>` and press the house tab under the book; repeat at 320×640 and 844×390.
  - Expected: the cover closes over exactly what was on screen (the hanging house tab included when visible), then the new
    book comes at the very top of the page. Sideways: the same sequence, no horizontal scroll bar.
- [ DONE ] **72. Phone simple mode**
  - Test: `simple` mode at 390×844; Home → story.
  - Expected: the copy of the screen fades, tilts and shrinks (about 1 s), the page goes to the top, the new book shows and
    opens with the zoom (2.6 s); no cover.

### Navigation waits for the book (1.15.0)

- [ DONE ] **73. Navbar during a play**
  - Test: in a match with Slow 3G, press "Move" and, while the card is lifted, click the navbar user button.
  - Expected: the URL becomes `/player` at once, the navbar is not blocked; the book stays on the game: the lift, the flight, the hold and the turn run to the end; then the book changes to `/player` (story book → Home book). It never waits more than 15 s from the click (item 76).
- [ DONE ] **74. Browser Back during a turn or a fade**
  - Test: in a match opened from the Home ("Resume") click "Backpack" and press the browser Back while the sheet turns; then
    open an (i) and press Back during its fade.
  - Expected: the turn (or fade) ends first, then the book changes to the Home; the page under the closing cover is the
    settled one (no half-turned sheet in the copy).
- [ DONE ] **75. During a book change; the latest one wins**
  - Test: A: Home → story; during the change click the navbar user button, then at once the brand. B: Home → `/player` (turn);
    during the turn press Back, then Forward. C: Home → story; during the change press Back.
  - Expected: A: the change to the story ends, then ONE more book change straight to the Home (the `/player` click is
    dropped). B: after the turn nothing else happens (Forward lands on the shown path: applied at once, the pending Back
    dropped). C: the change ends, then a second change back to the Home.
- [ DONE ] **76. During a hold; a play that never answers: 15 s at most** (fixed November 26)
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
- [ DONE ] **77. Direct load of `/play`: the match lookup does not wait** (fixed November 26)
  - Done: a same-path change (same pathname, only state or query) is applied at once and never animates, also during the
    opening, a turn, a hold or a book change.
  - Test: on a running match reload `/play/<id>` (no router state) at ¼×.
  - Expected: the first-load opening (2.6 s) starts on the loading page; the match lookup is applied at once, so the board
    can replace the loading page while the book is still opening; no turn, no cover, no second opening; the board's cards are
    dealt once the opening time is over. Watch the remount: if the zoom stops or jumps when the board arrives, report it.

### Home in the app, reloads kept (1.15.0)

- [ DONE ] **78. No reload**
  - Test: DevTools Network filter "Doc", "Preserve log" on; do items 53 (brand, house tab), 58 and 59 (Leave, end game
    "Close", fatal error "Close").
  - Expected: no new document request; the language, the Preferences and the cookie banner state stay; the Home shows fresh
    match badges.
- [ DONE ] **79. The brand on the Home, modifier clicks, a second click** (second click fixed November 26)
  - Done: `routeBookStatus()` (`RouteBook.jsx`: the shown pathname and `settled`); `Navbar.onBrandClick` reloads only when
    the Home is the shown page and its book is settled.
  - Test: on `/` (opening over, nothing turning) click the brand; on `/story/<id>` Ctrl+click and middle click the brand; on
    `/story/<id>` click the brand twice quickly; reload `/` and click the brand during the first-load opening.
  - Expected: on a settled Home the brand reloads the site (a document request, the first-load opening again: owner).
    Ctrl / middle click opens `/` in a new tab and the current page stays. Two quick clicks: the first starts the book change
    to the Home, the second does nothing (no document request) and the running change goes on to its end. During the
    opening: nothing, no reload.
- [ DONE ] **80. Account deletion and sign-out still reload**
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

- [ DONE ] **82. Desktop 1920×1080: the side column in a match**
  - Done: over 1120px the tabs hang down the cover's right edge (`book.css` `@media (min-width: 1121px)`).
  - Test: a match board with a stat badge on Information and a weight badge on Backpack; DevTools: measure the tabs.
  - Expected: the book 16px under the navbar, at most 1080px wide, centred in the space left of a 94px column. Right of the
    cover, from 42px under its top: Position, Information, Backpack, Map, Missions, one under the other, icon on top with the
    badges stacked under it; every tab 74px wide (also those without badges); the house tab alone at the foot, its bottom
    42px above the cover's bottom; the deck pile just above the house tab, its lowest card a little behind it, and under
    every tab. The tabs touch the cover's right edge (deviation: they do not tuck under it).
- [ DONE ] **83. Desktop 1280×800 and 1200×700: smaller pile, house tab at the foot**
  - Test: the same board at 1280×800, then 1200×700; also 1440×900.
  - Expected: 1440×900: pile at full size. 1280×800 and 1200×700: the pile at 70% (`--pile-scale: 0.7`), partly under the
    game tabs; the house tab always at the foot, never over the game tabs; no tab cut by the screen edge; the deal leaves from
    the pile where it is now.
- [ DONE ] **84. The column on every page; no sideways shift**
  - Test: at 1440×900 the Home, `/player`, `/story/<id>`, `/start-match/<id>`, a policy chapter in a match, the end pages;
    switch Home ↔ `/player` several times and compare the cover's left edge (DevTools ruler or a screenshot).
  - Expected: every page keeps the right column; pages without game tabs show the house tab alone at the foot; the Home shows
    none. The book does not move sideways between the Home and `/player`.
- [ DONE ] **85. Tooltips on the left**
  - Test: hover each side tab, the top one and the house tab included; then at 1024×768 hover a tab.
  - Expected: over 1120px the drawn tooltip opens 8px to the left of the tab, over the cover, vertically centred on it, its
    arrow on its right edge pointing at the tab; near the navbar or the screen bottom it stays inside the screen. Texts:
    "Position" / "Posizione", "Information" / "Informazioni", "Backpack" / "Zaino", "Map" / "Mappa", "Missions" /
    "Missioni", "Back to the home page" / "Torna alla pagina iniziale". At 1024×768: above or below the tab as before.
- [ DONE ] **86. Pile with the deal off, and `over`**
  - Test: `VITE_ANIM_DEAL=false`; then `VITE_ANIM_DECK=over` (deal on); restart each time; 1440×900.
  - Expected: deal off: no pile, the house tab still at the foot. `over`: the pile lies over the cover's edge and over the
    tabs.
- [ DONE ] **87. Tablet 1024×768 and 800×1000** (as in 1.14.0)
  - Expected: the book 46px under the navbar; game tabs on the top edge over the left page, the house tab at the end of the
    right row; badges shown; tabs about the same size as in 1.14.0, the band open at the bottom against the page edge.
- [ DONE ] **88. Phone 390×844: icon tabs on the book's edges**
  - Done: step 16's sticky pills row is gone; the game tabs stand on the book's top edge, the house tab hangs under it.
  - Test: a match board; scroll down and up; `/story/<id>`; the Home.
  - Expected: icon-only game tabs (no names, no badges) on the cover's top edge, from 42px (clear of the top-left gold corner),
    in one row; they scroll away with the book (nothing sticky under the navbar). The house tab hangs under the bottom edge,
    72px from the right (left of the ribbon and the bottom-right corner), upside down (band on the sides and bottom), touching
    the cover (deviation: not tucked under it). Room above the book only with game tabs, 46px under it only with the house
    tab; the Home has neither. A tap opens its page; a long press shows the tooltip only (step 16 item 7).
- [ DONE ] **89. Phone 320×640 and sideways 844×390**
  - Expected: 320: the five game tabs stay on the book (narrower sides, 3px), one line, no sideways scroll. 844×390: the phone
    layout of item 88 (not the side column), no horizontal scroll bar.
- [ DONE ] **90. Phone: every page change goes back to the very top**
  - Test: at 390×844 scroll to the bottom of the board each time, then: tap Backpack; tap Position; the bag's back arrow; a
    left preview on `/story/<id>`; a game (i) (right page); a movement. Then `VITE_ANIM_TURN=false` and repeat a tab and an (i).
  - Expected: after each turn, left preview and reload the page lands at the document top, the tabs on the book's edge in
    view (step 16 landed on the right page's top instead). The game (i) scrolls to its page on the right (unchanged). Turn
    off: a tab still jumps to the very top; an (i) fade never jumps.
- [ DONE ] **91. Tab look in every state** (1920×1080, 1024×768, 390×844)
  - Done: light tan inside framed by a 6px band of the cover's dark tooled leather, a gold line and a dashed stitching
    inside the band; the side under the cover open.
  - Test: look closely at a tab, hover one (mouse), look at the active one; DevTools: `.book-bookmark` padding.
  - Expected: light tan inside, dark leather band with the cover's grain on the outer sides, a thin gold line and a faint
    dashed stitching just inside it; no band, line or stitching on the side against the cover (desktop: left; tablet: bottom;
    phone game tabs: bottom; phone house tab: top). Icon dark brown, no text shadow; hover: lighter inside, darker icon;
    active: parchment-light inside, brighter gold line. Paddings (deviation): tablet `3px 9px 10px`, desktop `9px 7px 9px
    12px`, phone `6px 10px 12px`, phone house tab `12px 10px 6px`, under 360px `3px` on the sides.
- [ DONE ] **92. Red and gold tabs on every screen**
  - Test: a critical stat (Information), an overloaded bag (Backpack), a mission just changed (Missions); at 1920, 1024 and
    390; then open each.
  - Expected: red Information and Backpack tabs, gold Missions tab, with their glow, inside the leather band, also on phones
    (icon only); active variants brighter; opening Missions puts the gold out.
- [ DONE ] **93. A book change with the side column**
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

- [ DONE ] **95. Desktop: the line after the check** (Turnstile key set, cookie deleted)
  - Done: `useAntibotSuccess(phase)` (true for 4 s after `checking` → `ready`) and `AntibotSuccess`, shared with the Home.
  - Test: `/start-match/<id>`; wait for the check.
  - Expected: while checking, the spinner and the widget in the right page's footer, no line. Once passed, under the story
    card's text on the left page: a check icon and "Success! You are human." / "Verifica superata! Sei umano."; after 4 s it
    fades out and is gone; the widget hides as before. Leave and come back (a fresh check): the line shows again.
- [ DONE ] **96. Guest login page**
  - Test: as a guest, with Google sign-in enabled on the backend, open `/start-match/<id>`.
  - Expected: the left page is the "Guest user" / "Ospite" login card; the line shows under its text, then goes after 4 s.
- [ DONE ] **97. Preview, no key, phone, reduced motion**
  - Test: open a card's (i) within the 4 s; `VITE_CF_TURNSTILE_KEY=` empty and restart; 390×844; reduced motion.
  - Expected: the preview covers the line (closing it after 4 s shows no line); with no key no line (the dev bypass starts
    ready); on the phone the line is under the top card's text; with reduced motion it disappears after 4 s with no fade. The
    Home's line behaves as in step 14.
- [ UNIT ] **98. Rules:** no line while checking, the line inside the left card's `.book-page-desc` after success, gone after
  4 s, again after a retry or an expired token, on the guest page too, none behind a preview, never when it starts ready,
  timer cleared on unmount (`useAntibot`, `StartMatchTurnstileRetry`, `StartMatchFlowCoverage`, `HomePage` tests).

### Second round (§9 "Second round", to-dos 5–11, November 27, 1.15.0)

Older items this round changes (their text is kept; the new items win):
- Desktop and tablet flight target (items 2–8, 10): with the deal on, every play now lands on the face-up pile and stays
  (item 117); the left page picture and the fade-out only with the deal off (item 125).
- Desktop house tab (items 10, 32, 52, 53, 58, 59, 82–86, 93): over 1120px there is no house tab (item 107); use the navbar
  brand "Paths Games" (in a match it opens the close card first). Tablets keep the house tab.
- Desktop pile place (items 82, 83, 86): both piles centred beside the book (items 112–115).
- Phone tabs and book (items 33, 36, 39, 42, 71, 88, 89, 91): the house tab is now at the right end of the top tab row
  (items 109, 110); phone tab padding `3px 5px 12px` (`3px 2px 12px` under 360px), row from 30px (26px under 360px); no spine,
  one single sheet (items 104–106).
- Phone page changes (items 34, 38, 49, 90, and step 16's phone sheet turn): no sheet turns on phones any more, the cards
  shuffle (items 134–142); the phone flight goes to the page deck (item 136). The fade of a play that does not move stays
  (items 34, 50).
- Book change timings (section 0, items 52, 66, 67, 70): two zoom phases (1.28 s each at ¼×) join every cover change,
  so the phone is capped too (items 128–133).

#### Map centred during a desktop page turn (to-do 9)

- [ DONE ] **99. Map tab during a desktop full turn**
  - Done: `Map.jsx` places the world's origin at the canvas centre (`main.css` `.game-map-world { top: 50%; left: 50% }`)
    and its first render is already centred on the current location (no `requestAnimationFrame`), so the turning sheet's
    copy shows the centred map.
  - Test: 1440×900, default `full`, ¼×: on the board click "Map" / "Mappa" and watch the back of the turning sheet, then the
    moment the sheet goes. Then "Missions" / "Missioni" and back to "Map" (a back turn). Repeat at 1920×1080 and 1024×768.
    In DevTools Elements look at `.game-map-world`.
  - Expected: on the sheet's back the map already shows the current location (its "You are here" / "Sei qui" marker) in
    the middle of the map canvas; when the sheet lands and is removed the live map is exactly where the copy was: no jump
    and no slide. The back turn: the same, no jump. `.game-map-world` has `top: 50%; left: 50%` and an inline
    `transform: translate(…px, …px) scale(1.2)` with negative offsets.
- [ DONE ] **100. Map in simple mode, fade, book change and phone**
  - Test: `VITE_ANIM_TURN_MODE=simple` (or "Turn style" → "Simple" / "Semplice"), click "Map"; back to `full`, on the map click a
    node (its page fades in on the right); with the map open press the navbar brand → close card → "Exit to Home" / "Torna
    alla Home" (book change); at 390×844 tap the "Map" tab.
  - Expected: in every case the map is centred on the current location from its first frame: in simple mode it fades in
    from the blur already centred; the node fade leaves the map still; the closing book copy shows the centred map; on the
    phone the map appears centred with no slide after the page change.
- [ DONE ] **101. After a move; a location at the graph's edge**
  - Test: A: move to another location, then open "Map". B: the same match in two tabs, tab 2 on the Map zoomed in twice with
    "+"; move in tab 1 and let tab 2 refresh. C: stand on a location at the border of the map (the start location, or the
    left-, right-, top- or bottom-most node) and open "Map".
  - Expected: A: the map opens centred on the new location. B: tab 2's map jumps (no animation) to centre the new location
    and keeps the zoom you chose. C: the location sits exactly at the canvas centre, with empty map around it on the outer
    side (1.14.0 kept a 90px margin there, so the location was off centre).
- [ DONE ] **102. Drag, zoom and ◎ unchanged**
  - Test: on the map drag in every direction as far as it goes; press "+" / "−" ("Zoom in" / "Ingrandisci", "Zoom out" /
    "Riduci") several times; roll the mouse wheel over a node away from the centre; drag, then press ◎ ("Center on current
    location" / "Centra sulla posizione attuale"); drag a node by more than a few pixels and release on it.
  - Expected: the drag follows the pointer and stops at the limits as before; "+" and "−" zoom around the canvas centre (the
    location there stays put); the wheel zooms around the pointer (the node under it stays put) and the page does not
    scroll; the zoom stops at 0.4× and 2.6×; ◎ glides back (about 0.5 s) to the location exactly at the centre; a drag does
    not open the node.
- [ UNIT ] **103. Map rules:** first render centred before any frame, a parent reading the DOM in its commit phase sees it
  centred (mount and reload), a reload keeps the zoom and recentres only on a new location, drag and clamp, ◎ back to the
  exact centre, wheel and buttons zoom around their anchor, empty map, the wheel listener using the latest render (`Map`
  tests: 7 new cases).

#### Phones: one single page (to-do 8)

- [ DONE ] **104. The game board reads as one sheet** (390×844, also a real phone)
  - Done: `mobile.css`: spine and headbands hidden, no gutter shade or `::after` gradient, cover padding `8px 8px 10px`
    (was 20px on the left), both pages the same paper, no border between them, the page corners moved to the sheet's four
    outer corners, the stacked page edges on the outer side.
  - Test: a match board; zoom the browser to 200% if needed; scroll to the seam between the location (upper page) and the
    action cards (lower page).
  - Expected: no spine line or binding thread on the left, no dark headbands; the leather visible as wide on the left as on
    the right; no gutter shadow along the left edge; the location and the cards on one parchment colour with no line, gap,
    rounding or shadow where the two pages meet; small gold page corners only at the sheet's top-left, top-right,
    bottom-left and bottom-right (none at the seam); the stacked page edges show on the right and bottom of the sheet. The
    cover frame, its gold corners and the ribbon (about 46px from the right) are still there.
- [ DONE ] **105. Every other page as one sheet** (390×844 and sideways 844×390)
  - Test: the Home, `/story/<id>` (and a loadout (i)), `/start-match/<id>`, `/player` with a match open, "Privacy Policy" from
    the footer.
  - Expected: the same single-sheet look as item 104 on each (no spine, no seam, corners only outside); sideways the page
    with picture and description side by side keeps the look; no horizontal scroll bar.
- [ DONE ] **106. The end page as one sheet**
  - Test: end a match at 390×844, once without missions (the ending), once with missions (missions card, a mission).
  - Expected: the ending: the end card with "Close" / "Chiudi" on top, the story card below, one sheet: thick page edge at the
    very top and very bottom, nothing at the seam, the four gold page corners at the outer corners (none in the middle).
    The missions pages: the normal order, the same look. Desktop and tablet end pages unchanged (spine, two pages).

#### Home tab per screen (to-do 7)

- [ DONE ] **107. Desktop: no house tab; the brand leads home**
  - Done: `book.css` `@media (min-width: 1121px) .book-bookmark--home { display: none }`; the right group stays in the markup,
    empty.
  - Test: at 1440×900 and 1920×1080 look at the Home, `/player`, `/story/<id>`, `/start-match/<id>`, a match, the end pages
    and a policy chapter in a match; in DevTools search `.book-bookmark--home`. Then in a match press the navbar brand
    "Paths Games"; on `/story/<id>` press the brand.
  - Expected: no house tab anywhere on desktop (the node is in the DOM with `display: none`); in a match only the five game
    tabs in the side column, nothing at its foot; pages without game tabs show an empty right column (the book still keeps
    its place, no sideways shift Home ↔ `/player`). The brand in a match opens the close card "Exit to Home" / "Torna alla
    Home" first; on the story page it changes the book to the Home (item 53).
- [ DONE ] **108. Tablet unchanged** (1024×768 and 800×1000)
  - Expected: as item 87: game tabs on the top edge over the left page, the house tab at the end of the right row, its
    tooltip "Back to the home page" / "Torna alla pagina iniziale"; on `/story/<id>` the house tab alone at the top right.
- [ DONE ] **109. Phone: the house tab at the right end of the top row** (390×844)
  - Done: `mobile.css`: the upside-down block is gone; one row on the top edge (`left: 30px`, `right: 8px`), the home group
    pushed to the right end; room over the book (8px + 44px) when either group shows; icons `1.45rem`, `1.25rem` under 400px.
  - Test: a match board; `/story/<id>`; `/player`; the Home; the end pages; scroll down and up; tap the house tab in a match
    and on the story page; long press it.
  - Expected: in a match the five game tabs from the left and the house tab at the right end of the same row, all standing
    on the cover's top edge with the same look (band on the sides and top, open at the bottom), nothing under the book's
    bottom edge. Story page, `/player`, end pages: the house tab alone at the top right, with room above the book and none
    under it. The Home: no tab, no room. The tabs scroll away with the book. In a match the tap opens the close card; on the
    story page it changes the book (phone cover); a long press shows only the tooltip.
- [ DONE ] **110. Phone widths 320, 360, 390, 430** (DevTools responsive, height 800; a match with all five game tabs)
  - Test: at each width look at the tab row and measure a tab; DevTools: the computed `font-size` of `.book-bookmark i`.
  - Expected: six tabs on one line, none cut, none wrapped, no sideways scroll; icon `font-size` 20px (`1.25rem`) at 320, 360
    and 390, 23.2px (`1.45rem`) at 430. About: 320 → tabs ~41px wide, row from 26px to 6px inside the cover, ~6px spare;
    360 → tabs ~47px, row from 30px, only ~4px spare (tightest: about 8px between Missions and the house tab);
    390 → ~30px spare; 430 → tabs ~51px, ~50px spare. The first tab does not cover the cover's top-left gold corner badly
    (the row now starts at 30px, was 42px): report it if it hides the corner.
- [ UNIT ] **111. Markup:** the home item still rendered with its class in the right group, the stage classes (`Book`,
  `BookBookmarks` tests); the desktop hiding and the phone row are CSS: manual only (items 107–110).

#### Piles centred beside the book (to-do 6)

How to measure: DevTools responsive mode (no scrollbar) or a normal window (with a scrollbar `100vw` counts it, so the
centre can be about a quarter of the scrollbar's width, 2–4px, too far right). Let R = the distance from the cover's right
edge to the screen's right edge; the piles' centre must be at R / 2 from the cover. Select `.played-pile` and `.deck-pile`
(children of `.book-shell`) and read their boxes (the box is the scaled size).

- [ DONE ] **112. Desktop 1920, 1440 and 1366 wide, 800 high** (in a match, deal on)
  - Done: `animations.css`: both piles `left: calc(100% + var(--table-mid) - 160px * var(--pile-scale) / 2)`, the face-up
    pile at `bottom: var(--home-bottom)` (42px), the deck `(210px + 21px) × scale` higher; `--table-mid: calc((100vw -
    100%) / 4 + 19.5px)` over 1120px; `z-index: -1`.
  - Expected (800 high = short desktop, scale 0.7: each pile about 112 × 147px): 1920: R ≈ 459, centre ≈ 230px right of the
    cover; 1440: R ≈ 219, centre ≈ 110px; 1366: R ≈ 182, centre ≈ 91px, the pile's left part under the game tabs. Both
    piles share the same centre (one exactly above the other); the face-up pile's bottom 42px above the cover's bottom; the
    deck's bottom about 204px above it (gap between the piles about 15px, 10% of a pile). Both under every tab and under the
    cover. At 1440×900 (scale 1, 160 × 210px): same centre, deck bottom 273px, gap 21px.
- [ DONE ] **113. Narrow desktop 1180×800**
  - Expected: R ≈ 94, centre ≈ 47px right of the cover: the piles' left 9px or so slide under the cover and most of their
    left part is under the game tabs; the tabs and the cover are never covered by a pile; same vertical places as item 112.
- [ DONE ] **114. Tablet 1024×800 and 900×800**
  - Done: tablet: `--table-mid: calc((100vw - 100%) / 4)`, scale 0.82, face-up pile 70px from the bottom, deck `70px + 231px
    × 0.82` (about 259px).
  - Expected: each pile about 131 × 172px, centred about 15px (1024) or 14px (900) right of the cover's edge: more than half
    of each pile is hidden under the cover (owner's choice), the visible part a strip beside the book; the deck above the
    face-up pile, same centre, gap about 17px. Also at 1024×768.
- [ DONE ] **115. The deck's place outside a match** (1440×900 and 1024×768)
  - Test: look at the deck on the Home, `/player`, `/story/<id>`, `/start-match/<id>`; then start or resume a match and
    watch the deck when the game opens.
  - Expected: outside a match only the deck, at the same height as in a match (an empty space under it where the face-up
    pile goes); when the match opens the face-up pile appears under it and the deck does not move. During a book change no
    pile shows on the moving copies.

#### The face-up played pile (to-do 5)

Desktop items at 1440×900 (scale 1) with the defaults. In DevTools: `.book-shell > .played-pile` with `.played-card`
children (`.played-card--story` first, `.played-card--top` last).

- [ DONE ] **116. Before the first play: the story card**
  - Done: new `PlayedPile.jsx`, rendered by `Book` only with the `playedPile` prop (GameBook and its end pages) and only
    while the deal is on; memory only (`usePlayController` keeps `played`).
  - Test: open (or resume) a match; hover the visible part of the face-up pile.
  - Expected: under the deck a single face-up card: the story's picture, gold frame, tilted about 9°, the story title tiny
    and blurred at its top; no text, badges or buttons. Hover: the tooltip shows the story's title (no "Last played").
- [ DONE ] **117. A play lands on the pile and stays**
  - Done: `flightTarget` aims at the pile's centre, final width 84px × `--pile-scale`, tilt −4°, opacity stays 1; on landing
    the card joins the pile and the flying copy goes in the same frame.
  - Test: from a movement's reading page press "Move" / "Muovi"; watch the flight; hover the pile.
  - Expected: the whole reading card flies in an arc out of the book to the pile, shrinking to a deck card's size and
    tilting a little, and does not fade: it becomes the top card, straight (−4°), with a thin gold glow and a brighter gold
    border, with no blink or gap when the flying copy is removed. The story card stays under it. Tooltip "Last played:
    title" / "Ultima giocata: title" with the card's title. Then the hold and the turn as before.
- [ DONE ] **118. Every kind of play lands on it**
  - Test: a small card's "Do" / "Scegli" on a choice; an action from its reading page ("Do" / "Agisci"); "Sleep" / "Dormi";
    an item "Use" / "Usa"; training "Improve" / "Migliora"; "End Game" / "Termina Partita".
  - Expected: each one flies to the pile and becomes its top card with its own picture (a card with no picture shows the
    bare brown card with the title hint; a reading card with no image uses its alternative picture); the previous top card
    goes down one place with a small tilt. "Drop" / "Getta" adds nothing (no play).
- [ DONE ] **119. At most five played cards; last on top**
  - Test: play seven cards in a row; count the `.played-card` nodes and hover.
  - Expected: after the seventh play: the story card plus five played cards (6 nodes), the oldest two gone; the last one on
    top and lit, the others each with its own small tilt; the tooltip names the last one.
- [ DONE ] **120. Reload, another match**
  - Test: after some plays reload `/play/<id>`; then go to the Home and resume the same match (no reload); then another
    story's match.
  - Expected: after the reload only the story card (owner: memory only). Through the Home too: only the story card (the
    game page is mounted again and the list lives in its state). Another story: its own story card alone.
- [ DONE ] **121. End pages keep the pile**
  - Test: play "End Game" / "Termina Partita", then on the ending open the missions and come back.
  - Expected: the end card lands on the pile as its top card; on the end pages the pile and the deck stay beside the book.
- [ DONE ] **122. Tablet: mostly under the cover** (1024×768 and 900×800)
  - Test: a match; play a movement; play a few more cards.
  - Expected: the pile is mostly hidden under the cover (item 114); the played card flies to the pile's centre (partly under
    the cover's edge), shrinks to 84px × 0.82 and stays; the visible strip shows the top card's edge. No flight to the left
    page picture.
- [ DONE ] **123. Absent on phones and outside a match** (390×844; 1440×900 on the Home, `/player`, `/story/<id>`, `/start-match/<id>`)
  - Test: phone: play a movement from its reading page, then a "Do" on a small card; desktop: look for `.played-pile`.
  - Expected: phone: no face-up pile; the card flies to the page deck at the bottom right of the screen (or the screen's
    bottom-right corner, about 50px from the right and 60px from the bottom, when the page deck is not on screen, as on a
    reading page), shrinks and fades out there; then the phone page change (items 136, 137). Desktop pages outside a match: no
    `.played-pile` node, the deck alone.
- [ DONE ] **124. `VITE_ANIM_DECK=over`** (1440×900 and 1024×768, restart)
  - Expected: the deck lies over the cover's edge and the tabs where they overlap (on 1440 there is no overlap: no visible
    change); the face-up pile stays under the cover and the tabs (it has no `over` place); plays still land on it.
- [ DONE ] **125. Deal off: no pile, the old flight** (`VITE_ANIM_DEAL=false`, restart, 1440×900)
  - Test: play two cards; then, with no reload, Preferences "Deal" / "Distribuzione" → "On" / "Attivo".
  - Expected: no deck and no face-up pile on any page; a play flies to the left page picture (or the left page centre) and
    fades out there at 0.3 scale, tilted −16° (the 1.15.0 first-round flight). The landed cards are still remembered: once
    the deal is on, the pile shows the story card with the two cards on it.
- [ DONE ] **126. Play off and reduced motion**
  - Test: `VITE_ANIM_PLAY=false`, restart (or Preferences "Play" / "Giocata" → "Off" / "Spento"); play two cards. Then play
    on, reduced motion on, play one.
  - Expected: no lift and no flight, and the pile keeps only the story card (a card is added only when it lands); the turns
    as in items 25 and 27.
- [ UNIT ] **127. Rules:** story card alone with its title as the tip, at most five on top of it, the last one `played-card--top`,
  tip text from `game.playedPile.last`, bare card without picture or title (`PlayedPile`: 3 cases); the pile only with
  `playedPile` and the deal on, after the deck in `.book-shell` (`Book`); `flightTarget` per layout (pile, left picture,
  phone page deck clamped or corner), the card stays opaque on the pile, `played` grows after `land`, not after `cancel`,
  kept to five (`PlayContext`); the reading page passes its picture (`CardPlay`); the pile in GameBook and its end pages
  (`GameBookTurns`).

#### Book change: smaller while it slides (to-do 11)

New timing `zoom` 320ms at 1× (`--t-zoom: 1280ms` on `<html>` at ¼×); `SWAP_SMALL` = 0.62; the grow back ends with a light
overshoot. Watch `div.book-swap` (desktop) or `div.m-sheet.m-cover` (phone) in Elements, or use a stopwatch.

- [ DONE ] **128. Desktop ¼× (default): close, shrink, slide, slide, grow, open** (1440×900)
  - Test: Home → a story; then the brand back to the Home.
  - Expected, in order: the right half folds over the spine showing the front cover (about 2.2 s); the closed book shrinks
    to about 62% where it is, around the spine, flap and left half together (about 0.8 s); it slides out left small (about
    1.5 s); the next closed book slides in small from the right with its title (about 1.5 s), stops in place, grows back to
    full size passing a little beyond it and settling (overshoot, about 0.8 s); then it opens (about 2.2 s). Total about
    10 s (16.16 s capped, every phase × 0.62). The flap never separates from the left half during the scaling.
- [ DONE ] **129. `VITE_ANIM_COVER_MAX_S`** (¼×, restart each time)
  - Test: `=0`, then `=5`, on desktop and on a phone (390×844).
  - Expected: desktop `0`: about 16.2 s (fold 3.6 s, zoom 1.28 s, slide 2.4 s, tab fade 0.8 s); phone `0`: about 12.3 s
    (cover 2.48 s, zoom 1.28 s, slide 2.4 s). `5`: 5 s on both, every phase by the same factor. Default 10: 10 s on both (the
    phone is now capped too: it was 9.8 s, item 66).
- [ DONE ] **130. Speed 1×** (Preferences "Speed" / "Velocità" 1×, or `VITE_ANIM_SPEED=1`)
  - Expected: desktop about 4.04 s (fade 0.2, fold 0.9, zoom 0.32, slide 0.6, each twice), phone about 3.08 s (cover 0.62,
    zoom 0.32, slide 0.6, each twice), none capped; the overshoot still visible but short.
- [ DONE ] **131. Phone ¼×: the cover shrinks around its middle** (390×844 and 320×640, also a real phone)
  - Test: Home → a story; the story's house tab → Home.
  - Expected: the cover closes over the screen from its left edge (about 2 s), shrinks to about 62% staying centred on the
    screen (not pulled to the left edge, about 1 s), slides out left small (about 1.9 s); the page goes to the top; the cover
    with the new title slides in small from the right (about 1.9 s), grows back with the overshoot (about 1 s), then the live
    book shows and the cover swings open. Total about 10 s. Sideways 844×390: the same, no horizontal scroll bar.
- [ DONE ] **132. Simple mode: no zoom** (`VITE_ANIM_TURN_MODE=simple`, desktop and phone)
  - Expected: as items 68 and 72: fade, tilt and shrink of the old book (about 1 s at ¼×), the new book opens with the
    first-load zoom (2.6 s); no cover, no 62% phase; total 3.64 s at ¼×, 0.91 s at 1×.
- [ UNIT ] **133. Rules:** `swapTimings` with `zoom` (1×: 4.04 s, 3.08 s, simple 0.91 s; ¼×: 16.16 s and 12.32 s capped to
  10 s by one factor; `0` = no limit), `--t-zoom` written and scaled, phase order close → zoom out → slide → slide → zoom
  in → open on desktop and phone, durations capped by `coverMax` (`bookSwap`, `RouteBook`, `animations` tests).

#### Phones: cards shuffle instead of a page turn (to-do 10)

`runShuffle` (`mobileTurn.js`): on the copy of the screen the small cards spin in their plane (240°, clockwise forward,
counter-clockwise back) and shrink into the page deck one after the other; the page card and the headings fade; the page
jumps to the very top; the new page fades in and its cards are dealt from the page deck. At ¼×: each card 1.68 s
(`--t-gather`), 0.24 s between cards (`--t-gatherStep`), from the ninth card on together (at most about 3.6 s), the fades
0.8 s; at 1×: 0.42 s, 0.06 s, 0.2 s. Best on a real phone (`npm run dev -- --host`); DevTools 390×844 otherwise.

- [ DONE ] **134. Forward: a tab after the current one**
  - Test: on the board scroll so that several action cards and the page deck are on screen; tap "Backpack" / "Zaino".
  - Expected: the screen freezes (no scroll, `<html class="is-turning">`), the page jumps to the very top under the copy;
    the cards on screen spin clockwise, shrink and fly one after the other into the page deck at the bottom right (or the
    bottom-right corner when no page deck shows), each fading at the end; meanwhile the location card and the headings fade
    out (0.8 s); once the last card has gone the copy is removed and the bag page fades in (0.8 s), its cards dealt from the
    page deck. No sheet swings at any time; no card shows its front mirrored.
- [ DONE ] **135. Back: a tab before the current one, back arrows**
  - Test: from "Backpack" tap "Position" / "Posizione"; open "Information", then the history, then its back arrow; an item
    "Use" / "Usa" (a back change).
  - Expected: the same shuffle, the cards spinning counter-clockwise; everything else as item 134.
- [ DONE ] **136. A play that moves: flight to the deck, then the shuffle**
  - Test: a movement from its reading page ("Move" / "Muovi"); a choice "Do" / "Scegli" on a small card that moves you.
  - Expected: the card lifts, flies to the page deck (or the bottom-right corner on a reading page) and fades there; the
    view is held while the board reloads (the other cards of a choice dim and fall first); then the forward shuffle of item
    134 (the cards that fell or were played do not spin again); the new board fades in at the very top and is dealt.
- [ DONE ] **137. A play that does not move: still the fade**
  - Test: "Sleep" / "Dormi"; an action that leaves you where you are.
  - Expected: the card flies to the deck; the page jumps to the top under the held copy, which fades out in 0.8 s, no card
    spins (`data-direction="fade"`), as item 50.
- [ DONE ] **138. Both turn modes; deal off**
  - Test: `VITE_ANIM_TURN_MODE=simple` (or "Turn style" → "Simple" / "Semplice"), repeat items 134 and 135; then
    `VITE_ANIM_DEAL=false` (restart) and repeat item 134.
  - Expected: simple mode shuffles exactly like `full` on phones (no swing of the live pages). Deal off: no page deck, the
    cards spin into the screen's bottom-right corner, and the new page's cards fade in with the page instead of being dealt.
- [ DONE ] **139. Route turns and previews on a phone**
  - Test: Home → navbar user button (`/player`), then its house tab back to the Home; on `/story/<id>` "Start Game" /
    "Inizia Gioco"; a game card's (i) and a left preview on `/story/<id>`.
  - Expected: Home ↔ `/player` and story set-up → start match: a shuffle (forward or back by rank), not a cover and not a
    sheet. The (i) previews keep their fade (no shuffle).
- [ DONE ] **140. Turn off and reduced motion**
  - Test: `VITE_ANIM_TURN=false`, restart, tap a tab; then turn on reduced motion (no reload) and tap a tab.
  - Expected: no shuffle and no fade: the new page appears at once (a tab still lands at the very top); the scroll is never
    locked afterwards.
- [ DONE ] **141. Clicks and scroll during a shuffle**
  - Test: during item 134 try to scroll and tap cards; tap the navbar user button.
  - Expected: the page does not scroll and taps on the copy do nothing; the navbar works, its navigation waits for the
    shuffle (item 74); after it `is-turning`, `div.m-blocker` and the copy are gone and the page scrolls normally.
- [ UNIT ] **142. Rules:** `deckGoal` (page deck centre clamped, corner when hidden or off screen), the leaving cards (on
  screen, not fallen, played or waiting), the fading parts and the live boxes, forward and back spin with the stagger cap,
  the copy removed at the end and the new page faded in, simple mode shuffling too, `finish()` ending at once, a page with
  nothing to move, the `fade` direction unchanged, `gather` / `gatherStep` timings (`mobileTurn`, `BookPages`,
  `GameBookTurns`, `animations` tests).

#### Regressions (second round)

- [ DONE ] **143. Things that must not change**
  - Test: one full tour on desktop 1440×900, tablet 1024×768 and phone 390×844.
  - Expected: desktop and tablet page turns, fades and holds as before (items 14–20); the deal of every list from the
    table deck (desktop, tablet) or the page deck (phone); drawn tooltips on the side tabs and the tablet tabs; red and
    gold tabs (item 92) also on the phone row; the start-match success line (items 95–97); the book's first-load opening
    once; no horizontal scroll bar at any size; the Map's legend ("Selected" / "Selezionata", "Safe" / "Sicura",
    "Unexplored" / "Inesplorata") unchanged.

### Third round (§9 "Third round", to-dos 12–15, November 27, 1.15.0)

Desktop and tablet only (phones unchanged). Defaults (deal on, face down, deck `under`, `full`, ¼×, max 10 s) unless the
item changes one. Older items this round changes (their text is kept; the new items win):
- Book change and the deck (items 52, 53, 54: "No deck pile on the moving copies; the live book and its pile show only at
  the end"; item 115: "During a book change no pile shows on the moving copies"): the deck now stays visible and still on
  the table for the whole change, under the moving copies (items 144–147). The copies still carry no pile, and the face-up
  pile still shows only with the game book.
- Pile gap (item 112: deck bottom about 204px at 1366/1440 × 800, 273px at 1440×900, gap 15px / 21px; item 114: tablet deck
  about 259px, gap 17px; second round's `--pile-gap` = 10% of the pile): the deck is lower, its box now overlaps the face-up
  pile's box by 34px × scale and its lowest cards touch the played ones (items 149–152).
- Played card titles (item 116: "the story title tiny and blurred"; item 118: "the bare brown card with the title hint"): the
  title is now a readable bar at the top of every card of the pile (items 153–154).
- The deal on desktop and tablet (items 20, 52 "the loadout cards are dealt from the pile", 55, 143 and step 14's deal
  items): the flight now runs on a copy of the card above the page, from the deck's top card to the slot, never cut by the
  page or a scrolling list; the real card waits invisible in its slot (items 156–166). Phones keep the in-page deal.

#### The deck stays on the table during a book change (to-do 12)

- [ DONE ] **144. Home ↔ story set-up: the deck never moves or vanishes** (1440×900)
  - Done: `animations.css` `.route-book.is-swapping .book-shell > .deck-pile { visibility: visible }`: while the live book
    is hidden for the change, its table deck stays shown (same place on every page, to-do 6); the face-up pile, the book
    and its tabs stay hidden.
  - Test: on the Home click a story card; then the navbar brand "Paths Games" back to the Home; then the browser Back and
    Forward. Watch the deck beside the book (bottom right) from the click to the end. In Elements keep `div.route-book`
    and its `.book-shell > .deck-pile` selected (Computed → `visibility`).
  - Expected: the deck is on the table from the first to the last frame of every change: no blink when the change starts
    (the live book hides) or ends (the live book shows), no shift, no resize. The folding, shrinking, sliding and opening
    book copies pass over it (the deck stays under them, never on the cover). While `div.route-book` has `is-swapping` the
    deck's computed `visibility` is `visible`. At the end the story's cards are dealt from it (item 156).
- [ DONE ] **145. Into a match and Leave: the face-up pile comes and goes with the game book** (1440×900)
  - Test: A: on the Home press a running match's "Resume" / "Riprendi" badge. B: in that match play one card, then press
    the navbar brand "Paths Games" → close card → "Exit to Home" / "Torna alla Home". C: on `/story/<id>` "Start Game" /
    "Inizia Gioco", pass start match to the game (same story book: a turn, not a change).
  - Expected: A: the deck still and visible the whole time; no face-up pile on the table or on the copies during the
    change; the face-up pile (the story card) appears under the deck only at the end, with the opened game book, and does
    not slide in. B: when the change starts the face-up pile (story card plus the played card) is gone at once, the deck
    stays; the Home book opens with the deck alone in the same place. C: the deck never moves; the face-up pile appears
    under it with the game page.
- [ DONE ] **146. 1366×768 and tablet 1024×768**
  - Test: as item 144 and item 145 A and B.
  - Expected: 1366×768 (piles at 0.7): as item 144; the deck stays where it is, also where the side tabs or the book's
    edge covered it. Tablet (piles at 0.82, mostly under the cover): the deck stays still; while the book is folded, small
    or off screen the whole deck shows on the table beside the book's place (more of it than with the book open), and the
    incoming book covers it again as it grows and opens; no blink at the start or the end.
- [ DONE ] **147. Phones, simple mode, deal off**
  - Test: A: 390×844, Home → a story and back. B: 1440×900 with `VITE_ANIM_TURN_MODE=simple` (or "Turn style" / "Stile del
    giro" → "Simple" / "Semplice"), Home → a story and back. C: `VITE_ANIM_DEAL=false` (restart), Home → a story.
  - Expected: A: no table deck on phones (as before), the phone cover change as item 131, no `.deck-pile` shown. B: the deck
    stays still and visible during the simple change too. C: no deck anywhere, the change as before.
- [ UNIT ] **148. Rule:** during a book change into a match the deck and its top card are `visible`, the face-up pile and the
  book `hidden`; after it the pile and the book are visible (`RouteBook`: 1 new case, the real `animations.css` loaded).

#### The deck lowered until it touches the played pile (to-do 13)

CSS only (`--pile-gap: -34px`, was +21px; deck `bottom` = foot + (210px − 34px) × `--pile-scale`): no unit test. The value is
the concept's: judge by eye. Select `.deck-pile` and `.played-pile` (children of `.book-shell`) to read their boxes; the
face-up pile is drawn after the deck, so where they meet the played cards lie over the deck's lowest backs.

- [ DONE ] **149. Desktop 1440×900** (scale 1, each pile 160 × 210px; a match with two or three played cards)
  - Test: look at the two piles; hover the top of the face-up pile.
  - Expected: the deck's lowest backs touch the top edge of the face-up cards: no strip of table between them (about 55px
    before), at most a few pixels at the tilted corners; the deck does not cover the played cards' title bars (item 153);
    same centre for both piles. Boxes: face-up pile bottom 42px above the cover's bottom (unchanged), deck bottom 218px
    above it (was 273px): the deck's box overlaps the pile's box by 34px. The hover shows "Last played: title" /
    "Ultima giocata: title" (the deck takes no pointer).
- [ DONE ] **150. Desktop 1366×768** (short desktop, scale 0.7: each pile about 112 × 147px)
  - Expected: the same contact as item 149 at a smaller size; deck bottom about 165px above the cover's bottom (was about
    204px), overlap about 24px; both piles' left part still under the game tabs as before, never over them.
- [ DONE ] **151. Tablet 1024×768** (scale 0.82: each pile about 131 × 172px, mostly under the cover)
  - Expected: in the visible strip beside the book the deck's backs meet the face-up cards with no gap; face-up pile 70px
    above the cover's bottom (unchanged), deck bottom about 214px (was about 259px), overlap about 28px.
- [ DONE ] **152. Outside a match; `VITE_ANIM_DECK=over`** (1440×900 and 1024×768)
  - Test: A: the deck on the Home, `/player`, `/story/<id>`, `/start-match/<id>`; then resume a match. B: `VITE_ANIM_DECK=over`
    (or Preferences "Deck" / "Mazzo" → "Over the book" / "Sopra il libro"), a match with played cards.
  - Expected: A: the deck at the same height as in a match (218px at 1440×900, about 214px at 1024×768) with the empty room
    under it; when the match opens the face-up pile appears under it touching it, and the deck does not move. B: the deck
    lies over the cover (item 124) at the same lowered place; where it meets the face-up pile the deck's backs are now over
    the played cards (the face-up pile stays under the cover); report if that overlap looks wrong.

#### Title on the played cards (to-do 14)

- [ DONE ] **153. A readable title bar** (1440×900, text size "Normal" / "Normale")
  - Done: `animations.css` `.played-card__title`: a bar across the top of each pile card (Cinzel bold `0.56rem` = about 9px,
    gold-light text on a see-through dark brown gradient, gold-dark bottom line, one line with "…"), no blur; `PlayedPile.jsx`
    markup unchanged.
  - Test: open a match before any play and look at the story card; then play cards with a short and a long title; in
    Elements select a `.played-card__title` (Computed: `font-size`, `filter`).
  - Expected: the story card shows a dark bar at its top with the story's title in gold, sharp and readable (no blur, not
    faint), a thin gold line under it, the picture visible below; every played card the same with its own title; a long
    title on one line ending with "…". Still no description, badges or buttons. A card with no picture: the bare brown card
    with the bar; a card with no title: no bar. Computed `font-size` 8.96px, `filter: none`, `white-space: nowrap`.
- [ DONE ] **154. Smaller piles and languages** (1366×768, 1024×768; Italian)
  - Test: the same match at 1366×768 (scale 0.7) and 1024×768 (scale 0.82, the visible strip); switch to Italian and play
    one more card.
  - Expected: the bars scale with the pile (text about 6.3px and 7.3px on screen): judge whether they stay readable and
    report the size if not; on the tablet the bar of the top card shows in the strip beside the cover. In Italian the tip
    reads "Ultima giocata: title"; the bars show the titles as the cards had them when played.
- [ UNIT ] **155. Rule:** the title bar rendered on the story card and on every played card, over the picture (`PlayedPile`:
  1 new case).

#### The deal flies visibly from the table deck (to-do 15)

Done (`useDeal.js`, `animations.css`, `book.css`): when a batch leaves from the table deck (`dealOrigin` found
`.deck-pile__top`, flagged `table`), each card gets a copy (`dealCopy`: `cleanClone`, no ids, test ids or tips, `inert`,
`aria-hidden`, the slot's box and `--card-w`, the page's inherited text styles copied inline) on `<body>` as
`div.pg-card.deal-copy` (fixed, z-index 1600: above the book, the side tabs, the book change layer 990 and the navbar 1000;
under `.flying-card` 2000 and the drawn tooltip 2100). The copy runs the same keyframes, timings and stagger; the real card
waits invisible in its slot (`data-deal="flying"` + `data-deal-copy`, no layout change) and shows when its copy's own
`animationend` fires, the copy removed in the same frame; a safety timer (deal + step × i + 200ms) lands it anyway. On
desktop the book's `.hide-in-book` parts and the status card's button labels are hidden on the copy too. Phones: the page
deck, the card itself flies inside the page (no copy). At ¼× a card flies 2.48 s, 0.44 s after the previous one.

- [ DONE ] **156. The story catalog: visible from the deck all the way** (1440×900, Home)
  - Test: reload `/` and wait for the book's opening; watch the story cards being dealt; during the flights look at the end
    of `<body>` in Elements and at the cards in the list.
  - Expected: each card leaves the top of the table deck (right of the book), small and face down, and is seen along the
    whole path: over the book's edge, the side column and the page margins, never popping out of the page's edge; it turns
    face up while arriving and lands in its slot with no jump, no blink and no change of size, font, colour or shadow when
    the copy is replaced by the real card. While they fly `<body>` ends with one `div.pg-card.deal-copy` per card in flight
    (`inert`, `aria-hidden="true"`, `data-deal-face="down"`); their real cards have `data-deal="flying"
    data-deal-copy="on"`, are invisible and keep their places (the grid does not shift). After the last landing:
    `document.querySelectorAll('.deal-copy').length` is 0 and every card `data-deal="landed"`.
- [ DONE ] **157. Every scrolling grid** (1440×900)
  - Test: `/story/<id>` (the loadout cards, then each config page you open); `/start-match/<id>` (its phase cards); `/player`
    (the matches list); the game board `/play/<id>` (the location's action cards, then "Backpack" / "Zaino", "Missions" /
    "Missioni"); the "Credits" / "Crediti" chapter from the footer.
  - Expected: as item 156 in each: the flights start at the deck and are visible all the way; on the game board the new
    page's cards fly only after the page turn has ended; the copies look exactly like the landed cards (on the status card
    the footer buttons show icons only, no labels, in flight and after landing; nothing marked hidden in the book appears
    on a copy). Console count 0 after each deal.
- [ DONE ] **158. Slots at the edge of a list, over the tabs and the navbar** (1440×900)
  - Test: on the Home scroll the catalog slowly so a new row enters from the bottom edge; do the same on the loadout; on the
    game board deal a long list (the bag) and watch flights that cross the side tabs; if the page scrolls under the navbar,
    watch a card dealt near the top.
  - Expected: a card is dealt when about a fifth of it shows; its copy flies whole to the whole slot, drawn over the side
    tabs and, near the top, over the navbar; on landing the part of the card outside the list (or under the navbar)
    disappears at once, cut as the real card is (the copy is never clipped: see section 3). The navbar stays usable during
    the flights (the copies take no clicks).
- [ DONE ] **159. Face up** (`VITE_ANIM_DEAL_FACEDOWN=false`, restart; or Preferences "Face-down deal" / "Distribuzione coperta"
  → "Off" / "Spento"; 1440×900)
  - Test: the Home, then `/story/<id>`.
  - Expected: the copies have `data-deal-face="up"`: each fades in at the deck already face up and small, grows on the way,
    rises a little (about 6px) and settles in its slot; no back is shown; no jump at landing. Face down back on: the d20
    backs again, turning face up on arrival.
- [ DONE ] **160. Deck over the book** (`VITE_ANIM_DECK=over` or Preferences "Deck" / "Mazzo" → "Over the book" / "Sopra il libro")
  - Test: 1440×900 and 1024×768, the Home and a game board.
  - Expected: the flights start from the deck's top card lying on the cover, then as item 156.
- [ DONE ] **161. 1366×768 and tablet 1024×768**
  - Test: the Home, `/story/<id>`, a game board.
  - Expected: 1366×768: the deck's left part is under the game tabs, but each copy is drawn over the tabs from its first
    frame. Tablet: the deck is mostly under the cover; the copies start at its top card, about 20px right of the cover's
    edge, drawn over the cover (not behind it), and fly to the slots; landing as item 156.
- [ DONE ] **162. Scroll during a flight** (1440×900, ¼×)
  - Test: while copies fly on the Home or the loadout, roll the mouse wheel over the list (over a copy too).
  - Expected: the list scrolls (a copy never catches the wheel); the copies keep flying to where their slots were when they
    left; on landing each card appears in its real, scrolled place: a small jump (accepted by the step file). No copy stays.
- [ DONE ] **163. No stray copies after a page turn, a book change or leaving mid-deal** (1440×900, ¼×)
  - Test, each while copies are still flying: A: on the game board click a game tab ("Backpack" / "Zaino"). B: on the Home
    click a story card (book change). C: on the loadout press the navbar brand, then the browser Back. D: in a match while
    the bag is dealt, navbar brand → "Exit to Home" / "Torna alla Home". After each, run the Console count.
  - Expected: as soon as the turn or the change starts no copy is left on screen (none over the turning sheet, the cover
    copies or the navbar); the new page's cards are dealt afterwards from the deck; the Console count is 0 once its deal
    has ended. Watch the turning sheet: if cards still in flight show as empty places on it, note it (section 3).
- [ DONE ] **164. Keyboard Tab during a deal** (1440×900, ¼×)
  - Test: reload `/story/<id>`; once the opening is over and the loadout is being dealt, press Tab repeatedly.
  - Expected: the focus never goes into a copy (they are `inert`); when the focus reaches a button of a card whose copy is
    still flying, that copy vanishes at once and the real card shows in its slot with the focus ring; the other copies
    keep flying; the Console count drops by one.
- [ DONE ] **165. Phones unchanged** (390×844 and sideways 844×390)
  - Test: the Home, `/story/<id>`, a game board; scroll down through a long list.
  - Expected: no table deck; cards are dealt from the sticky page deck at the bottom right inside the page as in step 16
    (the part of a flight outside the page is still cut); no `.deal-copy` on `<body>` at any time (Console count 0); cards
    have no `data-deal-copy`.
- [ DONE ] **166. Reduced motion and deal off**
  - Test: A: reduced motion on (DevTools Rendering), reload the Home. B: Preferences "Deal" / "Distribuzione" → "Off" /
    "Spento" (or `VITE_ANIM_DEAL=false`, restart), open `/story/<id>`. C: deal on, start a deal on the Home and turn reduced
    motion on during it.
  - Expected: A, B: no copies, no flight: every card shows at once (`data-deal="landed"`), none stays hidden. C: the flying
    copies vanish at once and every card shows in its slot.
- [ UNIT ] **167. Rules:** `dealOrigin` flags the table pile (`table: true`) and not the page deck; from the table a clean,
  `inert`, `aria-hidden` copy on `<body>` on the slot's box with `--card-w`, face down or up on the copy, the real card
  hidden with `data-deal-copy`; inherited text styles copied; landing on the copy's own `animationend` (the card's own
  ignored), copy removed in the same frame; the safety timer; unmount; a hold (page turn, book change) mid-flight; keyboard
  focus landing a card at once; phones: the card itself flies, no copy (`DealtList`: 8 new cases, 2 rewritten).

#### Regressions (third round)

- [ DONE ] **168. Things that must not change**
  - Test: one tour at 1440×900, 1024×768 and 390×844: deal lists, play cards, change books, hover the piles and the tabs.
  - Expected: a play still flies to the face-up pile above everything (items 117–119; `.flying-card` z-index 2000 over the
    deal copies); the drawn tooltips over the copies; the "match changed on another device" banner and the navbar usable
    (a copy may pass over them); the pile places and centring of items 112–115 apart from the deck's new height; the book
    change of items 128–132 apart from the deck; phone shuffle and page deck as items 134–142; no horizontal scroll bar.

### Fourth round (§9 "Fourth round", to-dos 16–18, November 27, 1.15.0)

Defaults (deal on, face down, deck `under`, cover on, `full`, ¼×, max 10 s) unless the item changes one. Start the tab
items on the tablet 1024×768 (the owner's case). Older items this round changes (their text is kept; the new items win):
- Pile order and places (item 82 "the deck pile just above the house tab"; item 112: face-up pile bottom 42px, deck about
  204px / 273px; item 114: tablet "the deck above the face-up pile", deck about 259px; items 115 and 152 A: outside a match
  the deck "at the same height as in a match" with an empty space under it; item 116 "under the deck a single face-up
  card"; item 145 "the face-up pile appears under the deck"; items 149–152: the deck lowered onto the pile, deck bottom
  218px / about 165px / about 214px, `--pile-gap: -34px`): the deck now lies at the foot on every page, the Home too (42px
  over 1120px wide, 70px on tablets) and never moves; in a match the face-up pile lies right above it, `--pile-gap: -44px`
  (items 169–175). The centring of items 112–114 is unchanged.
- Tabs during a book change and the first-load opening (item 52 "the house tab fades in"; item 64: the opening; items 68
  and 72: `simple`; items 70, 71 and 93: on phones the cover closes over the tabs; item 93: desktop tabs fade out before
  the fold): every mode now fades the tabs out on the still book first, shows no tab on any copy while the book closes,
  moves or opens, and fades the live tabs in only once the book is open and still (items 176–185). Desktop `full` already
  faded the side column: its look and its time stay.
- Timings (section 0; item 66: phone "9.8 s"; item 67: phone 2.4 s, simple 0.9 s, opening 0.65 s; item 129: phone `0`
  "about 12.3 s"; item 130: phone "about 3.08 s"; item 131: the phone phases; items 132–133: simple 3.64 s / 0.91 s; item
  64: the opening 2.6 s): phone 13.92 s capped to 10 s (3.48 s at 1×), `simple` 5.24 s (1.31 s at 1×), the opening plus
  the tab fade 3.4 s (0.85 s at 1×); desktop `full` unchanged (item 182). The book stays busy until its tabs are back, so
  the first deal and a waiting route start one fade later.
- Scroll during a deal (item 162: the copies fly "to where their slots were when they left ... a small jump (accepted)"):
  the copy now follows its slot and lands exactly on it, no jump (items 187–191).

#### Piles inverted: the deck at the foot, the played pile on it (to-do 16)

Done (CSS only, `animations.css`): `.deck-pile { bottom: var(--pile-foot) }` on every page; `.played-pile { bottom:
calc(var(--pile-foot) + (var(--pile-h) + var(--pile-gap)) * var(--pile-scale)) }` with `--pile-gap: -44px` (was −34px with
the deck above); `--pile-foot` = `--home-bottom` (42px) over 1120px wide, 70px on tablets. Same centre and scale as before,
both z-index −1. The play's target (`flightTarget`) and the deal's origin (`dealOrigin`, `.deck-pile__top`) measure the live
boxes: no code change. No unit test (CSS): judge by eye. Select `.deck-pile` and `.played-pile` (children of `.book-shell`)
to read their boxes; the distances below are from the cover's bottom. A played card is 126px tall in the middle of its
210px box, and the face-up pile is drawn after the deck: where they meet, the played cards lie over the deck's top backs.

- [ DONE ] **169. Desktop 1440×900, a match** (scale 1, each pile 160 × 210px)
  - Test: a match with two or three played cards; look at the table right of the book; hover the face-up pile; in
    Elements read both boxes.
  - Expected: the deck (face-down backs) at the foot, its box bottom 42px above the cover's bottom (level with the foot of
    the side tab column); the face-up pile right above it, same centre, its box bottom 208px above the cover's bottom (the
    boxes overlap by 44px). The played cards' lower edges rest on the deck's top backs: no strip of table between them,
    the played cards over the topmost backs by a few pixels only (about 10–15px at most, tilted corners included); the deck
    covers nothing of the played cards, their title bars (item 153) fully readable. The hover shows "Last played: title"
    / "Ultima giocata: title" (the deck takes no pointer). Both piles under the game tabs where they meet, never over
    them.
- [ DONE ] **170. Desktop 1366×768** (short desktop, scale 0.7: each pile about 112 × 147px)
  - Test: as item 169.
  - Expected: the same contact at a smaller size: deck box bottom 42px, face-up pile box bottom about 158px (overlap about
    31px); both piles' left part under the game tabs as before, never over them.
- [ DONE ] **171. Tablet 1024×768** (scale 0.82: each pile about 131 × 172px, mostly under the cover)
  - Test: as item 169; look at the visible strip beside the book.
  - Expected: deck box bottom 70px above the cover's bottom (where the face-up pile used to be), face-up pile box bottom
    about 206px (overlap about 36px); in the strip the played cards sit right on the deck's backs, no gap; the top tabs are
    never covered.
- [ DONE ] **172. The deck on every page, the Home too** (1440×900, 1366×768, 1024×768)
  - Test: look at the deck on the Home, `/player`, `/story/<id>`, `/start-match/<id>`, a policy chapter and the end pages;
    switch Home ↔ `/player`; then on the Home press a running match's "Resume" / "Riprendi"; leave it with the navbar brand
    "Paths Games" → "Exit to Home" / "Torna alla Home".
  - Expected: the deck at the foot on every page (box bottom 42px, 42px, 70px), in exactly the same place, never moving
    between pages, during a turn or during a book change (item 144, now at the foot); no empty room under it any more (the
    room is above it, where the face-up pile comes). Entering the match: the face-up pile appears above the deck with the
    opened game book, the deck does not move. Leaving: the face-up pile goes at once, the deck stays.
- [ DONE ] **173. The deal still leaves the deck; a play still lands on the pile** (1440×900 and 1024×768, ¼×)
  - Test: reload `/` and watch the catalog being dealt; open `/story/<id>`; in a match press "Move" / "Muovi" on a
    movement's reading page (or play any card); hover the pile afterwards.
  - Expected: every dealt card (its copy, item 156) starts at the deck's top card at the foot, right of the book (tablet:
    in the strip beside the cover), never from the old, higher place; the played card flies to the face-up pile above the
    deck, lands on top of it (tilted, lit, item 117) and stays; the tip now names it. Nothing lands on the deck.
- [ DONE ] **174. `VITE_ANIM_DECK=over`** (restart; or Preferences "Deck" / "Mazzo" → "Over the book" / "Sopra il libro";
  1440×900 and 1024×768)
  - Test: the Home, then a match with played cards; let a list be dealt.
  - Expected: only the deck lifts over the cover (z-index 2), at the same place at the foot (on the tablet it lies on the
    cover's lower right part); the face-up pile stays under the cover, above the deck; where they meet the deck's top backs
    now lie over the played cards' lower edges (the reverse of the default), the title bars still free: report if that
    overlap looks wrong. The deals start from the deck on the cover (item 160).
- [ DONE ] **175. Phones unchanged** (390×844 and 844×390)
  - Expected: no table piles (`.deck-pile` and `.played-pile` not displayed); the sticky page deck at the bottom right of
    the page and the play flying into it, as before.

#### Bookmarks only on an open book (to-do 17)

Done (`bookSwap.js`, `RouteBook.jsx`, `animations.css`): `fadeTabs` fades each tab group (`.book-wrapper >
.book-bookmarks-row > .book-bookmarks`, the house tab's group included), never the row (`display: contents` on tablets:
its opacity did nothing). Every mode (`desktopFull`, `desktopSimple`, `phoneCover`, `phoneSimple`) runs: tabs out on the
still old book → `is-tabless` on the swap layer `div.book-swap` (desktop) or the phone slice `div.m-sheet`, so every later
copy (the flap's inner copy, the incoming book) has hidden tabs (`.is-tabless .book-bookmarks { opacity: 0 }`) → close,
move, open → the live book shown → its tabs fade in → `is-tabless` leaves `div.route-book`. RouteBook puts `is-tabless` on
`div.route-book` for the whole change and for the first-load opening (new `runOpening`: tabs hidden, the book opens, tabs
fade in). A change stopped early (unmount, the 15 s wait limit of item 76) shows the tabs at once. A book with no tabs (the
Home) skips its fade. Route turns of the same book and page turns are untouched. Tabs per page (items 87, 107–109): on
desktop only a match shows tabs (the five game tabs in the side column; the house tab is hidden but its group exists); on
tablets the game tabs on the top edge with the house tab at the right end, the story pages and `/player` the house tab
alone; phones the same in the top row; the Home has none.

Timings (`bookSwap.swapTimings`, the tab fades counted in the cap):

| Change | ¼× (default, max 10 s) | 1× |
|---|---|---|
| Desktop and tablet `full` | 16.16 s → 10 s: tab fade 0.5 s, fold 2.23 s, zoom 0.79 s, slide 1.49 s, each twice (unchanged) | 4.04 s (unchanged) |
| Phone cover | 13.92 s → 10 s (× 0.718): tab fade 0.57 s, cover 1.78 s, zoom 0.92 s, slide 1.72 s, each twice (was 12.32 s → 10 s) | 3.48 s (was 3.08 s) |
| `simple`, desktop and phone | 5.24 s: tab fade 0.8 s, close 1.04 s, open 2.6 s, tab fade 0.8 s (was 3.64 s) | 1.31 s (was 0.91 s) |
| First-load opening (never capped) | 3.4 s: opening 2.6 s, tab fade 0.8 s (was 2.6 s) | 0.85 s (was 0.65 s) |

- [ DONE ] **176. Tablet 1024×768, `full`: story set-up ↔ Home (the owner's case)**
  - Test: open `/story/<id>` (the house tab alone at the top right of the cover); press the house tab; then on the Home
    click the same story card. Keep `div.route-book` selected in Elements.
  - Expected: story → Home: on the still, open story book the house tab fades out (about 0.5 s); only then the right half
    folds; while it folds, shrinks and slides out, and while the Home book slides in, grows and opens, no tab shows
    anywhere: not above the cover's top edge, not on the flap, not on the left half (before: the tablet tabs stayed on
    screen while the book closed, slid and opened). Home → story: the Home book folds at once (it has no tab); the story
    book slides in, grows and opens with no tab on it; only once it is fully open and still does the house tab fade in at
    the top right (about 0.5 s), then the loadout is dealt. `div.route-book` has `is-tabless` from the click until that
    fade ends; `div.book-swap` gets `is-tabless` right after the fade-out (at once when the old book has no tab).
- [ DONE ] **177. Tablet 1024×768: Home ↔ a match**
  - Test: on the Home press a running match's "Resume" / "Riprendi"; in the match press the house tab → the close card →
    "Exit to Home" / "Torna alla Home".
  - Expected: into the match: no tab on the incoming game book while it slides, grows and opens; once it is open the game
    tabs over the left page and the house tab at the right end fade in together (about 0.5 s), then the board's cards are
    dealt. Leaving: all the top tabs fade out together on the still board first, then the fold; no tab on any copy. In
    both directions no tab is ever seen moving with a copy.
- [ DONE ] **178. Desktop 1440×900, `full`: the side column**
  - Test: Home → "Resume" / "Riprendi"; in the match the navbar brand "Paths Games" → "Exit to Home" / "Torna alla Home";
    `/story/<id>` → Home with the brand; `/story/<id>` ↔ `/player`.
  - Expected: match → Home: the five game tabs fade out on the still, open board (about 0.5 s), then the fold; no tab on the
    flap or on the shrinking and sliding copies. Home → match: the game book slides in, grows and opens with an empty side
    column; once it is open the five tabs fade in (about 0.5 s), then the cards are dealt. Story pages and `/player` (no
    visible tab on desktop): a still pause of about 0.5 s before the fold and after the open (the hidden house tab's group
    fades), as before. The deck at the foot stays still throughout (item 144).
- [ DONE ] **179. Phone cover** (390×844, then 844×390)
  - Test: on `/story/<id>` press the house tab (top right); on the Home press "Resume" / "Riprendi"; in the match the house
    tab → "Exit to Home" / "Torna alla Home". Keep the new `body > div.m-sheet` selected in Elements when it appears.
  - Expected: the screen freezes with its tabs; the tabs (the house tab; in a match the six tabs of the row) fade out first
    (about 0.57 s) and `div.m-sheet` gets `is-tabless`; only then the leather cover swings in over the slice, with no tab
    visible above or beside it; it shrinks, slides out, comes back with the new title, grows and swings open on the new
    book with no tab; then the new book's tabs (the house tab on the story page, the six in a match, none on the Home) fade
    in at the top (about 0.57 s). `<html class="is-turning">` and `div.m-blocker` stay until the tabs are back (the page
    does not scroll until then), then they go.
- [ DONE ] **180. `simple` mode** (`VITE_ANIM_TURN_MODE=simple`, restart; or "Turn style" / "Stile del giro" → "Simple" /
  "Semplice"; 1024×768, 1440×900 and 390×844)
  - Test: `/story/<id>` → Home with the house tab (desktop: the brand); Home → "Resume" / "Riprendi"; match → Home.
  - Expected: the old book's tabs fade out first while it stays still (about 0.8 s), then the book fades, tilts and shrinks
    (about 1 s) with no tab; the new book opens with the zoom (2.6 s) with no tab; then its tabs fade in (0.8 s). On phones
    the page jumps to the top before the new book opens. The tablet's top tabs never stay on screen during the close or the
    open (before: they did). About 5.2 s when both books have tabs (before 3.6 s).
- [ DONE ] **181. First load** (1440×900, 1024×768 and 390×844, ¼×)
  - Test: on a running match reload `/play/<id>`; reload `/story/<id>`; reload `/`. Keep `div.route-book` selected.
  - Expected: the book rises from tilted, smaller and transparent into place (2.6 s) with no tab on it (before: the tabs
    rose with it), `div.route-book` has `is-tabless`; once it is in place its tabs fade in (0.8 s): desktop the five game
    tabs in the side column, tablet the top tabs and the house tab, phone the top row; then `is-tabless` goes and the cards
    are dealt (about 3.4 s after the start, 0.8 s later than before). `/`: no tab, the deal starts when the opening ends.
    On `/play/<id>` the board may replace the loading page during the opening (item 77): its tabs stay hidden and fade in
    once, at the end.
- [ DONE ] **182. Timings at ¼× and 1×** (stopwatch, or the life of `is-tabless` on `div.route-book`)
  - Test: `/story/<id>` ↔ `/player` (both books have a tab group) on 1024×768, 1440×900 and 390×844, in `full` and
    `simple`, at ¼× and at 1× (Preferences "Speed" / "Velocità" 1×, or `VITE_ANIM_SPEED=1`); a reload of `/story/<id>` at
    both speeds; on the phone also `VITE_ANIM_COVER_MAX_S=0` and `=5` (restart each time).
  - Expected: as the table above: `full` 10 s / 4.04 s on desktop and tablet; phone cover 10 s / 3.48 s; `simple` 5.24 s /
    1.31 s; first load 3.4 s / 0.85 s. Phone `0`: about 13.9 s (no cap). `=5`: 5 s for the phone cover and for `simple`
    too (5.24 s capped, every phase × 0.95). A change to or from the Home (no tabs) is one fade shorter (about 9.5 s at ¼×
    in `full`).
- [ DONE ] **183. Reduced motion and cover off: the tabs at once**
  - Test: A: reduced motion on (DevTools Rendering); at 1024×768 reload `/play/<id>`, then `/story/<id>` → Home. B: cover
    off (`VITE_ANIM_COVER=false`, restart; or Preferences "Book cover" / "Copertina" → "Off" / "Spento"); the same at
    1440×900 and 390×844.
  - Expected: no opening and no book change: the new book appears with its tabs already shown, no fade; `div.route-book`
    never gets `is-tabless`; the cards are dealt at once (A: shown at once, no flight).
- [ DONE ] **184. Route turns and page turns: tabs untouched** (1024×768 and 1440×900, ¼×)
  - Test: Home ↔ `/player` (a turn of the Home book); `/story/<id>` → "Start Game" / "Inizia Gioco" → start match → the
    game (same story book: turns); in a match click "Backpack" / "Zaino" and "Missions" / "Missioni", play a card.
  - Expected: the tabs stay fully visible during every turn (no fade out or in); `div.route-book` never gets `is-tabless`;
    on start match → game the game tabs come with the new page as before, with no fade.
- [ DONE ] **185. Navigating during a change** (1024×768 and 390×844, ¼×)
  - Test: A: on `/story/<id>` press the house tab; during the change press the browser Back. B: on the Home click a story
    card; during the change press the navbar brand "Paths Games".
  - Expected: the running change ends normally (item 75): the new book opens and its tabs fade in fully; only then the
    waiting route starts its own change, and those tabs fade out again on the still book before it closes (a short moment
    with tabs between the two changes, by design: the book is open and still there); no tab on any copy in either change.
    A ends on the story page with the house tab faded in once; B on the Home, no tab. `is-tabless` leaves `div.route-book`
    only for that moment between the changes and at the end.
- [ UNIT ] **186. Rules:** the tab groups faded, never the row; the swap layer (desktop) or the phone slice marked
  `is-tabless` after the fade-out, so the flap's copy and the incoming copy carry hidden tabs (the real `animations.css`
  loaded); phase order tabs → close → zoom out → slide → slide → zoom in → open → tabs; `simple` on both layouts: tabs out,
  close, open, tabs in; `is-tabless` on `div.route-book` during a change and the first-load opening, gone after the fade-in,
  per mode and layout; `runOpening` (hidden, opens, fades in; stopped while opening or fading → tabs at once; no tabs → no
  fade); cover off, reduced motion and route turns: no class; an unmount during a change shows the tabs; `swapTimings`
  with the tab fades in every mode (`bookSwap`, `RouteBook` tests).

#### The dealt copy follows its slot while the page scrolls (to-do 18)

Done (`useDeal.js`): while at least one copy flies (desktop and tablet, the table deck), one `requestAnimationFrame` loop
for the list and a passive capture `scroll` listener on `window` (it hears the scroll of any inner list) set each copy's
`left`, `top`, `width`, `height` and `--card-w` to its slot's current box. The keyframes are relative (`--from-x` /
`--from-y` measured once at the start), so the path bends with the scroll and ends on the slot; the start point moves
with the slot too (accepted by the step file). The loop and the listener stop at the last landing, on a hold (page turn,
book change), on unmount and on clean-up; phones (the page deck: the card itself flies inside the page) start none. At ¼×
a card flies 2.48 s, 0.44 s after the previous one: scroll steadily with the wheel while cards are in flight.

- [ DONE ] **187. Desktop 1440×900, ¼×: scroll the catalog while it is dealt**
  - Test: reload `/`; when the first cards leave the deck, roll the mouse wheel down over the catalog steadily, so the
    list keeps moving while cards fly and new rows enter and are dealt; later roll up during a deal. In Elements select a
    `body > .deal-copy` while it flies.
  - Expected: each copy leaves the deck and its path bends with the scroll (it drifts up as the list moves up); it ends
    exactly on its slot wherever the slot is at that moment; when the copy goes the real card is in the very same place:
    no jump up or down (before: a jump as large as the scroll, item 162), no blink. The selected copy's inline `top`
    changes while you scroll. The list scrolls normally (a copy never catches the wheel). After the last landing the
    Console count is 0.
- [ DONE ] **188. Every scrolling list** (1440×900, ¼×)
  - Test: as item 187 on the loadout of `/story/<id>` and a config page; `/start-match/<id>`; `/player` (the matches list);
    the game board's "Backpack" / "Zaino" and "Missions" / "Missioni"; the "Credits" / "Crediti" chapter. Once drag the
    scroll bar instead of the wheel.
  - Expected: as item 187 in each: every copy lands exactly on its card, in both scroll directions; no jump at landing.
- [ DONE ] **189. Tablet 1024×768, ¼×**
  - Test: as items 187 and 188 on the Home and the loadout, with the wheel and with touch emulation (drag the list).
  - Expected: the copies start at the deck's top card in the strip beside the cover, bend with the scroll and land
    exactly; no jump; Console count 0 at the end.
- [ DONE ] **190. A slot scrolled out of its list** (1440×900 and 1024×768, ¼×)
  - Test: while a row of copies flies, scroll fast so their slots leave the list's visible area (up past its top edge, or
    down past its bottom edge); then scroll back.
  - Expected: each copy keeps following its slot also outside the list (it is not clipped: it may pass over the page
    margin, the side tabs or the navbar), lands there and vanishes; the real card is out of view (cut by the list as any
    card); scrolling back shows it in place with `data-deal="landed"`. No copy stays on screen, Console count 0 (accepted by
    the step file).
- [ DONE ] **191. A page turn, a book change or leaving while copies follow a scroll** (1440×900, ¼×)
  - Test: while copies fly and you scroll: A: on the game board click a game tab; B: on the Home click a story card; C: in
    a match the navbar brand → "Exit to Home" / "Torna alla Home". Then, once all is still, scroll the lists again.
  - Expected: as item 163: no copy left on screen when the turn or the change starts; later scrolls move only the page
    (no copy appears); the next deals follow their slots again.
- [ DONE ] **192. Phones unchanged** (390×844 and 844×390)
  - Test: the Home, `/story/<id>`, a game board; scroll while cards are dealt.
  - Expected: as item 165: the cards fly inside the page from the sticky page deck (step 16), no `.deal-copy` (Console
    count 0), no `data-deal-copy`; the page deck is read again at each batch as before.
- [ UNIT ] **193. Rules:** a slot moved mid-flight: the copy's box follows it on the next frame and on a `scroll` event; the
  loop and the listener stopped after the last landing, on unmount and on a hold, started again by a new flight; phones
  (the page deck): no loop, no listener (`DealtList`: 3 new cases).

#### Regressions (fourth round)

- [ DONE ] **194. Things that must not change**
  - Test: one tour at 1440×900, 1024×768 and 390×844: deal lists, play cards, change books, reload, hover the tabs and the
    face-up pile.
  - Expected: once a book is open its tabs look, sit and answer as items 82–92 and 107–110 (red and gold tabs, item 92,
    also right after a fade-in; their tooltips); the deck still on the table during a change (items 144–147, now at the
    foot); the play's flight above everything (items 117–119); the deal copies from the table deck (items 156–161); the
    title bars on the played cards (items 153–154); page turns, holds and fades (items 14–20, 49–51); the phone shuffle
    (items 134–142); no horizontal scroll bar; no `.deal-copy`, `div.book-swap` or `div.m-sheet` left after any action.

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
- **1.15.0 second round, to-dos 5–11 (November 27, one dev run, read by the tester against the code):**
  - Step file §9 to-do 11 and the concept README §5 give the phone book change as 3.04 s at 1× and 12.2 s at ¼×; the code
    and its tests give 3.08 s and 12.32 s (2 × (620 + 320 + 600) ms): the docs' sum is off, the code follows their formula.
    Desktop 4.04 s and 16.16 s (docs "16.2 s") agree.
  - The concept's pile tooltip reads "Last played: title (N cards played)"; the code (and the step file) show only "Last
    played: title" / "Ultima giocata: title"; before the first play the tip is the story's title alone (no prefix).
  - The concept starts the phone tab row 34px from the left; the code uses 30px (26px under 360px); 1.15.0's first round
    used 42px to clear the cover's top-left gold corner (item 110 asks to look).
  - `VITE_ANIM_DECK=over` lifts only the deck; the face-up pile has no `over` place and stays under the cover (item 124).
  - Landed cards are remembered also when no pile shows (deal off, phones): turning the deal on, or widening a phone window
    to desktop, shows them (item 125).
  - `--table-mid` uses `100vw`, so with a classic scrollbar the piles sit a quarter of its width (2–4px) right of the exact
    middle; the step file's optional `ResizeObserver` fallback was not added.
  - The Map's first render and a reload on a new location skip the clamp (the location exactly at the centre); ◎ and the
    zoom use a clamp widened so any location can sit at the centre.
  - Not seen in a browser by the developer: the pile places and flight, the single sheet, the phone tab row, the shuffle,
    the zoom and overshoot, the map during a turn.
- **1.15.0 third round, to-dos 12–15 (November 27, one dev run, read by the tester against the code):**
  - The step file's §9 "Third round" heading said "(analysed, to develop)"; it has since been marked developed.
  - The copies' z-index 1600 puts them above the navbar (1000), the "match changed on another device" banner (1010) and the
    book change layer (990); the step file asked "above the book and the tabs, under the navbar's drawn tooltip and
    `.flying-card`" (both kept) and did not name the navbar (items 158, 168).
  - Card styles that depend on a parent: the step file proposed a wrapper with the same classes or moving the rules; the
    code copies eight inherited text properties inline (colour, font family, size, style and weight, line height, letter
    spacing, text alignment) and adds `.deal-copy` to the two desktop `book.css` rules (`.hide-in-book`, the status card's
    button labels). CSS variables set on a parent and `.book-stage.is-busy` do not reach the copy; the tester found no other
    desktop card rule scoped by a list or book class (the grid margins are zeroed on the copy). Items 156–157 check it by eye.
  - Not in the step file: the copy is never clipped, so a card dealt while only a fifth of it is inside its scrolling list
    flies whole and loses its outer part at landing (item 158).
  - Not verified: a page turn copies the old page before the new one comes; cards still in flight are invisible there
    (`data-deal-copy`) and may show as empty places on the turning sheet (item 163).
  - With `VITE_ANIM_DECK=over` the lowered deck (z-index 2) lies over the face-up pile where the two meet (item 152).
  - Tested again by the tester: the three changed suites (78 passed) and the full run with coverage (same numbers as the
    developer). Not seen in a browser: the deck during the change, the contact of the piles, the title bars, the flights.
- **1.15.0 fourth round, to-dos 16–18 (November 27, one dev run, read by the tester against the code):**
  - Deviation (developer): to-do 17 asked only for a tab fade-in after the open in the modes other than desktop `full`;
    the code also fades the tabs out before the close in `desktopSimple`, `phoneCover` and `phoneSimple`, inside the cap.
    At 1×: desktop `full` 4.04 s (unchanged), phone cover 3.08 → 3.48 s, `simple` 0.91 → 1.31 s, the first-load opening
    +0.2 s (+0.8 s at ¼×). At ¼× the phone change is 13.92 s, capped to 10 s; the rounded phases (575 + 1782 + 920 + 1724
    ms, twice) make it up to 4 ms over.
  - The book stays busy until its tabs are back: the first deal after a reload or a change, and a route waiting for the
    book (item 75), start one fade later; the redirect wait noted above ("up to 2.6 s at ¼×", item 62) is now up to 3.4 s.
  - A book with no tab group (the Home) skips its fade, so a change to or from the Home is one fade shorter than the
    total `swapTimings` plans (about 9.5 s instead of 10 s at ¼× in `full`). On desktop the story pages and `/player` keep
    the hidden house tab's group, so an invisible fade (about 0.5 s, 0.8 s in `simple`) still runs before their close and
    after their open (item 178).
  - With `VITE_ANIM_COVER_MAX_S=5` the `simple` change (5.24 s at ¼×) is now capped too; before it stayed under 5 s.
  - `phoneSimple` with no slice to copy (the book off screen) skips the fade-out.
  - To-do 16: the piles' places are CSS only and no test asserts them; "cards just touching" is the concept's −44px,
    judged by eye (items 169–171). With `VITE_ANIM_DECK=over` the deck's top backs lie over the played cards' lower edges
    (item 174).
  - To-do 18: `--from-x` / `--from-y` are measured once, so the flight's start point moves with the slot (accepted by the
    step file); a copy whose slot leaves the list keeps following it and is not clipped (item 190).
  - The step file's §9 "Fourth round" heading still says "(analysed, to develop)" (for `/doc-update`).
  - Tested again by the tester: the full run with coverage (same counts as the developer). Not seen in a browser by the
    developer: the new pile places, the tab fades on any layout, the copies following a scroll.
- Known noise: the "chunks larger than 500 kB" build warning; StrictMode doubles dev-mode requests.
- Not seen in a browser by the developer: the turn geometry (full, simple, fade), the flight arc, the hold timing, the book
  change (fold, slide, cover text, phone cover), the side column, the pile positions, the tab look and the phone tabs.

---

# Version Control
- **Document Version**: 1.15.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.14.0 | Test list for card play, page turns and phone book | November 25, 2026 |
  | 1.15.0 | Book change, bookmarks, fades, played pile, deal; tested and closed | November 27, 2026 |

- **Last Updated**: November 27, 2026 (v1.15.0)
