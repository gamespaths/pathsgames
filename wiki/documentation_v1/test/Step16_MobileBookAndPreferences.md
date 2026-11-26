# Step 16 — Mobile book and preferences: test list

**Status: to test (November 25, 2026, version 1.14.0; updated November 26, 2026 for 1.15.0).** Step file: [Step16_MobileBookAndPreferences.md](../Step16_MobileBookAndPreferences.md),
part B: the vertical book graphics (§6.3) and §6.4–6.10 (pills, sticky deck, mobile turn, touch, vibration, preferences,
cookie and policy texts). Part A (§6.3, the one-tree switch) was built with step 15 and is tested in
[Step15_PlayAndPageTurn.md](./Step15_PlayAndPageTurn.md) items 33–45: not repeated here (part B changes some of their phone
expectations, item 52 and §3).
Developed in react-game only. Java, Python, AWS, react-admin, OpenAPI, Flyway and Robot suites are unchanged; step 16 adds
no env key (1.15.0 adds two for step 15, §0). Unit tests and build are green (unit tests run again on November 26); every
manual check below is still to do (the developer opened no browser and no phone). Step 15's 1.15.0 to-dos (bookmarks per
screen size, book change between routes, plays that do not move fade) replaced the phone pills row and changed several
items; items 55–59 are new, placed in their groups (§3, last note). Steps 14 and 15 are still being tested: their lists stay
[Step14_HomeBookAndCardFaces.md](./Step14_HomeBookAndCardFaces.md) and [Step15_PlayAndPageTurn.md](./Step15_PlayAndPageTurn.md).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` covered by unit tests ·
`[ ROBOT ]` covered by Robot suites · `[ NOT TESTABLE ]` with the reason.
For each point: **Done** = what changed, **Test** = what to try, **Expected** = the expected result.

---

## 0. Before starting

- **Environment variables:** none new for step 16. One code default changed: `VITE_SHOW_MOBILE_CARD_CHARACTERISTICS`
  is now `false`. Step 15's 1.15.0 adds `VITE_ANIM_COVER` and `VITE_ANIM_COVER_MAX_S` to react-game `.env.example` and the
  alpha workflow (last two rows). On November 26 `.env`, `.env.test` and `.env.alpha` have no `VITE_ANIM_*` and no
  `VITE_SHOW_*` key, so the code defaults apply. To try a switch, add the key to react-game `.env` and restart `npm run dev` (Vite reads `.env` only at
  start); remove it afterwards. The agent never edits `.env*`. A choice made in the Preferences card wins over these env
  defaults; the OS reduced motion wins over both.

  | Variable | Where | Who reads it | Value | When needed |
  |---|---|---|---|---|
  | `VITE_SHOW_MOBILE_CARD_CHARACTERISTICS` | react-game `.env` (not in `.env.example`) | `src/constants/features.js` → `PageRightMain` | `false` (new default); `true` brings the phone status card back | item 9 |
  | `VITE_ANIM_TURN` | react-game `.env` | `src/constants/animations.js` → `PreferencesProvider` → `AnimationProvider` | `true` (default) | item 22 |
  | `VITE_ANIM_TURN_MODE` | same | same → `mobileTurn.js` `run` | `full` (default) or `simple` | item 21 |
  | `VITE_ANIM_SPEED` | same | same; clamped to 0.1–4 | `0.25` (default) | item 24 |
  | `VITE_CF_TURNSTILE_KEY` | react-game `.env` | `src/utils/turnstile.js` | `1x00000000000000000000AA` (Cloudflare test key, `.env.example`) or empty (no check) | items 31, 45 |
  | `VITE_ANIM_COVER` (1.15.0) | react-game `.env`, `.env.example`; alpha `vars.VITE_ANIM_COVER` | `src/constants/animations.js` → `RouteBook` | `true` (default); `false` = no book change and no first-load opening | items 58, 59 |
  | `VITE_ANIM_COVER_MAX_S` (1.15.0, env only, no preference row) | same; alpha `vars.VITE_ANIM_COVER_MAX_S` | same → `swapTimings` in `bookSwap.js` | `10` (default, seconds); `0` = no limit; negative or text → 10 | item 58 |

- **Servers** (start them yourself):
  - a backend on 8042: `cd code/backend/java && mvn -pl ms-launcher spring-boot:run`
    or `source .venv/bin/activate && cd code/backend/python && python3 -m app.launcher`;
  - react-game: `cd code/frontend/react-game && npm run dev` → http://localhost:5174. For a real phone on the same network:
    `npm run dev -- --host`, then open `http://<PC address>:5174` on the phone. Google sign-in works only on registered
    origins (http://localhost:5174 and the alpha site), not on a LAN address: do the Google items on the PC.
- **Game data:** a running match with items in the bag, a story with choices, training and an end game (as in step 15).
- **Devices:** DevTools device mode with a touch preset (390×844, 360×740, custom 320×640, sideways 844×390), desktop
  1440×900, 1024×768 and 800×1000; a real Android phone with Chrome (vibration, tap flash) and an iPhone with Safari
  (scroll lock, no vibration). Keep DevTools undocked (or the viewport taller than 500px) on desktop items: a viewport wider
  than tall and at most 500px high counts as "phone sideways" for the card columns even at 1440 wide (§3, risk 3).
  Reduced motion: DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce"; Android "Remove
  animations"; iPhone Settings → Accessibility → Motion → "Reduce Motion".
- **Timings at the default speed 0.25** (written on `<html>` as `--t-*`): mobile sheet 2.48 s (`--t-sheet: 2480ms`), simple
  swing 2.08 s, fade 0.8 s, lift 0.96 s, flight 2.24 s; 1.15.0 adds slide 2.4 s and close 1.04 s (a phone book change
  2 × (sheet + slide) = 9.76 s, under the 10 s cap). At ½× all halve, at 1× the sheet takes 0.62 s.
- **Test hooks:** `<html>` carries `data-pg-theme`, `data-pg-size`, `data-pg-cols` (absent with Auto) and `data-pg-reduced`
  (OS reduced motion only), plus the class `is-turning` while a phone sheet is up; the sheet is `div.m-sheet` on `<body>`,
  with `div.m-cast` and the touch blocker `div.m-blocker`; `.book-wrapper` keeps `data-direction` and `data-page-key`
  (step 15). The choices live in localStorage under `pathsgames.preferences`. 1.15.0: during a phone book change `<body>`
  holds `div.m-blocker`, the old slice copy `div.m-sheet.m-sheet--tabs` and the cover `div.m-sheet.m-cover`, and
  `.route-book` has `is-swapping` (the live book hidden); the stage has `book-stage--game-tabs` and/or `book-stage--home-tab`.
- **Git (November 26):** steps 14–16 B were committed with 1.14.0 (`eecbe160`); the 1.15.0 work is unstaged (untracked
  `RouteBook.jsx`, `bookSwap.js`, `AntibotSuccess.jsx`, `RouteBook.test.jsx`, `bookSwap.test.js`), nothing staged, plus the
  owner's 1.15.0 version bump. The rest of this point is the November 25 state. Step 16 B adds untracked files: `components/book/mobileTurn.js`,
  `utils/haptics.js`, `preferences/settings.js`, `preferences/PreferencesContext.jsx`,
  `features/preferences/PreferencesCard.jsx`, `features/preferences/PreferencesEditor.jsx`, `styles/preferences.css` and four
  test files (`mobileTurn`, `preferencesSettings`, `PreferencesContext`, `PreferencesCards`). Its changes to `providers.jsx`,
  `devicePreferences.js`, `features.js`, `Book.jsx`, `BookBookmarks.jsx`, `GameBook.jsx`, `mobileView.js`, `PlayerBook.jsx`,
  `UserMatchesList.jsx`, `cookieConsent.js`, `en.json`, `it.json`, `main.css`, `book.css`, `mobile.css`, `variables.css` are
  unstaged and mixed with steps 14 and 15 (as are the untracked `animations.js`, `AnimationContext.jsx`, `BookPages.jsx`,
  `pageTurn.js`, `PlayContext.jsx`, `animations.css`). The pom.xml, package.json, `Footer.jsx`, `FooterBar.jsx`,
  `template.yaml`, echo handler, `application.yml`, `config.py`, `pyproject.toml` and root `.env.example` changes are the
  owner's 1.14.0 version bump.

---

## 1. Steps, in order

- [ UNIT ] **1. Unit tests** (green, run again only after a change)
  - `cd code/frontend/react-game && npx vitest run --coverage`
  - Result on November 26 (1.15.0, `npx vitest run`, run once by the tester): 191 files, 2255 passed, 0 failed, 3 skipped.
    Coverage not measured again; the figures below are the 1.14.0 ones.
  - Result on November 25 (run again by the tester, same numbers as the dev report): 189 files, 2138 passed, 0 failed,
    3 skipped (before part B: 185 files, 2067 passed). Coverage overall: statements 99.13%, branches 95.47%, functions
    99.5%, lines 99.66%.
  - The six new modules (`mobileTurn.js`, `haptics.js`, `settings.js`, `PreferencesContext.jsx`, `PreferencesCard.jsx`,
    `PreferencesEditor.jsx`): 222/222 lines, 167/167 branches, 82/82 functions (100%). Changed files: `devicePreferences.js`
    and `mobileView.js` 100%; `Book.jsx` 69/69 branches; `BookBookmarks.jsx` 29/30; `UserMatchesList.jsx` 31/32;
    `PlayerBook.jsx` 56/61; `GameBook.jsx` 77/78 lines (line 218), 46/49 branches.
  - New suites: `mobileTurn` (13), `preferencesSettings` (20, `haptics` included), `PreferencesContext` (10),
    `PreferencesCards` (13); 20 suites updated (dev report).
  - Flaky check: four full runs (two with coverage, two without) and five isolated runs of `useGameplayResultsPlay` (13 tests):
    all green; the dev report's single failure was not reproduced (likely cause in §3).
- [ UNIT ] **2. Build:** `npx vite build` passes (run by the tester; only the "chunks larger than 500 kB" warning, as before).
- [ ] **3. Robot regression** (optional: no suite written or changed, every suite is API-only and no endpoint changed)
  - `code/scripts/dev/run_robots/run_robot_with_local_java.sh`
  - `code/scripts/dev/run_robots/run_robot_with_local_python.sh`
  - Expected: all green as in 1.13.0.
- [ ] **4. Manual tests** of section 2: phone sizes in DevTools, a real Android and iPhone, desktop, both languages.
- [ ] **5. Alpha deploy** (when you release): nothing new for step 16 (no env key). Step 14's seven `VITE_ANIM_*` variables
  must still be set (step 14 list, item 3), plus step 15's `VITE_ANIM_COVER` and `VITE_ANIM_COVER_MAX_S` (1.15.0, GitHub
  `vars.*`). After it, item 50 and the phone items on the alpha site.
