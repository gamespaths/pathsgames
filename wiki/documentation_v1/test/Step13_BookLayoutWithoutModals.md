# Step 13 — Book layout without modals: test list

**Status: tested and closed by the owner (November 25, 2026), version 1.13.0.** Step file: [Step13_BookLayoutWithoutModals.md](../Step13_BookLayoutWithoutModals.md).
Developed in react-game only: Java, Python, AWS, react-admin and OpenAPI are unchanged. Automated
tests are green; the manual checks below are done (item 17, IT/EN texts, still unticked).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` covered by unit tests ·
`[ ROBOT ]` covered by Robot suites · `[ NOT TESTABLE ]` with the reason.
For each point: **Done** = what changed, **Test** = what to try, **Expected** = the expected result.

---

## 0. Before starting

- **Environment variables:** none new. `.env` and `.env.test` are untouched; `.env.example` only has a
  comment change ("player page").
- **Servers** (start them yourself):
  - a backend on 8042: `cd code/backend/java && mvn -pl ms-launcher spring-boot:run`
    or `source .venv/bin/activate && cd code/backend/python && python3 -m app.launcher`;
  - react-game: `cd code/frontend/react-game && npm run dev` → http://localhost:5174.
- **Devices:** a desktop browser, then DevTools device mode with touch (phone width ≤ 442px), or a real phone.
- **Git:** renames and deletions are staged (`git mv` / `git rm`), everything else is unstaged. Nothing committed.

---

## 1. Steps, in order

- [ UNIT ] **1. Unit tests** (green, run again only after a change)
  - `cd code/frontend/react-game && npx vitest run --coverage`
  - Result on November 25: 174 files, 1872 passed, 0 failed, 3 skipped (before: 168 files, 1773 passed).
    Coverage overall: statements 98.77%, branches 94.81%, lines 99.46%. New and changed lines:
    348/348 (100%), branches 355/366 (96.99%).
- [ UNIT ] **2. Build:** `npm run build` passes; `bump-version.sh --check` still finds 1.13.0 in `Footer.jsx`.
- [ DONE ] **3. Robot regression** (no suite written or changed: every suite is API-only and no endpoint changed)
  - `code/scripts/dev/run_robots/run_robot_with_local_java.sh`
  - `code/scripts/dev/run_robots/run_robot_with_local_python.sh`
  - Expected: all green as in 1.12.0.
- [ DONE ] **4. Manual tests** of section 2, on desktop and on phone width.
- [ DONE ] **5. Documentation:** `/doc-update` (react-game `README.md`, `wiki/Security.md` still names `PolicyBook.jsx`).

---

## 2. Manual tests

### Layout, navbar and footer

- [ DONE ] **1. Sticky navbar and footer below the fold** (Home, desktop)
  - Done: the document scrolls and the navbar is sticky; the footer is two centred rows.
  - Test: open the Home and scroll to the bottom.
  - Expected: the navbar stays on top. The footer is reached only by scrolling: row 1 env badge, server,
    "PATHS GAMES v1.13.0 © …"; row 2 Privacy Policy / Terms of Service / Cookies Policy / Credits.
    No GitHub, Instagram or YouTube link, no "Crafted with" line.
- [ DONE ] **2. Footer server badge and Devlog**
  - Test: hover the server badge; click the env badge; press the chapter's back arrow.
  - Expected: drawn tooltip "Servers may be unavailable or reset at any time." (not the browser one).
    The Devlog chapter opens at the top of the page; back returns to the same scroll position.
- [ DONE ] **3. Server states**
  - Test: with one server only, look at the badge; stop the backend and reload; reload while it is starting.
  - Expected: green icon "server 1.13.0" online; red icon "server offline" when down; "detecting…" while probing.
    With several servers a select with the status dot, as before.

### Story page and routes

- [ DONE ] **4. Story page `/story/<id>`**
  - Done: the story preview is a page in a book (was `StartBookModal`).
  - Test: click a story card on the Home.
  - Expected: URL `/story/<id>`. The book sits under the navbar with only the tabs' height above it, at least
    520px tall, with leather cover, gold corners, headbands and ribbon. Home tab (house icon) at the right of
    the top edge. Card picture at most 45% of the card; texts, badges and bookmarks as big as before.
- [ DONE ] **5. Direct load and wrong id**
  - Test: reload `/story/<id>`; open `/story/xyz`.
  - Expected: the reload works (LoadingCard on both pages while loading). `/story/xyz` shows the ErrorCard
    "This story could not be loaded."; its close goes to the Home.
- [ DONE ] **6. Start and Back**
  - Test: on the story press Start, change the loadout, then use the "Back" card; repeat with the browser Back.
    Then open `/start-match/<id>` directly.
  - Expected: `/start-match/<id>`; both Backs return to the story with the loadout kept. The direct load
    redirects to `/story/<id>`.
- [ DONE ] **7. Match route and close card**
  - Test: finish start-match, then use the browser Back. In the match press the home tab and the brand.
  - Expected: `/play/<id>`; Back lands on `/story/<id>`. Home tab and brand open the close card, they never leave.
- [ DONE ] **8. Policy chapter during a match**
  - Test: in a match open a card credit or Privacy from the footer, then press the home tab.
  - Expected: the chapter closes and the close card shows (scrolled into view).
- [ DONE ] **9. Game direct load**
  - Test: reload `/play/<id>` or open it in a new tab; then the same with no running match on that story.
  - Expected: the running match resumes; without one, redirect to `/story/<id>`.
- [ NOT TESTABLE ] **10. Transient error**
  - Test: trigger an error in a match (e.g. an action without enough energy).
  - Expected: the ErrorCard replaces the right page, the left page stays; closing it returns to the board.

### Player page

- [ DONE ] **11. `/player`**
  - Done: the guest/user modal is now a page (`PlayerBook`).
  - Test: click the navbar user button from the Home and from a match; press Back. Open it also from the
    session-limit "sign in again" and from the start-match "Logged" (i).
  - Expected: `/player` every time; from a match Back returns to the match. No matches heading over the cards.
- [ DONE ] **12. Account deletion** (Google account)
  - Test: delete the account from `/player`, then press Close or the home tab.
  - Expected: the Home reloads as a new guest.

### Policy deep links

- [ DONE ] **13. `?policy=` on any route**
  - Test: open `/?policy=privacy`, `/player?policy=terms`, `/nope?policy=cookies`; close each chapter.
  - Expected: each chapter opens (`/nope` redirects to `/?policy=cookies`); closing removes `?policy=` from the URL.

### Tooltips

- [ DONE ] **14. Mouse and keyboard**
  - Done: `title` replaced by `data-tip` and a drawn tooltip layer.
  - Test: hover bookmarks, home tab, icon-only (i) buttons, map zoom and centre, navbar socials. Then Tab
    through them and press Escape.
  - Expected: the drawn tooltip, never the browser one. Focus shows it, Escape hides it. Near the navbar it
    flips below the target; at the screen edges it stays inside.
- [ DONE ] **15. Touch long press** (phone width with touch)
  - Test: long-press a bookmark or an (i) for 0.5s, then lift; then a normal tap.
  - Expected: the tooltip shows, nothing opens, no system menu; it hides about 1.5s after lifting.
    A tap never shows it and opens the target as before.

### Phone width

- [ DONE ] **16. Layout on the phone**
  - Test: Home, story, start-match, match and `/player` at phone width.
  - Expected: home tab above the stack, navbar sticky, no horizontal scroll. Footer with short labels
    (Privacy / Terms / Cookies / Credits) and "icon + version". The env badge is hidden in the navbar but
    still shown in the footer. Vertical book graphics come with step 16: today only the desktop has them.

### Languages

- [ ] **17. IT/EN texts**
  - Test: switch to Italian and check the new texts.
  - Expected: "Torna alla pagina iniziale" (home tab), "server non raggiungibile" / "rilevamento…",
    Termini / Cookie / Crediti (short footer), "Non è stato possibile caricare questa storia.". In English:
    "server offline", "detecting…", "This story could not be loaded.".

### Regressions

- [ DONE ] **18. Things that must not change**
  - Test: one full tour of the game.
  - Expected: the update banner sits under the navbar; mobile (i) modals still open; Home Turnstile and catalog
    as before; the end-game Close goes to the Home; the cookie banner is still a modal; route changes open the
    new page at the top.

---

## 3. Notes from development

- Route changes scroll to the top (the document now scrolls; without it a page opened at the old position).
- The `*` redirect keeps `?policy=` through router state, so the chapter stays open.
- A failing story detail with the Home's summary in hand falls back to the summary; only a direct load shows the ErrorCard.
- Removed: `CardDetailModal`, `ConfirmStep`, the `.card-detail-*` CSS, 8 unused i18n keys. Map zoom and
  centre buttons gained an `aria-label`.
- Not yet seen in a browser: the CSS geometry (46px tab row, cover padding).
- Test noise: "not wrapped in act()" warnings already existed (261 → 271).
- Phones show no bookmarks (only the home tab): by design until step 16, which adds them reusing `BookBookmarks`.

---

# Version Control
- **Document Version**: 1.13.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Test list for book pages without pop-ups, tested and closed | November 25, 2026 |

- **Last Updated**: November 25, 2026 (v1.13.0)
