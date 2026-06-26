# Paths Games - Frontend React - Game

# Version Control
- Starting from 0.18.0 version

## Tech Stack (v0.18.0) 
- **React** 18.3.1 + **Vite** 5.3.1
- **React Router** 6.23.1
- **Axios** 1.7.2
- **Tailwind CSS** 3.4.4 (primary utility layer)
- **Bootstrap 5** via CDN only — modals + grid
- **Font Awesome 5** via CDN
- **Google Fonts**: Cinzel Decorative, Cinzel, Crimson Text
- Dev port: **5174** (react-admin runs on 5173)
- API proxy: `/api` → `http://localhost:8042`

## Commands
```bash
npm install
npm run dev      # http://localhost:5174
npm run build
npm run preview
```

## Environment Variables
```bash
cp .env.example .env
# Edit VITE_GTM_ID and VITE_API_URL
```
| Variable | Default | Description |
|---|---|---|
| `VITE_GTM_ID` | `GTM-T52SH6JQ` | Google Tag Manager ID |
| `VITE_API_URL` | (empty, uses vite proxy) | Backend base URL |
| `VITE_MATCH_START_DELAY` | `20` | Seconds to wait before/after calling `POST /api/matches` on the StartMatchPage |

## Project Structure
```
src/
├── i18n/           # Language context (IT default, EN) + en.json / it.json
├── api/            # Axios client targeting the configured backend
│   ├── client.js   # Base Axios instance + fetchJson() helper
│   ├── stories.js  # getStories(), getStory(id)
│   ├── game.js     # getLocations(storyId), getActions(locationId)
│   ├── auth.js     # createGuestSession(), resumeGuestSession() — withCredentials:true
│   └── matches.js  # createMatch(), listMatches(), getMatchInfo()
├── consent/        # Cookie-consent layer (vanilla-cookieconsent v3.1.0 + GTM)
│   ├── gtm.js                # loadGtm(gtmId) — loads GTM container
│   ├── cookieConsent.js      # initCookieConsent(lang), openCookiePreferences(), setConsentLanguage(lang)
│   └── cookieconsent-theme.css  # Maps --cc-* tokens to site design variables (dark bg + gold)
├── context/
│   └── GuestUserContext.jsx  # GuestUserProvider + useGuestUser() hook; identity in React state; stores accessToken for match API calls
├── data/           # images.json (Unsplash credits) — static UI asset registry
├── styles/         # variables.css (CSS tokens) + main.css (global + component styles)
├── utils/
│   └── bonusStats.js   # STAT_FIELDS map, STAT_CATEGORY map, STAT_CATEGORY_ORDER, getNonZeroStats(entity, entityType), aggregateBonusTotals(pairs)
├── components/
│   ├── layout/     # Navbar, Footer, GameCard, GameCardCreditsBar (credits row), GameCardInfoButton (legacy, no longer used by GameCard)
│   ├── modals/     # PrivacyModal, TermsModal, CookiesModal (GDPR 6-section), CopyrightModal, GuestUserModal
│   ├── common/     # BonusBadgeList (shared pill-badge row component)
│   ├── book/       # BookWrapper, BookPageLeft, BookPageRight, BookPageLeftContent
│   └── CookieConsentManager.jsx  # Headless component; mounts consent banner once, syncs language; placed in App.jsx
├── features/
│   ├── home/       # StoryCard (Netflix card), StoryCatalog (rows by category)
│   ├── startBook/  # StartBookModal, StartBookMobile, ConfigView, SelectionView, ConfigCard, loadoutCards.js (shared loadout helper)
│   └── game/       # GameBook, LocationCard, PlayerStats, NeighborRow, ActionsRow, CardDetailModal
└── pages/
    ├── HomePage.jsx        # /
    ├── StartMatchPage.jsx  # /start-match/:storyId
    └── GamePage.jsx        # /play/:storyId
```