- [ ] **6. Documentation:** `/doc-update`. To update: react-game `README.md` (new modules `preferences/`,
  `features/preferences/`, `components/book/mobileTurn.js`, `utils/haptics.js`, `styles/preferences.css`; the language
  buttons now live in the Preferences editor, §4 still says "language switcher in Navbar"; `pathsgames.preferences` in the
  cookie table; `VITE_SHOW_MOBILE_CARD_CHARACTERISTICS` defaults to false); `wiki/documentation_v1/INDEX.md` lines of Step15
  and Step16 still say "Analysed 1.13.0".

---

## 2. Manual tests

Phone items run at 390×844 in DevTools touch mode with the defaults (deal on, play on, turn on, `full`, speed 0.25) unless
the item says otherwise.

### Vertical book on phones (§6.3, part B graphics)

- [ ] **1. Book graphics in a match**
  - Done: the phone book is bound on its left edge: spine, thread and headbands on the left, gutter shading on the left of
    each page, stacked page edges on the right, ribbon moved to the right; cover, frame, stitching and corners kept.
  - Test: open `/play/<id>`; scroll from the top of the book to its bottom.
  - Expected: a dark spine (about 10px) with a dotted gold thread runs down the left edge of the cover, from about 34px
    under its top to 34px above its bottom, with a small striped gold headband at each end. Both pages have a soft dark
    shading along their left edge (about 28px) and three thin page edges showing on their right side. The upper page is
    rounded at the top, the lower one at the bottom. Gold corners at the four outer corners; the leather cover with its gold
    frame and stitching wraps both pages; the red ribbon hangs under the bottom edge near the right corner (not in the
    middle), the house tab just left of it (item 56). No horizontal scroll.
