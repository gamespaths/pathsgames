# Step 14 — Home book and card faces: test list

**Status: tested and closed by the owner (November 27, 2026), version 1.15.0.** Step file: [Step14_HomeBookAndCardFaces.md](../Step14_HomeBookAndCardFaces.md).
Developed in react-game only, plus seven lines in `.github/workflows/alpha-deploy-website.yml`. Java, Python,
AWS, react-admin, OpenAPI and Robot suites are unchanged. Unit tests and build are green; the owner ran every manual
check below (each item is `[ DONE ]`, `[ UNIT ]` or `[ NOT TESTABLE ]`).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` covered by unit tests ·
`[ ROBOT ]` covered by Robot suites · `[ NOT TESTABLE ]` with the reason.
For each point: **Done** = what changed, **Test** = what to try, **Expected** = the expected result.

---

## 0. Before starting

- **Environment variables:** seven new keys, already in `code/frontend/react-game/.env.example` with one comment each.
  You must add them yourself (the agent never edits `.env*`). On November 25 none of `.env`, `.env.test` and `.env.alpha`
  has them (0 `VITE_ANIM_*` keys): local dev still works because the code defaults are the same values.

  | Variable | Where | Who reads it | Value | When needed |
  |---|---|---|---|---|
  | `VITE_ANIM_DEAL` | react-game `.env`, `.env.test`, `.env.alpha`; GitHub `alpha` environment | `src/constants/animations.js` (`readAnimationEnv`), at dev-server start / build | `true` | now (local), before the next alpha deploy |
  | `VITE_ANIM_DEAL_FACEDOWN` | same | same | `true` | same |
  | `VITE_ANIM_PLAY` | same | same (used by step 15) | `true` | same |
  | `VITE_ANIM_TURN` | same | same (used by step 15) | `true` | same |
  | `VITE_ANIM_TURN_MODE` | same | same (used by step 15) | `full` | same |
  | `VITE_ANIM_SPEED` | same | same; clamped to 0.1–4, invalid → 0.25 | `0.25` | same |
  | `VITE_ANIM_DECK` | same | same; `under` or `over` | `under` | same |

  Vite reads `.env` only at start: after every change restart `npm run dev`. Without the seven GitHub variables the
  alpha workflow step "Write .env.alpha from the alpha variables" stops with "Refusing to build". The root `.env.example`
  only has the owner's `VERSION=1.14.0`.
- **Turnstile tests (items 3, 10, 31, 35):** set `VITE_CF_TURNSTILE_KEY=1x00000000000000000000AA` (Cloudflare test key, always passes,
  from `.env.example`) in react-game `.env`, and delete the `pathsgames.turnstilePass` cookie before reloading. With the key empty
  (dev bypass) the check is skipped and no success line shows.
- **Servers** (start them yourself):
  - a backend on 8042: `cd code/backend/java && mvn -pl ms-launcher spring-boot:run`
    or `source .venv/bin/activate && cd code/backend/python && python3 -m app.launcher`;
  - react-game: `cd code/frontend/react-game && npm run dev` → http://localhost:5174.
- **Devices:** desktop browser with DevTools responsive mode at 1440×900, 1280×800 and 1024×768; phone sizes 390×844,
  600×900, 320×640 and sideways 844×390 (or a real phone). Reduced motion: DevTools → Rendering → "Emulate CSS media
  feature prefers-reduced-motion: reduce", or the OS setting.
- **Git:** nothing staged, nothing committed. Step 14 files are unstaged changes plus 12 untracked new files
  (`Deck.jsx`, `CardBack.jsx`, `DealtList.jsx`, `animations.js`, `AnimationContext.jsx`, `useDeal.js`, `animations.css`,
  five test files). The pom.xml, package.json, `Footer.jsx`, `FooterBar.jsx`, `template.yaml`, echo handler,
  `application.yml`, `config.py`, `pyproject.toml` and root `.env.example` changes are the owner's 1.14.0 version bump.

---

## 1. Steps, in order

- [ UNIT ] **1. Unit tests** (green, run again only after a change)
  - `cd code/frontend/react-game && npx vitest run --coverage`
  - Result on November 25 (run again by the tester, same numbers as the dev report): 179 files, 1959 passed, 0 failed,
    3 skipped (before: 174 files, 1872 passed). Coverage overall: statements 98.82%, branches 94.95%, lines 99.48%.
    The six new modules: 145/145 lines, 122/122 branches, 53/53 functions (100%); with the rewritten files
    (dev report) 183/183 lines, 208/208 branches, 68/68 functions. After the owner's fixes (item 38, Home antibot):
    179 files, 1961 passed, 0 failed, 3 skipped; branches 94.99%; `npx vite build` OK. Run again on November 26
    (1.15.0, steps 15–16 and the step 15 to-dos in the tree, `npx vitest run`): 191 files, 2255 passed, 0 failed, 3 skipped.
  - The dev report says the suites are also green with non-default values (deal off, deck over, speed 1, flat deal).
- [ UNIT ] **2. Build:** `npx vite build` passes (only the "chunks larger than 500 kB" warning, as before).
- [ DONE ] **3. Environment:** add the seven keys of section 0 to `.env`, `.env.test`, `.env.alpha` and to the GitHub `alpha`
  environment. Then `code/scripts/alpha/deploy_website.sh --check-only` (local check, no AWS call).
  - Expected: ".env.alpha complete: every VITE_* key of .env.example is set."
- [ DONE ] **4. Robot regression** (optional: no suite written or changed, every suite is API-only and no endpoint changed)
  - `code/scripts/dev/run_robots/run_robot_with_local_java.sh`
  - `code/scripts/dev/run_robots/run_robot_with_local_python.sh`
  - Expected: all green as in 1.13.0.
- [ DONE ] **5. Manual tests** of section 2, on desktop at three widths, on phone width, in both languages.
- [ NOT TESTABLE ] **6. Alpha deploy** (when you release): the workflow step "Write .env.alpha from the alpha variables" prints
  ".env.alpha complete: every VITE_* key of .env.example is set.", then item 36.
- [ DONE ] **7. Documentation:** `/doc-update`. To update: react-game `README.md` (Home still described as "Netflix-style story catalog grouped by category", tutorial "above the hero title", `.pg-card--home` row, new env keys and modules) and
  `code/scripts/alpha/README.md` (the alpha variable lists miss the seven `VITE_ANIM_*` keys).

---

## 2. Manual tests

Desktop items run at 1440×900 unless a width is given. Default values everywhere unless the item changes one.

### Home book

- [ DONE ] **1. Two pages, no home tab** (http://localhost:5174/)
  - Done: the Home is a book; the full-width hero banner and the category rows are gone.
  - Test: open the Home; in DevTools inspect the intro title.
  - Expected: left page = intro card with the pathway photo, title "Epic Adventures Await" (an `h1.book-page-title`),
    text "Branching narratives. Infinite choices. Every decision opens a new path: explore living worlds, face their
    dangers and write a story that is yours alone." (about three lines). Right page = the story cards. No home tab (on
    `/story/<id>` it sits at the foot of the tab column right of the cover). The book sits 16px under the navbar, as on
    every page above 1120px, and keeps an empty column on its right (about 94px, the tab column's room), so it does not
    shift sideways between the Home and `/player`. No "Stories" heading is visible (it is in the markup, hidden).
- [ DONE ] **2. Photo credit bar**
  - Test: under the intro card press "image credit".
  - Expected: the note "Image by Lili Popper with Unsplash license" opens in the card's tip area, as on the other book
    pages. The policy Credits chapter still lists the home photo.
- [ DONE ] **3. Anti-bot strip, then the success line** (Turnstile key set, cookie deleted)
  - Done: the check moved from the hero to the intro card, right under its text (owner's fix: not at the card's foot).
  - Test: reload the Home; wait for the widget to pass; reload once more.
  - Expected: under the intro text a spinner with "Checking you're human…" and the Turnstile widget; when it passes it is replaced by a green check and "Success! You are human." in the same place, which fades and is gone after about 4 s. On the second reload (cookie valid) no widget and no success line. The story cards are dealt meanwhile; their footers show "Loading…" until the check passes, then "Play".
- [ UNIT ] **4. Widget failure** (HomePage tests: "blocked" footers, no clicks, navbar error; no strip or line in the intro card).
- [ DONE ] **5. Tutorial button**
  - Done: larger (1.5rem text), centred, alone at the intro card's foot; logic and test id unchanged.
  - Test: look at it while the matches load, then click it. Start the tutorial, come back to the Home; finish it.
  - Expected: centred and bigger than in 1.13.0; disabled with a spinner while loading, then "Play the tutorial" with the play icon; the click opens `/story/<tutorial id>`. With a running tutorial match "Resume the tutorial"; once completed it is gone. It never appears while the stories are loading or failed.
- [ DONE ] **6. One story grid**
  - Done: every story in one list, today's order, the category as a badge on each card.
  - Test: look at the right page; set `VITE_ADD_COMING_SOON_STORIES=true`, restart, look again.
  - Expected: 3 columns, no category rows. Stories grouped by category in first-seen order; every card has its category
    in a small gold uppercase pill at the top right. Teasers sit inside their category with the hourglass "Coming Soon",
    greyed picture, not clickable. Paused / Completed badges and the "Play" / "Resume" / "Replay" footers as in 1.13.0.
- [ DONE ] **7. Loading page on the right page**
  - Test: DevTools Network → "Slow 3G", reload the Home.
  - Expected: right page = the game's loading page (spinner, "Loading…" card) filling the page; the intro card stays on
    the left, no tutorial button yet. No narrow 500px card any more.
- [ DONE ] **8. Fetch error on the right page**
  - Test: stop the backend, reload the Home; start it again and use the navbar retry.
  - Expected: right page shows only the yellow warning sign; the message and the retry stay in the navbar; no tutorial
    button. After the retry the stories are dealt.
- [ UNIT ] **9. Empty catalog:** "No stories available." on the right page (StoryCatalog and HomePage tests).
- [ DONE ] **10. Policy chapter over the Home**
  - Done: step 13's interim host is gone; the chapter takes both Home pages, the Home stays mounted.
  - Test: (Turnstile key set, cookie deleted) reload and at once open "Privacy Policy" from the footer; close it.
    Then open "Credits"; then load `/?policy=roadmap` directly.
  - Expected: both pages show the chapter, no house tab; the deck pile stays beside the book (always shown on desktop, owner's choice). On close
    the intro and stories come back and the anti-bot result went on (no new check; the success line, if still in its 4 s, under the intro text). Credits and the
    Devlog chapter show their cards dealt from the pile. Closing removes `?policy=` from the URL.

### Card faces and the deal (desktop)

- [ DONE ] **11. The deck pile**
  - Done: a pile of ten card backs on the table, right of the right page, partly under the cover.
  - Test: open the Home and look right of the book; then `/story/<id>`; hover and click the pile.
  - Expected: ten backs (gold 45° stripes on brown, double gold frame, a d20 in the middle) gathered with small tilts,
    right of the cover at the foot of the tab column: its bottom about 66px above the book's bottom edge (24px above the
    home tab's foot), a strip of about 30px under the cover. On `/story/<id>` the home tab covers its lowest card a
    little and every side tab lies over the pile. Only the top card's d20 is light gold and pulses (grows and glows,
    about 1.6 s per beat); the nine below are still and dimmer. Hover and click on the pile do nothing (clicks reach
    what is under; the tabs over it still work).
- [ DONE ] **12. Deal on the Home**
  - Done: each card flies face-down from the pile's top card and flips face-up on landing.
  - Test: reload the Home and watch the right page.
  - Expected: first the cover opens (first load only: it fades in from a backward tilt at 85% size, about 2.6 s; the
    pile lies still on the table, it is outside the cover); the cards wait, invisible, until it ends. Then they appear
    one after the other, entering the right page from its right edge, back side up, and flip to the front as they land.
    One card flies about 2.5 s; the eighth leaves about 3.1 s after the first; a full hand lands in about 5.6 s. The list
    does not slide in from the right. While a card waits or flies it cannot be hovered or clicked. No empty room for a
    deck at the bottom of the right page: the cards use the whole page height. The same wait follows every book change
    between routes and every page turn (step 15). With `VITE_ANIM_COVER=false` (restart) there is no opening and the
    deal starts at once.
- [ DONE ] **13. Dealt once**
  - Test: after the deal, hover cards; scroll the stories list down and back up; wait for the footers to turn to "Play".
  - Expected: hover lifts the card and turns its border gold, no flip, no back. Cards that enter the view when
    scrolling are dealt then, as a new batch from the pile; cards already dealt never fly again, also when their footer
    changes.
- [ DONE ] **14. Front face keeps every part** (story page, start-match and a match)
  - Done: the card content moved into a front face; sizes from step 13 (6.3.16) unchanged.
  - Test: look at the cards after landing.
  - Expected: title with its bonus badges, type badge on hover, image overlay statistics, (i), select / selected state,
    action button (spinner while running), secondary buttons, locked label with lock icon: same place and size as in
    1.13.0. No back face visible at rest. The page cards (left page, story page) have no back and are unchanged.
- [ UNIT ] **15. Focus, unmount, re-render, hidden cards:** a waiting card reached with Tab lands at once; leaving a page
  mid-deal lands every card; a re-rendered card is not dealt again; a card added later is dealt (DealtList tests, 25).
- [ DONE ] **16. Deck over the cover**
  - Test: set `VITE_ANIM_DECK=over`, restart `npm run dev`, open the Home; then back to `under`.
  - Expected: the pile now lies on top of the cover's right edge, covering a bit of it (`data-place="over"` on
    `.deck-pile`). With `under` the cover hides that strip.
- [ DONE ] **17. Flat deal**
  - Test: set `VITE_ANIM_DEAL_FACEDOWN=false`, restart, reload the Home.
  - Expected: the cards fly face-up and fade in from the pile, no back, no flip.
- [ DONE ] **18. Speed**
  - Test: in DevTools look at the `style` of `<html>`; then set `VITE_ANIM_SPEED=1`, `=10`, `=abc`, restarting each time.
  - Expected: default `--t-deal: 2480ms`; speed 1 → `620ms` (four times faster deal); 10 is clamped to 4 → `155ms`;
    `abc` falls back to 0.25 → `2480ms`. The d20 pulse keeps the same beat at every speed.
- [ DONE ] **19. Deal off**
  - Test: set `VITE_ANIM_DEAL=false`, restart, open the Home, a story and a match.
  - Expected: no pile anywhere; every card is shown at once (the old short slide-in of the list is back); every
    `.pg-card` carries `data-deal="landed"`.
- [ DONE ] **20. Reduced motion**
  - Test: on the Home turn on DevTools "prefers-reduced-motion: reduce" (or the OS setting) without reloading; open a
    story; then turn it off and open another page.
  - Expected: `<html>` gets `data-pg-reduced="true"`, the pile disappears at once, the story's cards are shown at once
    with no flight and no back. Turned off: the attribute goes, the pile comes back and the next list is dealt again.

### Every card grid (desktop)

- [ UNIT ] **21. Wrapping:** each of the 16 grids carries `pg-dealt` (one smoke test per family).
- [ DONE ] **22. Story page** (`/story/<id>`)
  - Test: open a story; press the action of a selectable card (class, character, trait or difficulty), pick an option.
  - Expected: the six loadout cards are dealt from the pile; the option list is dealt too; the selected option has the
    gold border and glow on its front.
- [ DONE ] **23. Start match** (`/start-match/<id>`)
  - Test: on the story page press "Start"; on `/start-match/<id>` accept the terms, press "Start" and watch both blocks
    until the match opens.
  - Expected: the fixed cards (story, game type, bonuses, terms, bonuses with "Start") are dealt; each phase card is
    dealt when it appears.
    Borders as before: completed green, in progress gold glow, failed red. The guest login card text fits the card.
    No horizontal scroll bar flashes inside the lists while the cards fly in.
- [ DONE ] **24. Match pages** (`/play/<id>`)
  - Test: look at the board's right page; open the tabs "Information", "Backpack", "Missions" and one mission; from the
    Information page open the registry; open the experience card (training); make an action that offers choices.
  - Expected: every right-page list (board, information, backpack, registry, missions, mission steps, experience,
    pending choices) is dealt from the pile each time it opens. A done mission or step keeps its green border. Cards
    stay inside the right page while flying (clipped at its edge, never over the left page).
- [ DONE ] **25. Player page** (`/player`)
  - Test: open it from the navbar user button with a few matches; with a Google account check the missions part too.
  - Expected: the match cards are dealt; the highlighted match keeps its gold ring on the front; no horizontal scroll
    bar flashes inside the list.

### Desktop widths

- [ DONE ] **26. About 1440px** (1440×900, then 1440×800)
  - Expected: at 1440×900 the pile is at full size, fully visible right of the cover at the tab column's foot (bottom
    about 66px above the book's bottom), strip under the cover; 3 columns; no horizontal scroll bar on the page. At
    1440×800 (a short screen, at most 820px high) the pile is smaller (70%), same place; on `/play/<id>` the lowest game
    tabs may lie over its top.
- [ DONE ] **27. About 1280px** (1280×900, then 1280×800)
  - Expected: pile closer to the book and smaller: about 82% at 1280×900, 70% at 1280×800 (the short-screen rule wins);
    its bottom still about 66px above the book's bottom, just above the home tab; 3 columns; no horizontal scroll bar.
- [ DONE ] **28. About 1024px**
  - Expected: tablet layout (768–1120px): tabs on the cover's top edge, no side column (the Home book 16px under the
    navbar, `/story/<id>` 46px). The book takes 94% of the width; the pile (about 82%, bottom about 70px above the book's
    bottom) shows only its left edge right of the book (with `over` also the part on the cover), the rest is cut; never
    a horizontal scroll bar; 2 columns. Cards still enter the right page from its right edge.
- [ DONE ] **29. Picture and text sizes** (all three widths)
  - Test: the Home intro with the Turnstile strip and the tutorial button; a story page; a match.
  - Expected: page pictures at most 45% of the page height and never shrunk to make room for the strip, the button or
    the text; card titles, texts and badges as big as in 1.13.0 (step 13, 6.3.16).
- [ DONE ] **30. Column breakpoint**
  - Test: on the Home drag the width from 1200 to 1100 px.
  - Expected: 3 columns above 1120px, 2 below, on every card grid.

### Phone width

- [ DONE ] **31. Home on a phone** (390×844)
  - Done: the Home is rendered once; CSS stacks the intro page above the stories page.
  - Test: (Turnstile key set, cookie deleted) open the Home and scroll the whole page.
  - Expected: one column of book: intro (picture about a third of the screen high, title, text, the anti-bot strip
    under the text, then "Success! You are human." for about 4 s, the tutorial button), then the stories in 2 columns. No
    home tab, no ten-card table pile, one widget only, no horizontal scroll. While the stories grid is on screen the page
    deck (three backs, about 54px wide, the top one with the pulsing d20) rides the bottom right of the screen, about
    12px above its edge. After the first-load opening, cards are dealt as they scroll into view, flying in face down
    from that deck and clipped by the page.
- [ DONE ] **32. Columns on phones**
  - Test: Home and a story page at 600×900, 320×640 and sideways 844×390.
  - Expected: 600 wide → 2 columns (was 3 in 1.13.0); 320 → 1 column; sideways → 3 columns.
- [ DONE ] **33. Policy chapter on the Home, phone**
  - Test: open "Privacy" from the footer, scroll, close it.
  - Expected: the chapter's two pages are stacked inside the Home book, shown once (no second copy below it); closing
    brings back the intro and the stories.
- [ DONE ] **34. Other books on a phone**
  - Done: at first a deviation (a hidden desktop copy); since step 16 part A every book is rendered once, and step 16
    part B deals from a page deck on phones.
  - Test: `/story/<id>`, `/start-match/<id>`, `/play/<id>`, `/player` at 390 wide; then open a story at 1440 and narrow the
    window under 767px.
  - Expected: no table pile; while a dealt grid is on screen the page deck rides the bottom right of the screen and the
    cards fly from it; nothing stays invisible. At the switch to the phone layout the same cards stay (one tree, no
    copy): the landed ones are not dealt again, the table pile goes and the page deck shows.

### Languages

- [ DONE ] **35. IT/EN texts**
  - Test: switch to Italian on the Home (with the Turnstile key and the cookie deleted), then back to English.
  - Expected: Italian: "Verifica che tu sia umano…" then "Verifica superata! Sei umano.", "Avventure Epiche ti Aspettano",
    "Narrazioni ramificate. Scelte infinite. Ogni decisione apre un nuovo sentiero: …", "Gioca il tutorial" / "Riprendi il tutorial", "crediti immagine" →
    "Immagine di Lili Popper con licenza Unsplash", "Prossimamente". English: "Checking you're human…", "Success! You are
    human.", "Play the tutorial", "image credit". A language change reloads the catalog: the loading page shows, then the
    stories are dealt again (new list, expected).

### Regressions

- [ NOT TESTABLE ] **36. Alpha site** (after the deploy)
  - Test: open the alpha Home with the DevTools console open.
  - Expected: no CSP "Refused to apply" error; `<html>` carries `--t-deal: 2480ms`; the deal and the pile work as on local.
- [ DONE ] **37. Things that must not change**
  - Test: one full tour of the game.
  - Expected: a story click opens `/story/<id>` (with step 15's book change); hidden stories stay hidden
    (`VITE_HIDE_STORIES=true`); navbar, footer, drawn tooltips and the cookie banner as in 1.13.0, except the desktop side
    tabs' tips opening on their left (step 15) and the banner's new row (step 16); on phones an (i) shows its card in the
    book with a fade, no modal (step 16); the end-game "Close" / "Chiudi" goes to the Home in the app with a book change,
    no reload; the navbar dice bounces and the book opens on the first load only; with reduced motion both stop (step 16's
    `preferences.css`, step 15's `cover` gate).
- [ DONE ] **38. Short lists: no scroll bar, nothing cut** (owner's fix)
  - Done: a dealt list no longer scrolls or clips by itself; its parent (the page area) scrolls and clips.
  - Test: open lists with one row of cards (the Home with `VITE_HIDE_STORIES` leaving 1-3 stories, a match's "Missions"
    with one mission, `/player` with no matches) and with two rows; reload to watch the deal; then hover the small cards
    of the right page, the last column and the last row included.
  - Expected: no scroll bar appears during or after the deal; every card's flight is whole down to the page's bottom
    (not cut under the first or second row); the hover shadow (dark drop shadow plus a gold glow) is whole on every
    card, also the first (top and left) and the last of the row (top and right); the grid sits about 12px from the
    page's left edge and about 22px from its right edge (scroll bar included). Lists longer than the page still scroll (Home, `/player`, credits); the
    scroll bar sits at the page's right edge, dark gold (gold thumb on a dark see-through track, brighter on hover).

---

## 3. Notes from development

- Deviation 1: step 16's "one tree on mobile" is not built yet. Only the Home renders once (Home-only mobile CSS stacks
  its pages); the other books still render a hidden copy, whose cards stay "waiting" until the layout switches (item 34).
  - Resolved by step 16 part A (developed with step 15, November 25, 2026): items about the hidden mobile copy now see one tree.
- Deviation 2: `overflow-x: clip` added to `.book-stage` so the pile beside a narrow book is cut without a horizontal scroll
  bar. The dev report says "above ~991px"; in `book.css` it is the base rule, so it applies at every width (on phones
  `html, body` already clip).
- Deviation 3: the list carries `data-deal-list="on"` while dealing; CSS drops its slide-in animation then.
- The page deck (`.deck`, three backs at the end of the right page) is rendered but hidden everywhere until step 16;
  phones deal from the screen corner.
- A list is dealt once per mount: every view change in a match, and a language change on the Home, mounts a new list, so
  its cards are dealt again. By design.
- Owner's fixes after the first test round: every dealt list is `overflow: visible` (animations.css), so a one- or
  two-row list no longer cuts the flight or the hover shadow nor shows scroll bars; `.selection-scroll` gains
  `overflow-x: hidden`, `.matches-list-wrap` scrolls instead of its list; on desktop the grid gets 8px 4px 12px padding
  and its scroller reaches 10px into the page margin, so the bar moves right and the grid is close to the page edge;
  the hover shadow is tighter (`0 10px 14px -4px` dark plus a gold glow `0 0 9px 1px`) so it fits that room;
  the bars inside the book are dark gold (item 38). The Home's anti-bot strip and success
  line moved under the intro text (`Card` prop `afterDescription`); the line shows only after a check passed on this
  visit and leaves after 4 s (items 3, 31). The intro text is three lines long (items 1, 35).
- Owner's choice (same day): the table pile is always shown on desktop while the deal is on (`.deck-pile` is
  `display: block`), no longer only when the right page holds a dealt list; still hidden on phones and with the deal off.
- The step file's "Between about 1100 and 1360 px" is one CSS rule at `max-width: 1360px` (scale 0.8); under about 1150px the
  book is 94vw and the pile is mostly cut.
- Removed: the hero (`HERO_IMG`, `.hero-*`), `.pg-card--home`, `.stories-grid`, `.stories-section`, `.section-label`, the
  `maxWidth` prop of `LoadingCard`, the four `!important` column rules of `mobile.css`.
- Not seen in a browser by the developer: all geometry (pile place at 1440 / 1280 / 1024, entry edge, picture and text sizes).
- Later work (November 26, 2026, 1.15.0) changed items: step 16 parts A and B (one tree, page deck, phone fades) → 31, 34, 37;
  step 15 book change and first-load opening (`RouteBook`, `useDeal.openingOf` gone) → 12, 37; bookmarks per screen size
  (pile via `--home-bottom` / `--pile-scale`) → 1, 11, 26, 27, 28; shared `AntibotSuccess` → no change (same line and 4 s).

---

# Version Control
- **Document Version**: 1.15.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.14.0 | Test list for the Home book and dealt cards | November 25, 2026 |
  | 1.15.0 | Items updated after book changes; tested and closed | November 27, 2026 |

- **Last Updated**: November 27, 2026 (v1.15.0)