## Pages & Features
1. **Home** (`/`) — Netflix-style story catalog grouped by category. Click story → book modal.
2. **Start Book Modal** — book UI (desktop) / `StartBookMobile` vertical list (mobile, extracted component). Configure character, class, trait, difficulty. Config grid uses 2-column big cards (`card-big-list`). The left page always renders `<BookPageContent>` (chapter title + image + scrollable description + optional stats panel + footer). Card preview via magnifier button (`fa-search-plus`) opens a `CardPreviewOverlay` (absolute overlay, solid book-page background) on top of the left page, also using `<BookPageContent>`. The `description` field in `BookPageContent` is rendered via `dangerouslySetInnerHTML`, so HTML markup in i18n strings (e.g. `<br />` line breaks in `guestDesc`) is interpreted rather than escaped. When a preview is active, `BookPageContent` receives `entity` + `entityType` props and renders a **bonus-stats panel** (`.book-page-stats`) **inline inside the description area** (`.book-page-desc`), after the gold `border-top` separator. The panel is rendered by the shared `BonusBadgeList` component (props: `items: [{ key, label, value }]`, optional `className`). Each pill (`<span class="badge bonus-badge">`) shows `.bonus-badge__label` + `.bonus-badge__value` at `1.3rem` to match description text; the value uses gold text-shadow with no background; zero/null/undefined values are hidden. Stat fields per type are defined in `src/utils/bonusStats.js` (`STAT_FIELDS` map). `title` and `description` fall back to `entity.name` / `entity.description` when no card is attached. Locked: game type (Single) + login (Guest). Accept terms → Start Game. Below the footer, `ConfigView` renders `<BonusBadgeList className="config-total-bonus" ...>` with one pill per stat category, each showing the sum of contributions from all four selected entities. Eight categories are defined: `life`, `energy`, `sad`, `dexterity`, `intelligence`, `constitution`, `weight`, `exp`. Only categories with a non-zero total are shown. Category totals are computed by `aggregateBonusTotals(pairs)` in `bonusStats.js` using the `STAT_CATEGORY` bucket map. The seven trait stat-delta fields (`life`, `energy`, `sad`, `dexterity`, `intelligence`, `constitution`, `weight`) are included in the map and contribute to category totals (v0.19.6); fields intentionally excluded from totals — e.g. `costPositive`/`costNegative` on traits, `minCharacter`/`maxCharacter` on difficulty — remain outside the map. Labels resolve via `book.stats.totals.<category>` i18n keys (English: Life / Energy / Sadness / Dexterity / Intelligence / Constitution / Weight / XP; Italian: Vita / Energia / Tristezza / Destrezza / Intelligenza / Costituzione / Peso / EXP).
3. **Start Match** (`/start-match/:storyId`) — full-screen book page between configuration and gameplay. Receives `{ story, config }` via React Router `state` from the Start Book Modal's "Start Game" button. Left page: story card. Right page: the six selected loadout cards (class, character, trait, difficulty, game-type, login) from `src/features/startBook/loadoutCards.js` plus the aggregated bonus-totals list. Flow: shows a countdown ("Starting match…"), waits `VITE_MATCH_START_DELAY` seconds, then calls `POST /api/matches` with the full loadout payload. On success shows "Match created, the story book is loading…" and navigates to `GamePage` after another delay. On failure shows an error with **Retry** and **Back-to-home** actions. The JWT bearer token for the API call is read from `GuestUserContext.accessToken`.
4. **Game** (`/play/:storyId`) — book layout. Left: current location card. Right: player stats (Life/Energy/Sadness/XP/Food/Magic/Coins/Weight) + neighbor locations row + actions row. Click card → detail modal with move/execute button. Navbar + Footer always present.
4. **i18n** — IT (default) / EN via language switcher in Navbar. All labels in `src/i18n/en.json` + `it.json`. The `book.stats.*` namespace holds labels for every bonus/stat field shown in the preview panel (`lifeMax`, `energyMax`, `sadMax`, `dexterityStart`/`Base`, `intelligenceStart`/`Base`, `constitutionStart`/`Base`, `weightMax`, `costPositive`, `costNegative`, `expCost`, `maxWeight`, `minCharacter`, `maxCharacter`, `costHelpComa`, `costMaxCharacteristics`, `numberMaxFreeAction`, and the seven trait stat-delta keys `life`, `energy`, `sad`, `dexterity`, `intelligence`, `constitution`, `weight` added v0.19.6) plus `book.stats.title` ("Bonuses"). The sub-object `book.stats.totals` holds short labels for the eight ConfigView category pills: `life`, `energy`, `sad`, `dexterity`, `intelligence`, `constitution`, `weight`, `exp`. The `card.*` namespace holds labels used by `GameCard`: `card.info` ("Info" / "Info") for the circular info button and `card.viewOriginal` ("View original" / "Vedi originale") for the detail modal link. The `modals.guestUser.*` namespace (added v0.19.8) holds `title`, `anonymous`, `uuidLabel`, and `body` (HTML) for the `GuestUserModal`. The `startMatch.*` namespace (added v0.19.10) holds labels for the StartMatchPage countdown and status messages; also added missing Italian `book.singleDesc` / `book.guestDesc` keys.
5. **API** — All data comes from the configured backend server (selectable in the Footer). There is no offline/mock fallback; a request error surfaces to the caller.
6. **Legal modals** — Privacy, Terms, Cookies triggered by Footer links. Copyright (i) on every big card.
7. **Guest identity** — `GuestUserProvider` (v0.19.8) wraps the entire app and manages guest session state. Identity lives in React state only — no frontend cookie is written. On mount it tries `POST /api/auth/guest/resume` first (the browser sends the backend HttpOnly cookie `pathsgames.guestcookie` automatically via `withCredentials: true`); on 401/error it falls back to `POST /api/auth/guest` to mint a new guest. The Navbar user-icon button displays the cached `username` and opens `GuestUserModal` (`#guestUserModal`) via Bootstrap `data-bs-toggle`. `GuestUserModal` renders a `BookPageContent` card showing the username as title and the session UUID under a divider. Backend HttpOnly session cookies (`pathsgames.guestcookie` 30 days, `pathsgames.refreshToken` 7 days) are set by the server and are consent-exempt.
8. **Cookie consent** (v0.20.3) — Self-hosted [vanilla-cookieconsent](https://github.com/orestbida/cookieconsent) v3.1.0 (MIT) gated to **Google Consent Mode v2**. Consent Mode defaults are all `denied`; the GTM container loads on every visit but Google tags write no cookies until the user accepts the `analytics` category. Categories: `necessary` (read-only) + `analytics` (off by default), bilingual en/it. Consent choice is stored in `pathsgames.cookiesConsent` (first-party, 6-month, revision-based re-prompt). The banner is themed via `src/consent/cookieconsent-theme.css` (dark `--bg-card` background + `--color-gold` text). The full GDPR cookie policy (6 sections: strictly-necessary, analytics, legal basis, managing preferences, third parties, data-subject rights) is rendered by `CookiesModal` in both languages. Modules: `src/consent/gtm.js` (loads GTM from `VITE_GTM_ID`), `src/consent/cookieConsent.js` (`initCookieConsent(lang)`, `openCookiePreferences()`, `setConsentLanguage(lang)`), `src/consent/cookieconsent-theme.css`, `src/components/CookieConsentManager.jsx` (headless; boots consent once, syncs on lang switch; mounted in `App.jsx`).

## Card System

All card size variants enforce `aspect-ratio: 2/3` (updated from `1/1.4`):

| Class | Width | Usage |
|-------|-------|-------|
| `.pg-card--small` | 100px | — |
| `.pg-card--medium` | 150px | Game rows (neighbors, actions) |
| `.pg-card--home` | 225px | Story catalog |
| `.pg-card--grid` | flex:1 | Config grid |
| `.pg-card--large` | 100% | Left page big card |

Config view uses `card-big-list` (2-column big cards) instead of the previous `selection-list` 3-column grid.

`GameCard` accepts one notable prop:
- `onPreview` — when supplied, a magnifier button (`fas fa-search-plus`) is shown in the title bar and triggers a `CardPreviewOverlay` on the left page. When `onPreview` is not set, the magnifier button is not rendered at all. The `previewLayout` prop has been removed.

New CSS in `main.css`: `.card-preview-overlay` (now `position: absolute; inset: 0` solid book-page overlay), `.card-preview-close`, `.card-preview-info`, `.card-magnify-btn`, `@keyframes fadeIn`. Book page layout classes: `.book-page-content` (card-style container with border + box-shadow), `.book-page-loading`, `.book-page-title` (golden title bar: dark brown gradient background, gold text, `border-radius: 8px 8px 0 0`), `.book-page-image-wrap` (relative container for image + absolute stats overlay), `.book-page-img` (full-width, `border-radius: 0`), `.book-page-desc` (parchment-light background, dark gold text, rounded bottom corners, gold `border-top` separator), `.book-page-footer`, `.book-page-copyright`, `.book-page-credit-btn` (absolute, bottom-right of the content area, 32px size). Shared badge classes (replaces all previous per-context badge classes): `.bonus-badge-list` (flex-wrap row), `.bonus-badge` (pill — no background, large font `1.3rem` matching desc text, inline inside description), `.bonus-badge__label`, `.bonus-badge__value` (gold text-shadow, no background chip). Modifier: `.book-page-stats` (inline flow within `.book-page-desc`, not absolute-positioned). Modifier: `.config-total-bonus` (centered flex, `margin-top: 10px`). Removed: `.book-page-stats__badge`, `.book-page-stats__value`, `.config-total-bonus__badge`, `.config-total-bonus__value`, old two-column grid classes, `.story-card-full*` rules. `gc-actions` uses `align-items: stretch` for equal-height children; `gc-footer__btn` is `display: flex` + `gap: 4px`; `gc-footer__btn-label` truncates text with ellipsis (`overflow: hidden; white-space: nowrap; text-overflow: ellipsis`); `gc-footer__btn--icon` (`flex: 0 0 auto`) is the icon-only / fixed-width button modifier.

`GameCard` uses a unified `gc-*` layout shared across all variants (`big`, `little+image`, `little-no-image`). Structure: golden title bar (`gc-title` — dark brown gradient background, gold text, flex row) with magnifier button at right (`gc-title__btn`, only rendered when `onPreview` is set); full-width image (`gc-img`) or placeholder (`gc-placeholder`, `flex: 1`); dark footer (`gc-footer` — dark brown gradient, **not** parchment, **no** bottom border-radius) containing a `gc-actions` div (`align-items: stretch` so both children fill the same height) that holds two side-by-side elements: a circular `(i)` info button (`gc-actions__info`, 26px, label via `t('card.info')`) on the left and the pill-shaped action/select button (`gc-footer__btn` with `flex: 1`) on the right. Below `gc-footer` sits the optional `GameCardCreditsBar` component (see below), which carries the bottom border-radius. Button text is wrapped in `gc-footer__btn-label` (overflow hidden, white-space nowrap, text-overflow ellipsis) to truncate gracefully in narrow variants. The `gc-footer__btn--icon` modifier (`flex: 0 0 auto`) is used for icon-only or fixed-width button variants. Coming-soon cards show `gc-footer__coming-soon` label. `gc-footer__btn--selected` modifier applies to selected state. `GameCard` uses `useTranslation` / `t()` for `card.info` (info button aria-label and visible label) and `card.viewOriginal` (detail modal link). Legacy wrapper classes `pg-card`, `card-big`, `config-card-selected`, `config-card-disabled` are still applied on the outer element; the old `card-big` / `config-card-cover` inner layout has been replaced by `gc-*`.

`GameCardCreditsBar` (`components/layout/GameCardCreditsBar.jsx`) — slim footer row rendered below `gc-footer`, styled identically to `gc-title` but at `0.55rem` font size. Displays "Credits: story by [author], image by [copyright]" with optional links. Author is sourced from `story.author` / `story.card.linkCopyright`; image credit from `card.copyrightText` / `card.linkCopyright`. Returns `null` when neither field is available (no empty bar). Previously this data was surfaced via the `hideCredits` prop and `GameCardInfoButton`; both have been removed — `GameCardCreditsBar` is the sole credits surface on `GameCard`. CSS classes: `.gc-credits` (flex-wrap row, dark brown gradient, `border-top: 1px solid gold-dark`, `border-radius: 0 0 8px 8px`), `.gc-credits__label` (semi-transparent gold, `opacity: 0.75`), `.gc-credits__link` (gold underline, hover brightens).

Cards support `style_main` (extra classes on wrapper), `style_detail` (extra classes on the image at any size), and three new size-specific image style fields: `style_image_little`, `style_image_medium`, `style_image_large` (extra classes applied to the `<img>` element when the card is rendered at the corresponding variant). The `GameCard` component selects the right size field based on the `variant` prop (`little` / `medium` / `big`) and joins it with `styleDetail` on the image `className`.

## Config Options (per story)

Each story in `stories.json` carries its own option arrays:
- **characters**: Young Woman, Young Man, Adult Woman, Adult Man
- **classes**: Human, Elf, Dwarf, Hobbit
- **traits**: Happy, Strong, Smart, Fast
- **difficulties**: Easy, Normal, Hard, Legendary

Locked cards use static images from `images.json`: `id="person"` (Single Player) and `id="gems"` (Guest).

## Credits (i) Modals

Every card with an image shows an `(i)` button (top-left, hover-only on desktop, always visible on mobile). Opens a Bootstrap `modal-lg` with credit cards in order: Story image → Config image → Text (disabled) → Sound (disabled).

## Stat Labels

In-fiction names used in the UI (v0.19.5). JSON keys are unchanged so the API contract is unaffected; only the player-facing labels were renamed and every "Max" qualifier was dropped (except the lower-bound `minCharacter`).

| key                                                   | it (before)    | it (now)     | en (before) | en (now)  |
|-------------------------------------------------------|----------------|--------------|-------------|-----------|
| `book.stats.lifeMax` / `book.stats.totals.life`       | Vita Max / Vita | Vita         | Life        | Life      |
| `book.stats.energyMax` / `book.stats.totals.energy`   | Energia Max / Energia | Energia | Energy      | Energy    |
| `book.stats.sadMax` / `book.stats.totals.sad` / `game.stats.sadness` | Tristezza Max / Tristezza | **Felicità**  | Sadness     | **Happiness** |
| `book.stats.weightMax` / `book.stats.totals.weight` / `game.stats.weight` | Peso Max / Peso | **Trasporto** | Weight      | **Carry** |
| `book.stats.constitutionStart` / `constitutionBase` / `book.stats.totals.constitution` | Costituzione | **Fisico** | Constitution | **Physique** |
| `book.stats.maxCharacter`                             | Giocatori Max  | Giocatori    | Max Players | Players   |
| `book.stats.costMaxCharacteristics`                   | Costo Carat. Max | Costo Carat. | Max Char. Cost | Char. Cost |

## Image Credits
All Unsplash images and SVG icons documented in [`src/data/images.json`](src/data/images.json). SVG icons from [game-icons.net](https://game-icons.net) (CC BY 3.0).

---

- **Document Version**: 0.20.3
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.18.0 | React game frontend initial implementation | May 04, 2026 |
    | 0.18.0 | Per-story options, card system, credits modals, locked card images, mobile fixes | May 05, 2026 |
    | 0.19.2 | StartBookMobile extracted component; card-big-list config grid; CardPreviewOverlay with magnifier; aspect-ratio unified to 2/3 | May 12, 2026 |
    | 0.19.3 | BookPageLeftContent dedicated component; book-page-* CSS classes; removed story-card-full* rules; CardPreviewOverlay refactored to solid absolute overlay | May 12, 2026 |
    | 0.19.3 | GameCard picks styleImageLittle/Medium/Large per variant alongside styleDetail | May 14, 2026 |
    | 0.19.3 | StartBook desktop: lens on selectable cards opens preview + selection list together; back/close on either pane dismisses both | May 14, 2026 |
    | 0.19.3 | BookPageContent bonus-stats panel: entity+entityType props, STAT_FIELDS map, book-page-stats CSS, book.stats.* i18n keys | May 14, 2026 |
    | 0.19.3 | bonusStats.js util (STAT_FIELDS, getNonZeroStats, sumBonusValues); stats panel redesigned as pill badges above image; zero-value stats hidden; ConfigView total-bonus aggregate pill | May 14, 2026 |
    | 0.19.3 | BonusBadgeList shared component extracted to components/common/; book-page-stats repositioned absolute top-right over image (book-page-image-wrap); unified badge CSS (.bonus-badge-list, .bonus-badge, .bonus-badge__label, .bonus-badge__value); removed old per-context badge classes | May 14, 2026 |
    | 0.19.3 | ConfigView total bonus changed from single grand-total pill to one pill per stat category (life/energy/sad/dexterity/intelligence/constitution/weight/exp); sumBonusValues removed; STAT_CATEGORY map + STAT_CATEGORY_ORDER + aggregateBonusTotals added to bonusStats.js; book.stats.totals i18n sub-object added | May 14, 2026 |
    | 0.19.3 | BookPageContent restyled as card: border+shadow container, golden title bar (dark brown bg + gold text), image full-width no border-radius, description on parchment-light background with dark gold text, (i) credit button repositioned to bottom-left | May 18, 2026 |
    | 0.19.3 | BookPageContent badge/desc/button redesign: bonus badges inline inside description (not absolute-positioned), large font (1.3rem matching desc text), badge value gold text-shadow (no background); description has gold border-top separator; (i) info button moved to bottom-right, size 32px | May 18, 2026 |
    | 0.19.3 | GameCard full redesign: unified gc-* layout (gc-title, gc-title__text, gc-title__btn, gc-img, gc-placeholder, gc-footer, gc-footer__btn, gc-footer__btn--selected, gc-footer__coming-soon, gc-footer__label) replaces card-big/config-card-cover inner layout; golden title bar with magnifier, full-width image, parchment-light footer with action button only | May 18, 2026 |
    | 0.19.3 | GameCard footer redesign: gc-footer switched to dark brown gradient; new gc-actions div holds gc-actions__info (circular (i) 26px) + gc-footer__btn (flex:1 pill) side by side; previewLayout prop removed; magnifier in title bar only rendered when onPreview is set | May 18, 2026 |
    | 0.19.3 | GameCard i18n + button layout: useTranslation added; card.info + card.viewOriginal i18n keys; gc-footer__btn-label span for text truncation (ellipsis); gc-actions align-items:stretch for equal height; gc-footer__btn--icon modifier for fixed-width variants | May 18, 2026 |
    | 0.19.3 | CSS layout fixes: .config-cards-area padding set to 10px 14px 16px and overflow-x:hidden added to prevent shadow clipping; .selection-list gains grid-auto-rows:auto, align-items:start, isolation:isolate to fix card row overlap on short viewports | May 18, 2026 |
    | 0.19.3 | GameCardCreditsBar new component: slim credits footer row (gc-credits / gc-credits__label / gc-credits__link) showing story author + image copyright; replaces GameCardInfoButton + hideCredits prop on GameCard; gc-footer loses bottom border-radius (moved to gc-credits) | May 18, 2026 |
    | 0.19.3 | BookPageContent description rendered via dangerouslySetInnerHTML: HTML tags in i18n strings (e.g. `<br />` in guestDesc) are now interpreted rather than escaped | May 18, 2026 |
    | 0.19.6 | bonusStats.js STAT_FIELDS.trait extended with seven stat-delta keys (`life`, `energy`, `sad`, `dexterity`, `intelligence`, `constitution`, `weight`); non-zero values rendered automatically by existing `BonusBadgeList`; all seven keys contribute to ConfigView category totals via STAT_CATEGORY map | May 19, 2026 |
    | 0.19.7 | bonusStats.js STAT_FIELDS.difficulty extended with the same seven stat-delta keys (`life`, `energy`, `sad`, `dexterity`, `intelligence`, `constitution`, `weight`); BonusBadgeList renders the new bonus pills inside the BookPage difficulty preview; values flow into ConfigView category totals via existing STAT_CATEGORY mapping (no i18n change — labels use the existing `book.stats.totals.<key>` keys) | May 19, 2026 |
    | 0.19.8 | Guest-user flow rewired: new `GuestUserProvider` (`src/context/GuestUserContext.jsx`) owns identity, persists a non-HttpOnly `paths.games.user` cookie ({userUuid, username}) with 30-day Max-Age, auto-calls `POST /api/auth/guest` on first visit and `POST /api/auth/guest/resume` when the cookie is present (`withCredentials:true` so the backend `pathsgames.guestcookie` HttpOnly cookie travels along). Mock-server mode synthesizes an offline guest locally. New `api/auth.js` wraps both endpoints. Navbar user-icon now shows the cached `username` and opens the new `GuestUserModal` (Bootstrap modal `#guestUserModal`) instead of the legacy toast; the modal renders a `BookPageContent` card with the username as title and `modals.guestUser.body` (HTML) as description plus the session UUID under a divider. New i18n keys `modals.guestUser.title/anonymous/uuidLabel/body` (EN+IT). New tests: `src/context/GuestUserContext.test.jsx` (cookie restore + mock-server synthesis); `src/test/Navbar.test.jsx` updated to mock the new context and assert the modal trigger. Cookie-consent banner intentionally not touched — handled externally by Cookies-Yes | May 19, 2026 |
    | 0.19.6 | Code refactoring: all scattered test files (`echoApi.test.js`, `NeighborRow.test.jsx`, `ActionsRow.test.jsx`, `bonusStats.test.js`, `GuestUserContext.test.jsx`) moved from their source-adjacent locations (`api/`, `features/game/`, `utils/`, `context/`) into the central `src/test/` folder; relative imports updated accordingly | May 20, 2026 |
    | 0.19.10 | New `StartMatchPage` at `/start-match/:storyId`: full-screen book page with countdown, loadout summary, and `POST /api/matches` call before navigating to GamePage. New `src/api/matches.js` (createMatch/listMatches/getMatchInfo). New `src/features/startBook/loadoutCards.js` shared helper. `GuestUserContext` now stores `accessToken`. New `VITE_MATCH_START_DELAY` env var (default 20s). New `startMatch.*` i18n keys; Italian `book.singleDesc`/`book.guestDesc` added. 62 tests pass. | May 20, 2026 |
    | 0.20.3 | Cookie consent brought in-project: `src/consent/` layer (gtm.js, cookieConsent.js, cookieconsent-theme.css) + CookieConsentManager.jsx; vanilla-cookieconsent v3.1.0 + Google Consent Mode v2; `pathsgames.cookiesConsent` cookie; GDPR CookiesModal (6 sections, en/it); GuestUserContext refactored to React state only (no frontend cookie). | May 28, 2026 |
- **Last Updated**: May 28, 2026
- **Status**: Active development

---

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