- [ ] **2. Book graphics on the other books**
  - Test: `/story/<id>`, `/start-match/<id>`, `/player`, a policy chapter (footer "Privacy"), the Home, an end game.
  - Expected: the same spine, headbands, edges, shading and ribbon on every book. On the end game the end card is on top
    (rounded at the top) and the story card below it.

### Tabs on the book's edges (§6.4; the pills row was replaced by step 15's bookmarks per screen size, 1.15.0)

- [ ] **3. Icon tabs on the book's top edge** (in a match)
  - Done: step 16's sticky pills row is gone (step 15 to-do "Bookmarks per screen size"): on phones the game tabs stand on
    the book's top edge, icon only, no badges; the house tab hangs under the book (item 56).
  - Test: look at the top of the book at 390×844, then at the same match at 1440×900.
  - Expected: phone: no bar under the navbar; five icon tabs (Position, Information, Backpack, Map, Missions) stand on
    the cover's top edge, no badges and no names; the house tab is not up there. Red Information or Backpack tab when a stat
    is critical or the bag is overloaded, light gold Missions tab after a mission changed, as on desktop. 1440: the tabs
    hang down the cover's right edge (step 15 list).
- [ ] **4. No sticky bar: the tabs scroll with the book**
  - Test: scroll down to the last action card and back up.
  - Expected: the tabs go up with the book's top edge and leave the screen; nothing but the navbar stays at the top; back
    at the top they stand on the book's edge again.
- [ ] **5. No sideways scroll** (360×740)
  - Test: swipe left and right starting on the tabs.
  - Expected: nothing scrolls sideways (there is no row to swipe) and the page never scrolls sideways; all five tabs show
    on the book, none cut by the screen edge.
- [ ] **6. A tap opens**
  - Test: tap Backpack, then Map, then Position; tap the active tab.
  - Expected: each tap opens its page (with the turn of items 14–16) and the page goes back to the very top (item 57); the
    tapped tab turns parchment-light (active) and shows no name; the active tab does nothing.
- [ ] **7. Long press: tooltip only** (DevTools touch and a real phone, Android and iPhone)
  - Test: press and hold the Map tab for about a second, release; the same on the house tab under the book; then a short
    tap on Map; then a swipe that starts on a tab.
  - Expected: after about half a second the drawn tooltip "Map" / "Mappa" shows by the tab and hides about 1.5 s after the
    release; nothing opens, no system menu, no text selection. On the house tab the tooltip reads "Back to the home page" /
    "Torna alla pagina iniziale" and the page stays. The short tap opens Map. The swipe scrolls the page up or down and
    shows no tooltip.
- [ ] **8. Books without game tabs**
  - Test: `/story/<id>`, `/start-match/<id>`, `/player`, a policy chapter opened inside a match; then the Home.
  - Expected: no tab on the top edge (the book starts about 8px under the navbar); the house tab alone hangs under the
    book's bottom edge (item 56); in a match with a chapter open the game tabs are gone and only the house tab stays under
    the book. The Home has no tab at all.
- [ ] **55. Phone tabs at 390 and 320 wide, and sideways** (new, 1.15.0)
  - Done: tabs `padding: 6px 10px 12px` with a 6px band, `font-size: 1rem`; under 360px `padding: 6px 3px 12px`
    (`mobile.css`); same look on every screen (`book.css`).
  - Test: a match at 390×844, at 320×640 (custom) and at 844×390; one tab active, a red one if you can (low life or an
    overloaded bag).
  - Expected: the five tabs on one line on the top edge, the first about 42px from the left corner, the last clear of the
    right corner; at 320 narrower, all five still on the book, none cut or wrapped. Each tab: light tan inside framed by a
    6px band of the cover's dark tooled leather on top and sides, a thin gold line and dashed stitching in the band, open
    at the bottom where it meets the cover; dark brown icon; the active tab parchment-light with a brighter gold line; red
    and gold tabs keep their colours. 844×390: the same tabs, icons only.
- [ ] **56. Phone house tab under the book** (new, 1.15.0)
  - Test: in a match, on `/story/<id>` and on `/player` scroll to the end of the book; tap the house tab.
  - Expected: the house tab hangs under the book's bottom edge, about 72px from the right corner, just left of the red
    ribbon, upside down (band on the sides and bottom, open at the top against the cover, shadow downwards), with about
    46px of free page under it; it scrolls with the book, never pinned. The tap goes to the Home (in a match through the
    close card).
- [ ] **9. Status card gone on phones**
  - Done: `SHOW_MOBILE_CARD_CHARACTERISTICS` defaults to `false` (`constants/features.js`).
  - Test: in a match look at the top of the right page; then set `VITE_SHOW_MOBILE_CARD_CHARACTERISTICS=true`, restart,
    reload, and look at 390 and at 1440.
  - Expected: default: no status card at the top of the board (no "Map", "Missions", "Backpack" rows with names). With
    `true`: the status card is back on phones only, its shortcuts one per row with names; never on desktop.
- [ UNIT ] **10. Tab details:** one `.book-bookmarks-row` holding both groups, house tab last of `--right`, no
  `.book-bookmark__label` (icon only, 1.15.0), stage classes `book-stage--game-tabs` / `book-stage--home-tab` (none on the
  Home), badges still in the markup, a long press shows the tooltip and never opens (also the house tab), a page with the
  house tab alone; the new default of the status card flag (`Book`, `BookBookmarks`, `GameBookBookmarks`, `features` tests).

### Sticky deck and deal on scroll (§6.4, §6.6)

- [ ] **11. Page deck**
  - Done: step 14's page deck (three backs at the end of the right page) is shown on phones, sticky; the table pile stays
    hidden there.
  - Test: the Home, a match board, the story loadout and the `/player` grid; scroll each list; repeat at 844×390.
  - Expected: a small stack of three card backs (about 54px wide, the top one with the pulsing d20) rides the bottom right
    of the screen, about 12px above its edge, while the right page's card grid is on screen, and stops at the end of the
    right page. No ten-card table pile on phones, also sideways. A tap on a card under the deck reaches the card. No deck on
    a page without a dealt grid (a reading page, the loading page).
