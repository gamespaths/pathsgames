# Step 15 — Play and page turn

**Status: developed and tested, closed by the owner (November 27, 2026, version 1.15.0), react-game only; all section 9 to-dos (1–18) developed and tested (193 test files, 2303 passed, 0 failed, 3 skipped, build OK; `useDeal.js`, `bookSwap.js`, `RouteBook.jsx`, `PlayedPile.jsx`, `DealtList.jsx` at 100%); concept `website_concepts_v0/v1.15.0/`; owner test list: [test/Step15_PlayAndPageTurn.md](./test/Step15_PlayAndPageTurn.md).**
Roadmap line: *choosing a card and changing page are animated* ([Roadmap](./Roadmap.md) step 15).
Book UI chain: [Step 13](./Step13_BookLayoutWithoutModals.md) (layout, routes, no modals) ·
[Step 14](./Step14_HomeBookAndCardFaces.md) (card faces, animation config, deal) · **Step 15** ·
[Step 16](./Step16_MobileBookAndPreferences.md) (mobile book, preferences).
Development order: step 13, step 16's one-tree mobile switch (each page rendered once, so this
step animates one copy), then steps 14, 15, 16.
Prototype: `website_concepts_v0/v1.13.0/` (`demo.js` `play`, `flyOut`, `discard`, `fullTurn`, `simpleTurn`).

## 1. Scope

Goal: the played card lifts, glows and flies into the story while the server answers, then the
book turns ONE page; every other change inside a page turns or fades. react-game only.

**In**
- Play effect: lift and glow during the API call, then a fixed clone flies into the left page
  picture (mobile: top of the screen), for movement, action, choice, sleep, item use, experience
  and end game. Two-step flow kept: a play from a reading page flies its picture with no dim or
  fall; the other cards dim and fall only for choice "Do" and training (action on the small card).
  Never for the (i), drop item or view shortcuts.
- Ordering with `useGameplayResults`: flight and fall end first, the page is held while the board
  reloads, ONE turn when the new board has landed; `LoadingCard` only for a slow reload.
- Desktop page turn: `full` (sheet on the spine) and `simple` modes, forward / back / fade,
  driven by a Book page key + direction (hook left by step 13) and a hold flag.
- Direction mapping for GameBook, story set-up, player page, end game, policy chapter: full
  turns only for view changes; previews and news chain arrows fade.
- (i) preview: fade on the page it opens; game previews keep their place (right page; mobile:
  below the location). Mobile: `CardPreviewModal` removed, the left previews of story set-up,
  start-match and game replace the top card with a fade, the page scrolls to it, a back arrow closes it.
- Reduced motion and the step 14 flags for all of the above; unit tests.

**Out** — modal removal, routes, home tab, drawn tooltip, book graphics, footer, ErrorCard placement (step 13); card faces,
config module, `animations.css` creation, deal (step 14); vertical mobile book, mobile page turn,
sticky deck, deal on scroll, vibration, preferences (step 16); i18n (step 17).

## 2. Endpoint APIs

None. Java, Python and AWS backends and the OpenAPI specs are unchanged.

## 3. DTOs and Domain Models

No backend DTO. Front-end in-memory shapes only:

| Shape | Fields |
|---|---|
| Play state (`PlayContext`) | `playId` (e.g. `movement:<uuid>`, `exp:<stat>`), `el` (clicked card root), `phase` `lift` \| `land` |
| Book turn props | `pageKey` (counter, or `policy:<kind>` for a chapter, step 13), `direction` `'forward'` \| `'back'` \| `null` (step 13) plus `'fade'` (this step), `holdTurn` (bool, this step) |
| `useBookView` state | gains `turn: { key, direction }`; loses `previewModal` |
| Timings (`useAnimationSettings().timings`, step 14) | uses `lift 240, fly 560, discard 320, discardStep 50, flip 900, simple 520`; this step adds `fade 200` (ms at speed 1, divided by `VITE_ANIM_SPEED`: at 0.25 the flip lasts 3.6 s) |

## 4. Roles and Authentication

No change: guests and Google users see the same effects.

## 5. Database Tables

None: no Flyway migration (SQLite, PostgreSQL), no DynamoDB item, no localStorage key.

## 6. Components

### 6.1 react-game — play effect

- `PlayContext` (new, `features/gameplay/play/`), provided by GameBook: `begin(playId, el)`,
  `land()`, `cancel()`, `onPlayStart` (no-op hook for step 16 vibration). One capability gate:
  without `Element.prototype.animate` (jsdom) or with `anim.play` off, nothing runs and the board
  keeps today's behaviour.
- `Card` gets an optional `playId` and reads the context: `is-playing` on its root when the ids
  match; only when the played card is itself a small card, `is-dimmed` / `is-discarded` on every
  other small card (`.pg-card`) of the book. Reading pages (`variant="page"`) never dim, and a
  reading-page play dims nothing. React owns these classes (no `classList` on live nodes).
- `CardButtons`: when `playId` is set and a provider exists, the main action (`onAction`) and the
  select button (`onSelect`, choice "Do") call `begin` with `e.currentTarget.closest('.pg-card,
  .book-page-content')`; `finally` cancels a play still in `lift` (API error, `STALE_MATCH`).
  The (i), secondary actions (drop, shortcuts) never play.
- Two-step flow kept: on the board the small card's "Go" / "Do" is the (i) and opens the reading
  page, where the action plays; choice "Do" and training play straight from the small card.
- The seven cards pass `playId` on the small card and inside the preview `props`, so the reading
  page action plays too: `MovementCard` (map page included), `ActionCard`, `ChoiceCard`,
  `GoToSleepCard`, `ItemCard` (use only), `ExperienceStatCard`, `EndGameCard`.
- Lift: small card `translateY(-14px) scale(1.08)`, gold pulse and light sweep on its front face
  (`.pg-card__front`, step 14); reading page: its picture lifts and glows, the page stays still.
  The button spinner stays. **Owner's decision after the test (November 25, 2026):** on a reading page the whole
  card lifts and flies (`.book-page-content`), not only its picture. `onPlayStart` runs synchronously inside the click (user activation).
