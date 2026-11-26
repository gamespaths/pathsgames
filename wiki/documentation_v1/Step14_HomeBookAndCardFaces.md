# Step 14 — Home book and card faces

**Status: developed (November 25, 2026, version 1.14.0, react-game only, unit tests green), waiting for owner's test; owner test list: [test/Step14_HomeBookAndCardFaces.md](./test/Step14_HomeBookAndCardFaces.md); analysed (1.13.0), owner's decisions recorded (Home left page, no heading over the cards, card components, page picture and text sizes kept, deck on the table beside the book, deck under or over the book), no open doubts.**
Roadmap line: *the Home becomes a book and every card gets a back* ([Roadmap](./Roadmap.md) step 14).
Concept: [`website_concepts_v0/v1.13.0/`](./website_concepts_v0/v1.13.0/README.md) (effect 1, deal; "Book position and deck": `demo.css` `.deck-pile`, `demo.js` `dealBatch`).
Sibling steps: `Step13_BookLayoutWithoutModals.md` (in-page books, routes, footer),
`Step15_PlayAndPageTurn.md` (play, page turn, (i) fade), `Step16_MobileBookAndPreferences.md`
(vertical mobile book, sticky deck, preferences).

## 1. Scope

react-game (`code/frontend/react-game`) plus seven lines in the alpha deploy workflow.
Development order: step 13, then step 16's "one tree on mobile" switch (each page rendered
once), then steps 14, 15, 16. This step uses step 13's in-page `Book` under the sticky navbar,
its `/story/:storyId` navigation (the Home no longer mounts `StartBookModal`) and the one tree.
Built in that order: step 16 part A (one tree on mobile) was developed before this step, so the
"one tree" deviation noted in the test list is resolved.

In:
- **Home book**: left page a fixed intro card (today's hero picture with its credit, title,
  subtitle; in its `extraContent` the anti-bot result and a larger, centred tutorial button);
  right page all stories in one card grid, no category rows, today's order, category badge on
  each card, no visible heading over it. No home tab (step 13). Rendered once on mobile too.
  Loading, error and empty states, coming-soon and hidden stories, resume / paused / completed
  badges and the antibot footer states keep today's logic.
- **Card columns** from one CSS parameter for every card grid: 3 on desktop and on a phone
  turned sideways, 2 under 1120 px, 1 under 331 px.
- **Card faces**: every non-page `Card` gets a front and a back; the back is the concept pattern
  with the site's d20 in light gold, pulsing. The front face carries every Card special
  component, with today's picture and text sizes (6.4, step 13's rule 6.3.16).
- **Deck on the table** (owner decision): on desktop a pile of ten card backs lies outside the
  book, right of the right page, partly under its cover (or over it: `VITE_ANIM_DECK`); the dealt
  cards leave its top card and enter the right page from its right edge. On phones the deck
  stays in the right page (sticky in step 16).
- **Animation config**: env defaults, one module, CSS timing variables, `styles/animations.css`,
  OS reduced motion wins; designed so step 16 plugs player preferences in.
- **Deal**: cards fly face-down from the deck and flip face-up, when they enter the screen, on
  every card grid (16 grids, list in 6.5).
- The seven `VITE_ANIM_*` keys in the alpha deploy workflow (6.8).
- i18n EN/IT, unit tests.

Out: modal removal, routes, footer, policy chapter, ErrorCard page, home tab, drawn tooltip,
book graphics (step 13); play (from a
reading page only the picture flies, no fall; the fall is for choice "Do" and training lists),
page turn, (i) fade (step 15); vertical book styling, mobile page turn, sticky tabs replacing the
mobile status card, sticky mobile deck, preferences UI, columns chosen by the player (step 16);
reduced motion for older animations such as the navbar dice and the book opening (step 17).