- [ ] **12. Deal on scroll**
  - Test: the Home, scroll slowly through the stories; then a match with many action cards.
  - Expected: each card waits until about a fifth of it is on screen, then flies in face down from where the deck is now
    (bottom right) and flips on landing, a batch at a time; later batches leave from the deck's new place, not from the top
    of the page.
- [ ] **13. Deal after a turn**
  - Test: in a match tap Backpack (with items in the bag), then Position.
  - Expected: the new page's cards wait while the sheet turns and are dealt only once it has gone.

### Mobile page turn (§6.5)

- [ ] **14. Forward turn, right page changes**
  - Done: `components/book/mobileTurn.js` is the phone strategy of step 15's turn: the visible slice is copied on a fixed
    sheet, scrolling is locked, the scroll jumps under the sheet, then the sheet turns on its left edge.
  - Test: in a match scrolled to the middle of the board, tap Backpack; watch `<html>` and `<body>` in Elements.
  - Expected: what was on screen freezes as a sheet under the navbar; behind it the page has already jumped to the very
    top (1.15.0: not the right page's top any more); the sheet swings away to the left around its left edge, darkening,
    while a shadow on the page fades (about 2.5 s), and shows the tabs on the book's edge and the left page first, the bag
    below it. `<html>` has `class="is-turning"` and `<body>` holds `div.m-sheet`,
    `div.m-cast` and `div.m-blocker` only during the turn; then all are gone. `.book-wrapper` has
    `data-direction="forward"`.
- [ ] **15. Forward turn, left page changes**
  - Test: on the board tap Information ("Informazioni"); on `/story/<id>` tap "Change" / "Cambia" on the class card.
  - Expected: the same sheet; underneath, the page lands at the very top (the tabs on the book's edge under the navbar, the
    new upper page first), as in item 14.
- [ ] **16. Back turn**
  - Test: from the bag tap Position; from the map tap Position; on `/player` open a match's (i), then its back arrow
    "Back" / "Indietro".
  - Expected: the old view freezes, the page jumps under it to the very top, then the new view swings in from the left
    edge over it while a shadow grows (about 2.5 s); then both copies go and the live page is exactly where the incoming
    sheet showed it.
    `data-direction="back"`.
- [ ] **17. A turn from the end of a long page** (§3, risk 1)
  - Test: in the bag (or the `/player` grid with many matches) scroll to the very end, then tap Position (or a match's (i)).
    Repeat from the end of the Home list with the footer "Credits" / "Crediti".
  - Expected: only the part on screen turns. While the sheet turns the page underneath is already at the very top;
    when the sheet leaves, nothing slides, jumps or scrolls any more.
- [ ] **57. Back to the very top on every page change** (new, 1.15.0; replaces step 16's "right page top" landing)
  - Done: `land()` in `mobileTurn.js` is `window.scrollTo({ top: 0 })` for forward, back, simple and a fade release;
    `landingOf` / `pageSignature` removed; `viewTop` is the navbar bottom only; `scrollBookToTop()` scrolls the document top.
  - Test: in a match scroll halfway down, then tap Backpack; scroll down the bag, tap Position; open Missions and its back
    arrow; "Sleep" / "Dormi". Repeat with Turn style "Simple" / "Semplice" and with Page turn "Off" / "Spento". After each,
    type `window.scrollY` in the console.
  - Expected: after every page change the screen shows the tabs on the book's edge right under the navbar and the left
    page first; `window.scrollY` is `0`; never the right page's top. Only right previews (a board card's (i), a map node,
    the close card) still jump to the lower page (item 20).
- [ ] **18. Play on a phone: flight, hold, one turn or a fade**
  - Done: the flight aims at the top of the visible slice; the hold is the sheet itself. 1.15.0 (step 15 to-do): a play
    that does not move the character releases the hold with a fade (`runFade`) instead of a turn.
  - Test: a movement's (i) → "Move" / "Muovi"; an action "Do" / "Agisci" that leaves the character where it is, and one
    with a forced movement if the story has it; "Sleep" / "Dormi"; an item "Use" / "Usa" in the bag. Once with Network →
    "Slow 3G".
  - Expected: the picture lifts, then the whole card flies to the top centre of the visible book (about 60px under the
    navbar); the emptied view is held (no scrolling) while the board reloads. Move and the forced movement: ONE forward
    turn, landing at the very top on the new location. "Do" with no move and Sleep: no turn, the held view fades out
    (about 0.8 s) over the page already at the very top. "Use": ONE back turn, landing at the very top. With Slow 3G the
    view is held about 1 s, then the turn (or fade) shows the loading page and the new board appears with no second turn.
    This replaces step 15 item 34 ("no hold, no turn") on phones.
- [ ] **19. Scroll lock and the navbar during a turn** (speed ¼×; DevTools and a real iPhone)
  - Test: during a turn swipe the page, tap a card and a tab; during another turn tap the navbar user button.
  - Expected: nothing scrolls or reacts under the sheet, on iOS too. The navbar stays usable (the blocker starts under it):
    the user button opens `/player`, no sheet, blocker or `is-turning` stays behind and the new page scrolls normally.
- [ ] **20. Previews on phones: fade, no sheet**
  - Test: the (i) of a movement card, a map node, a loadout card on `/story/<id>`; their back arrows.
  - Expected: no sheet: the movement (i) and the map node jump to the card on the lower page; the loadout card's (i) (a
    left preview) goes back to the very top (1.15.0); every jump is instant (§3 risk 1) and the card fades in (0.8 s); the
    back arrow fades back.
- [ ] **21. Simple mode**
  - Test: `VITE_ANIM_TURN_MODE=simple` and restart (or Preferences "Turn style" → "Simple" / "Semplice"); repeat items 14
    and 16.
  - Expected: no sheet; the page jumps at once to the very top, the upper page fades in from a light blur and the lower
    page swings in from 35° (around its left edge forward, its right edge back), about 2.1 s.
- [ ] **22. Turn off**
  - Test: `VITE_ANIM_TURN=false` and restart (or Preferences "Page turn" → "Off" / "Spento"); a tab, a movement, "Change"
    on `/story/<id>`.
  - Expected: no sheet and no fade; the page goes straight to the very top (1.15.0: `BookPages` jumps once with no turn);
    a play still lifts and flies, then the loading page shows.
- [ ] **23. Reduced motion on a phone**
  - Test: turn reduced motion on (DevTools, Android or iPhone setting); a tab, a movement, an (i).
  - Expected: `<html data-pg-reduced="true">`; no sheet, lift, flight, fade or deal, and no page deck; pages change at once
    and the page jumps instantly to the very top; a book change (item 58) just shows the new book. Turned off again, the
    next tab turns.
- [ ] **24. Speed**
  - Test: Preferences "Speed" / "Velocità" ¼×, ½×, 1×; after each, look at the `style` of `<html>` and turn a tab.
  - Expected: `--t-sheet: 2480ms` / `1240ms` / `620ms` (and `--t-flip` 3600 / 1800 / 900ms, `--t-fade` 800 / 400 / 200ms);
    the sheet turns in about 2.5 s / 1.2 s / 0.6 s.
- [ UNIT ] **25. Engine details:** the visible slice under the navbar only (1.15.0: no tab row), the copy without `id`,
  `data-testid`, `data-tip` and iframes (empty boxes), forward, back, simple and a fade release all landing at the document
  top (1.15.0, the `landingOf` rule removed), forward and back layers added and removed, scroll lock and busy flag released,
  the plain path without WAAPI, a book off screen, a held sheet released with a fade, simple mode, phone scroll jumps
  skipped while a sheet is up, `scrollBookToTop` → `window.scrollTo` top on phones, one jump when no strategy runs
  (`mobileTurn`, `MobileView`, `BookPages` tests); the phone flight target under the navbar (`PlayContext`); sleep and a
  non-moving action release with a fade, a forced movement turns forward (`useGameplayResultsPlay`, `GameBookTurns`). A
  copy taken on the other layout (the phone rotated past the breakpoint during a hold) is dropped with no turn; the 10 s
  hold safety (`BookPages` tests).

### Book change on phones (step 15 to-do "Book change between routes", 1.15.0)

- [ ] **58. A cover closes and the next book opens** (new, 1.15.0; 390×844)
  - Done: `RouteBook.jsx` and `bookSwap.js` (`phoneCover`): the visible slice, tabs included, copied; a cover closes over
    it, slides out left, the page goes to the top, the cover comes back from the right with the new title and opens.
  - Test: on the Home scroll halfway, tap a story card (Home → `/story/<id>`); then tap the house tab (→ Home); then
    `/player` → a match's "Resume". Once with Turn style "Simple" / "Semplice", once with `VITE_ANIM_COVER_MAX_S=0`.
  - Expected: what is on screen of the old book, its tabs too, freezes; a leather cover with the gold frame, the gold d20
    and the old book's title closes over it from its left edge, slides out to the left, comes back from the right with the
    new title over the new book (now at the very top) and opens on its left edge. Titles: Home book "Paths Games" with
    "Web gamebook" / "Librogame web"; a story book its title with "Paths Games". About 9.8 s at ¼× (under the 10 s cap, so
    the same with `0`), 2.4 s at 1×. During it `<html>` has `is-turning`, `<body>` holds `div.m-cover` and `div.m-blocker`,
    nothing scrolls; then all are gone, the new cards are dealt after the cover opens. Simple: the copy tilts, shrinks and
    fades, then the new book opens (about 3.6 s at ¼×). Home ↔ `/player` is a page turn, not a book change.

### Phone sideways (§6.6)

- [ ] **26. Landscape 844×390**
  - Test: a match, `/story/<id>`, `/player`, the Home; tap a tab; open the Preferences editor.
  - Expected: the tabs stand on the book's top edge, icons only (no badges, no name, 1.15.0), the house tab under the book
    (items 55, 56); the picture beside the description
    (part A); card grids in 3 columns; the page deck at the bottom right and no table pile; a tab turns as in item 14. In
    the editor the "Card columns" options "1" and "4" are disabled.

### Touch guards, tap feedback and vibration (§6.7)

- [ ] **27. No stuck hover**
  - Done: the lift and zoom hover rules apply only under `(hover: hover)`.
  - Test: DevTools touch preset (or a real phone): tap a story card on the Home, the body of a small action card, a loadout
    card cover, a choice card, a tab. Then on desktop hover the same with the mouse.
  - Expected: on touch nothing stays lifted, zoomed or recoloured after the tap (the small card's type badge may show: that
    rule is not a lift). On desktop the hover still lifts a card (up 3px, 3% larger), zooms its picture and colours a tab.
- [ ] **28. Tap feedback** (real phone)
  - Test: press and hold a card button ("Move" / "Muovi"), a tab that is not active, a language button in the Preferences
    editor, "Start Game" / "Inizia Gioco".
  - Expected: each shrinks a little (to 96%) while pressed and comes back on release; no grey or blue tap flash on Android.
    The active tab and disabled buttons do not shrink.
- [ ] **29. Vibration on Android** (Chrome, the phone's vibration not muted)
  - Done: `utils/haptics.js` calls `navigator.vibrate(15)` inside the tap that starts a play.
  - Test: in a match tap "Move" / "Muovi", "Do" / "Agisci", a choice "Do" / "Scegli", "Sleep" / "Dormi", "Use" / "Usa",
    "Improve" / "Migliora", "End Game" / "Termina Partita"; then an (i), a tab, a back arrow, "Drop" / "Getta", "Change" /
    "Cambia" on the Preferences card. Then set Preferences "Vibration" → "Off" / "Spento" and tap "Move" again.
  - Expected: one very short tick at the tap of each play, also with Play off or reduced motion; nothing for the other
    buttons; nothing after Vibration Off.
- [ ] **30. No vibration on iPhone**
  - Test: iPhone Safari: tap "Move"; open the Preferences editor.
  - Expected: no vibration and no error; the editor has no "Vibration" / "Vibrazione" row.
- [ UNIT ] **31. Haptics:** no API is a silent no-op, `vibrate(15)` once with the API, nothing with the choice off, a
  throwing API swallowed; the play start runs inside the click (`preferencesSettings`, `PlayContext` tests).

### Preferences card and editor (§6.8–6.9)

- [ ] **32. The card in the player grid** (desktop and phone, EN then IT)
  - Done: `PreferencesCard` follows `UserStatsCard` in the `/player` grid; the language buttons left the user card.
  - Test: `/player` (Turnstile key set, `pathsgames.turnstilePass` cookie deleted); wait for the anti-bot.
  - Expected: while "Checking you're human…" / "Verifica che tu sia umano…" shows there is no grid. Then, after the player's
    statistics card, a little card "Preferences" / "Preferenze" with a sliders icon and five badges: "EN", "Medieval", "M",
    "On ¼×", "Auto" (IT: "IT", "Medievale", "M", "Attivo ¼×", "Auto"), and the button "Change" / "Cambia" with a pen icon;
    then the matches. The user card on the left page has no language buttons any more.
- [ ] **33. Open and back**
  - Test: "Change" / "Cambia", then the back arrow "Back" / "Indietro"; at 1440 and at 390.
  - Expected: desktop: a forward turn; the right page shows the page "Preferences" / "Preferenze" with the text "Your
    display choices for this device: they apply at once and stay in this browser, never on our servers." / "Le tue scelte di
    visualizzazione per questo dispositivo: valgono subito e restano in questo browser, mai sui nostri server."; the user
    card stays on the left; the back arrow turns back to the grid. Phone: the sheet turns and the page lands at the very
    top (the user card first, the editor below it, 1.15.0); back lands at the very top too, the grid below the user card.
- [ ] **34. The rows**
  - Expected: each row is a group of pill buttons, the chosen one gold with a check mark: "Language" (ENGLISH, ITALIANO),
    "Theme" (Medieval, Parchment), "Text size" (Small, Normal, Large), "Card columns" (Auto, 1, 2, 3, 4); the heading
    "Animations"; "Deal", "Face-down deal", "Play", "Page turn", "Book cover" (1.15.0) (On, Off each), "Turn style" (Full,
    Simple), "Speed" (¼×, ½×, 1×), "Deck" (Under the book, Over the book), "Vibration" (On, Off; shown only where the
    browser has the Vibration API: Chrome and Edge, desktop included, and Android; not Safari); then "Back to defaults".
    IT: "Lingua", "Tema" (Medievale, Pergamena), "Dimensione del testo" (Piccolo, Normale, Grande), "Colonne di carte",
    "Animazioni", "Distribuzione", "Distribuzione coperta", "Giocata", "Giro pagina", "Copertina" (Attivo, Spento), "Stile
    del giro" (Completo, Semplice), "Velocità", "Mazzo" (Sotto il libro, Sopra il libro), "Vibrazione", "Torna ai valori predefiniti". Checked by
    default: the current language, Medieval, Normal, Auto, On ×5, Full, ¼×, Under the book, On. On a phone each row name
    sits on its own line above its pills.
- [ ] **59. "Book cover" / "Copertina" row** (new, 1.15.0; desktop and phone)
  - Done: `anim.cover` in `ANIM_FLAGS` (`settings.js`), whitelisted; default from `VITE_ANIM_COVER`.
  - Test: set "Book cover" Off; go from the Home to a story and back with the house tab; reload; look at DevTools
    Application → Local Storage; set it On and repeat the trip.
  - Expected: Off: the new book just appears in place, no close, slide or open (phone: no cover, no `is-turning`), and no
    opening zoom after the reload; Home ↔ `/player` still turns (Page turn row). After the reload still Off;
    `pathsgames.preferences` has `"cover":false` inside `"anim"`; the card badge stays "On ¼×" / "Attivo ¼×". On: the book
    change of item 58 runs again.
- [ ] **35. Language: guest and Google user**
  - Test: as a guest, with DevTools Network open, press ITALIANO. Then on http://localhost:5174 sign in with Google, press
    ENGLISH and reload.
  - Expected: guest: the whole page switches to Italian at once, no request, localStorage `pathsgames.lang` = `it`. Google:
    one `PATCH /api/auth/me` with body `{"language":"en"}` answering 200, the language buttons disabled while it runs; after
    the reload the page is still in English (from the profile). The card's language badge follows ("IT" / "EN").
- [ ] **36. Theme**
  - Test: "Parchment" / "Pergamena"; look at `/player`, a match and the Home, desktop and phone; then "Medieval".
  - Expected: at once the pages of every book turn to the light parchment gradient; cover, navbar and footer unchanged;
    `<html data-pg-theme="parchment">`; every text on the pages stays readable; badge "Parchment" / "Pergamena". Medieval
    brings the brown pages back.
- [ ] **37. Text size**
  - Test: Small, Large, then Normal; desktop and phone.
  - Expected: `<html data-pg-size="small">` (`large`, `normal`); titles, descriptions, buttons and tabs get smaller
    (87.5%) or larger (112.5%) at once; card widths do not change; on phones the tabs on the book's edge get bigger with
    Large and the five still fit on one line at 320 wide (item 55). Badge "S" / "L" / "M" (IT "P" / "G" / "M").
- [ ] **38. Card columns per layout**
  - Test: at 1440×900 choose 4, then Auto; choose 4 again and narrow to 1024×768; then 390×844 (choose 1, then 2),
    320×640 and 844×390.
  - Expected: 1440: "1" disabled; 4 → every card grid (Home, `/player`, loadout, board) in 4 columns, `data-pg-cols="4"`;
    Auto removes the attribute (3 columns). 1024 (4 stored): "4" disabled, "3" checked, grids in 3, badge "3". 390: "3" and
    "4" disabled, "2" checked; 1 → one column. 320: only Auto and 1 enabled, always one column. 844×390: "1" and "4"
    disabled, Auto gives 3 columns. Resizing updates the disabled options with no reload.
- [ ] **39. Animation rows on desktop** (1440, a match and the Home)
  - Test: one at a time, then back: Deal Off; Face-down deal Off; Play Off; Page turn Off; Book cover Off (Home → a story);
    Turn style Simple; Speed 1×; Deck "Over the book", then "Under the book".
  - Expected: Deal Off: no table pile, cards shown at once. Face-down Off: cards fly face up, no back, no flip. Play Off: no
    lift or flight on "Move", the turn still runs. Page turn Off: pages change at once. Book cover Off: the story book just
    appears (item 59). Simple: step 15's simple swing. 1×: everything four times faster. Deck Over: the ten-card pile lies
    over the cover's edge at once; Under puts it back under. All five flags Off: badge "Off" / "Spento"; Speed 1×: "On 1×"
    / "Attivo 1×". On a phone the Deck row changes
    nothing (no pile); the other rows act as items 21–24.
- [ ] **40. Reduced motion in the editor**
  - Test: open the editor, turn reduced motion on (no reload), then off.
  - Expected: the note "Your device asks for reduced motion: the animations stay off." / "Il dispositivo chiede movimento
    ridotto: le animazioni restano spente." appears; the eight rows Deal to Deck (Book cover included) are greyed and
    cannot be pressed; Language, Theme, Text size, Card columns, Vibration and "Back to defaults" still work; the badge reads "Off" / "Spento". Off
    again: the note goes, the rows work, the stored choices apply again.
- [ ] **41. Back to defaults**
  - Test: change theme, size, columns, speed and vibration; press "Back to defaults" / "Torna ai valori predefiniti".
  - Expected: Medieval, Normal, Auto, the env defaults (On, Full, ¼×, Under the book), Vibration On; localStorage has no
    `pathsgames.preferences`; the language does not change.
- [ ] **42. Saved after a reload, never sent**
  - Test: Parchment, Large, 2 columns, Simple, ½×; reload; open a new tab; look at DevTools Application → Local Storage and
    at Network while changing rows.
  - Expected: everything as chosen after the reload and in the new tab; `pathsgames.preferences` holds
    `{"v":1,"theme":"parchment","size":"large","columns":2,"anim":{"turnMode":"simple","speed":0.5}}` (key order may
    differ); no request to the backend for any row except Language with a Google user.
- [ ] **43. Two tabs**
  - Test: two tabs on `/player`; in tab A change the theme and the text size.
  - Expected: tab B follows at once, with no reload.
- [ ] **44. Guests and Google users, logout**
  - Test: as a guest set Parchment and Large; sign in with Google; log out; sign in with another Google account.
  - Expected: the choices stay through the sign-in, the logout and the other account: they belong to the browser, the same
    for guests and Google users.
- [ ] **45. Match list error: no Preferences card** (§3, risk 2)
  - Test: stop the backend; open `/player` (anti-bot passed); start the backend and reload.
  - Expected (as coded): the right page shows the error line and no grid, so no Preferences card and no way to change the
    language; after the restart the card is back. Decide if this is acceptable.
- [ UNIT ] **46. Preferences module:** whitelist of stored values (bad JSON, unknown values, an `anim.deck` other than
  under/over; `anim.cover` boolean, 1.15.0), `VITE_ANIM_COVER` / `VITE_ANIM_COVER_MAX_S` parsing (`animations`), storage
  that throws, `devicePreferencesBody()` still language and high contrast only (a first Google sign-in sends nothing new), env then choice then OS reduced motion, columns limits and clamping per layout, `<html>` attributes,
  both `matchMedia` listener APIs and none, the `storage` event, reset, every editor row writing, rows disabled under
  reduced motion, vibration row only with the API, language through the profile for Google and the device for guests, EN/IT
  key parity (`preferencesSettings`, `PreferencesContext`, `PreferencesCards`, `UserMatchesList`, `PlayerBook*` tests).

### Cookie banner and policies (§6.10)

- [ ] **47. Cookie banner row**
  - Test: a private window (no consent cookie): on the banner press "Manage preferences" / "Gestisci preferenze" and open
    "Strictly necessary cookies" / "Cookie strettamente necessari"; also footer "Cookies" → "Cookie settings" /
    "Impostazioni cookie".
  - Expected: right after the `pathsgames.lang, pathsgames.highContrast` row: "pathsgames.preferences (browser storage)" |
    "Remembers your display choices: theme, text size, card columns, animations, vibration" | "Persistent (until cleared)";
    IT: "pathsgames.preferences (memoria del browser)" | "Memorizza le tue scelte di visualizzazione: tema, dimensione del
    testo, colonne di carte, animazioni, vibrazione" | "Persistente (fino a cancellazione)".
- [ ] **48. No new consent request**
  - Test: in a browser that accepted the banner before this version, reload any page.
  - Expected: no banner (the consent revision is still 2).
- [ ] **49. Policy chapters** (EN and IT)
  - Test: footer "Privacy", "Cookies" / "Cookie", "Terms" / "Termini".
  - Expected: Privacy, section "2. Data we collect" / "2. Dati che raccogliamo" ends with "Your display preferences (theme,
    text size, card columns, animations, vibration) stay in your browser and are never sent to our servers." / "Le tue
    preferenze di visualizzazione (tema, dimensione del testo, colonne di carte, animazioni, vibrazione) restano nel browser
    e non vengono mai inviate ai nostri server."; at the bottom "Last updated: November 2026" / "Ultimo aggiornamento:
    Novembre 2026". Cookies, section "1. Strictly necessary cookies" / "1. Cookie strettamente necessari": the browser
    storage list names "pathsgames.preferences (your display choices: theme, text size, card columns, animations,
    vibration)" / "pathsgames.preferences (le tue scelte di visualizzazione: tema, dimensione del testo, colonne di carte,
    animazioni, vibrazione)"; "Last updated: November 2026". Terms still "Last updated: October 2026" / "Ultimo
    aggiornamento: Ottobre 2026".
