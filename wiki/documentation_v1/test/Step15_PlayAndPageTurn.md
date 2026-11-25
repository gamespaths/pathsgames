# Step 15 — Play and page turn: test list

**Status: to test (November 25, 2026), version 1.14.0.** Step file: [Step15_PlayAndPageTurn.md](../Step15_PlayAndPageTurn.md);
also step 16 part A, the one-tree mobile switch ([Step16_MobileBookAndPreferences.md](../Step16_MobileBookAndPreferences.md) §6.3),
built first in the same run because the book chain's development order asks for it.
Developed in react-game only. Java, Python, AWS, react-admin, OpenAPI, Robot suites, env files and i18n keys are unchanged.
Unit tests and build are green (run again by the tester); every manual check below is still to do (the developer did not
open a browser). Step 14 is in the same working tree and is still being tested: its list stays
[Step14_HomeBookAndCardFaces.md](./Step14_HomeBookAndCardFaces.md).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` covered by unit tests ·
`[ ROBOT ]` covered by Robot suites · `[ NOT TESTABLE ]` with the reason.
For each point: **Done** = what changed, **Test** = what to try, **Expected** = the expected result.

---

## 0. Before starting

- **Environment variables:** none new. Step 15 reads four of step 14's keys. On November 25 `.env`, `.env.test` and
  `.env.alpha` still have no `VITE_ANIM_*` key (0 each), so the code defaults below apply. To try the switches, add the key to
  react-game `.env` and restart `npm run dev` (Vite reads `.env` only at start). The agent never edits `.env*`.

  | Variable | Where | Who reads it | Value | When needed |
  |---|---|---|---|---|
  | `VITE_ANIM_PLAY` | react-game `.env`, `.env.test`, `.env.alpha`; GitHub `alpha` | `src/constants/animations.js` → `PlayContext` | `true` (default) | items 25, 27 |
  | `VITE_ANIM_TURN` | same | same → `BookPages`, `useGameplayResults`, `FadeIn` | `true` (default) | items 24, 27 |
  | `VITE_ANIM_TURN_MODE` | same | same → `pageTurn.pickStrategy` | `full` (default) or `simple`; any other value is `full` | items 22, 23 |
  | `VITE_ANIM_SPEED` | same | same; clamped to 0.1–4, invalid → 0.25 | `0.25` (default) | item 26 |

  `fade` is not a turn mode: it is the transition of previews, news chain arrows and the error page, always on while
  `VITE_ANIM_TURN` is on. The seven step 14 keys must still reach `.env`, `.env.test`, `.env.alpha` and GitHub `alpha`
  (step 14, item 3) before the next alpha deploy.
- **Turnstile (items 30, 37, 41):** `VITE_CF_TURNSTILE_KEY=1x00000000000000000000AA` (Cloudflare test key, from `.env.example`)
  in react-game `.env`, and delete the `pathsgames.turnstilePass` cookie before reloading.
- **Servers** (start them yourself):
  - a backend on 8042: `cd code/backend/java && mvn -pl ms-launcher spring-boot:run`
    or `source .venv/bin/activate && cd code/backend/python && python3 -m app.launcher`;
  - react-game: `cd code/frontend/react-game && npm run dev` → http://localhost:5174.
- **Game data:** a running match where you can move, do an action and use or drop an item; for choices, training, the end game
  and missions use a story that offers them. Two browser tabs on the same match for item 13 B.
- **Timings at the default speed 0.25:** lift 0.96 s, flight 2.24 s, fall 1.28 s (0.2 s between cards), full flip 3.6 s,
  simple swing 2.08 s, fade 0.8 s. A local API answers in a few ms: use DevTools Network → "Slow 3G" to watch the lift.
- **Test hooks:** the `.book-wrapper` carries `data-direction` (`forward`, `back`, `fade`; absent for no turn) and `data-page-key`
  of the last page change; `.book-stage` gets `is-busy` while a card is played.
- **Devices:** desktop 1440×900 and 800×1000 (a portrait tablet keeps the desktop book); DevTools responsive 390×844,
  600×900 and sideways 844×390 (or a real phone). Reduced motion: DevTools → Rendering → "Emulate CSS media feature
  prefers-reduced-motion: reduce", or the OS setting. Dev mode runs React StrictMode (effects twice): count DOM nodes, not
  network requests, when checking "rendered once".
- **Git:** nothing staged, nothing committed. Step 15 and 16 A are unstaged changes mixed with step 14's, plus untracked new
  files: `components/book/pageTurn.js`, `components/book/BookPages.jsx`, `features/gameplay/play/PlayContext.jsx`,
  `features/gameplay/js/bookTurns.js`, `components/layout/FadeIn.jsx`, `hooks/useBookTurn.js`, `test/fixtures/waapi.js` and
  eight test files. Deleted: `CardPreviewModal.jsx`, `GameBookMobile.jsx`, `StartBookMobile.jsx` and their two test files.
  The pom.xml, package.json, `Footer.jsx`, `FooterBar.jsx`, `template.yaml`, echo handler, `application.yml`, `config.py`,
  `pyproject.toml` and root `.env.example` changes are the owner's 1.14.0 version bump.

---

## 1. Steps, in order

- [ UNIT ] **1. Unit tests** (green, run again only after a change)
  - `cd code/frontend/react-game && npx vitest run --coverage`
  - Result on November 25 (run again by the tester, same numbers as the dev report): 185 files, 2063 passed, 0 failed,
    3 skipped (before: 179 files, 1961 passed). Coverage overall: statements 99.07%, branches 95.29%, functions 99.47%,
    lines 99.64%. The six new modules: 289/289 lines, 228/230 branches (two in `BookPages.jsx`), 84/84 functions; with the
    changed files (dev report) 492/492 lines, 393/404 branches (97.28%). After the review fixes (§3): 185 files, 2067
    passed, 0 failed, 3 skipped; 501/501 lines, 405/416 branches (97.36%).
  - New suites: `pageTurn` (17), `BookPages` (14), `PlayContext` (15), `bookTurns` (16), `FadeIn` (5, with `useBookTurn`),
    `CardPlay` (8), `useGameplayResultsPlay` (12), `GameBookTurns` (10); WAAPI stubbed by `src/test/fixtures/waapi.js`.
    `GameBookMobile` and `StartBookMobile` tests deleted, `PlayerBookMobile` rewritten for the one tree.
- [ UNIT ] **2. Build:** `npx vite build` passes (only the "chunks larger than 500 kB" warning, as before).
- [ ] **3. Robot regression** (optional: no suite written or changed, every suite is API-only and no endpoint changed)
  - `code/scripts/dev/run_robots/run_robot_with_local_java.sh`
  - `code/scripts/dev/run_robots/run_robot_with_local_python.sh`
  - Expected: all green as in 1.13.0.
- [ ] **4. Manual tests** of section 2: desktop, phone portrait and sideways, both languages.
- [ ] **5. Alpha deploy** (when you release): nothing new for step 15; step 14's seven variables must be set.
- [ ] **6. Documentation:** `/doc-update`. To update: react-game `README.md` (the `modals/` line still names
  `CardPreviewModal`; `start-book/` and `gameplay/` lines name `StartBookMobile` and `GameBookMobile`; the Story page paragraph
  says "`StartBookMobile` vertical list (mobile)"; the (i) paragraph says mobile opens `CardPreviewModal`; new modules
  `PlayContext`, `BookPages`, `pageTurn`, `FadeIn`, `useBookTurn`, `bookTurns`).

---

## 2. Manual tests

Desktop items run at 1440×900 with the defaults (play on, turn on, `full`, speed 0.25) unless the item changes one.

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
- [ ] **4. Action**
  - Test: press the (i) of an action card ("Do" / "Agisci") → on its reading page press "Do" / "Agisci".
  - Expected: as item 2 (the picture lifts, then the whole card flies; no card dims); after the forward turn the right page shows the effect.
- [ ] **5. Choice "Do" on the small card: the others dim and fall**
  - Test: do an action that offers choices; on the list press "Do" / "Scegli" on one option (Slow 3G to watch the lift).
    Then, on a new list, open an option's (i) and press "Do" on its reading page.
  - Expected: the option rises (about 14px) and grows (8%), bright gold border, pulsing glow and a light band sweeping across
    its face; every other small card of the book dims (grey, 40% opacity, a little lower and smaller). The lifted card is
    whole, also in the first row (its top not cut by the list's edge). On the answer the others fall one after the other
    (about 0.2 s apart; from the ninth on together), each with a small random tilt, and vanish; the option flies to the left
    picture; then ONE forward turn. From the reading page: the whole reading card flies (its place stays empty until the turn), nothing dims or falls.
- [ ] **6. Sleep**
  - Test: open the sleep card's page (on the board when energy is low, or on the "Information" page) → "Sleep" / "Dormi".
    Repeat with a sleep that advances time and changes the weather.
  - Expected: the whole card flies, then ONE forward turn. With a weather change the weather card is on the new right page,
    (it lands inside the one turn); the flip never jumps to its end half-way (see §3, review fixes).
- [ ] **7. Item use: ONE back turn**
  - Test: "Backpack" tab → (i) of a usable item → "Use" / "Usa".
  - Expected: the whole card flies to the left picture; then ONE back turn (the left page lifts on the spine and swings to the
    right: the bag closes); the right page shows the item's effect. `data-direction="back"`.
- [ ] **8. Training: dim, fall, ONE back turn**
  - Test: board → the experience card ("Train" / "Allenati") → on the training page press "Improve" / "Migliora" on a stat.
  - Expected: as item 5 (the stat card lifts, the others dim, then fall, the card flies), then ONE back turn; the right page
    shows "Trained" / "Allenato".
- [ ] **9. Drop: no play, no turn**
  - Test: "Backpack" → (i) of an item → "Drop" / "Getta".
  - Expected: nothing lifts or flies; the right page shows the loading page, then the bag again, with no turn and no fade
    (no `data-direction` on `.book-wrapper`).
- [ ] **10. End game in the same book**
  - Done: the end pages moved into GameBook's own Book (`useEndGamePages`): entering them is a turn, not a second book.
  - Test: at an end-game location press the small card "End Game" / "Termina Partita" (flag icon) → on its page "End Game".
    With missions: open a mission, a step (i), its back arrow, the mission's back arrow, the missions card's back arrow.
    Then the house tab, or "Close" / "Chiudi".
  - Expected: the whole card flies, then ONE forward turn to the end pages; the book does not close and open again. With
    missions: missions card left, grid right; a mission turns forward, a step (i) fades, every back arrow turns back; the
    missions card's arrow turns back to the ending (story card left, end card right with "Close" / "Chiudi"). Without
    missions: straight to the ending. The game tabs are gone; the house tab goes straight to the Home (no close card);
    "Close" loads the Home.
- [ UNIT ] **11. Buttons that never play:** the (i), "Drop", the status card shortcuts and every secondary action; no play id or
  no provider = 1.13.0 buttons (`CardPlay` tests). A reading page without a picture lands with no flight; leaving the page
  mid-flight removes the flying copy (`PlayContext` tests).
- [ ] **12. The book is busy while a card plays**
  - Test: Slow 3G; while a card is lifted hover other cards, then click another card's button, a page arrow, a game tab and
    the house tab; then click the navbar user button.
  - Expected: no hover lift and no reaction inside the book, tabs and house tab included (the Book's root has `inert` and
    `aria-busy="true"`, `.book-stage` has `is-busy`, until the flight ends); keyboard Enter on a focused button inside the
    book does nothing either; the navbar still works.
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
    Map, Missions.
  - Test: on the board click "Information", "Backpack", "Map", "Missions" ("Informazioni", "Zaino", "Mappa", "Missioni"),
    then "Map" again, then "Position" / "Posizione"; click the tab you are on.
  - Expected: a tab to the right of the current one turns forward (right page over to the left); one to the left turns back
    (left page over to the right); "Position" turns back to the board. The current tab: no turn ("Information" redraws its
    page with a short fade).
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
  - Test: Network "Slow 3G"; move.
  - Expected: after the flight the pages are held about 1 s; then ONE forward turn to the loading page ("Loading…" /
    "Caricamento…" with the story picture); the new board then appears with no second turn.
- [ ] **19. Clicks during a turn and a hold**
  - Test: click a tab and, while the sheet turns, click cards and arrows on both pages; then click another tab mid-turn.
    Repeat during a fade and during the hold of item 18.
  - Expected: clicks on the pages do nothing while a turning sheet, a fading copy or a held copy is up, and no drawn tooltip
    shows over it. The tabs and the house tab are busy too until the turn or hold ends (the whole Book is `inert`); a tab
    clicked right after works normally. The navbar works throughout.
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
  - Test: `VITE_ANIM_TURN_MODE=simple`, restart; repeat item 14 and a movement.
  - Expected: no sheet and no copy: at once the new left page fades in from a light blur and the new right page swings in
    from 35° around its left edge (forward) or its right edge (back), about 2.1 s. Previews and news still fade.
- [ ] **23. Other turn mode values**
  - Test: `VITE_ANIM_TURN_MODE=fade`, then `=abc`, restarting each time; click a tab.
  - Expected: a full turn both times (only `simple` changes the mode).
- [ ] **24. Turn off**
  - Test: `VITE_ANIM_TURN=false`, restart; tabs, an (i), a movement, the story page "Change", a phone preview (390 wide).
  - Expected: pages change at once everywhere, no fade, also on the phone; a play still lifts and flies, then the loading
    page shows on the right and the new board appears (1.13.0 behaviour); its cards are dealt right away.
- [ ] **25. Play off**
  - Test: `VITE_ANIM_PLAY=false`, restart; a movement, a choice "Do", an item use.
  - Expected: no lift, glow, dim, fall or flight: the button shows "Executing" / "Esecuzione"; the old pages stay still while
    the board reloads; then ONE turn (forward; back for the item).
- [ ] **26. Speed**
  - Test: in DevTools look at the `style` of `<html>`; then `VITE_ANIM_SPEED=1`, restart, look again and click a tab.
  - Expected: default `--t-lift: 960ms`, `--t-fly: 2240ms`, `--t-discard: 1280ms`, `--t-flip: 3600ms`, `--t-simple: 2080ms`,
    `--t-fade: 800ms`; at speed 1: 240, 560, 320, 900, 520 and 200 ms, and a turn four times faster. The glow pulse (1 s)
    and the light sweep (1.2 s) keep their beat at every speed.
- [ ] **27. Reduced motion (OS)**
  - Test: in a match turn on "prefers-reduced-motion: reduce" without reloading; move, open a tab and an (i); turn it off and
    repeat.
  - Expected: `<html>` gets `data-pg-reduced="true"`; no lift, glow, fall, flight, turn or fade: the spinner, then the
    loading page, and pages change at once. Turned off (no reload), the next play and tab animate again.

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
    accept the terms and "Start".
  - Expected: the left page fades to the card (0.8 s) with a back arrow "Back" / "Indietro" at its top left; the arrow fades
    back to the story card. The login card's (i) shows the Google login page on the left page. During each fade no second
    Turnstile loads (the copy shows an empty box where the widget is). The phase cards after "Start" appear with no turn.
- [ ] **31. Policy chapter**
  - Test: on `/story/<id>` open "Privacy Policy" from the footer, close it; open "Devlog" and its "credits page" link
    ("pagina crediti"); on the Home open and close "Credits".
  - Expected: opening a chapter turns forward, closing turns back, Devlog → credits turns forward. Same on the Home.
- [ ] **32. House tab from a policy chapter in a match**
  - Test: in a match open "Privacy Policy" from the footer, then press the house tab; repeat with the navbar brand.
  - Expected: ONE fade from the chapter to the close card "Exit to Home" / "Torna alla Home" ("You closed the game book
    without finishing it…" / "Hai chiuso il libro del gioco senza concluderla…"); no back turn before it.

### Phones: one tree (step 16 part A) and step 15 on phones

- [ ] **33. The game, rendered once** (390×844)
  - Done: `Book` lost its `mobile` prop; `GameBookMobile`, `StartBookMobile` and the inline stacks are deleted; `mobile.css`
    stacks the same `.book-wrapper` under the phone media query.
  - Test: open `/play/<id>`; in DevTools Elements search `.book-mobile-layout` and count `.book-wrapper`; scroll the page.
  - Expected: no `.book-mobile-layout`, one `.book-wrapper`. One column: the house tab right-aligned at the top inside the
    cover, the location (picture a third of the screen high, the description below), then the status card with "Map",
    "Missions", "Backpack" one per row with names, then the action cards in 2 columns. No spine, no headbands, no game tabs;
    the upper page rounded at the top, the lower page at the bottom; the leather cover with its gold frame and stitching
    wraps both, gold corners at its four corners, the ribbon under its bottom edge. The book spans the screen less about
    16px (1.13.0 capped the stack at 500px). The navbar stays on top while scrolling; no horizontal scroll.
- [ ] **34. Play on a phone**
  - Test: the (i) of a movement (its page opens below the location) → "Move"; later an option "Do" / "Scegli".
  - Expected: the picture lifts and glows, then the whole card flies to the top centre of the screen, just under the navbar; no hold, no
    turn, no sheet: the loading page shows and the page scrolls back to the top on the new location. On "Do" the other
    small cards dim and fall as on desktop.
- [ ] **35. Previews on a phone: no modal**
  - Test: a movement or action (i); the status card's (i) (Information); the back arrows.
  - Expected: no dark backdrop, no modal. A card's page opens below the location, fades in (0.8 s) and the page scrolls to
    it; the Information page takes the location's place at the top, with the same fade. Each back arrow closes its page.
- [ ] **36. Story set-up on a phone**
  - Test: `/story/<id>`: scroll; the (i) of a loadout card and its back arrow; "Change" / "Cambia".
  - Expected: house tab at the top right; the story card on top (no gold "Start Game" on it), the loadout below in
    2 columns, the "Start Game" / "Inizia Gioco" button at the end. The (i) puts the card in the story card's place, fading
    in, and the page scrolls up to it; its back arrow brings the story card back. "Change": the picker below, the top card
    carries the back arrow (no extra arrow button above the list).
- [ ] **37. Start match on a phone** (Turnstile key set, cookie deleted)
  - Test: `/start-match/<id>`; DevTools Elements: search `challenges.cloudflare.com`; the (i) of a card; its back arrow.
  - Expected: the story card on top, the fixed cards below, then the anti-bot widget and "Start". One Turnstile iframe (1.13.0
    had two). The (i) puts the card on top, fading in, the page scrolls to it, the back arrow "Back" / "Indietro" closes it.
- [ ] **38. End game on a phone**
  - Test: end a match (item 10) at 390 wide, with and without missions.
  - Expected: the ending shows the end card with "Close" / "Chiudi" on top and the story card below; with missions first
    the missions card on top and the grid below. No turn on the phone.
- [ ] **39. Player page on a phone** (`/player`)
  - Expected: the user card on top, then the anti-bot and the matches in 2 columns; a match's (i) puts the story card on top
    and the missions below; one `.book-wrapper` in the DOM.
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
    card grids in 3 columns; the house tab above the top page; no horizontal scroll bar.
- [ ] **43. Width switch**
  - Test: open a match at 1440, narrow the window under 767px, then widen it again.
  - Expected: the same book restacks with nothing reloaded and the open page kept; on the phone layout no turn and no
    hold run; back on desktop the turns work again.
- [ ] **44. Desktop unchanged by part A**
  - Test: 1440×900 and 800×1000 on the game, the story page and `/player`.
  - Expected: two pages with spine and headbands, game tabs at the top left and the house tab at the top right, the status
    card not shown on the board: as in 1.13.0 (plus this step's turns).
- [ UNIT ] **45. One-tree checks:** one home tab last in its row, no `.book-mobile-*` node, one anti-bot and one card grid on
  start match, the player page and the story set-up rendered once, previews in the top card scrolled into view (`Book`,
  `StartMatchFlowCoverage`, `PlayerBookMobile`, `StartBook*` tests).

### Languages

- [ ] **46. IT/EN texts** (no new key: only existing texts take part)
  - Test: items 1, 5, 7, 8, 10, 13 and 32 in Italian, then in English.
  - Expected: Italian "Esecuzione", "Muovi", "Agisci", "Scegli", "Dormi", "Usa", "Getta", "Migliora", "Termina Partita",
    "Chiudi", "Indietro", "Vai", "Caricamento…", "Errore Match", "Aggiornamento", "Torna alla Home". English "Executing",
    "Move", "Do", "Do", "Sleep", "Use", "Drop", "Improve", "End Game", "Close", "Back", "Go", "Loading…", "Match Error",
    "Refreshing", "Exit to Home".

### Regressions

- [ ] **47. Card special components** (step 13, 6.3.16), desktop and phone
  - Test: a match, the story page and start match; also look at a turning sheet and a flying card.
  - Expected: page arrows, bonus badges on the picture and by the title, tip note, extra content, credits bar, "view
    original" link, type badge on hover, (i), select and selected state, spinner, secondary buttons and the locked label
    with its icon: same place and size as in 1.13.0; the sheet and the flying copy look like the page they copy.
- [ ] **48. Things that must not change**
  - Test: one full tour of the game.
  - Expected: the book opening animation on first load; the deal of every list (step 14); drawn tooltips on hover; the
    cookie banner; the sticky navbar on phones; a held right page keeps its scroll position (no jump to the top).

---

## 3. Notes from development

- Built first, step 16 part A (§6.3, one tree). Not built: the vertical book graphics, step 16 §6.4 bookmark pills on
  phones (owner note of November 25), the mobile page turn and §6.4–6.10 (part B, next run). Until then phones get no hold
  and no turn: the play flies, then the 1.13.0 reload with the loading page.
- Deviation 1: the end game has no hold: after the card lands, the end pages and their forward turn go in one commit
  (nothing reloads in between).
- Deviation 2: the start-match preview has a back arrow on desktop too (one tree, item 30).
- Deviation 3: `inert` sits on each copied page, not on the turn layer; the layer takes the clicks while it holds a copy.
  The layer is z-index 9, under the spine (10) and the cover ornaments (11).
- Deviation 4: a drop reopens the bag with an explicit "no turn"; `turnFor` takes an optional third argument (the reducer's
  result) for the right-page changes.
- The Home on phones: its 6px top padding comes from the generic stack rule `.book-wrapper .config-cards-area` (mobile.css),
  no Home-only rule.
- Review fixes (same day, after the tester read the code):
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
  - Tests after the fixes: 185 files, 2067 passed, 0 failed, 3 skipped; new and changed code 501/501 lines, 405/416
    branches (97.36%); `npx vite build` OK.
- `VITE_ANIM_TURN_MODE` reads only `full` and `simple`; the fade is not a mode (section 0).
- Step 14's list predates this run: its item 34 (hidden mobile copy) now sees one tree, and item 37's "mobile (i) modals
  still open" no longer holds (the modal is gone, items 35–37 here).
- Known noise: the "chunks larger than 500 kB" build warning; StrictMode doubles dev-mode requests.
- Not seen in a browser by the developer: the turn geometry (full, simple, fade), the flight arc, the hold timing at speed
  0.25, the stacked layout of every book in portrait and sideways.

---

# Version Control
- **Document Version**: 1.14.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.14.0 | Test list for card play, page turns and phone book | November 25, 2026 |

- **Last Updated**: November 25, 2026 (v1.14.0)
