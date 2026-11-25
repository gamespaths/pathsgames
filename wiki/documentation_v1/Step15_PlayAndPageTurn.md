# Step 15 — Play and page turn

**Status: developed (November 25, 2026, version 1.14.0, react-game only, unit tests green), waiting for owner's test; owner test list: [test/Step15_PlayAndPageTurn.md](./test/Step15_PlayAndPageTurn.md).**
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

Owner's request after the first test round (November 25, 2026), not developed yet.

**No page turn when a play does not change the location.** Today every play answer lands, holds
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

# Version Control
- **Document Version**: 1.14.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Play and page turn analysed, owner choices recorded | November 24, 2026 |
  | 1.14.0 | Developed; waiting for owner's test | November 25, 2026 |

- **Last Updated**: November 25, 2026 (v1.14.0)


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