- [ ] **50. Static policy pages**
  - Test: `cd code/frontend/react-game && npm run build` (its postbuild writes the pages), open `dist/privacy.html` and
    `dist/cookies.html`; after the alpha deploy, the same pages on the alpha site.
  - Expected: the sentences and dates of item 49 in both languages (the tester rendered the pages in memory on November 25:
    present).
- [ UNIT ] **51. Cookie and i18n:** the new row in both languages, revision still 2; the privacy and cookies texts name the
  key; `policyPages` green (`cookieConsent`, `PreferencesCards`, `policyPages` tests).

### Desktop and regressions

- [ ] **52. Step 15 phone items with part B**
  - Test: step 15 list items 33, 34, 38, 42 and 43, at 390×844 and 844×390.
  - Expected: as written there, except where part B and 1.15.0 changed them: item 33 → spine and headbands on the left
    edge, the icon tabs on the book's top edge and the house tab under the book (items 3, 56), no status card; item 34 →
    hold and one turn or a fade (item 18 here); item 38 → the end game turns on phones too; item 42 → icon tabs, no
    badges, the house tab under the book (items 26, 55); item 43 → turns and holds now run on the phone layout.
- [ ] **53. Desktop unchanged**
  - Test: 1440×900 and 800×1000: a match, `/story/<id>`, the Home; click the tabs and the house tab; move.
  - Expected: as before part B, except step 15's 1.15.0 bookmarks (tested in the step 15 list): at 1440 the game tabs
    hang down the cover's right edge and the house tab sits at the foot of that column; at 800×1000 (tablet) the game tabs
    stay on the top-left edge and the house tab on the top-right edge. Icons and badges only (no name on the active tab),
    the new tab look (item 55), drawn tooltips on hover; the spine in the middle with its headbands; step 15's full flip; no
    page deck (the table pile beside the book, step 14); the house tab goes to the Home (in a match through the close
    card). The portrait tablet keeps the desktop book.