- `land()`: siblings fall (small-card play only; WAAPI, stagger `--j` capped at 8, random tilt) and a fixed clone of
  the card (reading page: the whole card, owner's decision) flies in an arc to the left page picture
  (`.book-page-left .book-page-img`, else the left page centre); on mobile to the top centre,
  below the always-visible navbar of step 13. Resolves when both end; the clone is removed, also on unmount.
  End states live in classes (`is-discarded`, played card hidden), not in WAAPI fills: the
  hold snapshot (6.3) uses `cloneNode`, which does not copy running animations.
- The Book root gets `is-busy` while a play runs: no hover lift, footer buttons, page arrows and
  bookmarks (the home tab included) inert; the navbar, brand included, stays live.
- **Card special components stay** (step 13, 6.3.16): `playId` and the play classes are added
  to `Card.jsx` / `CardButtons.jsx` without removing any of them (page arrows, `BonusBadgeList`
  overlay and title badges, `TipNote`, `extraContent`, `CardCreditsBar`, "view original" link,
  `gc-type-badge`, `childrenIntoImage`, (i), select and selected state, spinner, `actionsList`,
  locked label). The flying clone and the turn snapshots copy them as they are; the mobile
  previews that replace `CardPreviewModal` (6.5) and the end game moved into GameBook (6.4)
  keep them too. Their tests and test ids stay.

### 6.2 react-game — ordering with `useGameplayResults`

Sequence of a play (desktop, effects on):

| # | What the player sees | Code |
|---|---|---|
| 1 | Card lifts and glows | `CardButtons` → `begin`, then the card's API call |
| 2 | API answers: others fall (small-card play), card flies | handler → `await play.land()` (before `reloadBoard`) |
| 3 | Emptied page stays on screen | `holdTurn = true` in the same batch as `reloadBoard` (snapshot of the old DOM) |
| 4 | — (hidden) | `resetForReload`, news, `loading`, new `gameData`, chrome refresh |
| 5 | ONE turn to the new spread | after reload **and** chrome settle → `holdTurn = false` with the answer's direction |
| 5b | Slow reload: turn to `LoadingCard`, the board appears without a second turn | hold released 1000 ms after the landing if still loading |

- Handlers touched: `handleEventExecuted` (item use and training go through it),
  `handleMovementDone`, `handleSlept`, `handleSelectChoice` (also `cancel()` in its `catch`), and
  GameBook `handleEndGame` (land → hold → `setGameEnded` → release). `handleItemDropped` unchanged.
- When no play is landing and turns are off, handlers stay synchronous (`land()` returns null),
  so the existing `useGameplayResults*` and `GameBook*` suites keep their timing.
- `useMatchChrome.refresh` returns a promise (all three calls settled), so a weather change of
  the same answer lands inside the one turn instead of after it.
- Safety: a hold never lasts more than 10 s; a refetch (`reloadKey`) during a hold releases it with `none`.
- Mobile (until step 16): lift, fall and flight run on the live page, then today's reload
  (`LoadingCard`, scroll to top); no hold, no turn.

### 6.3 react-game — page turn engine

Recommendation: **DOM snapshot before the state change**, not the View Transitions API. During
`startViewTransition` the whole document stops rendering until the update promise settles (no
glow, no `LoadingCard` fallback) and Chromium aborts it after about 4 s; a two-faced 3D sheet
(old right page in front, new left page behind) also does not fit the pseudo-element tree.

- `Book` props: `pageKey`, `direction`, `holdTurn`. A small class component (`BookPages`, new)
  renders spine, pages and an empty `.book-turn-layer` that React never fills.
  `getSnapshotBeforeUpdate` clones both `.book-page` nodes when `pageKey` changes or `holdTurn`
  turns on; `componentDidUpdate` runs the strategy (DOM already new, not yet painted).
- Clone hygiene: strip `id`, `data-testid` and `data-tip` (no drawn tooltip on a sheet), replace `iframe` (Turnstile) with an empty box,
  copy `scrollTop` of scrolled descendants, `aria-hidden` + `inert` on the layer; the layer
  absorbs clicks while present.
- `full` forward: sheet = old right clone, back face = clone of the new left page, old left clone
  held until the sheet lands; back is the mirror. Shading, cast shadow, perspective as the
  concept (`fullTurn`). `simple`: clones removed, live `.page-inner` animated with the concept's
  `page-enter` / `page-enter-back` / `page-fade` keyframes (WAAPI). `fade`: both old clones fade
  out over the live pages (an unchanged page crossfades with itself, invisibly).
- A new change during a running turn finishes it at once, then starts. Book publishes a
  `turning` flag (context) that feeds `DealtList` `hold` (step 14): the new cards are dealt
  after the turn, never under the sheet.
- Strategies: `{ full, simple, fade, mobile: null }`, each `{ snapshot(bookEl), run({ snapshot,
  bookEl, direction, timings }) }` (the before-commit and after-commit hooks). On the mobile
  layout (`MOBILE_MQ`, the same Book with its pages stacked) only `mobile` may run: step 16 plugs in
  `components/book/mobileTurn.js` with no change to callers. Step 13's `data-page-key` /
  `data-direction` attributes stay as test hooks.
- `useBookTurn()` (new): `{ pageKey, direction, turnTo(direction) }` for books on `useState`;
  `turnTo` is called in the same handler as the state change (one batched commit).

### 6.4 react-game — direction mapping

GameBook: `useBookView` sets `turn` in its reducer through a pure `turnFor(state, action)`
(new `js/bookTurns.js`); any action may override it (`setPreviewRight(value, 'fade')`).
"none" below is `direction: null`.

| Change | Code path | Transition |
|---|---|---|
| Open information, backpack, map, missions | `openInfo`, `openItems`, `openMap`, `openMissions` (tabs, status card, info cards) | forward; tab to tab by bookmark order (position, information, backpack, map, missions): to the right forward, to the left back |
| Open registry, training, a mission's steps, match history | `openRegistry`, `openExp`, `openMission`, `matchlog` | forward |
| Back to the board (back arrow, position tab, enter from map) | `closeAll` | back |
| Mission steps back to the grid; choices closed; coma / sadness back | `openMissions`, `closeChoices`, `setPreviewLeft(null)` | back |
| (i) reading page open / close; map node selected; close prompt (home tab or brand, step 13, also from an open policy chapter); "match updated" card; error page | `openPreview` (lens), `selectMapNode`, `previewRight` | fade |
| Answer of move, action, choice, sleep, end game | hold → release | ONE forward turn |
| Answer of item use, training (the bag / training page closes) | hold → release | ONE back turn |
| News chain arrows (effect → weather → wake-up list, missions completed) | `onForward` / back | fade |
| News arriving after the turn (weather, fetched item card) | async `setPreviewRight` | fade |
| Refetch on `STALE_MATCH` or page return; reload internals | `reloadKey`, `resetForReload` | none |

Full turns only for the view changes above; news chain arrows fade (a flip lasts 3.6 s at speed 0.25).

Other books (`useBookTurn`):

| Book | Forward | Back | Fade | None |
|---|---|---|---|---|
| Story set-up `/story/:storyId` | "Change" opens a picker (+ selected preview) | picker back arrow, option chosen | option (i), single-option detail | trait toggle |
| Player page `/player` | match (i) → story + missions, mission → steps, history | every back arrow | step (i) | missions loading → loaded |
| End game | board → end game (the play answer) | steps → grid, missions card arrow → ending | step (i) | — |
| Policy chapter (step 13) | open, roadmap → credits link | close | — | — |

- Home tab or brand in a match with a policy chapter open (owner decision, step 13 6.3.3): the
  chapter gives way to the close card in ONE commit, so ONE fade; the close prompt's `fade` wins
  over the chapter's back turn.
- End game: GameBook keeps ONE Book for the whole match; `EndGameBook` state and pages move to a
  hook (e.g. `useEndGamePages`) rendered through that Book, so entering the end game is a turn,
  not a second book mounting with `bookOpen`. Its `body` / modal-backdrop clean-up goes (left by
  `Step13_BookLayoutWithoutModals.md`, which also drops its `overlayClass` and `onClose`).
- Start-match page: (i) fade only; its phase cards are progress, not pages (no turn).

### 6.5 react-game — (i) preview

- Desktop: `fade` transition when a preview opens and closes, on whichever page it lands
  (story set-up and start-match: left; game: right). The `fadeIn 0.18s` of
  `.card-preview-overlay` is removed (no double fade).
- Game previews keep their place: right page on desktop, below the location on mobile, same fade.
- Mobile: `CardPreviewModal.jsx` deleted with every `window.bootstrap.Modal` call for it
  (`useBookView` `previewModal`, `hideCardModal`; `StartBookModal`; `StartMatchFlow`; their CSS
  `.card-preview-modal-*`). `CardDetailModal.jsx` (unused) is already deleted by step 13.
  - GameBook: a left preview on mobile becomes `previewLeft`, as on desktop (top of the column).
  - Story set-up: the preview takes the place of the hero story card (picker open: on top of the
    list, under its back button). Start-match: the preview, Google login panel included, takes
    the place of the story card; the "became Google user" effect only clears the preview.
  - New `FadeIn` wrapper (WAAPI opacity on mount, keyed by the preview; mobile layout only, on
    desktop the Book `fade` runs), also around the game's right-page preview below the location;
    the page scrolls to the card with the step 13 scroll helper; the card's back arrow
    (`page-back`, label `card.back`) closes it. No new i18n key.

### 6.6 react-game — reduced motion, config, CSS

- Flags and timings come from `useAnimationSettings()` (step 14), read at each effect (a step 16
  preference change applies at the next play): `play` gates 6.1, `turn` and `turnMode` gate 6.3
  and the fade. OS `prefers-reduced-motion` (`reduced`) turns all of them off.
- Play on, turn off: flight, then today's reload with `LoadingCard`. Play off, turn on: spinner,
  then hold and one turn.
- CSS rules go into step 14's `animations.css`: `.is-playing`, `.is-dimmed`, `.is-discarded`,
  `.flying-card`, page-variant glow, `.book-turn-layer` (perspective 2600px), `.page-flipper`,
  `.flip-shade`, `.turn-shadow`, `.is-busy`, plus the reduced-motion block. No new env variable.

### 6.7 What step 16 plugs in

`mobile` turn strategy with its own snapshot of the visible slice (then hold, turns and the
fallback work on phones with no change to callers); `onPlayStart` → `vibratePlay()`;
preferences as `useAnimationSettings` overrides. The mobile flight target set here (top centre
below the navbar) is swapped for step 16's `visibleSlice()` top. Step 16's landing after a
mobile turn (top of the page when the left page changed, else the right page's top) runs in those
before/after-commit hooks. Its sticky tabs, which replace the mobile status card, turn by the 6.4 bookmark order.

### 6.8 Java, Python, AWS, react-admin, Robot

No change. The Robot suites are API-only (RequestsLibrary, no browser library): no new or
changed suite.

## 7. Tests

Vitest + jsdom, coverage of new code > 96%. Effects are covered by stubbing
`Element.prototype.animate` (returning `{ finished, finish, cancel }`) and `window.matchMedia`;
timers with fake timers.

| Suite | Covers |
|---|---|
| `pageTurn.test.js` (new) | clone hygiene (`data-tip` stripped too), `full` fwd/back, `simple`, `fade`, no-`animate` instant path, overlap finish, cleanup |
| `BookPages.test.jsx` (new) | key change → strategy and direction, `none`, hold on/off → one turn, 10 s safety, mobile skip, `turning` flag |
| `PlayContext.test.jsx` (new) | begin / cancel classes, land: fall stagger, no dim or fall for a reading-page play, flight clone added and removed, targets (left picture, left centre, mobile top), disabled → null, unmount cleanup, `onPlayStart` |
| `bookTurns.test.js` (new) | every row of the 6.4 tables, tab order, news arrows fade |
| `FadeIn.test.jsx` (new) | animates on key change, mobile only, reduced motion |
| `CardButtons`, `Card`, `CardVariants` | begin on action and select, (i) and secondary never, no provider = today; every special component and test id unchanged (step 13, 6.3.16) |
| `useGameplayResults*` | land → hold → release order, item / training back, choice error cancel, slow fallback, chrome promise |
| `GameBook*`, `EndGameBook*` | Book props, end game in the same Book, no `CardPreviewModal`; home tab from an open policy chapter: one fade to the close card, no back turn |
| `StartBook*`, `StartMatch*`, `GuestUserModal*` | mobile preview in the top card, back arrow, scroll, turn directions; modal tests removed |
| `GameBookViewModel.test.jsx` | modal cases replaced by mobile `previewLeft` and `turn` |

## 8. Doubts

No open doubts. Owner decisions (November 24, 2026): two-step flow kept (6.1), game previews
keep their place (6.5), news chain arrows fade (6.4), Card special components kept (6.1), home
tab from a policy chapter in a match opens the close card (6.4).

Fixes after the first test (November 25, 2026, owner): the flying copy is a child of `body`
(`body > .flying-card`, it was off screen under `main.css` rules); a reading-page play flies the
whole card (6.1). News arriving in the same answer lands inside the one turn, and the Book root is
`inert` with `aria-busy` while a card plays, turns or holds. Details in
[test/Step15_PlayAndPageTurn.md](./test/Step15_PlayAndPageTurn.md) §3.

## 9. To do

Owner's requests after the first test round (November 25 and 26, 2026), developed November 26, 2026 (1.15.0), tested.

**No page turn when a play does not change the location.** Developed (November 26, 2026, 1.15.0). Today every play answer lands, holds
the old pages while the board reloads and then turns ONE page with a fixed direction
(`useGameplayResults`, `played(direction, …)`). A play that leaves the character where it is
(a sleep, most actions and choices) must not turn the page: the held copy **fades** out instead
(step 15's `fade` strategy, `timings.fade`; on phones step 16's mobile strategy already only fades
the copy). The card flight and the hold stay as they are; the news of the same answer (weather,
missions) still lands inside the fade.

- How the client knows: the answers already say it, no backend change. Movement: `toLocationUuid`
  (always a move). Execute event, select choice (it extends `ExecuteEventResponse`) and use item:
  `movementApplied: true` or a non-empty `locationChanges[]` (forced movement). Sleep and use exp
  never move. The same rule is in `chromeScope.js` (`moved`): extract it as `movedBy(result)` and
  reuse it in both places.
- Turns per play:

  | Play | Today | After |
  |---|---|---|
  | Movement | forward | forward (always moves) |
  | Event / action ("Do") | forward | forward when `movedBy`, else fade |
  | Choice | forward | forward when `movedBy`, else fade |
  | Sleep | forward | fade |
  | Use item | back | **back, kept** (the bag is on the left page) |
  | Use exp (training) | back | **back, kept** (the training page is on the left page) |

- Unchanged: navigation turns (tabs, bag, map, missions, choices list, match history), the end
  game pages, the hold safety and the release order.
- Multiplayer (V4+): `locationChanges` lists every moved character; then check the player's own
  `characterUuid` among them.
- Tests: `movedBy` (movement, forced movement, no move, empty answer), `useGameplayResultsPlay`
  and `GameBookTurns` (sleep and a non-moving action release with a fade, a forced-movement event
  turns forward, item and exp still turn back); owner's test list items 5–9 updated.

**Book change between routes** — Developed (November 26, 2026, 1.15.0) (owner request and answers, November 26, 2026; concepts
`website_concepts_v0/v1.13.0/README.md` "Between pages", `demo.js` `openRoute`, `swapBook`, `mobileSwap`, and
`website_concepts_v0/v1.14.0/README.md` (named `v1.15.0` until November 27) "Book change between routes", "Owner decisions", `demo.js` `BOOK_OF`,
`swapTimes`, `pendingRoute`). No V1 step took it: this step turns pages inside one route only. Today React Router
unmounts the old Book at once and the new one mounts with step 13's CSS `bookOpen` (`book.css` `.book-shell`, 0.6 s,
not scaled by `VITE_ANIM_SPEED`, not gated by any flag or step 16 preference); a navbar click or browser Back during
a play, hold or turn cuts it; Leave, the end game's "Back to home", the fatal error close and the navbar brand even
reload the whole site. Wanted: when the player moves to another book, the open book closes (its right half folds
over the spine, the leather cover shows its title), slides out to the left, the next one comes in closed from the
right and opens, in at most 10 s; every other route change turns the page, forward towards the game, back otherwise;
a navigation during any book animation waits until the book is free. react-game only: no endpoint, DTO, table,
OpenAPI or Robot change (Java, Python, AWS, react-admin untouched).

- Books and covers (owner's rule: swap whenever the book changes, concept `BOOK_OF`):

  | Book | Routes (rank) | Cover title | Cover subtitle |
  |---|---|---|---|
  | Home book | `/` (0), `/player` (1) | `nav.brand` (Paths Games) | new `book.coverSub`: "Web gamebook" / "Librogame web" |
  | Story book | `/story/:id` (1), `/start-match/:id` (2), `/play/:id` (3), end game included | story title, current language | `nav.brand` |

- Route pairs (pure `routeTransition(prev, next)`; browser Back / Forward follow the same rule):

  | From → to | Trigger | After |
  |---|---|---|
  | Home → story set-up | story card, Tutorial | swap |
  | Home → game | Resume | swap (owner) |
  | Home ↔ `/player` | navbar user / sign-in, blocking match; home tab, Back | forward / back turn |
  | Story set-up → Home | home tab, brand, Back, "story not found" close | swap |
  | Story set-up → start match → game | Start; `created` (replace, step 13) | forward turn, forward turn |
  | Start match → story set-up; game → story set-up | Back card, Back (start match replaced its entry) | back turn |
  | Start match → Home | home tab, brand | swap (owner) |
  | Game or end game → Home | Leave, "Back to home", fatal error close (today a reload; in-app now, owner) | swap |
  | Story pages ↔ `/player` | navbar user, start-match "Logged" (i), player page Resume, Back | swap |
  | `/story/A` ↔ `/story/B` | Back / Forward | swap |
  | Same path, new state | Start saves the loadout, game finds its match, `/player` replace | nothing |
  | Redirects | `*` → `/`; `/play` and `/start-match` direct loads → `/story` | nothing (`REDIRECT_STATE` added to the two guards) |
  | Policy chapter | footer links, `?policy=` deep link | not a route: step 15 turn inside the book |
  | Any of the above during a play, hold, turn or swap | navbar, browser Back / Forward | waits; then the latest one, by this table |
  | First load, reload, account deletion (`reloadHome`) | — | no swap, no turn: the first book's opening only (owner) |

- Engine — new `components/book/RouteBook.jsx` (class) and `bookSwap.js` (`bookOf`, `routeTransition`,
  cover face, desktop and phone swaps). `RouteBook` wraps `<Routes>` in `AppRoutes` (prop: the router
  location; a `display: contents` container ref). Its `getSnapshotBeforeUpdate` runs before the new
  route reaches the DOM: it copies the old `.book-wrapper` with `cleanClone` (ids, test ids, tooltips
  and iframes stripped, scrolls kept, its `.book-turn-layer` emptied), its viewport box and
  `data-cover-title`. `componentDidUpdate` (new DOM, not painted) runs the swap or the turn.
  - A swap uses copies only, on a fixed `.book-swap` layer on `<body>` under the navbar (z-index 990 as
    `.m-sheet`, perspective 2600px); the live new book stays hidden under it until the end (its table
    deck too). Reason: GamePage and StartBook replace their loading Book with the real one, a remount
    that would cut an animation run on the live book.
  - Desktop `full` (concept `swapBook`): the copy's tabs fade (`fade`); its right half folds over the
    spine (`flip`, shades as `fullTurn`) and shows the cover with the old title; the closed book slides
    out left (`slide`); a copy of the new book, closed with the new title, slides in from the right to
    the new book's place (`slide`); the cover opens (`flip`); tabs fade in; layer gone, live book shown.
  - Phones (concept `mobileSwap`): the visible slice under the navbar, tab row included, copied with
    step 16's `sheetOf`; a cover closes over it from its left edge (`sheet`, −90° → 0), slides out left,
    the page scrolls to the top, the title changes, it slides in (`slide`) over the live book and opens
    (0 → −90°); `html.is-turning`, `.m-blocker` and `setMobileTurnBusy` as the mobile turn.
  - `simple` turn mode, both layouts: the copy closes (fade, tilt −8°, scale 0.92, new timing `close`),
    then the new book opens with the former `bookOpen` keyframes (`open`); a remount just ends it.
  - Route turns (same book): step 15's strategies unchanged; old pages by `snapshotPages` (phones:
    `mobileStrategy.snapshot`), run with the new book as `bookEl` and, on desktop, a fixed layer placed
    on the new book as `layer`, so a loading → board remount does not cut the sheet; direction by rank.
  - A route change during a running swap, route turn, play, hold or page turn waits (owner, next bullet).
- Navigation waits for the book (owner, concept `pendingRoute`): `RouteBook` renders `<Routes location={shown}>`, so
  the old page and its `useLocation()` stay on the shown location, and applies a new router location only when the
  book is free: no swap or route turn of its own and the live Book not busy (Book reports its `busy`, play, hold or
  turn, to a `RouteBook` context in an effect). A change while busy is kept as `pending` (the latest wins, one equal
  to the shown location is dropped) and applied on the next tick after busy goes false, with the swap or turn the
  route table gives from the shown page. The navbar stays clickable (outside the inert book) and the URL changes at
  once; only the book waits (a hold at most its safety time). AppRoutes' policy close and `scrollTo(0, 0)` key on the
  shown pathname, not the router's, so nothing jumps under a running animation.
- Cover look (concept `.cover-face`): the `.book-wrapper` leather and gold tooled frame, the gold d20
  of the card back, title in `--font-display` light gold, subtitle in small caps; phones: 12px corners.
  Title source: `Book` gets `coverTitle` → `data-cover-title` (StartBook, StartMatchFlow, GamePage
  loading and error, GameBook); the incoming cover reads the new book's, else
  `location.state.story.title` (Home and player-page Resume add `story` to the state), else the d20 alone.
- Settings (`constants/animations.js`, step 16 `preferences/settings.js`; owner): new flag `cover` from
  `VITE_ANIM_COVER` (default true) gates swaps and the first-load opening; new `coverMax` from
  `VITE_ANIM_COVER_MAX_S` (seconds ≥ 0, default 10, 0 = no limit, invalid → 10, `parseCoverMax`). Both keys
  in react-game's `.env.example` and the alpha workflow (`alpha-deploy-website.yml`, `vars.*`); `readAnimationEnv`
  reads nine keys. `turn` gates route turns; `turnMode` picks full or simple; `speed` scales all; reduced motion (OS
  or `data-pg-reduced`) turns all off and the new book just appears. New base timings `slide 600`, `close 260`
  (`--t-slide`, `--t-close`); `open`, `flip`, `sheet`, `fade` reused. Preferences: one more on/off row, "Book cover"
  / "Copertina" (`preferences.rows.cover`, `anim.cover` whitelisted, `PREFERENCES_VERSION` stays 1); `coverMax` is
  env only, no row (the speed row already shortens the change; the cap is a release safety, not a taste).
- At most 10 s (owner, concept `swapTimes`): pure `swapTimings(timings, { layout, mode, maxMs })` in `bookSwap.js`.
  Total at the current speed: desktop full 2 × (fade + flip + slide), phone 2 × (sheet + slide), simple close + open;
  above `coverMax` every phase of the change (fade, flip, slide, sheet, open, close) is multiplied by the same factor
  `max / total`. Desktop full 3.4 s at 1× (unchanged), 13.6 s → 10 s at the default ¼× (factor 0.735); phone 2.4 s
  at 1×, 9.8 s at ¼×; simple 0.9 s and 3.6 s (both under the cap). The first-load opening is not a book change: not
  capped (2.6 s at ¼×). Route turns keep step 15's timings.
- `bookOpen`: removed from `.book-shell` (`book.css`), with the unused `.game-book-wrapper` rule and
  `@keyframes bookOpen` (`main.css`); its keyframes move to WAAPI in `RouteBook`, first load only, on
  `.book-wrapper` (phones get it too: their `.book-shell` is `display: contents`), `timings.open`, gated
  by `cover`, scaled by the speed (owner: kept, first load only). Side effect: GamePage's and StartBook's
  loading → content remount no longer opens twice.
- Deal (step 14) and play (step 15): `RouteBook` publishes `busy` (context); `useBookTurning()` returns
  `turning || busy`, so DealtList deals the new cards after the cover opens or the route turn ends, and
  `useDeal.openingOf` (waiting for `.book-shell` CSS animations) goes. Book adds `busy` to its `inert`
  and `aria-busy`, and reports its own busy back through the same context (waiting rule above). No play
  navigates (the end game is a turn of the game's one Book); a navigation during a play, hold or turn
  comes only from the navbar or the browser and now waits, so the closing copy always shows settled pages.
- Policy chapter: `PolicyBookContext` keeps the pathname it opened on and `usePolicyChapter()` returns
  null elsewhere (the shown pathname), so the new book mounts without it. Today AppRoutes closes it in an
  effect after the commit, and the new book runs a back turn that would play under the incoming cover.
- Focus and scroll: copies and covers `aria-hidden` and `inert`; the new book `inert` and `aria-busy`
  until the end; the navbar stays live. Focus falls to `<body>` when the clicked button unmounts, as
  today (moving it is step 17's keyboard work). Desktop: `RouteBook` scrolls to the top before it
  measures the new book (AppRoutes' `scrollTo(0, 0)` stays, on the shown pathname); phones scroll under the cover.
- Call sites (owner): GamePage `gotoHomePage` (Leave, fatal error) and `EndGameBook.goToHome` use
  `navigate('/')` instead of `window.location.href = '/'`; the navbar brand off the Home navigates too
  (`preventDefault`); `reloadHome()` after an account deletion stays a reload.
- Tests (Vitest, coverage of new code > 96%, `animate` and `matchMedia` stubbed as above):
  - `bookSwap.test.js` (new): `bookOf` per route; every row of the route table (swap, forward, back,
    none for same path and redirects); cover title order (attribute, router state, d20 alone);
    `swapTimings`: 1× unchanged (3.4 s desktop, 2.4 s phone), ¼× desktop full capped to 10 s with every phase
    by the same factor, phone and simple at ¼× unchanged (under the cap), `maxMs` 0 = no limit.
  - `RouteBook.test.jsx` (new): copy taken before the commit (stripped, turn layer emptied); live book
    hidden then shown; desktop full sequence and layer removal; simple; phone cover; route turns call
    the step 15 strategy with the rank direction; flags off and reduced motion: nothing; capped phase
    durations passed to `animate`; a navigation during a swap, a route turn or while the Book reports busy
    (play, hold, turn) keeps the shown page and its animation, then applies only the latest one; a pending
    equal to the shown location dropped; AppRoutes' scroll and chapter close follow the shown pathname;
    `busy` on and off; first-load opening once; unmount clean-up.
  - `animations.test.js`: `VITE_ANIM_COVER` (default true) and `VITE_ANIM_COVER_MAX_S` (default 10, 0 kept,
    negative or text → 10); `coverMax` not overridable by preferences.
  - Changed: `Book` (reports busy), `BookPages`, DealtList / `useDeal` (cards wait for `busy`), `animations`,
    `AnimationContext`, `preferencesSettings`, PreferencesEditor (eight animation rows), `routes`
    (redirects silent; chapter gone in the same commit, no back turn), `GamePage`, `EndGameBook`,
    `Navbar` (navigate instead of reload; a click during a turn no longer unmounts the book). Robot: none
    (API-only suites). Owner's test list: every route pair on desktop and phone, both turn modes, speed ¼×
    (desktop change about 10 s) and `VITE_ANIM_COVER_MAX_S=0`, navbar and browser Back during a play, a hold,
    a turn and a book change.
  - Fixes after review (November 26, 2026): brand double click, 15 s navigation wait limit, same-path changes never wait.
- Doubts for the owner (all resolved on November 26, 2026):
  1. Resolved by the owner (November 26, 2026): a new `VITE_ANIM_COVER` flag (default true) with its own "Book
     cover" preference row.
  2. Resolved by the owner (November 26, 2026): swap whenever the book changes (Home book `/`, `/player`; story
     book set-up, start match, game, end game), so also Home → game Resume, start match → Home and story pages ↔
     `/player`; `/player` is a page of the Home book (a turn from the Home).
  3. Resolved by the owner (November 26, 2026), changed: a book change lasts at most `VITE_ANIM_COVER_MAX_S`
     (default 10 s, 0 = no limit), its phases shrunk by one factor (concept `swapTimes`); env only, no preference row.
  4. Resolved by the owner (November 26, 2026): in-app navigation to `/` for Leave, end game "Back to home",
     the fatal error close and the navbar brand; the account deletion keeps its reload.
  5. Resolved by the owner (November 26, 2026): the opening zoom kept, first load only, gated by `cover` and
     scaled by the speed.
  6. Resolved by the owner (November 26, 2026), new: a navigation during an animation (play, hold, turn, book
     change) waits until the book is free (concept `pendingRoute`); the navbar stays clickable.

**Bookmarks per screen size** — Developed (November 26, 2026, 1.15.0) (owner decisions, November 26, 2026; concept
`website_concepts_v0/v1.14.0/README.md`, `demo.css` blocks marked `v1.15.0`, `demo.js` `renderBookmarks`,
`isSideTabs`, `scrollToSide`, `showTip`). Today the tabs stand on the book's top edge on desktop and tablet
(game tabs over the left page, the home tab ending the right row) and, on phones, form step 16's sticky pill
row under the navbar (badges, active tab label, home tab pinned at the row end). Wanted: three layouts in the
one tree, cut at 1120px (the edge where `--cards-cols` goes from 3 to 2) and at `MOBILE_MQ`; same items, icons,
states (active, red `danger`, gold `alert`) and handlers. react-game only: no endpoint, DTO, table, OpenAPI or
Robot change (Java, Python, AWS, react-admin untouched).

- Layouts:

  | Screen | Game tabs (position, information, backpack, map, missions) | Home tab | Book |
  |---|---|---|---|
  | Desktop (`min-width: 1121px`) | Down the cover's right edge from `top: 42px` (under the top-right corner), one under the other, all the same width (74px), icon with its badges stacked under it | Same right edge, at the bottom (over the bottom-right corner), in front of the deck pile, which lies just above it | 16px under the navbar on every page (taller); a right column (`--side-tab-w` 78px + 16px gutter) on every page, the Home too (owner: no sideways shift between Home and `/player`), `min(1080px, room left)`, centred in what is left |
  | Tablet (768–1120px, not `MOBILE_MQ`) | Top edge over the left page (today) | Top edge, end of the right row (today) | Today (46px under the navbar) |
  | Phone (`MOBILE_MQ`) | Standing on the top edge from 42px (clear of the top-left corner), icon only, `padding: 12px 16px`, scrolling with the book | Hanging under the bottom edge at `right: 72px` (left of the ribbon and the bottom-right corner) | Room over it only with game tabs, 46px under it only with the home tab |

- `Book.jsx`: markup kept: `.book-bookmarks-row` inside `.book-wrapper` holds the `--left` group (game tabs)
  and the `--right` group (`bookmarksRight`, empty today, then `HomeTabRow`'s home tab, last). The tabs stay in
  the cover on purpose: the book swap (to-do above) copies `.book-wrapper` and fades the copy's tabs, and inside
  `.book-wrapper` (z-index 1) they already lie over the pile (z-index 0), so the concept's `z-index: -1` is not
  needed. Group names `--left` / `--right` kept (their tablet places; tests use them). New classes: stage
  `book-stage--game-tabs` (a game tab shows) and `book-stage--home-tab` (the right group shows), `book-stage--no-tabs`
  kept (its tablet top; the desktop column no longer depends on it). No pile class is needed: the home tab is at the corner with the deal on or off.
- `BookBookmarks.jsx`: every tab gets `data-tip-side="left"` (read only by the side layout, below). Step 16's active
  label span `book-bookmark__label` goes with its CSS: tabs are icon only everywhere. Badges stay in the markup
  (desktop, tablet); phones hide them in CSS.
- `bookmarks.js`: no change. `danger` (`isStatsCritical`, `isBagOverloaded`), `alert` (missions changed), badges and
  tab order as today, so a phone tab still turns red with the values left on the information and backpack pages;
  `SHOW_MOBILE_CARD_CHARACTERISTICS` stays false (`VITE_SHOW_MOBILE_CARD_CHARACTERISTICS=true` brings the card back).
- `book.css`: the base rules stay the tablet ones. New `@media (min-width: 1121px)` block: `--book-stage-top: 16px`;
  every stage, the Home too (owner), gets `padding-right: calc(16px + var(--side-tab-w))`; `.book-shell { width: min(1080px, 100%) }`;
  `.book-bookmarks-row` becomes one absolute flex column right of the cover (`left: 100%`, `top: 42px`, `bottom:
  var(--home-bottom)` with `--home-bottom: 42px` on `.book-shell`, `z-index: 5`, `pointer-events: none`); the groups
  stack (`position: static`, no transform) and `.book-bookmarks--right` takes `margin-top: auto`, so the home tab
  always sits at the column foot, over the bottom-right corner, with the deck pile just above it (owner's rule of
  November 26, 2026, below). Side tab: `flex-direction: column`, `align-items: center`, **`width: 74px` for every tab**
  (the width the stacked badges need, so the column is even: owner's decision), the band on top, right and bottom
  (`border-width: 9px 9px 9px 0`, open on the left, under the cover), `border-radius: 0 10px 10px 0`, `padding: 6px 4px
  6px 12px` (the outer size of a 3px border and `12px 10px 12px 12px`), shadow to the right, touching the cover's right
  edge as today's top tabs touch its top (the same −4px pair, turned); badges stacked (`min-width: 44px`); size
  `1.5rem` kept (step 13 sizes).
- Tab look (owner, November 26, 2026, revised; every screen; concept block "owner's tab look" at the end of
  `demo.css`), on `book.css`'s base `.book-bookmark` rule: the light (tan) inside of today's tabs framed by a band of
  the cover's dark tooled leather. `border: 9px solid transparent` (the 3px `--color-brown-warm` border goes);
  `background`: today's `--book-bookmark-background` (hover `-hover`) on `padding-box`, then the cover's noise and
  leather gradient on `border-box`, `background-blend-mode: normal, soft-light, normal` for every state; icon in a dark
  leather brown (concept `#4a2410`; today `--color-brown-light`), no text shadow. `position: relative`; new `::before`
  (1px gold tooled line, 3px in: inset −6px) and `::after` (1px dashed stitching, 5px in: inset −4px), with no line and
  inset 0 on the open side. Active: parchment-light inside (`--color-parchment-light`, `--color-parchment`,
  `--color-brown-super-tan`), gold line brighter; `is-danger` and `is-alert` (and their `is-active`) keep their
  gradients on `padding-box` and their glows, their `border-color` rules go; `(hover: hover)` kept. The side under the
  cover stays open and the paddings shrink by the band, so the outer size stays: tablet top tabs open at the bottom,
  `border-radius: 10px 10px 0 0`, `padding: 0 6px 10px` (was a 3px border and `6px 12px 10px`); desktop as above;
  phones in `mobile.css` (below).
- `animations.css` (`.deck-pile`) — **owner's rule: the home tab at the bottom, the pile just above it and under every
  tab.** On desktop the pile's place follows the home tab's: `bottom: calc(var(--home-bottom) + 24px)`, so the home tab
  covers its lowest card a little; vertically the pile is above the home tab, in depth under every tab (the tabs are
  inside `.book-wrapper`, z-index 1, the pile z-index 0). Size from `--pile-scale` on `.book-shell` (`transform:
  scale(var(--pile-scale))`, `transform-origin: left bottom`): 1, `0.82` up to 1360px wide (today a literal 0.8; the
  rule keeps `right: -100px`), `0.7` on `(min-width: 1121px) and (max-height: 820px)` (less of it under the game tabs).
  `VITE_ANIM_DECK=over` (z-index 2) still puts it on the cover and the tabs; phones still hide it. `.m-sheet
  .book-bookmarks-row { visibility: hidden }` stays (a sheet never shows the copy's tabs).
- `variables.css`: `--side-tab-w: 78px` (desktop); `--book-pills-h` removed; phones get their own `--book-tabs-h`
  (the icon tab height, about 44px); new `--leather-noise` (the `.book-wrapper` SVG noise) and `--leather` (its
  `135deg` brown gradient), shared by the cover and the tab band.
- `mobile.css`: step 16's sticky row goes (sticky `.book-bookmarks-row`, pinned `--right`, pill look, active label
  and its landscape rule, corners `z-index: 31`); `.book-page` `scroll-margin-top` becomes `var(--navbar-h)` and its
  `--no-tabs` variant goes. New: row `display: contents`; `--left` group `top: -4px; left: 42px; right: 16px;
  translateY(-100%)`, tabs with the outer size of `padding: 12px 16px` (band and `padding: 3px 7px 12px`, open at the
  bottom; under 360px `3px 0 12px`, doubt 3), `font-size: 1rem`, badges `display: none`; `--right` group `bottom: 0;
  right: 72px; translateY(100%)`, its tab upside down (band on the sides and bottom, open at the top, `border-radius:
  0 0 10px 10px`, `padding: 12px 7px 3px`, gold line and stitching turned, shadow down);
  `.book-stage--game-tabs .book-wrapper` margin-top `8px + var(--book-tabs-h)`, `.book-stage--home-tab .book-wrapper`
  margin-bottom 46px.
- `TooltipLayer.jsx`: `placeTooltip(target, tip, viewport, navH, side)` gains a `left` placement. With
  `data-tip-side="left"` and `isSideTabsViewport()`, the tip opens 8px left of the tab, over the cover, centred on it
  and clamped between the navbar and the screen bottom (`viewport.height`), `data-placement="left"`, arrow on its
  right edge at the tab's centre (`--pg-tip-arrow`, vertical; rule in `main.css`); no room on the left → above /
  below as today. Tablets and phones (long press) unchanged.
- `mobileView.js`: `SIDE_TABS_MQ = '(min-width: 1121px)'` and `isSideTabsViewport()` beside `MOBILE_MQ` (the one place
  for media queries). `scrollBookToTop(behavior)` becomes `window.scrollTo({ top: 0, behavior })` (phones only,
  skipped under a turn): the very top, tabs in view (today `.book-page-left` under navbar and pills).
- Phone rule "every page change goes back to the very top" (replaces step 16's landing "right page top when the left
  page did not change"):
  - `mobileTurn.js`: `land()` scrolls to the document top for forward, back and simple, and also before a held copy
    fades out (`runFade`, a play that does not move, first to-do); `landingOf`, `pageSignature` and `leftSig` go.
    `viewTop` is the navbar bottom only (no sticky row; the slice is `.book-wrapper`, the tabs lie outside it). The
    step 15 phone flight target (`visibleSlice` top) follows.
  - `BookPages.jsx`: on phones a forward or back request that runs no strategy (turns off, reduced motion, no WAAPI)
    calls `scrollBookToTop()` after the commit; a fade never. Turn layer unchanged (z-index 9, `inset: 0` inside
    `.book-wrapper`): the side column lies outside its box (a full turn's 3D overshoot is a few pixels, inside the
    cover's padding), and the book is `inert` while turning.
  - The turn scrolls of the handlers go (now in one place): `useBookView` `openItems`, `openRegistry`, `openMissions`,
    `openExp`, `openMission`, `openMap`; GameBook `closeItemsView`, `closeRegistryView`, `closeMissionsView`,
    `closeExpView`. Left (i) previews (fades) call `scrollBookToTop()`: `useBookView.openPreview` left,
    `StartBook` and `StartMatchFlow` `handleSelectionPreview`. Right-page scrolls stay: the `previewRight` effect
    (game (i), close card), `selectMapNode`, GameBook error. `useGameplayResults` keeps `scrollBookToTop()` after a
    reload; route changes keep AppRoutes' `scrollTo(0, 0)`; a policy chapter keeps step 13's open at the top and
    close back to the old place (its layout effect runs after the landing).
- With the rest: step 14's `dealOrigin` measures `.deck-pile__top` at every batch, so the deal leaves from the moved
  pile (lower and smaller on short desktops) with no code change; phones keep the page deck. First to-do: on phones
  the fade release also jumps to the top under the fading copy; desktop unchanged. Book change to-do: the fixed
  `.book-swap` layer must not clip the side column (the tabs fade out and in beyond the cover's right edge); the phone
  cover must start at the tabs over the book, not at the `.book-wrapper` top; Home ↔ `/player` (a turn of the Home
  book) keeps the book in place, as the column is on every desktop page.
- Tests (Vitest, coverage of new code > 96%, `matchMedia` stubbed):
  - `Book.test.jsx`: the step 16 row test keeps both groups in one `.book-bookmarks-row` inside `.book-wrapper`, home
    last of `--right`, no `.book-bookmark__label`; new stage classes (game tabs, home tab, none on the Home).
  - `BookBookmarks.test.jsx`: `data-tip-side="left"` on every tab, no label span, badges still rendered;
    `GameBookBookmarks.test.jsx`: the position tab's label test becomes icon only.
  - `TooltipLayer.test.jsx`: `left` placement (position, vertical clamp, arrow), fallback above / below without room,
    `data-tip-side` ignored when `SIDE_TABS_MQ` does not match.
  - `MobileView.test.js`: `SIDE_TABS_MQ`, `isSideTabsViewport`, `scrollBookToTop` → `window.scrollTo` top on phones,
    no-op on desktop and under a turn.
  - `mobileTurn.test.js`: `viewTop` ignores the row; forward, back, simple and fade release land at the top; the
    landing test of `landingOf` goes. `BookPages.test.jsx`: phones with the engine off, forward / back jump once,
    fade and desktop never. `PlayContext.test.jsx`: phone flight target under the navbar only.
  - `GameBookViewModel`, `GameBook`, `StartBookCoverage`, `StartMatchFlowCoverage`, `useGameplayResults*`: left
    previews and reloads scroll to the top; tab handlers no longer scroll; right previews still `.book-page-right`.
  - Column, pile, tab look and phone tabs are CSS (not measured by jsdom): owner's test list at 1920×1080, 1280×800,
    1200×700, tablet 1024×768, phone 390 and 320 wide, phone sideways, deal on and off, `VITE_ANIM_DECK=over`; the band,
    gold line and stitching with the open side under the cover, tabs of today's outer size, every state (active, red,
    gold, hover); desktop Home ↔ `/player` with no sideways shift. Robot: none.
- Doubts for the owner:
  1. Resolved by the owner (November 26, 2026, revised): the light (tan) inside of today's tabs, framed by a band of
     the cover's dark tooled leather at half the cover's thickness (9px of 18px) with its gold tooled line (3px in)
     and stitching (5px in); the side under the cover open; active tab parchment-light; red and gold states
     unchanged; paddings shrink by the band, so the tabs keep their outer size.
  2. Resolved by the owner (November 26, 2026): the home tab at the bottom of the column, the deck pile just above it
     and under every tab; every side tab the same width. The home tab is no longer placed from the pile, so it never
     rides over the game tabs; on short screens the pile lies partly under them.
  3. Resolved by the owner: under 360px wide the phone tabs take less side padding (`padding: 12px 9px`), so the five
     tabs stay on the book.
  4. Resolved by the owner: the phone home tab stays at the end of the book, with the light tab look (not the dark
     leather the first concept drew, which looked dimmed).
  5. Resolved by the owner (November 26, 2026), new: on desktop the right column is kept on every page, the Home too,
     so the book never shifts sideways between the Home and `/player`.
  6. Resolved by the owner (November 26, 2026): the band is **6px** (half of react-game's 12px cover), on every screen;
     the gold line and the stitching move closer to fit it (gold line 2px in: inset −4px; stitching 4px in: inset −2px),
     and the paddings shrink by 6px instead of 9px, so the outer size stays. The concept keeps 9px (half of its 18px).

**Start match success line** — Developed (November 26, 2026, 1.15.0) (owner request, November 26, 2026; concept v1.14.0 README "Owner decisions", `demo.js`
`START.enter`, `successUntil`). Today `StartMatchFlow` (a fresh check on every visit, `useAntibot({ cookie: false })`)
shows the spinner and the Turnstile widget in the right page's footer and, once passed, only hides the widget
(`hidden`): no success line. Wanted: as on the Home (step 14), "Success! You are human." right under the left card's
text, only after the check passed on this visit, for `ANTIBOT_SUCCESS_MS` (4 s) with a short fade at the end, then
gone. react-game only: no endpoint, DTO, table, OpenAPI or Robot change.

- Shared: HomePage's timer effect moves to `useAntibotSuccess(phase)` in `hooks/useAntibot.js` (true for 4 s after
  `checking` → `ready`, timer cleared on unmount), with `ANTIBOT_SUCCESS_MS` exported there; the line itself becomes
  `components/ui/AntibotSuccess.jsx` (`<p className="home-antibot-success" data-testid="antibot-success">`). HomePage
  uses both, same behaviour. CSS kept (`main.css` `.home-intro-antibot`, `.home-antibot-success`, 4 s
  `home-antibot-out`, no animation with reduced motion).
- `StartMatchFlow`: `const successShown = useAntibotSuccess(gate.phase)`; the left page's card when no preview is open
  (the story card, or the guest login page of a guest with Google on) gets `afterDescription={successShown && <div
  className="home-intro-antibot"><AntibotSuccess /></div>}` (step 14's `Card` prop; both cards have a description, so
  `book-page-desc` renders). The widget, the bottom spinner and the error block stay as they are.
- Same rules as the Home: no line with no site key (dev bypass starts `ready`); a retry after an error or an expired
  token (`onExpire` is `retry`) is a new check, so its pass shows the line again; an (i) preview covers the left card
  while the 4 s run.
- Tests (Vitest, coverage of new code > 96%, fake timers): `useAntibot.test.jsx` (`useAntibotSuccess` true only after
  `checking` → `ready`, false after 4 s, never when it starts ready, cleared on unmount); `HomePage.test.jsx` passes
  unchanged; `StartMatchTurnstileRetry` / `StartMatchFlowCoverage`: no line while checking, the line inside the left
  card's `.book-page-desc` after success, gone after 4 s, again after a retry, on the guest page too, none behind a
  preview; `AntibotSuccess` rendered text and test id. Owner's test list: start match on desktop and phone.

### Second round — owner's requests of November 27, 2026 (developed and tested)

Concept: [`website_concepts_v0/v1.15.0/`](./website_concepts_v0/v1.15.0/README.md) (built on `v1.14.0/`, the former
`v1.15.0/` folder). Version stays 1.15.0. react-game only: no endpoint, DTO, table, OpenAPI or Robot change (Java,
Python, AWS, react-admin untouched). "Desktop" = wider than 1120px (side tabs), "tablet" = 768–1120px, "phone" =
`MOBILE_MQ`. Suggested order: 9 (small, a bug), 8, 7, 6, 5, 11, 10.

**5. Played cards land on a face-up pile** (concept §1, `demo.js` `renderPlayed`, `addPlayed`, `flightTarget`). — Developed (November 27, 2026, 1.15.0)
Today `PlayContext.flightTarget` sends the clone to the left page picture (desktop) or the top of the screen (phone),
where it fades out at 0.3 scale; the table holds only the face-down `Deck` (`variant="table"`).
- New `components/book/PlayedPile.jsx`, a sibling of the table `Deck` in `Book.jsx` (outside the wrapper), rendered
  only when the Book gets a new prop `playedPile` (GameBook and its end pages; no other book): bottom card the story's
  card (picture of `story`, gold frame), on top up to five played cards, the last one straight and lit. The pile has
  the deck's size (owner, November 27: box 160 × 210px, cards 84px wide, same `--pile-scale`). Its cards show the
  picture only, the title in 0.6rem blurred, no text, badges or buttons (`aria-hidden`; the pile has a `data-tip`
  "Last played: …"). Desktop and tablet (owner: tablets too, even if the cover hides most of it); hidden on phones.
- Data: `usePlayController` keeps `played[]` (`{ title, image }`) for the match: `begin(playId, el, meta)` gets the
  card's title and picture from `CardButtons` (small card) or the reading page card; pushed in `land` after the flight.
  In memory only: after a reload the pile shows the story card alone (owner: the simplest).
- Flight (`flightTarget`): desktop with the pile → the pile's centre, final scale = 84px × `--pile-scale` / card width,
  tilt −4°, **opacity stays 1** (it becomes the pile's top card); phone → the sticky page `.deck` (clamped to the
  screen's bottom-right corner when off screen), fades on arrival; tablet → the pile, as desktop (owner).
  The two-step flow, the fall of the other cards, the hold and the turn are unchanged.
- Tests: `PlayedPile` (story card alone, max five, last on top, tip text), `PlayContext` (`flightTarget` per layout,
  `played` grows after `land`, not after `cancel`), `Book` (pile only with `playedPile` and the deal flag rules).

**6. Both piles centred between the book and the screen's edge, played pile under the deck (desktop and tablet)** — Developed (November 27, 2026, 1.15.0)
(concept §2, `placeTable`).
Today `.deck-pile` is `right: -122px` (−100px up to 1360px) and `bottom: calc(var(--home-bottom) + 24px)`.
- `animations.css`, desktop media, both piles: `left: calc(100% + var(--table-mid) - 160px * var(--pile-scale) / 2)`,
  `right: auto` (horizontally aligned, same centre). Vertically (owner, November 27): the face-up pile at the foot,
  `bottom: var(--home-bottom)`; the deck above it, `bottom: calc(var(--home-bottom) + (210px + 21px) * var(--pile-scale))`
  (`--pile-gap` = 10% of the pile's 210px height). The deck keeps that place on every page, also outside a match where
  the face-up pile is absent (no jump when a match starts). `--table-mid` is half the room right of the book. With today's stage paddings (16px
  left, 16px + `--side-tab-w` right, the book centred in what is left) the room is `(100vw - 100%) / 2 + 39px`
  (`100%` = the shell's width, resolved where `left` uses it), so `--table-mid: calc((100vw - 100%) / 4 + 19.5px)`;
  `100vw` counts the scrollbar (about 8px off): if that shows, a `ResizeObserver` in `Deck` sets the variable instead.
- Both piles stay `z-index: -1` (under every tab, under the cover). Tablet (owner): the same centring and order, face-up pile
  `bottom: 70px`, deck `70px + 231px × 0.82`, `--pile-scale: 0.82`; there `--table-mid` is half of `(100vw - 100%) / 2` (no side column) and the piles are
  mostly under the cover. Phone: the page deck.
- Tests: CSS only; owner's checks at 900, 1024, 1180, 1366, 1440 and 1920px wide and 800px high.

**7. Home bookmark per screen** (concept §3, `renderBookmarks`). — Developed (November 27, 2026, 1.15.0)
- Desktop: no home tab. `Book`'s `HomeTabRow` still renders the right group (`book-bookmarks--right`, the corner slot
  for future icons) but the home item is hidden by CSS on desktop (`@media (min-width: 1121px)
  .book-bookmark--home { display: none }`); with no other item the group takes no room. The way home on desktop is
  the navbar brand (in a match the close card first, as the tab did).
- Tablet: unchanged (top edge, right end).
- Phone: the home tab goes back to the top edge, right end of the tab row, with the top-tab look (`mobile.css`: drop
  the upside-down block, `.book-stage--home-tab` `margin-bottom: 46px`, `transform: translateY(100%)`); `--book-tabs-h`
  margin applies when either group shows.
- Phone icons bigger: `.book-wrapper .book-bookmark i { font-size: 1.45rem }`, `1.25rem` under 400px (owner). Six
  tabs (five game tabs + home) on a 360px phone need the band at 6px (already the app's) and less side padding under
  360px: check at 320, 360, 390, 430px.
- Tests: `Book` / `BookBookmarks` (home item present with its class; desktop hiding is CSS), Navbar brand unchanged.

**8. Phones: one single page** (concept §4, end of `demo.css`). — Developed (November 27, 2026, 1.15.0)
Today (`mobile.css`, step 16) the vertical book has a spine with binding thread on the left (`.book-spine` left 5px),
two headbands, a gutter shade (`inset 4px 0 12px`, `::after` 28px gradient) on both pages, `padding-left: 20px`.
- Phone only: hide `.book-spine` and the headbands, drop the gutter shade and the `::after` gradients, symmetric
  cover padding (8px), no border radius or shadow between the left (top) and right (bottom) page, so they read as one
  sheet; the stacked page edges move to the outer box. Cover frame, corners and ribbon kept (owner: the page of a book).
- Tests: CSS only; owner's checks on the game, Home, story set-up, start match, end game, player page, policy chapter.

**9. Map centred during a desktop page turn** (bug, no concept). — Developed (November 27, 2026, 1.15.0)
Cause: `Map.jsx` starts at `{ tx: 0, ty: 0 }` and centres the current location in a `requestAnimationFrame` after
mount; the `full` turn (`pageTurn.runFull`) clones the new left page right after the commit, before that frame, so
the turning sheet's back shows the map off centre; when the sheet is removed the live, centred map appears: the jump.
- Fix in `Map.jsx`: the first view is computed before paint: `useLayoutEffect` + a measured canvas (`clientWidth` /
  `clientHeight`) setting the centred `tx`/`ty` synchronously; or, independent of timing, the world placed with CSS
  (`left: 50%; top: 50%` and `translate(-x·scale, -y·scale)`), so the first render is already centred and the clone
  copies it. Recommended: the CSS one (no measuring, also right for `simple` and `fade` and for the book change
  copies); `clamp` stays for drag and zoom.
- Tests: `Map` (first render centred on the current location, before any frame; drag, zoom and ◎ unchanged).

**10. Phones: cards shuffle instead of a page turn** (concept §4, `mobileShuffle`). — Developed (November 27, 2026, 1.15.0)
Today `mobileTurn.js` copies the visible slice on a fixed sheet and turns it on its left edge (forward 0 → −90°,
back −90° → 0) or fades it (`runFade`).
- New phone strategy, both turn modes (owner: as drawn in the concept): the small cards on screen spin (in-plane, 240°, no 3D: a fading 3D card
  is flattened and shows its front mirrored) and shrink into the sticky page deck, staggered (`gather` 420ms,
  `gatherStep` 60ms, stagger capped at 8, at speed 1); the page card and the heading fade (`fade`); jump to the very
  top (kept); the new page card fades in; the new cards are dealt by step 14's deal from the page deck (deal off:
  they fade in). Back and forward only change the spin's direction; the `fade` direction (a play that did not move)
  keeps today's fade of the copy.
- Engine: the snapshot copies the visible slice as today (`sheetOf`); the cards are animated on the copy (their boxes
  are known), so the live new page can render under it; the copy goes when the last card has left. `is-turning`,
  `.m-blocker`, `setMobileTurnBusy` and the hold are unchanged. New base timings `gather`, `gatherStep`
  (`constants/animations.js`, `--t-gather`), scaled by the speed; `turn` flag and reduced motion gate it as today.
- Tests: `mobileTurn` (cards of the copy animated with stagger to the deck box, page parts faded, top jump, copy
  removed at the end, `fade` unchanged, reduced motion and flag off: nothing), `GameBookTurns` phone cases.

**11. Book change: smaller while it slides** (concept §5, `swapBook`, `mobileSwap`, `swapTimes`). — Developed (November 27, 2026, 1.15.0)
- `bookSwap.js`: after the close (desktop fold, phone cover) the closed copy shrinks to 0.62 (`zoom`), slides out
  small; the incoming closed copy slides in small, stops, grows back with a light overshoot, then opens. Desktop: the
  closed book and the flap scale around the spine (book centre = flap hinge); phone: the cover's hinge is its left
  edge, so its scale is re-centred with a `translateX((1 − s) · w / 2)`.
- New base timing `zoom` 320ms (`--t-zoom`), counted in `swapTimings`: desktop full 2 × (fade + flip + zoom + slide)
  = 4.04 s at 1×, 16.2 s at ¼× → 10 s; phone 2 × (sheet + zoom + slide) = 3.08 s at 1×, 12.32 s → 10 s; `simple` mode
  unchanged (no zoom). `VITE_ANIM_COVER_MAX_S` still caps everything.
- Tests: `bookSwap.test.js` (`swapTimings` with `zoom`, the new totals and factors; keyframes of the zoom phases),
  `RouteBook.test.jsx` (phase order close → zoom out → slide → slide → zoom in → open).

Code vs spec (second round, as built):
- Phone book change total is 3.08 s at 1× and 12.32 s at ¼× (→ 10 s), not 3.04 / 12.2 as written in to-do 11.
- Pile tooltip is "Last played: {title}" (i18n `game.playedPile.last`, no count); before any play the title is the story's.
- `PlayContext.begin(playId, el, { title, image })`; `played` capped at 5, memory only; `flightTarget` returns `{ x, y, width, rotate, stays }`; `CardButtons` prop `playImage`.
- Played cards are recorded also when the pile is hidden (deal off, phone) and show when it appears.
- `VITE_ANIM_DECK=over` lifts only the deck; the face-up pile stays under the cover.
- `--table-mid` uses `100vw`: the piles may sit about 2–4px right of the exact middle (no `ResizeObserver` added).
- Phone home tab row starts 30px from the left (26px under 360px); icons 1.45rem (1.25rem under 400px); desktop home tab hidden by CSS.
- Phone single page also unifies the paper, removes the seam border and moves the corner flourishes to the sheet's outer corners.
- Shuffle: `mobileTurn.js` `runShuffle` replaces the phone sheet turn; exports `deckGoal`, `leavingCards`, `fadingParts`, `pageParts`, `GATHER_MAX_STAGGER`. Timings `zoom` 320, `gather` 420, `gatherStep` 60; `bookSwap.js` `SWAP_SMALL` 0.62 and a `zoom` phase; `isolation: isolate` on `.book-shell`.
- Map: world origin at the canvas centre, first render centred (a location near the graph's edge is now exactly centred; the old 90px margin is skipped on first render); the wheel handler uses the latest `zoomAt` through a ref.

Doubts for the owner — all resolved on November 27, 2026:
1. Resolved: tablets as the desktop (face-up pile, centring, flight to the pile), even if the piles are mostly hidden.
2. Resolved: after a reload only the story card (the simplest, memory only).
3. Resolved: phone single page keeps the book page graphics (cover frame, corners, ribbon).
4. Resolved: smaller tab icons under 400px (`1.25rem`).
5. Resolved: the phone shuffle as drawn in the concept (in-plane spin).

### Third round — owner's requests of November 27, 2026 (developed November 27, 2026, 1.15.0; to-do 13 replaced by 16)

Concept `website_concepts_v0/v1.15.0/` (`demo.css` `--pile-gap`, `.played-card__title`, `.pg-card.deal-copy`; `demo.js`
`dealBatch`). react-game only, version stays 1.15.0, no doubt open.

**12. The deck stays on the table during a book change** Developed (November 27, 2026, 1.15.0). (desktop and tablet). Today `RouteBook` hides the whole live
route while a swap runs (`.route-book.is-swapping { visibility: hidden }`, `animations.css`), so the table deck vanishes
with the book and comes back at the end. Wanted: the face-down deck stays visible and still in its place for the whole
change, under the sliding and opening book copies (the fixed swap layer is above it). Fix: `.route-book.is-swapping
.book-shell > .deck-pile { visibility: visible }` (the new book's deck: same place on every page, rule of to-do 6). The
face-up pile belongs to the match: it stays hidden during the change (it appears with the game book, leaves with it).
Phones: no table deck, nothing changes. Tests: `RouteBook` (deck visible while `is-swapping`; pile not).

**13. The deck lowered until it touches the played pile** Developed (November 27, 2026, 1.15.0). (desktop and tablet). Today the deck box sits `(210px + 21px)
× --pile-scale` above the pile's foot; the cards inside the boxes leave a visible gap of about 55px. Wanted: the deck's
lowest cards touch the top of the played pile's cards. `animations.css`: `--pile-gap: -34px` (the deck box overlaps
the pile box by 34px × scale; check by eye, the value is the concept's). Deck still above the pile, both z −1, same
centre; outside a match the deck keeps the same place. Tests: CSS only; owner's check at 1440×900, 1366×768, 1024×768.

**14. Title on the played cards.** Developed (November 27, 2026, 1.15.0). Today `.played-card__title` is tiny, blurred and faint (a hint only). Wanted: the title
readable: a small bar at the top of each played card (dark brown see-through background, gold-dark bottom line,
Cinzel 0.56rem bold, gold-light text, one line with ellipsis), no blur, picture under it; still no description,
badges or buttons. `PlayedPile.jsx` markup unchanged. Tests: `PlayedPile` (title rendered for the story card and every
played card).

**15. The deal flies visibly from the table deck** Developed (November 27, 2026, 1.15.0). (desktop and tablet). Today `useDeal` animates the real card in its
slot (CSS `pg-deal-facedown` / `pg-deal-flat` with `--from-x/--from-y`), so the part of the flight outside the page is
clipped by the page and the scrolling lists (`overflow`): the card seems to appear at the page's edge. Wanted: the
flight shows from the table deck's top card to the slot. In `useDeal.fly`, when the origin is the table pile
(`dealOrigin` found `.deck-pile__top`): a copy of the card (`cleanClone`, ids and test ids stripped, `aria-hidden`,
inert, `--card-w` and the slot's box) on a fixed layer on `<body>` (`.deal-copy`, z-index above the book and the tabs,
under the navbar's drawn tooltip and `.flying-card`) runs the same keyframes and timings (stagger, face down or up);
the real card waits hidden in its slot (`data-deal="flying"` keeps it invisible, no layout change) and shows when its
copy lands (the copy removed in the same frame). Phones keep today's in-page deal (the page deck is inside the page).
Card styles that depend on a parent class (e.g. `.selection-list …`) must still apply to the copy (wrap it in an element
with the same classes, or move those rules to the card). Unmount, a page turn or a book change during the deal removes
the copies and lands the cards (as `land` today); a scroll during the flight: the copy lands where the slot was (small
jump accepted). Reduced motion, deal off, no IntersectionObserver: unchanged (all landed). Tests: `useDeal` / `DealtList`
(copy on `body` for a table origin, none for the page deck; real card hidden then landed; copies removed on unmount and
on the safety timer; face down / up attributes on the copy).

### Fourth round — owner's requests of November 27, 2026 (developed November 27, 2026, 1.15.0, tested)

Concept `website_concepts_v0/v1.15.0/` (`demo.css` piles block: deck `bottom: var(--home-bottom)`, played pile above,
`--pile-gap: -44px`). react-game only, version stays 1.15.0, no doubt open.

**16. Piles inverted: the deck at the foot, the played pile on top of it** Developed (November 27, 2026, 1.15.0). (desktop and tablet; replaces to-do 13's
order). Today (to-dos 6 and 13) the played pile lies at the foot and the deck above it. Wanted: the face-down deck at
the foot of the right side on **every page, the Home too** (`bottom: var(--pile-foot)`: `--home-bottom` on desktop,
70px on tablets), never moving; in a match the face-up pile right above it, same size, same centre, their cards just
touching: `bottom: calc(var(--pile-foot) + (210px + var(--pile-gap)) * var(--pile-scale))` with `--pile-gap: -44px`
(the played cards sit in the middle of their box, so the boxes overlap more than in to-do 13; check by eye). Both
z −1 under every tab; `VITE_ANIM_DECK=over` lifts only the deck, as today. The flight target (`flightTarget`) and the
deal origin (`dealOrigin`, `.deck-pile__top`) follow the new places by measuring, no code change expected.
Tests: CSS only (plus any test that asserts the old order); owner's checks at 1440×900, 1366×768, 1024×768, Home and game.

**17. Bookmarks only on an open book** Developed (November 27, 2026, 1.15.0). (every layout, every turn mode; the owner saw it on tablets). Today, in a book
change, `desktopFull` fades the tabs with `fadeTabs` on `.book-bookmarks-row`; on tablets that row is `display:
contents`, so the opacity does nothing, and the copy's left half is clipped with `LEFT_HALF` (`inset(-60px 50% …)`),
which leaves the top tabs above the cover visible: the tablet tabs stay on screen while the book closes, slides and
opens. `desktopSimple`, `phoneSimple` and the first-load opening (`openBook` on the live `.book-wrapper`) never hide
them. Wanted: the tabs show only when the book is open and still: they fade out before the book starts closing,
no copy (old book, flap, incoming book, cover) shows any tab while it closes, moves or opens, and they fade in on the
live book only after it has fully opened.
- Fade the tab groups (`.book-bookmarks`), never the row (`display: contents` on tablets); after the fade-out mark the
  swap layer/copies so every later copy has its tabs hidden (e.g. a `.book-swap--tabless .book-bookmarks { opacity: 0 }`
  class, or strip the row from the clones), so `flapOf`'s inner clone and the incoming `bookCopy` carry none.
- Live book: while the swap or the first-load opening runs, its tabs are hidden (a class on the route root or the
  `.book-stage`); after the open ends they fade in (`timings.fade`) and the class goes. Applies to `desktopFull`,
  `desktopSimple`, `phoneCover`, `phoneSimple` and the first-load opening. Route turns (same book) are not an opening:
  unchanged.
- Timings: the fade out / in already counted in `swapTimings` for `full` desktop stays; the other modes add a fade in
  after the open (inside the cap when the cap applies).
- Tests: `bookSwap` / `RouteBook` (tabs groups faded, not the row; copies made after the fade carry hidden tabs; live
  tabs hidden during the open and faded in after, per mode and layout; first-load opening; reduced motion / cover off:
  tabs shown at once).

**18. The dealt copy follows its slot while the page scrolls** Developed (November 27, 2026, 1.15.0). (desktop and tablet; bug of to-do 15, owner, November
27, 2026). Today `useDeal.fly` measures the slot once (`card.getBoundingClientRect()`) and places the fixed copy
(`dealCopy(card, r)`) there; the keyframes end at `translate(0, 0)`, i.e. on that first box. When the right page (or
any scrolling list, or the document) keeps scrolling during the flight — the usual case, since a card is dealt when it
scrolls into view — the slot moves up while the copy lands on the old place, lower down; when the copy goes, the real
card shows in its slot: a jump up. At ¼× a flight lasts about 2.5 s, so the gap is large.
- Wanted: the copy always lands exactly on its slot. While at least one copy flies, one `requestAnimationFrame` loop of
  the list (and a passive capture `scroll` listener on `window` for the same update) sets every flying copy's
  `left`/`top` (and width/height) to its slot's current box; the keyframes stay relative, so the flight bends with the
  scroll and ends on the slot. The loop stops when no copy flies (landing, unmount, hold), and on clean-up.
- The deck end of the flight moves with the slot (accepted: the start point is already past when the user scrolls).
- A slot scrolled out of its list's visible area: the copy still lands on it and goes (it is not clipped); accepted.
- Tests: `DealtList` / `useDeal` (a slot moved mid-flight: the copy's box follows on the next frame and on a scroll
  event; loop and listener stopped after the last landing and on unmount; phones, in-page deal: no loop).

### Code vs spec (rounds three and four, as built)

- Developer's deviation (to-do 17): a tab fade-out phase also runs in simple (desktop, phone) and phone cover changes, inside the cap.
- Timings at 1x: desktop full 4.04 s unchanged; phone cover 3.08 to 3.48 s; simple 0.91 to 1.31 s; first-load opening +200 ms (book busy until the tabs are back).
- Phone at 1/4x: 13.92 s becomes 10 s (at most 4 ms over, by rounding).
- With `VITE_ANIM_COVER_MAX_S=5` the simple change (5.24 s at 1/4x) is capped too.
- Changes to or from the Home (no tabs) are one fade shorter.
- On desktop, story pages and `/player` keep an empty tab group, so an invisible fade of about 0.5 s runs.
- Phone simple change skips the fade-out when the book is off screen.
- Deal copies use z-index 1600: above the navbar (1000) and the stale-match banner (1010), below `.flying-card` (2000) and the tooltip (2100).
- Copies are never clipped: a slot partly outside its list lands whole, then its outer part vanishes.
- `VITE_ANIM_DECK=over` lifts only the deck (it lies over the pile where they meet).
- To-do 13's order (deck above the pile, -34px) was replaced by to-do 16 (deck at the foot, `--pile-gap: -44px`).

# Version Control
- **Document Version**: 1.15.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Play and page turn analysed, owner choices recorded | November 24, 2026 |
  | 1.14.0 | Developed; waiting for owner's test; two to-dos analysed | November 25, 2026 |
  | 1.15.0 | Four rounds developed; tested and closed | November 27, 2026 |

- **Last Updated**: November 27, 2026 (v1.15.0)


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
