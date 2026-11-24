# Step 13 — Book layout without modals

**Status: analysed (November 24, 2026), version 1.13.0. Owner decisions recorded (home tab, also from a policy chapter, drawn tooltip with a long press on touch, book graphics, book close to the navbar, no heading over the cards, trait budget, card components, page picture and text sizes kept, English source texts); no open doubts: ready for development.**
Roadmap line: *every page keeps its own book under an always-visible navbar* ([Roadmap](./Roadmap.md) step 13).
Book UI chain (version 1.13.0): **Step 13** · `Step14_HomeBookAndCardFaces.md` · `Step15_PlayAndPageTurn.md` · `Step16_MobileBookAndPreferences.md`.
Development order: step 13, then step 16's "one tree on mobile" switch (each page rendered once, the two pages stacked by CSS under `MOBILE_MQ`), then steps 14, 15 and the rest of 16.
Reference prototype: [`website_concepts_v0/v1.13.0/`](./website_concepts_v0/v1.13.0/README.md).

## 1. Scope

**Goal.** The game, start book, start match, end game, player and policy books stop being full-screen overlays. Each one becomes the in-flow book of its own page, sized to the screen under a sticky navbar that is always visible. The footer sits below the fold.

**In (react-game only):**
- `Book.jsx` rewritten: no overlay, an in-flow `.book-stage` sized to the screen under the navbar, the book close to it (over the book only the bookmarks' height), and the new book graphics (leather cover, gold corners and headbands, page edges, ribbon: 6.3.2).
- Every modal book moves into the page layout: game, end game, start match, the start book (new route `/story/:storyId`), the player book (new route `/player`).
- The policy book becomes a **chapter** of the current book. It opens without a URL change, also during a match, and the `?policy=` deep link keeps working.
- Today's close (X) becomes the **home tab**: a bookmark with the home icon on the right of the book's top edge, on every page but the Home, labelled "Back to the home page". In a match it still opens today's close card first, also from an open policy chapter. The navbar gets no close button (6.3.3).
- A **drawn tooltip** replaces the browser `title` on bookmarks and icon-only buttons; on touch screens a long press shows it (6.3.14).
- No heading over the right page's card list: kept in the markup, hidden by CSS, its place reserved for the multiplayer messages (6.3.15). The trait budget badges are not a heading and stay visible.
- The Card special components stay, with their tests and test ids; the page card's picture and the text and badge sizes keep today's values (6.3.16, a rule for steps 13–16).
- New footer (two centred rows) below the fold.
- `ErrorCard` becomes the right page of the book, like `LoadingCard`. The cookie banner stays a modal.
- Mobile scrolling moves from `.book-overlay` to the page (the document). The scroll helpers and the sticky behaviour are fixed.
- The z-index layers are cleaned up. Dead code is removed. New EN/IT i18n keys. Unit tests are rewritten.
- Deep-link and browser-Back behaviour of every route.

**Out (sibling steps):**
- Home book, card faces, animation config and deal: `Step14_HomeBookAndCardFaces.md`. Until then the Home keeps the hero and the catalog. Section 6.3.5 gives its interim chapter host.
- Play animation, page turn, (i) fade and `CardPreviewModal` removal: `Step15_PlayAndPageTurn.md`. Bootstrap's `#cardPreviewModal` and the `body` clean-up in `EndGameBook` stay until then.
- Vertical mobile book (one tree instead of the `mobile` slot), mobile turn and preferences: `Step16_MobileBookAndPreferences.md`. The one-tree switch comes right after this step, so step 13 touches the `mobile` slot only as far as the layout needs.
- Backends (Java, Python, AWS), react-admin, OpenAPI and Robot are untouched (section 6).

## 2. Endpoint APIs

No REST change on any backend; no OpenAPI file changes. Calls made by the new pages already exist: `GET /api/stories/{uuid}` (story detail, `getStoryDetail`), `GET /api/matches` (`listMatches`), the auth and match endpoints used today.

Frontend routes after this step (`src/app/routes.jsx`):

| Route | Page | Reached from | Direct load without router state (typed URL, bookmark, new tab) |
|---|---|---|---|
| `/` | `HomePage` | brand, home tab, every "home" action | unchanged |
| `/player` **new** | `PlayerPage` (was `GuestUserModal`) | navbar user, sign-in, session-limit alert, Home story with a blocking match, start-match "Logged" card (i) | works: the matches list is fetched (no preloaded list) |
| `/story/:storyId` **new** | `StoryPage` (was `StartBookModal`, a state of the Home) | Home story card, Tutorial button, start-match "Back" card | works: `getStoryDetail(storyId)`; an unknown or failing story shows the `ErrorCard` right page. The Home's active-match guard is not repeated: the backend already refuses a second match with `ACTIVE_MATCH_ALREADY_EXISTS` |
| `/start-match/:storyId` | `StartMatchPage` | story page "Start" | redirect (replace) to `/story/:storyId`, no longer to `/` |
| `/play/:storyId` | `GamePage` | start-match `created` (replace), Home Resume, player page Resume | was an error page: resumes the player's only running match of that story, else redirect (replace) to `/story/:storyId` (6.3.4) |
| `*` **new** | redirect (replace) to `/`, query string kept | mistyped URL | today an empty page |

The router state survives a browser refresh (`history.state`), so only typed or shared URLs lose it. The site's CloudFront already serves `index.html` for 403/404 (`code/website/terraform-aws/cloudfront.tf`, "SPA fallback"), so the new paths need no infra change.

## 3. DTOs and Domain Models

No backend DTO or domain change. Frontend contracts that change:

- **Router state:**
  - `/story/:storyId`: `{ story?, config? }`. `config` is the loadout to reopen with; it replaces Home's `reopenStory`/`reopenConfig`.
  - `/start-match/:storyId`: `{ story, config }` (unchanged).
  - `/play/:storyId`: `{ matchUuid }` (unchanged).
  - `/player`: none.
- **`GuestUserContext`:** `guestModalOpen`, `openGuestModal` and `closeGuestModal` are removed. `matches`/`setMatches` (the preloaded list) and `accountDeleted` stay. A new hook `usePlayerPage()` (`features/guest-user/usePlayerPage.js`, inside the router) returns:
  - `openPlayerPage(preloaded?)`: stores the list, then `navigate('/player')`;
  - `closePlayerPage()`: `reloadHome()` after an account deletion, else `navigate('/')`.

  The context itself cannot navigate: `Providers` wrap `BrowserRouter`.
- **`PolicyBookContext`:** same API (`policyBook`, `openPolicyBook`, `closePolicyBook`). Opening stores `window.scrollY` and scrolls to the top. Closing restores that position (guarded, since jsdom has no real scroll).
- **New `HomeButtonContext`** (`src/context/HomeButtonContext.jsx`, mounted in `Providers`), with two hooks:
  - `useHomeButtonHandler(fn)`: a page registers an override of the home tab while mounted;
  - `useHomeButton()`: the book's home tab and the navbar brand read it.

  The handler is held in a ref, so registering it causes no re-render.
- **`Book` props**, after this step:
  - kept: `left`, `right`, `mobile`, `bookmarksLeft`, `bookmarksRight`, `showBookmarks`, `wrapperClass`;
  - `overlayClass` becomes `stageClass`;
  - `onClose` and `closeLabel` are removed;
  - new: `homeTab` (default `true`; the Home passes `false`): Book appends the home tab after the `bookmarksRight` items;
  - new: `pageKey` and `direction` (`'forward' | 'back' | null`), written as `data-page-key` / `data-direction` on `.book-wrapper` only (hooks for step 15).
- **Tooltip target**: any element with `data-tip="<text>"` (6.3.14); `BookBookmarks` items keep `title` as the tooltip text, now written as `data-tip`.

## 4. Roles and Authentication

Unchanged. Every route is public, as today; the API enforces guest/Google rights. `/player` shows the same content to a guest and a Google user. The page's Turnstile check (`VITE_TURNSTILE_APPEARANCE_GUEST`) and the account deletion flow move with it. After a deletion, the "close" button and the home tab both reload the home (`reloadHome()`), as `closeGuestModal` does today. Login, logout, `SESSION_LIMIT` and the cross-tab sync are untouched. The session-limit alert's "sign in again" now opens `/player`.

## 5. Database Tables

None: no Flyway migration (SQLite, PostgreSQL) and no DynamoDB item. No new browser storage either (step 16 adds the preference keys).

## 6. Components

### 6.1 Java, Python, AWS

No change: there is no API contract change.

### 6.2 react-admin

No change.

### 6.3 react-game (`code/frontend/react-game/`)

#### 6.3.1 Layout shell
- `App.jsx` renders `CookieConsentManager`, `Navbar`, `<main className="app-main">` holding the routes, then `Footer` and `TooltipLayer` (6.3.14). The global mounts of `PolicyBook` and `GuestUserModal` are removed.
- `main.app-main` gets `min-height: calc(100dvh - var(--navbar-h))` (with a `100vh` fallback first). Every page, the Home included, fills the screen under the navbar, so the footer is only reached by scrolling. The footer's `margin-top: 60px` goes.
- `--navbar-h`: the `Navbar` writes its real height on `<html>` through a `ResizeObserver`, since the bar wraps on mobile and with the error pill. CSS fallback: `72px` on desktop, `56px` on mobile. Guard: jsdom has no `ResizeObserver`.
- **Sticky fix**: `html, body { overflow-x: hidden }` in `mobile.css` becomes `overflow-x: clip`. With `hidden`, `body` becomes a scroll box, and once the document scrolls the sticky navbar would stop sticking. `.game-page-wrap` goes (6.3.4). The same fix is needed by step 16's sticky deck and pills, and it cuts step 14's deck pile at the screen edge without a horizontal scroll bar.
- `AppRoutes` closes an open policy chapter on every pathname change, except on the first render, so the `?policy=` deep link survives the load. Without this, the global chapter would follow the player to the next page.

#### 6.3.2 `Book.jsx`
- Structure: `.book-stage[.stageClass] > .book-shell > .book-wrapper > (bookmarks, spine, left page, right page)`, then the `mobile` slot.
  - Desktop `.book-stage`: `display: flex`, centred, no `overflow` clipping (step 14's deck pile hangs beside the book). **Book close to the navbar** (owner decision): the top padding is just the bookmark row's height (about 46 px), so the tabs stick out above the book without sitting under the navbar. When Book renders no tab at all (the Home, also with a chapter open) it adds `book-stage--no-tabs` and the top padding drops to about 16 px. Sides and bottom about 16 px and 30 px (concept `.stage`).
  - `.book-shell` (new): `position: relative`, it carries the desktop book size and the opening animation (`bookOpen` moves there from `.book-wrapper`). `.book-wrapper` and any `wrapperClass` size rule (e.g. `.start-match-wrapper`) fill it. It is the positioning box of step 14's deck pile. Under `MOBILE_MQ` it is `display: contents`.
  - Mobile `.book-stage`: `display: block`, no own scroll; the document scrolls.
  - Desktop book size (on `.book-shell`): the width keeps `min(94vw, 1080px)`; the height follows the screen (`100dvh` minus `--navbar-h` and the stage padding), at least 520 px, instead of `min(88vh, 680px)`. With the small top padding the book is taller.
- The fixed close bar, `.book-close-*`, `closeLabel` and the `padding-right: 56px` that `.book-bookmarks--right` kept for the old X are removed; the home tab now sits in that row (6.3.3).
- **Book graphics** (new `styles/book.css`, imported by `main.css`; palette unchanged, site tokens only):
  - cover: leather with a gold tooled frame and stitching; **dark gold** (`--color-gold-dark`, not light gold) metal corners with rivets and headbands at both ends of the spine; the binding thread on the spine;
  - pages: stacked page edges, paper grain, gutter shading, corner flourishes in `--color-gold-deep`; a ribbon under the bottom edge;
  - drawn with CSS gradients and a few empty `aria-hidden`, `pointer-events: none` elements (corners, headbands, ribbon); the grain may be an SVG data URI (CSP `img-src` already allows `data:`), no new image file;
  - mobile: a vertical book bound on its left edge, styled with step 16's one-tree layout (its 6.3).
- Policy chapter: `Book` calls `usePolicyChapter()` (6.3.5). While a chapter is open, Book renders the chapter's pages (desktop and mobile) and hides the bookmarks, except the home tab (in a match it opens the close card, 6.3.3). Its own `left`/`right`/`mobile` stay **mounted and rendered but covered** (`.book-content--covered`: `visibility: hidden`, out of flow, zero height on mobile), never `display: none` and never unmounted. This keeps in-flight state: `CardButtons.actionStarted`, the `AutomaticEvents` index, and the start-match Turnstile iframe that must keep running.
- Outside a `PolicyBookProvider` (isolated tests) the hook is inert, as today.

#### 6.3.3 Home tab and navbar
- **Home tab**: a bookmark (`BookBookmarks` `side="right"`, today `BOOKMARKS_RIGHT` is empty) on the right of the book's top edge, last of that row: `{ key: 'home', icon: 'fas fa-home', label: nav.backHome }` (the home icon, not an X; "Back to the home page" as `aria-label` and drawn tooltip).
  - Shown on every Book but the Home's (`homeTab={false}`, also on step 13's interim Home chapter host): story set-up, start match, game (loading and error included), player page, end game.
  - Not tied to `SHOW_BOOK_BOOKMARKS` / `showBookmarks`, which gate the game's tabs only. Outside a router (`useInRouterContext()` false: isolated Book tests) it is not rendered.
  - Mobile in this step (the `mobile` slot is still there, `.book-wrapper` hidden): the same tab sits at the top-right of `.book-stage`, above the stack. Step 16 moves it to the end of the sticky bookmarks row, pinned there while the other tabs scroll sideways.
- Click: runs the registered handler, else `navigate('/')`. Handlers:
  - `GameBook`, while the match is running: `closePolicyBook()`, then `setPreviewRight({ kind: 'close' })`. This is today's close card; on mobile `useBookView` already scrolls it into view. **Also with a policy chapter open** (owner decision): the chapter gives way to the close card, never straight to the Home; the close card's scroll into view must win over the chapter's scroll restore (`PolicyBookContext`, section 3);
  - `PlayerPage`: `closePlayerPage` (the deletion case);
  - `EndGameBook`, `StoryPage`, `StartMatchPage` and the game's loading and error states: none (plain home). Outside a match the tab goes to the Home even with a chapter open; the route change closes the chapter (6.3.1).
- **Navbar**: no close button. The "Exit to Home" button shown on `/play/…` today goes (it sits under `.book-overlay` and cannot be reached in a match), and so do `.navbar-home-btn` and `.navbar-social--tight` (its only reason was that button): the navbar is the same on every route.
- Brand: when a handler is registered (in a match, the close card first, also from a policy chapter; on `/player` it ends at home anyway) its click prevents the full reload and runs that handler; otherwise it keeps `href="/"`.
- User and sign-in buttons open `/player` directly, also in a match. It is a push, so Back returns to the match, which reloads from its router state.

#### 6.3.4 Pages
- **`/player`**: `pages/PlayerPage.jsx` (route shell) and `features/guest-user/PlayerBook.jsx` (today's `GuestUserModal` body, without `guestModalOpen`).
  - It registers `closePlayerPage` as the home-tab handler and clears the preloaded `matches` on unmount, as `closeGuestModal` does today.
  - `UserMatchesList` loses its `onClose` prop: Resume just navigates to `/play/…`.
  - `UserAccountPanel`'s deletion "close" button calls `closePlayerPage`.
  - Callers updated: Navbar (user button, sign-in button, `signInAgain`), `HomePage` (blocking match, `openPlayerPage(list)`), `StartMatchFlow` (the Google "Logged" card (i)).
- **`/story/:storyId`**: `pages/StoryPage.jsx` and `features/start-book/StartBook.jsx` (today's `StartBookModal`, without `onClose`).
  - `HomePage.handleStoryClick` navigates with `{ state: { story } }` instead of `setSelectedStory`. The Home's reopen effect and its `selectedStory`/`reopenConfig` state go.
  - While the detail loads, the page shows the same Book: the story card (from the state) on the left, `LoadingCard` on the right. Today it is a bare spinner inside `.book-overlay`.
  - "Start" first saves `{ story, config }` in the current entry (`navigate(pathname, { replace: true, state })`), then pushes `/start-match/:storyId`. This way the browser Back and the start-match "Back" card both find the loadout.
- **`/start-match/:storyId`**: `StartMatchFlow` loses `onClose` and `goHome`.
  - `goBackToBook` returns to `/story/:storyId` with `{ story, config }`: `navigate(-1)` when the previous entry is that story page, else a replace.
  - The `created` phase enters `/play/:storyId` with `replace: true` (state `{ matchUuid }`), so Back from the game returns to `/story/:storyId`, never to a spent start-match page.
- **`/play/:storyId`**: `GamePage` drops `.game-page-wrap` and renders a Book in every state:
  - no `matchUuid` in the router state: once the session is known, one `listMatches` and `findResumableMatch(list, storyId)`. A match found replaces the entry with `{ matchUuid }`; no session, no running match or a failed list redirects (replace) to `/story/:storyId`. The `LoadingCard` shows meanwhile;
  - initial load: left `LoadingCard` (the story picture when known), right an empty page. Step 14 deals the cards into it;
  - fatal error (no match, failed load): left the story card when loaded, else the fixed error picture; right `ErrorCard`. Closing it goes home, as today;
  - board: `GameBook`, which takes a new `error` prop (6.3.6).
- **End game**: `EndGameBook` drops `overlayClass` and `onClose` from its Books. Its "Close" actions are unchanged. GameBook stops registering the close-card handler once `gameEnded` is true.

#### 6.3.5 Policy chapter
- `components/modals/PolicyBook.jsx` moves to `components/book/PolicyChapter.jsx`. It exports `usePolicyChapter()` and returns `{ kind, left, right, mobile }` or `null`. `RoadmapCards`, `RoadmapIntro` and `REPO_URL` are still exported from it. The credits stories load as today.
- The chapter's left page card gets `onClose={closePolicyBook}`: the back arrow returns to the page exactly as it was. The Devlog intro's "credits" link switches to the credits chapter, as today.
- Opened from anywhere: footer links, Devlog info icon, card credit links (`Card` → `openPolicyBook`), terms (i) in start-match, age notice in `UserAccountPanel`. During a match the board stays mounted under the chapter (6.3.2).
- `?policy=privacy|cookies|terms|roadmap` on load opens the chapter in that route's book. Closing it drops the parameter (`clearPolicyDeepLink`), as today.
- **Interim Home host** (until step 14): while `policyBook` is set, `HomePage` covers its hero and catalog (kept mounted, so the Home Turnstile keeps running) and renders `<Book left={null} right={null} homeTab={false} />`, which shows the chapter. Step 14 deletes this branch, because the Home becomes a Book.
- The chapter adds no history entry: the browser or Android Back leaves the page, as with today's modals; the chapter's own back arrow closes it.

#### 6.3.6 `ErrorCard` and `LoadingCard` as right pages
- `components/modals/ErrorCard.jsx` moves to `components/layout/ErrorCard.jsx`, next to `LoadingCard`. It drops `.error-card-overlay` and the `maxWidth` prop (only `GamePage` used it) and returns the page `Card` only.
- In a match, a transient error (`GamePage.handleGameError`) reaches `GameBook` as `error`. The right page becomes `ErrorCard` (priority: error, then `results.loading`, then content) and the left page is untouched. Closing clears the error. On mobile, the right part of the stack scrolls into view.
- `LoadingCard` keeps `maxWidth`: the Home uses it until step 14.

#### 6.3.7 Footer
- A small bar after `main` (smaller padding and font), so it is never visible when a page opens. Two centred rows, on desktop and on mobile:
  - **Row 1**:
    - `<EnvBadge>` (env label and info icon, opens `openPolicyBook('roadmap')`). With no label (`prod` or empty), the info icon shows alone with the "Devlog" drawn tooltip, so the Devlog stays reachable;
    - the server: a select when there are several servers (as today, with its status dot); with a single server, a badge "green icon, server `<version>`" when online, a red icon with `footer.serverOffline` when offline, and `footer.serverDetecting` while probing (today a hard-coded English "detecting…"). Its drawn tooltip is `footer.serversWarning`;
    - "`<fa-dice-d20>` PATHS GAMES v1.13.0 © ALL RIGHTS RESERVED". The `v1.13.0 &nbsp;` text stays at the start of its own source line, as `bump-version.sh` matches `^\s*v<semver>(?= &nbsp;)`: the script is untouched.
  - **Row 2**: Privacy, Terms, Cookies, Credits (buttons that open the chapter).
- Leave the footer: GitHub (still in the Devlog intro), the Devlog link (now the env badge's info icon), Instagram and YouTube (still in the desktop navbar), the alpha sentence and "Crafted with ♥ by …".
- Mobile keeps the two rows: the env short label (already there), the server badge as icon plus version, and short link labels (`footer.short.*`). Row 1 may wrap only below about 360 px.

#### 6.3.8 Mobile scrolling
- `mobileView.js`:
  - `scrollBookToTop` drops the `.book-overlay` `scrollTo` and keeps `.book-mobile-left` `scrollIntoView`;
  - `scrollMobileIntoView` is unchanged;
  - both take an optional `behavior` (default `'smooth'`; step 16 passes `'auto'` under a turn).
  - The file comment no longer names `.book-overlay`.
- `.book-mobile-left`, `.book-mobile-right` and `.book-stage` get `scroll-margin-top: var(--navbar-h)`, so a scrolled-to card is not hidden under the sticky navbar.
- `mobile.css`:
  - `.book-overlay.book-overlay {…}` becomes `.book-stage` (block flow, no own overflow, a top padding just for the home tab: no close bar any more);
  - `.start-match-overlay > .book-mobile-layout` becomes `.start-match-stage > …`;
  - `.book-close-label` is removed.
- Step 14's IntersectionObserver uses the viewport (`root: null`), not `.book-overlay`.

#### 6.3.9 Layers after this step

| Layer | z-index | Change |
|---|---|---|
| Sticky navbar | 1000 | unchanged; `--z-navbar` variable |
| `.pg-update-banner` (fixed under the navbar) | 1010 | was 1070; `top: calc(var(--navbar-h) + 8px)` instead of `72px` |
| Bootstrap `#cardPreviewModal` (until step 15) | 1050 / 1055 | Bootstrap default, unchanged |
| `.navbar-toast` | 2000 | unchanged; `top` follows `--navbar-h` |
| Drawn tooltip `.pg-tooltip` (6.3.14) | 2100 | new; `--z-tooltip` |
| Cookie banner (`#cc-main`) | library max | unchanged, stays a modal |

Removed: `.book-overlay` (1050), `.error-card-overlay` (1060), `.policy-book-overlay` (1060), `.sleep-modal-backdrop` (1080), `.book-close-bar` (1100), `.close-prompt-overlay` (1200). The layers inside the book (spine 10, bookmarks 5, cards up to 20, the cover ornaments) stay below the navbar.

#### 6.3.10 Dead code removed
- `components/modals/CardDetailModal.jsx` and its test (only the test uses it).
- `CloseGameCard`'s overlay mode: the branch without `onBack`, `onDismiss`, and the `.close-prompt-*` CSS. Only `PageRight` renders the card, always with `onBack`.
- CSS: `.sleep-modal-backdrop`, `.sleep-modal-content`, `.modal-close-btn` and `.credits-list` (main and mobile). No markup uses them. Also `.book-close-*`, `.navbar-home-btn` and `.navbar-social--tight` (6.3.3).
- `features/start-match/ConfirmStep.jsx`: only a commented import refers to it since v0.38.3. The commented `ConfirmStep` block in `StartMatchFlow` goes with it.
- i18n keys that become unused after the footer change (check with grep first): `footer.alphaPrefix`, `footer.madeWith`, `footer.byTeam`, `footer.github`, `footer.instagram`, `footer.youtube`, `footer.roadmap` (already unused), `game.closeBook`. `footer.serversWarning` stays (server drawn tooltip).

#### 6.3.11 i18n (EN / IT, `src/i18n/en.json`, `it.json`)

| Key | EN | IT |
|---|---|---|
| `nav.backHome` (home tab) | Back to the home page | Torna alla pagina iniziale |
| `footer.serverVersion` | server {version} | server {version} |
| `footer.serverOffline` | server offline | server non raggiungibile |
| `footer.serverDetecting` | detecting… | rilevamento… |
| `footer.short.privacy` / `.terms` / `.cookies` / `.credits` | Privacy / Terms / Cookies / Credits | Privacy / Termini / Cookie / Crediti |
| `errors.storyNotFound` | This story could not be loaded. | Non è stato possibile caricare questa storia. |

English is the default language (steps 13–16): every new key is written first in `en.json`, the source text, and `it.json` holds its Italian translation.

`t()` has no interpolation: `{version}` is replaced by the caller, as `rateLimitMessage` does with `{time}`. The `modals.guestUser.*` keys keep their names (step 17 namespaces the keys per page).

#### 6.3.12 Files

| Action | Files |
|---|---|
| New | `pages/PlayerPage.jsx`, `pages/StoryPage.jsx`, `features/guest-user/usePlayerPage.js`, `context/HomeButtonContext.jsx`, `components/ui/TooltipLayer.jsx`, `styles/book.css` |
| Moved / renamed | `GuestUserModal.jsx` → `features/guest-user/PlayerBook.jsx`; `StartBookModal.jsx` → `features/start-book/StartBook.jsx` (`CardPreviewOverlay` still exported); `components/modals/PolicyBook.jsx` → `components/book/PolicyChapter.jsx`; `components/modals/ErrorCard.jsx` → `components/layout/ErrorCard.jsx` |
| Changed | `App.jsx`, `providers.jsx`, `routes.jsx`, `Book.jsx`, `BookBookmarks.jsx`, `Navbar.jsx`, `Footer.jsx`, `EnvBadge.jsx` (footer variant), `PolicyBookContext.jsx`, `GuestUserContext.jsx`, `UserAccountPanel.jsx`, `UserMatchesList.jsx`, `HomePage.jsx`, `GamePage.jsx`, `StartMatchPage.jsx`, `StartMatchFlow.jsx`, `StartBookMobile.jsx` (comment), `GameBook.jsx`, `EndGameBook.jsx`, `CloseGameCard.jsx`, `mobileView.js`, `main.css`, `mobile.css`, `variables.css`, `en.json`, `it.json`; `title` → `data-tip` only (6.3.14): `Card.jsx`, `CardButtons.jsx`, `TipNote.jsx`, `BonusBadgeList.jsx`, `Map.jsx`, `RegistryLockInfo.jsx`, `MatchLogCard.jsx` |
| Deleted | `components/modals/CardDetailModal.jsx`, `features/start-match/ConfirmStep.jsx` |

After this step `components/modals/` holds only `CardPreviewModal.jsx`, which step 15 removes.

#### 6.3.13 Hooks left for the sibling steps
- **Step 14**:
  - Home becomes a `Book`, rendered once on mobile (after the one-tree switch), and drops the interim chapter host (6.3.5);
  - the deck: step 14 adds the table pile beside the right page, inside `.book-shell` and outside `.book-wrapper` (so the desktop stage must not clip), plus the in-page deck used on phones;
  - the IntersectionObserver root is the viewport;
  - `LoadingCard.maxWidth` can go once the Home no longer uses it.
- **Step 15**:
  - `Book.pageKey` and `direction` (data attributes only in step 13); a chapter's key is `policy:<kind>`;
  - `ErrorCard` and `LoadingCard` are already right pages (the play fallback);
  - `#cardPreviewModal` and the `EndGameBook` `body` clean-up are still there to remove.
- **Step 16**:
  - the document scrolls and the navbar is sticky with `--navbar-h` (sticky tabs at `top: var(--navbar-h)`); the mobile status card gives way to them (`SHOW_MOBILE_CARD_CHARACTERISTICS` defaults to `false` there);
  - the `overflow-x: clip` fix is done;
  - the scroll helpers take `behavior`;
  - the preferences card goes in `PlayerBook`'s right page;
  - the `mobile` slot of `Book` is still there; the one-tree switch replaces it right after this step;
  - the home tab's mobile copy (6.3.3) goes with the one-tree switch; the tab ends the sticky bookmarks row, pinned at its right end;
  - the book graphics get their vertical version, bound on the left edge (6.3.2).

#### 6.3.14 Drawn tooltip
- `components/ui/TooltipLayer.jsx`, mounted once in `App.jsx`: one `position: fixed` element `.pg-tooltip` (portal to `document.body`, `aria-hidden`, `pointer-events: none`) and delegated listeners on `document` for any `[data-tip]` target. The label stays the target's `aria-label`.
- Shown on mouse hover (`pointerType` not `touch`, under `(hover: hover)`) and on keyboard focus (`:focus-visible`), as decided. Hidden on `pointerdown`, scroll, resize, `Escape`, route change and when the target leaves the DOM. Guarded when `matchMedia` is missing (jsdom).
- **Touch: a long press** (owner decision; `LONG_PRESS_MS = 500`) on any `[data-tip]` target (bookmarks, home tab, icon-only buttons) shows the same tooltip. A touch `pointerdown` starts the timer; a finger move of more than about 10 px, `pointercancel`, an early lift or a scroll cancel it. Once shown, it hides about 1.5 s after the finger lifts (`TOUCH_HIDE_MS = 1500`), or at once on scroll; a plain tap never shows it.
- The click that follows a long press is **swallowed**: a capture-phase `click` listener on `document` (it runs before React's root listeners) calls `preventDefault()` and `stopImmediatePropagation()` once, so a long press never opens the tab or runs the button; the flag is cleared on the next `pointerdown`. The `contextmenu` of a long press on a `[data-tip]` target is prevented, and under `(hover: none)` `[data-tip]` gets `-webkit-touch-callout: none; user-select: none`, so no system menu or text selection opens.
- Placement: above the target; below it when the room above is too small or the navbar is in the way (`--navbar-h`); centred, then clamped inside the screen (8 px margin); the arrow follows the target's centre. Coordinates are set through `style.setProperty` (CSSOM, allowed by the CSP).
- Look: dark brown, gold border and arrow, Cinzel, small text, `max-width: min(260px, 90vw)`.
- **A hidden tooltip takes no layout space**: `hidden` attribute (`display: none`), never only `visibility` or `opacity` (in the concept, an absolute hidden tip widened the mobile page).
- `title` becomes `data-tip` on: bookmarks and the home tab (their badges get no `title`: new `BonusBadgeList` prop `withTitle`, default `true`, `false` inside a bookmark); navbar socials, sign-in and user buttons; `EnvBadge` info icon; footer server badge; Card page arrows (`page-back`, `page-forward`); `CardButtons` icon-only (i) and locked label (`lockedReason`); `TipNote` hide and link; `Map` zoom and centre; `RegistryLockInfo`; `MatchLogCard` filters and (i). Badges and cut text elsewhere (stat badges, map nodes, clock, match-log row titles) keep `title`.

#### 6.3.15 No heading over the cards
- Every right page's heading over a card list stays in the markup with the class `book-cards-heading`, hidden by CSS (`display: none`), with a one-line comment: its place is reserved for the future multiplayer messages.
- Today this is `UserMatchesList`'s `.matches-list-title` (player page); step 14 adds the Home's `home.stories`.
- `OptionPicker`'s `.selection-header` is not a heading (its title is commented out since v0.38.3): it gets no `book-cards-heading`, and the trait budget badges (`trait-budget`) stay visible above the trait list (owner decision).

#### 6.3.16 Card special components (rule for steps 13–16)
None of these react-game Card elements may be removed or lost by steps 13–16; their tests and test ids stay:
- **page variant**: title bar with back / forward arrows (`page-back`, `page-forward`); image with the `BonusBadgeList` overlay (`positionBonusBadge` overlay / desc / extra); description with `TipNote` (tip and credit notes, hide button, `tip-note`); `extraContent` area (`book-page-extra`); the page `CardButtons` bar (`book-page-buttons`); `CardCreditsBar` (type label, Tip, story credit, image credit, each opening its note: `credit-tip|story|image`); the credits "view original" link (`credits-view-btn`);
- **little / grid variant**: title with `BonusBadgeList` (`statistics` / `titleStatistics`, little version); `gc-type-badge` (on hover); image overlay (`childrenIntoImage`, full statistics); `CardButtons`: (i) preview, select with its selected state, action with the in-progress spinner, secondary `actionsList` buttons (grid2 / grid3), locked label with lock icon and `lockInfo` (test ids `<testId>-info|-select|-action`, secondary `testId`);
- **page card picture sizing** (owner decision, today's react-game rules): the picture is always a fixed share of the card and never shrinks to make room for the text. On desktop `.book-page-img` / `.book-page-img-wrapper` keep `max-height: 45%` and `flex-shrink: 0`, and the description below (`.book-page-desc`) scrolls; on mobile the picture keeps `height: 33svh` (`mobile.css`). The new stage, shell, taller book and graphics must not change these rules;
- **text and badge sizes** (owner decision): they stay as in today's `main.css` / `mobile.css`, never restyled by the book layout. Desktop: card title `clamp(0.65rem, 1.5vw, 0.9rem)`, card footer buttons and lock label `1rem`, type badge `0.55rem` (`0.7rem` in the title), page title `2rem`, page description `1.5rem` / line-height `1.25`, `extraContent` `1.25rem`, stat badges `0.8rem`, little `BonusBadgeList` `0.725rem`, tip note `1.2rem`, credits bar `0.7rem`, bookmarks `1.5rem`. Mobile: little card titles `1rem`, footer buttons `1.125rem`, `extraContent` `1rem`, stat badges `0.72rem`.

This step touches `Card.jsx`, `CardButtons.jsx`, `TipNote.jsx` and `BonusBadgeList.jsx` only for the tooltip (6.3.14) and the chapter links (6.3.5).

### 6.4 Robot Framework

No impact: every suite under `code/tests/robot` is API-only (`RequestsLibrary`, no browser library), and no endpoint changes.

### 6.5 Configuration and docs
- `.env.example`: no new key. Only comments change: `VITE_TURNSTILE_APPEARANCE_GUEST` and `VITE_RESUME_WITHOUT_MODAL` now say "player page". The key names stay, so `.env`, `.env.test`, `.env.alpha` and `deploy_website.sh`'s key check are untouched. The `VITE_ANIM_*` keys reach the alpha website workflow in step 14, not here.
- Through `/doc-update`, when developed:
  - `code/frontend/react-game/README.md` (routes, modals, legal books);
  - `wiki/Security.md` (the `PolicyBook.jsx` file name).

## 7. Tests

Unit tests (Vitest, `npm run test:coverage` in `code/frontend/react-game`): **coverage > 96 % of new and changed code**. Tests guard what jsdom lacks: `ResizeObserver`, `window.scrollTo` (stub it), `Element.scrollIntoView`, `matchMedia`.

| Area | Test files |
|---|---|
| Book | `Book.test.jsx`: home tab (`fa-home`) last of the right row (handler versus `navigate('/')`, absent with `homeTab={false}` or outside a router, shown with `showBookmarks={false}`); `stageClass`/`wrapperClass`; `.book-shell` between the stage and `.book-wrapper`; `book-stage--no-tabs` with no tab at all (Home, also with a chapter open), absent when a tab or the home tab shows; `data-page-key`/`data-direction`; ornaments `aria-hidden`; with a chapter, the chapter's pages show, the own pages stay mounted (covered), the bookmarks are hidden but the home tab stays; `BookBookmarks.test.jsx`: the two `title` assertions become `data-tip`, badges without `title` |
| Tooltip | new `TooltipLayer.test.jsx`: mouse hover shows, a touch tap never; long press (fake timers): shown at 500 ms and not before, cancelled by a move, an early lift or a scroll, hidden 1.5 s after the lift or at once on scroll, the next click swallowed once (the bookmark's handler not called, the following tap works), `contextmenu` prevented on `[data-tip]` only; keyboard focus shows, above / below the navbar / clamped at the edges (mocked rects), hidden with the `hidden` attribute, hides on scroll, `Escape`, `pointerdown`, no `matchMedia`; `BonusBadgeList` `withTitle` |
| Headings | `UserMatchesList` (heading in the markup with `book-cards-heading`); `OptionPicker` (trait budget still visible) |
| Policy chapter | `PolicyBook.test.jsx` → `PolicyChapter.test.jsx`; `Step40Books`, `Step40AlphaUx` (import path); `Step42AlphaLaunch` (deep link on any route); new: the chapter closes on a route change but not on first load; scroll stored and restored; home tab with a chapter open outside a match → `/`, chapter closed |
| Player page | the five `GuestUserModal*.test.jsx` → `PlayerBook*`/`PlayerPage` tests; `GuestUserContext*.test.jsx` (removed API); new `usePlayerPage` test (preloaded list, deletion → `reloadHome`); `UserAccountPanelLogoutMenu`, `UserMatchesList` |
| Story page | `StartBookModal*.test.jsx` → `StartBook*` plus a new `StoryPage` test (state vs direct load, failing detail → `ErrorCard`, Start saves the loadout); `GameBook.test.jsx` and `GameBookLocationEvents.test.jsx` mock path |
| Home | `HomePage`, `HomeResumeDirect`, `TutorialButton`, `PagesCoverage`: navigate to `/story/…` and `/player`; interim chapter host |
| Start match | `StartMatchPage` (redirect to `/story/:storyId`), `StartMatchFlowCoverage` (`created` replaces the entry), `StartMatchLoginCard`, `StartMatchRateLimited` |
| Game | `GamePage`, `GamePageStale`: loading and fatal error inside a Book, transient error as right page, direct load without state (running match resumed; none, no session or failed list → `/story/:storyId`); `GameBook`, `GameBookCoverage`: home-tab handler registered and removed at game end; with a policy chapter open, the home tab and the brand close it and show the close card (never `navigate('/')`), close card scrolled into view last; window scroll instead of `.book-overlay`; `EndGameBook*` |
| Cards | `ErrorCard.test.jsx` (no overlay, no `maxWidth`); `CloseGameCard.test.jsx` (page mode only); `CardDetailModal.test.jsx` deleted; `Card`, `CardVariants`, `CardButtons`, `CardCreditsBar`, `BonusBadgeList` kept with every test id (6.3.16), `title` checks moved to `data-tip` |
| Navbar and footer | `Navbar`, `NavbarGoogle`, `NavbarRateLimit`: no close button and no "Exit to Home" on any route, `data-tip` instead of `title`, brand with and without a handler, `/player` navigation, `--navbar-h` with and without `ResizeObserver`; `Footer`, `FooterEnvBadge`, `FooterStatus`: two rows, select / single-server badge / offline / probing, servers tooltip, client version, info icon without a label, the four links |
| Routes and context | new `routes.test.jsx` (`/player`, `/story/:id`, `*` redirect keeps `?policy=`); new `HomeButtonContext.test.jsx`; `MobileView.test.js` (`behavior`, no `.book-overlay`) |

Robot: no new or changed suite (6.4). Manual check before the owner's review: desktop and phone, on every route:
- sticky navbar, footer below the fold, home tab and close card in a match (also from a policy chapter), book graphics;
- the book close to the navbar (only the bookmarks' height over it, almost nothing on the Home), at least 520 px tall; the page card picture as today (at most 45 % of the card on desktop, 33svh on the phone), the description scrolling or flowing below it; card texts, badges and bookmarks as big as today (6.3.16);
- drawn tooltips with mouse, keyboard and a long press on touch (no tab opened, no system menu), none on a tap, no page widening on the phone;
- the chapter from the footer, from a card credit in a match and from `?policy=`;
- the Back button along Home → story → start-match → game (Back from the game lands on the story), and `/player` → Back in a match;
- `bump-version.sh --check` still finds the footer version.

## 8. Doubts

No open doubts.

# Version Control
- **Document Version**: 1.13.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Book pages without pop-ups, home tab, tooltips, taller book decided | November 24, 2026 |

- **Last Updated**: November 24, 2026 (v1.13.0)


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