- [ ] **54. Things that must not change** (phone and desktop)
  - Test: one full tour of the game.
  - Expected: page pictures a third of the screen high on phones and card texts as big as before; every Card special
    component in place (page arrows, badges, tip note, extra content, credits bar, "view original" link, type badge, (i),
    select, spinner, locked label); the sticky navbar; one Turnstile on start match; the book opening animation; drawn
    tooltips; the cookie banner.

---

## 3. Notes from development

- Deviations in the dev report, checked in the code:
  1. Phone scroll jumps (`scrollMobileIntoView`, `scrollBookToTop` in `mobileView.js`) default to `behavior: 'auto'` and are
     skipped while a sheet is up (`setMobileTurnBusy`). Fixed after risk 1: now `behavior: 'instant'`.
  2. When the left page changes, the turn lands at the top of the book (`landingOf` compares the left page's text and
     picture sources before and after the commit).
  3. On phones a fade is not a Book turn (`FadeIn` fades the previews); a held copy released with a fade fades out where it
     is (`runFade`, unit-tested only: the game releases holds with forward or back).
  4. `AnimationProvider` takes its overrides and the reduced motion from `PreferencesProvider` (one OS listener).
  5. The touch blocker (`.m-blocker`, z-index 989) starts under the navbar (`inset: var(--navbar-h) 0 0 0`): the navbar
     (1000) works during a turn; the sheet is 990.
  6. Screens up to 330px are their own column layout (`tiny`, always 1 column).
  7. The Deck row is disabled under reduced motion with the other animation rows.
  8. Sideways phones keep the pill badges and hide only the name.
  9. The GameBook suites force the status card on (`vi.mock` of `SHOW_MOBILE_CARD_CHARACTERISTICS: true`).