At the default speed 0.25 one card flies for about 2.5 s and the eighth leaves the deck 3.1 s
after the first: a full hand lands in about 5.6 s (owner's default, concept timings).

## 2. Endpoint APIs

None. No backend, OpenAPI file or API contract changes.

## 3. DTOs and Domain Models

No backend model. Frontend models only:

- **Animation settings** (`src/constants/animations.js`):
  `{ deal, dealFaceDown, play, turn, turnMode: 'full'|'simple', speed, deck: 'under'|'over', reduced, timings }`.
  `timings` = concept base values in ms divided by `speed`: `open 650, deal 620, dealStep 110,
  lift 240, fly 560, discard 320, discardStep 50, flip 900, simple 520, sheet 620` (play and turn
  values are defined here, used by step 15). `DEAL_MAX_STAGGER = 8`.
- **Card DOM** (non-page variants; `variant="page"` is unchanged):

  ```html
  <div class="pg-card pg-card--grid …">                 <!-- size, hover lift, deal transform -->
    <div class="pg-card__face pg-card__front">…today's title, image, footer, children…</div>
    <div class="pg-card__face pg-card__back" aria-hidden="true"><svg class="pg-d20">…</svg></div>
  </div>
  ```
- **Deal state** on the `.pg-card`: `data-deal="waiting" | "flying" | "landed"` plus the inline
  CSS variables `--deal-i`, `--from-x`, `--from-y`, `--from-rot`. Data attributes, not classes:
  React owns `className` and rewrites it when a card re-renders mid-flight (e.g. the footer
  state of a story card turning `ready`).

## 4. Roles and Authentication

No change. The Home Turnstile gate (`useAntibot({ cookie: true })`), the guest session and the
fail-closed match check move into the book unchanged.

## 5. Database Tables

None: no migration, no DynamoDB item. No new localStorage key in this step (step 16 adds the
preferences).

## 6. Components

### 6.1 Java, Python, AWS, react-admin
No change.

### 6.2 Robot
No change: the suites are API-only (RequestsLibrary, no browser library).

### 6.3 react-game — animation config
- `src/constants/animations.js`: `readAnimationEnv(env = import.meta.env)` parses
  `VITE_ANIM_DEAL`, `VITE_ANIM_DEAL_FACEDOWN`, `VITE_ANIM_PLAY`, `VITE_ANIM_TURN` with
  `parseFlag` (default `true`), `VITE_ANIM_TURN_MODE` (`full`|`simple`, anything else `full`),
  `VITE_ANIM_SPEED` (finite number > 0, clamped to 0.1–4, else `0.25`), `VITE_ANIM_DECK`
  (`under`|`over`, anything else `under`).
  `resolveAnimations({ env, overrides, reducedMotion })`: overrides win key by key over env,
  reduced motion turns every flag off (`deck` is a placement, not a flag: it stays). `applyAnimationTimings(settings, root)` writes `--t-<key>`
  (e.g. `--t-deal: 2480ms`) on `<html>` through the CSSOM (`style.setProperty`, which CSP
  `style-src` does not block, as React `style` props today) and `data-pg-reduced` when reduced.
- `src/context/AnimationContext.jsx`: `AnimationProvider` (added in `app/providers.jsx`) reads
  `matchMedia('(prefers-reduced-motion: reduce)')` and follows its `change` event, applies the
  timings at start-up and on every change, and exposes `useAnimationSettings()` →
  `{ ...settings, setAnimationOverrides }`, the single accessor steps 14 and 15 read.
  **Step 16 hook**: the player's `anim` preferences enter as `overrides` (same keys), seeded from
  localStorage; step 17 adds its profile flag to `reducedMotion`. Without a provider (unit tests)
  `useAnimationSettings()` returns the env defaults. Guards: no `matchMedia`, or a mocked one
  without `addEventListener` (several suites mock it as `{ matches: true }`).
- `src/styles/animations.css` (imported by `main.css`): `--t-*` fallbacks at speed 1, deal
  keyframes (`pg-deal-facedown` with no opacity, `pg-deal-flat`), d20 pulse, deck, the
  `[data-deal]` rules, and the reduced-motion safety net (`@media (prefers-reduced-motion)` and
  `html[data-pg-reduced]`): no deal, no pulse, cards shown at once.
- `.env.example`: the seven keys with their defaults and one comment line each (see 6.8).

### 6.4 react-game — card faces, back and deck
- `Card.jsx`: non-page variants wrap today's content in `.pg-card__front` and append
  `<CardBack />`; root classes, `additionalCardClasses`, test ids and buttons are unchanged.
- **Card special components stay** (step 13, 6.3.16; tests and test ids kept), with today's
  text and badge sizes of `main.css` / `mobile.css` (same rule). The front face carries all of
  them, the back face is only the d20 pattern:
  - little / grid: title with `BonusBadgeList` (`statistics` / `titleStatistics`, little
    version); `gc-type-badge` on hover; image overlay (`childrenIntoImage`, full statistics);
    `CardButtons`: (i), select and its selected state, action with the in-progress spinner,
    secondary `actionsList` buttons (grid2 / grid3), locked label with lock icon and `lockInfo`;
  - page variant (unchanged by the faces): title bar with back / forward arrows, image with the
    `BonusBadgeList` overlay (`positionBonusBadge`), description with `TipNote`, `extraContent`
    (`book-page-extra`), the `CardButtons` bar (`book-page-buttons`), `CardCreditsBar`, the
    credits "view original" link. The picture keeps today's size (step 13, 6.3.16): `max-height:
    45%` and `flex-shrink: 0` on desktop, `33svh` on mobile, never shrunk for the text.
- `CardBack.jsx` (new, `components/layout/`): the concept back pattern (45° gold stripes on the
  brown radial) **without the central circle**, double gold frame, and the site's d20 in the
  middle: an inline SVG with the `public/favicon.svg` path (Font Awesome 5 `dice-d20`, rotated
  20°, same attribution comment), 45 % of the card width, colour `--card-back-dice`
  (= `--color-gold-light`), pulsing with scale and a gold `drop-shadow` (fixed 1.6 s, not scaled
  by speed, never `opacity`). An inline SVG is used because an icon font needs a font size the
  card does not know. New prop `pulse` (default `true`): `false` gives a still, dimmer d20.
- `Deck.jsx` (new, `components/book/`): `aria-hidden`, `pointer-events: none`, two variants
  (owner decision, concept "Book position and deck"):
  - **table pile** (`variant="table"`, `.deck-pile`), desktop: rendered by `Book` inside step
    13's `.book-shell`, right after `.book-wrapper` (outside it, so it can lie under the cover).
    Ten `CardBack`s gathered with small offsets and rotations within about ±12° (concept
    `.deck-pile span:nth-child(n)`); the top one (`.deck-pile__top`) has the pulsing light-gold
    d20, the nine below `pulse={false}`.
  - Place: beside the right page, not below it, in its lower half (bottom about 70 px above the
    book's bottom edge); only a strip of about 30 px slides under the cover. Layers:
    `.book-wrapper` gets `position: relative; z-index: 1`; the pile's `data-place` comes from
    `useAnimationSettings().deck`: `under` (default) → `z-index: 0`, under the book's edge;
    `over` → `z-index: 2`, the pile covers a bit of the cover.
  - Between about 1100 and 1360 px the pile is smaller (`scale(0.8)`, origin left bottom) and
    closer to the book; under about 1100 px the book takes 94vw and only the pile's left edge
    shows, the rest cut by step 13's `overflow-x: clip` (no horizontal scroll bar). Hidden under
    `MOBILE_MQ`: no room beside the book.
  - **page deck** (`variant="page"`, `.deck`): three `CardBack`s slightly rotated (concept),
    rendered by `BookPageRight` at the end of the right page; hidden on desktop and, until step
    16's sticky deck, on mobile too.
  - Both are rendered only when the deal is on (`Book` prop `deck`, default on, passed to
    `BookPageRight`, can turn them off) and shown only when the right page holds a dealt list
    (`.book-shell:has(.book-page-right .pg-dealt)` for the pile, `.book-page-right:has(.pg-dealt)`
    for the page deck).
  - **Owner's decision after the test (November 25, 2026):** the table pile is always shown on
    desktop while the deal is on, not only when the right page holds a dealt list (`.deck-pile` is
    `display: block`); still hidden on phones and with the deal off. Step 16 later made the page
    deck sticky on phones.
  - On desktop the right page reserves no room for a deck (no bottom padding or margin): the
    card list gets the whole page height.
- CSS moves (main.css / mobile.css):
  - The base rule `.pg-card, .book-page-img` is split: `.book-page-img` keeps its look and its
    size (`max-height: 45%`, `flex-shrink: 0`); the root
    keeps position, radius, flex column, size classes and the `transform` transition, and gets
    `min-height: 0` (today `overflow: hidden` silently keeps the 2:3 ratio; without it a tall
    content would stretch the card). Border, background, `overflow: hidden` and the
    border/shadow transition move to `.pg-card__front` (`position: relative`, so every absolute
    overlay, badge and the pending spinner stay where they are).
  - Retarget to the front: hover border/shadow (`.pg-card:hover > .pg-card__front`; the lift
    stays on the root), `.config-card-selected`, `.pg-card--phase-complete|inProgress|failed`,
    `.pg-card--done`, `.pg-card--match-highlight`, the story card border, and
    `.pg-card--login-guest { container-type }`.
  - 3D only in flight: `transform-style: preserve-3d`, `backface-visibility: hidden` and the
    visible back exist only under `[data-deal="flying"]`; at rest the back is `display: none`
    (no 3D layer on hundreds of cards). Grouping properties (`overflow`, `opacity`, `filter`,
    `isolation`, `clip-path`, `mask`) never go on the root or on a face.
  - Dead rules removed: `.pg-card--home`, `.story-netflix-card` width / scroll-snap and its
    hidden `.story-card-badge`, `.stories-grid`, `.stories-section`, `.section-label`, `.hero-*`.

### 6.5 react-game — deal on every card grid
- `src/hooks/useDeal.js` + `src/components/layout/DealtList.jsx` (new). `DealtList` renders the
  list `div` with the caller's classes plus `pg-dealt`; props `className`, `children`, `hold`
  (default false; the hook for step 15's turn, which holds the deal until the turn ends), rest
  passed through.
- Rule: **a card is dealt once, the first time its node appears in the list and enters the
  screen.** The dealt element is the slot's `.pg-card` (the direct child, or its first `.pg-card`
  inside a wrapper such as `.match-card-wrap`); a slot without a card shows at once.
  - Layout effect scan at mount plus a `MutationObserver` for cards added later (new matches,
    start-match phase cards): new cards get `data-deal="waiting"` (`opacity: 0`, no pointer
    events) before the first paint; re-rendered cards are never dealt again.
  - One `IntersectionObserver` per list (root = viewport, threshold 0.2): the intersecting
    waiting cards form a batch in DOM order; `--deal-i = min(n, 7)`; `--from-x/y` = origin
    centre minus slot centre; `--from-rot` random ±15°; `data-deal="flying"` with
    `data-deal-face="down"` (face-down flip) or `"up"` (flat deal, `VITE_ANIM_DEAL_FACEDOWN=false`).
  - Origin, read at every batch (concept `dealBatch`): the top card of the table pile
    (`.deck-pile__top`) of the same `.book-shell` when displayed; else the page deck of the same
    right page (step 16's sticky deck on mobile); else the bottom-right corner of the screen.
  - The card in flight stays inside its page: no portal and no `overflow: visible` while dealing,
    so `.book-page { overflow: hidden }` clips it. On desktop it enters the right page from its
    right edge, as if it came out from under the book (owner decision).
  - Landing on `animationend` (target = the card) or a timeout fallback
    `deal + dealStep × i + 200 ms`; then `data-deal="landed"`. Unmount (and the StrictMode
    re-run) disconnects the observers, clears the timers and lands any card in flight.
  - No hidden copy: the one-tree switch comes first, so each list is rendered once. Cards hidden
    by `hide-in-book` / `hide-in-mobile` never intersect: they stay waiting and are dealt only if
    the layout switches.
  - Deal off, reduced motion, or no `IntersectionObserver` (jsdom): every card is `landed` at
    once, no timer, so the existing suites are unaffected.
  - A waiting card that gets keyboard focus lands at once (no invisible focused button).
  - The first batch of a book that is still opening is measured after the opening animation,
    so the cards leave the deck where it is drawn.
  - The list's `slideInRight` animation is dropped while the deal is on (they would fight).
- The 16 grids wrapped in `DealtList`: `PageRightMain`, `PendingChoicesList`, `ItemsCards`,
  `MissionCards`, `MissionStepsCards`, `RegistryCards`, `ExperienceCards`, `PageRightInfo`,
  `ConfigView`, `OptionPicker`, `StartMatchFlow` (confirm and phases blocks), `UserMatchesList`,
  `PolicyBook` (credits and roadmap), `StoryCatalog` (Home).

### 6.6 react-game — card columns parameter
- `variables.css`: `--cards-cols-wide: 3; --cards-cols-narrow: 2; --cards-cols: var(--cards-cols-wide)`;
  then, in this order:
  - under 1120 px (today's breakpoint): `--cards-cols: var(--cards-cols-narrow)`;
  - phone turned sideways (today's `(orientation: landscape) and (max-height: 500px) and
    (min-width: 500px)` query): `--cards-cols: var(--cards-cols-wide)`, as in the concept;
  - under 331 px (`max-width: 330px`): `--cards-cols: 1`.
- `.selection-list { grid-template-columns: repeat(var(--cards-cols), minmax(0, 1fr)) }`; the
  four `!important` column rules of `mobile.css` (991 → 3, 550 → 2, 1120 → 2, 330 → 1) and the
  plain mobile-stack rule are removed. Visible changes: a portrait mobile layout between 551 and
  991 px goes from 3 to 2 columns; a phone sideways always gets 3.
- Step 16 hook: the player's choice (`auto` or 1–4, capped per layout) overrides
  `--cards-cols-wide` / `--cards-cols-narrow` (e.g. `html[data-pg-cols="4"]` rules, no inline
  style); the media queries keep choosing which one applies. No JS constant, no env key.

### 6.7 react-game — Home book
- `HomePage.jsx`: renders step 13's `Book` with `left` = intro page, `right` = stories page,
  `homeTab={false}` (the Home has no home tab); data loading, `footerState`,
  `handleStoryClick`, `HomeStatusContext` errors, hidden and coming-soon filters unchanged. `HERO_IMG` is dropped: the picture and its credit come from the
  `home` entry of `data/images.json` (already listed in the policy credits) via
  `buildImageCard('home', t('home.heroTitle'), t('home.heroSub'))`.
- Intro page (left, fixed): `Card variant="page"` with that card, so the `CardCreditsBar` shows
  the photo credit; new optional `titleTag` prop on the page variant (default `h2`) so the Home
  title stays the page's `h1`. No tip, no type badge. The picture keeps the page card's size
  (6.4), never shrunk to make room for the `extraContent`. `extraContent`, in this order:
  - the **anti-bot result**: while `gate.phase === 'checking'` the strip "Checking you're human…"
    (`antibot.verifying`) with the single Turnstile widget (keyed by `gate.attempt`); once
    passed (`ready`) one line "Success! You are human." (`antibot.success`, new); blocked and
    error keep today's navbar message;
    **Owner's decision after the test (November 25, 2026):** the strip and the success line sit
    under the intro text (`Card` prop `afterDescription`), not in `extraContent`; the success
    line shows only after a check passed on this visit and leaves after 4 s; the intro text is
    three lines;
  - `TutorialButton` once the stories are loaded, **larger and centred** (CSS of the existing
    `.home-tutorial-btn`; its logic and the `tutorial-btn` test id unchanged).
- Stories page (right): heading `home.stories` kept in the markup but hidden by CSS
  (`book-cards-heading`, step 13 6.3.15: its place is reserved for the multiplayer messages); then
  - loading: `LoadingCard` (page variant) as the game's loading page;
  - fetch error: today's yellow sign with `role="alert"` (words and retry stay in the navbar);
  - empty: `home.noStories`;
  - else `StoryCatalog`: `config-view-wrap` + `DealtList className="config-cards-area
    selection-list home-stories"` with every `StoryCard` in one list, in today's order
    (categories in first-seen order, teasers inside their category); each card shows its
    category badge (`.story-card-badge`, hidden today because the row title named it);
    `StoryCard` drops the fixed 225 px width and becomes a normal grid card.
- Policy chapter: step 13's interim Home host (its 6.3.5) is deleted. When `usePolicyChapter()`
  returns a chapter, the Home book shows the chapter's pages; the intro and stories pages stay
  mounted but `hidden`, so the Turnstile check keeps running, as in step 13.
- `LoadingCard` loses its `maxWidth` prop: the Home was its last user (step 13, 6.3.13).
- Mobile: the Home is rendered once and CSS stacks the intro page above the stories page (the
  one-tree `Book`), no hidden copy: one Turnstile widget, one tutorial button, one card list.

### 6.8 react-game — env and infra
The seven keys, in `.env.example` with one comment line each:

| Key | Default | Meaning |
|---|---|---|
| `VITE_ANIM_DEAL` | `true` | cards are dealt from the deck |
| `VITE_ANIM_DEAL_FACEDOWN` | `true` | cards fly face-down and flip (`false` = flat deal) |
| `VITE_ANIM_PLAY` | `true` | play effect (step 15) |
| `VITE_ANIM_TURN` | `true` | page turn (step 15) |
| `VITE_ANIM_TURN_MODE` | `full` | `full` or `simple` turn (step 15) |
| `VITE_ANIM_SPEED` | `0.25` | speed factor, clamped to 0.1–4 |
| `VITE_ANIM_DECK` | `under` | desktop deck pile `under` the book's edge or `over` it |

- `.github/workflows/alpha-deploy-website.yml`: the seven keys join the `env` of the step "Write
  .env.alpha from the alpha variables" (`VITE_ANIM_DEAL: ${{ vars.VITE_ANIM_DEAL }}`, …), as the
  15 keys of today; the loop and `deploy_website.sh --check-only` are unchanged, so the rule
  "every `.env.example` key has an alpha value" holds.
- **For the owner** (done by him only): create the seven variables (`VITE_ANIM_DECK` included),
  with the defaults above, in the GitHub `alpha` environment, and add the seven keys to `.env`,
  `.env.test` and `.env.alpha`.
  `.env.test` is also loaded by Vitest (mode `test`); the unit tests never depend on its values.

### 6.9 react-game — i18n
The hidden right-page heading reuses `home.stories` (EN "Stories", IT "Storie", unused today);
the credit bar uses existing keys; the back and the deck are `aria-hidden`. One new key:
`antibot.success`: English source "Success! You are human.",
Italian translation "Verifica superata! Sei umano.".
Any other key added during development follows step 13's language rule (its 6.3.11).

## 7. Tests

Vitest, coverage > 96 % of the new code. jsdom has no `IntersectionObserver`, `animationend`
from CSS or layout: new suites install a fake observer and mock `getBoundingClientRect`.

- `animations.test.js`: flag parsing, turn mode fallback, speed (invalid, ≤ 0, clamp), deck
  (`under`, `over`, anything else `under`, kept under reduced motion), override precedence,
  reduced motion wins, scaled timings, CSS variables and `data-pg-reduced` written.
- `AnimationContext.test.jsx`: provider with and without `matchMedia`, mocked `matchMedia`
  without `addEventListener`, OS change event, `setAnimationOverrides`, default without provider.
- `useDeal` / `DealtList` tests: waiting marks before paint, batch order and stagger cap at 8,
  origins (pile top card; page deck when the pile is not displayed; screen corner when neither),
  face down / up, `animationend` and timeout landing (fake timers),
  unmount mid-flight, re-render not re-dealt, card added later dealt, wrapper slot, hidden card
  stays waiting, focus lands, `hold`, deal off / reduced / no observer → landed at once.
- `CardBack`, `Deck`: d20 rendered, `aria-hidden`, `pulse={false}`; table pile with ten backs,
  only the top one pulsing, `data-place` `under` / `over` from the setting; page deck with three
  backs; none rendered when the deal is off or with `deck={false}`. `Book.test.jsx`: the pile
  inside `.book-shell`, after and outside `.book-wrapper`; the page deck inside the right page.
- `Card.test.jsx`, `CardVariants.test.jsx`, `CardButtons.test.jsx`: faces on every non-page
  variant; every special component of 6.4 (badges, type badge, image overlay, (i), select,
  spinner, secondary and locked buttons) inside the front, none in the back; page variant
  unchanged; `titleTag`; existing test ids unchanged.
- Home: `HomePage.test.jsx` (book pages, no home tab, `h1`, credit bar, strip while checking
  then the success line in the intro card's `extraContent`, tutorial button centred, hidden
  `home.stories` heading still in the markup, loading / error / empty on the right page, rendered once with one Turnstile widget,
  policy chapter over the Home with the widget still mounted), `LoadingCard.test.jsx` (no
  `maxWidth`), `StoryCatalog.test.jsx` and `ComingSoonStories.test.jsx` (the four category-row
  tests become one-list tests: today's order, teasers inside their category, category badge on
  each card), `TutorialButton.test.jsx` Home part.
- One smoke test per wrapped grid family: the list carries `pg-dealt`.
- Unchanged suites stay green: they select by class (`.pg-card`, `.gc-footer__btn`, …), which
  stay on the same elements.
- Robot: none (API-only).
- Manual check before the owner's review, on desktop at about 1440, 1280 and 1024 px wide:
  - the pile beside the right page in its lower half, a strip under the cover; with
    `VITE_ANIM_DECK=over` it covers a bit of the cover; no pile on a phone;
  - cards leave the pile's top card and enter the right page from its right edge; no empty room
    for a deck at the bottom of the right page;
  - the pile smaller and closer between 1100 and 1360 px, only its edge under 1100 px, never a
    horizontal scroll bar;
  - page pictures (the Home intro included) and card texts as big as today (step 13, 6.3.16).

## 8. Doubts

No open doubts. Owner's fixes after the first test (November 25, 2026): dealt lists `overflow: visible`,
scroller reaching 10 px into the page margin, grid padding 8px 4px 12px, tighter dark hover shadow plus gold glow,
dark-gold scroll bars inside the book; details in [test/Step14_HomeBookAndCardFaces.md](./test/Step14_HomeBookAndCardFaces.md) §3.

> Owner's decision, November 26, 2026 (1.15.0): on desktop the deck pile now follows the home tab in the right bookmark column ([Step 15](./Step15_PlayAndPageTurn.md) section 9 point 3), and the CSS `bookOpen` is replaced by the first-load opening in code (`RouteBook`, `bookSwap.js`).

# Version Control
- **Document Version**: 1.15.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Home book, card backs and deck on the table agreed | November 24, 2026 |
  | 1.14.0 | Developed; waiting for owner's test | November 25, 2026 |
  | 1.15.0 | Deck pile placement and book opening changed | November 26, 2026 |

- **Last Updated**: November 26, 2026 (v1.15.0)


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
