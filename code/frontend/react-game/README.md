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

## Project Structure
```
src/
├── i18n/           # Language context (IT default, EN) + en.json / it.json
├── api/            # Axios client with automatic mock fallback
├── mock/           # stories.json, gameData.json, images.json (Unsplash credits)
├── styles/         # variables.css (CSS tokens) + main.css (global + component styles)
├── utils/
│   └── bonusStats.js   # STAT_FIELDS map, STAT_CATEGORY map, STAT_CATEGORY_ORDER, getNonZeroStats(entity, entityType), aggregateBonusTotals(pairs)
├── components/
│   ├── layout/     # Navbar (lang switcher + user btn), Footer (social + legal links)
│   ├── modals/     # PrivacyModal, TermsModal, CookiesModal, CopyrightModal
│   ├── common/     # BonusBadgeList (shared pill-badge row component)
│   └── book/       # BookWrapper, BookPageLeft, BookPageRight, BookPageLeftContent
├── features/
│   ├── home/       # StoryCard (Netflix card), StoryCatalog (rows by category)
│   ├── startBook/  # StartBookModal, StartBookMobile, ConfigView, SelectionView, ConfigCard
│   └── game/       # GameBook, LocationCard, PlayerStats, NeighborRow, ActionsRow, CardDetailModal
└── pages/
    ├── HomePage.jsx    # /
    └── GamePage.jsx    # /play/:storyId
```

## Pages & Features
1. **Home** (`/`) — Netflix-style story catalog grouped by category. Click story → book modal.
2. **Start Book Modal** — book UI (desktop) / `StartBookMobile` vertical list (mobile, extracted component). Configure character, class, trait, difficulty. Config grid uses 2-column big cards (`card-big-list`). The left page always renders `<BookPageContent>` (chapter title + image + scrollable description + optional stats panel + footer). Card preview via magnifier button (`fa-search-plus`) opens a `CardPreviewOverlay` (absolute overlay, solid book-page background) on top of the left page, also using `<BookPageContent>`. When a preview is active, `BookPageContent` receives `entity` + `entityType` props and renders a **bonus-stats panel** (`.book-page-stats`) **absolute-positioned top-right over the image area** (inside `.book-page-image-wrap`). The panel is rendered by the shared `BonusBadgeList` component (props: `items: [{ key, label, value }]`, optional `className`). Each pill (`<span class="badge bonus-badge">`) shows `.bonus-badge__label` + `.bonus-badge__value`; zero/null/undefined values are hidden. Stat fields per type are defined in `src/utils/bonusStats.js` (`STAT_FIELDS` map). `title` and `description` fall back to `entity.name` / `entity.description` when no card is attached. Locked: game type (Single) + login (Guest). Accept terms → Start Game. Below the footer, `ConfigView` renders `<BonusBadgeList className="config-total-bonus" ...>` with one pill per stat category, each showing the sum of contributions from all four selected entities. Eight categories are defined: `life`, `energy`, `sad`, `dexterity`, `intelligence`, `constitution`, `weight`, `exp`. Only categories with a non-zero total are shown. Category totals are computed by `aggregateBonusTotals(pairs)` in `bonusStats.js` using the `STAT_CATEGORY` bucket map (fields not in the map — e.g. `costPositive`/`costNegative` on traits, `minCharacter`/`maxCharacter` on difficulty — are intentionally excluded). Labels resolve via `book.stats.totals.<category>` i18n keys (English: Life / Energy / Sadness / Dexterity / Intelligence / Constitution / Weight / XP; Italian: Vita / Energia / Tristezza / Destrezza / Intelligenza / Costituzione / Peso / EXP).
3. **Game** (`/play/:storyId`) — book layout. Left: current location card. Right: player stats (Life/Energy/Sadness/XP/Food/Magic/Coins/Weight) + neighbor locations row + actions row. Click card → detail modal with move/execute button. Navbar + Footer always present.
4. **i18n** — IT (default) / EN via language switcher in Navbar. All labels in `src/i18n/en.json` + `it.json`. The `book.stats.*` namespace holds labels for every bonus/stat field shown in the preview panel (`lifeMax`, `energyMax`, `sadMax`, `dexterityStart`/`Base`, `intelligenceStart`/`Base`, `constitutionStart`/`Base`, `weightMax`, `costPositive`, `costNegative`, `expCost`, `maxWeight`, `minCharacter`, `maxCharacter`, `costHelpComa`, `costMaxCharacteristics`, `numberMaxFreeAction`) plus `book.stats.title` ("Bonuses"). The sub-object `book.stats.totals` holds short labels for the eight ConfigView category pills: `life`, `energy`, `sad`, `dexterity`, `intelligence`, `constitution`, `weight`, `exp`.
5. **API fallback** — If backend unreachable, falls back to `src/mock/` JSON automatically.
6. **Legal modals** — Privacy, Terms, Cookies triggered by Footer links. Copyright (i) on every big card.

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

`GameCard` accepts two new props:
- `onPreview` — when supplied, replaces the `(i)` info button with a magnifier button (`fas fa-search-plus`) that triggers a `CardPreviewOverlay` on the left page.
- `previewLayout` — when true, the credits `(i)` button uses class `card-preview-info` (bottom-right positioning).

New CSS in `main.css`: `.card-preview-overlay` (now `position: absolute; inset: 0` solid book-page overlay), `.card-preview-close`, `.card-preview-info`, `.card-magnify-btn`, `@keyframes fadeIn`. Book page layout classes: `.book-page-content`, `.book-page-loading`, `.book-page-title`, `.book-page-image-wrap` (relative container for image + absolute stats overlay), `.book-page-img`, `.book-page-desc`, `.book-page-footer`, `.book-page-copyright`, `.book-page-credit-btn`. Shared badge classes (replaces all previous per-context badge classes): `.bonus-badge-list` (flex-wrap row), `.bonus-badge` (pill — gold bg, gold-dark border, brown-deep text, `border-radius: 3px`, heading font `0.65rem` uppercase), `.bonus-badge__label`, `.bonus-badge__value` (inverted chip — brown-deep bg, gold text). Modifier: `.book-page-stats` (absolute top-right within `.book-page-image-wrap`, `z-index: 2`, `justify-content: flex-end`). Modifier: `.config-total-bonus` (centered flex, `margin-top: 10px`). Removed: `.book-page-stats__badge`, `.book-page-stats__value`, `.config-total-bonus__badge`, `.config-total-bonus__value`, old two-column grid classes, `.story-card-full*` rules.

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

## Image Credits
All Unsplash images and SVG icons documented in [`src/mock/images.json`](src/mock/images.json). SVG icons from [game-icons.net](https://game-icons.net) (CC BY 3.0).

---

- **Document Version**: 0.19.3
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
- **Last Updated**: May 14, 2026
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