- Risks found by the tester (code reading; not seen in a browser):
  1. **Smooth scroll instead of the instant jump.** `index.html` loads Bootstrap 5.3.3, whose reboot sets
     `:root { scroll-behavior: smooth }` when the OS does not ask for reduced motion; the app overrides it only under
     reduced motion (`preferences.css`, checked in the built CSS). `scrollIntoView({ behavior: 'auto' })` follows that value,
     so `land()` in `mobileTurn.js` and `scrollMobileIntoView` scroll smoothly. In a back turn `runBack` measures the new
     slice right after `land()`, before the page has moved: the incoming sheet may show the wrong part of the page and the
     page may slide or jump when the sheet leaves (items 16, 17, 20). jsdom mocks `scrollIntoView`, so the unit tests cannot
     see it. **Fixed the same day:** `land()` and the `mobileView.js` defaults now pass `behavior: 'instant'`, which
     ignores the `:root` smooth value (tests updated; 189 files, 2138 passed, 0 failed, 3 skipped). Items 16, 17, 20 check it.
  2. **Language reachable only through the grid.** The language buttons left the user card (step file 6.9) and the
     Preferences card is rendered inside `UserMatchesList`'s grid, which does not exist while the anti-bot runs or fails, or
     when `GET /api/matches` fails (`UserMatchesList.jsx` returns the error line first): then the player cannot change the
     language anywhere (item 45).
  3. **Short wide windows count as phone sideways for columns.** The `sideways` query in `settings.js`
     (`COLUMN_LAYOUT_QUERIES`) and step 14's rule in `variables.css` have no maximum width: a desktop viewport at most 500px
     high and wider than tall (DevTools docked at the bottom) gets 2–3 columns, with "1" and "4" disabled, while the book
     stays the desktop one.
  4. An env speed outside ¼×, ½× and 1× (e.g. `VITE_ANIM_SPEED=2`) leaves no Speed pill checked in the editor; the badge
     shows "On 2×".
  5. `preferences.sections.display` ("Display" / "Aspetto") is in `en.json` and `it.json` but used nowhere.
- Flaky test: `useGameplayResultsPlay` (step 15) failed once in the developer's coverage run. Not reproduced by the tester:
  four full runs (two with coverage) and five isolated runs, all green. Likely cause: most of its tests run on real timers,
  while `releaseWhenLanded` in `useGameplayResults.js` arms a real 1 s `SLOW_RELOAD_MS` timer; if a loaded machine takes
  more than 1 s between the hold and `reload.resolve()`, the release fires early and a "not called yet" assertion fails. Fake
  timers in those tests would remove it.
- Step 14 list items 31 and 34 say phone cards fly in "from the lower right corner of the screen": they now leave from the
  sticky page deck (item 12 here).
- Not seen in a browser or on a device by the developer: everything in step file §7.2 (Android and iOS, portrait and
  landscape, sticky behaviour, long press, vibration).
- Known noise: the "chunks larger than 500 kB" build warning; StrictMode doubles dev-mode requests.
- November 26, 2026 (1.15.0), step 15 to-dos: "Bookmarks per screen size" changed items 1, 3–8, 10, 14–17, 19–23, 25–29, 33, 37, 52, 53 and added 55–57 (deviations 2 and 8 above are gone); "Book change between routes" changed items 23, 34, 39, 40, 46 and added 58, 59; "No page turn when a play does not change the location" changed items 18 and 25.

---

# Version Control
- **Document Version**: 1.15.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.14.0 | Test list for phone book, pills and preferences | November 25, 2026 |
  | 1.15.0 | Phone tabs on the book, book cover, top landing | November 26, 2026 |

- **Last Updated**: November 26, 2026 (v1.15.0)
