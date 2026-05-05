# Paths Games V1 - Step 18: Game Main Frontend (react-game)

This document describes the **player-facing React frontend** built in `code/frontend/react-game/`. It is the main public website of paths.games — distinct from the admin panel (`react-admin`).

---

## 1. Overview

The frontend is a React 18 single-page application that lets a guest player:

1. Browse the story catalog (home page, Netflix-style rows)
2. Open a "Start Book" modal to configure and launch a story
3. Play the game on a dedicated game page (`/play/:storyId`)

All data is fetched from the backend API. When the API is unavailable, mock JSON files are used as transparent fallback.

### Tech Stack

| Tool | Version | Role |
|------|---------|------|
| React | 18.3.1 | UI framework |
| Vite | 5.3.1 | Build tool, dev server (port **5174**) |
| React Router | 6.23.1 | Client-side routing |
| Axios | 1.7.2 | HTTP client |
| Tailwind CSS | 3.4.4 | Primary utility layer |
| Bootstrap 5.3.3 | CDN only | Modal system and grid |
| Font Awesome 5.15.4 | CDN only | Icons |
| Google Fonts | CDN | Cinzel Decorative, Cinzel, Crimson Text |

Bootstrap and Font Awesome are loaded via CDN links in `index.html` — **never** via npm — to avoid CSS conflicts with Tailwind.

### Dev Commands

```bash
cd code/frontend/react-game
npm install
npm run dev      # http://localhost:5174
npm run build    # production build → dist/
```

API proxy: `/api` → `http://localhost:8042` (configured in `vite.config.js`).

---

## 2. File Structure

```
code/frontend/react-game/
├── index.html                      # CDN links, GTM snippet
├── .env.example                    # VITE_GTM_ID, VITE_API_URL
├── package.json
├── vite.config.js                  # port 5174, /api proxy
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx                    # React root mount
    ├── App.jsx                     # Router: / → HomePage, /play/:storyId → GamePage
    ├── styles/
    │   ├── variables.css           # CSS custom properties (colors, fonts, spacing)
    │   ├── main.css                # All component styles + animations
    │   ├── mobile.css              # Responsive overrides (≤767px)
    │   └── abbrev.css              # Tailwind-style shorthand utilities
    ├── i18n/
    │   ├── context.jsx             # LanguageContext + useTranslation hook
    │   ├── en.json                 # English captions
    │   └── it.json                 # Italian captions
    ├── api/
    │   ├── client.js               # Axios instance + mock fallback helper
    │   ├── stories.js              # getStories(), getStory(id)
    │   └── game.js                 # getLocations(storyId), getActions(locationId)
    ├── mock/
    │   ├── stories.json            # 5 stories with characters/classes/traits/difficulties
    │   ├── gameData.json           # locations + actions
    │   └── images.json             # SVG/Unsplash credits {id, imageUrl, linkCopyright, ...}
    ├── components/
    │   ├── layout/
    │   │   ├── Navbar.jsx          # Sticky navbar: brand, lang switcher, guest button
    │   │   └── Footer.jsx          # Social links, legal modal triggers, version
    │   ├── modals/
    │   │   ├── PrivacyModal.jsx
    │   │   ├── TermsModal.jsx
    │   │   ├── CookiesModal.jsx
    │   │   └── CopyrightModal.jsx  # Credits modal: image + text + sound cards
    │   └── book/
    │       ├── BookWrapper.jsx     # .book-overlay → .book-wrapper with spine
    │       ├── BookPageLeft.jsx    # Corner ornaments + page-inner slot
    │       └── BookPageRight.jsx   # Corner ornaments + page-inner slot
    ├── features/
    │   ├── home/
    │   │   ├── StoryCard.jsx       # Home medium card (225px, hover scale + gold border)
    │   │   └── StoryCatalog.jsx    # Rows by category, responsive horizontal scroll
    │   ├── startBook/
    │   │   ├── StartBookModal.jsx  # Book overlay orchestrator (desktop + mobile layout)
    │   │   ├── ConfigView.jsx      # Right page: 2×3 config card grid
    │   │   ├── SelectionView.jsx   # Right page: options list for a single config type
    │   │   └── ConfigCard.jsx      # Single config card (cover variant + plain variant)
    │   └── game/
    │       ├── GameBook.jsx        # Book wrapper for game page
    │       ├── LocationCard.jsx    # Big card for current location (left page)
    │       ├── PlayerStats.jsx     # Life/Energy/Sadness/Experience + backpack
    │       ├── NeighborRow.jsx     # Horizontal scroll neighbor location cards
    │       ├── ActionsRow.jsx      # Horizontal scroll action cards
    │       └── CardDetailModal.jsx # Bootstrap modal: big card + move/execute button
    └── pages/
        ├── HomePage.jsx            # Hero + StoryCatalog + StartBookModal
        └── GamePage.jsx            # /play/:storyId — Navbar + GameBook + Footer
```

---

## 3. Design System

### CSS Architecture

All design tokens live in `src/styles/variables.css` as CSS custom properties:

```css
--color-brown-deep, --color-brown-dark, --color-brown-mid, --color-brown-warm
--color-gold, --color-gold-dark, --color-gold-light
--color-parchment, --color-parchment-dark, --color-ash
--font-display   /* Cinzel Decorative */
--font-heading   /* Cinzel */
--font-body      /* Crimson Text */
```

### Unified Card System

All cards share a `1 : 1.4` aspect ratio enforced via `aspect-ratio: 1/1.4`. Four size variants:

| Class | Width | Usage |
|-------|-------|-------|
| `.pg-card--small` | 100px fixed | - |
| `.pg-card--medium` | 150px fixed | Game rows (neighbors, actions) |
| `.pg-card--home` | 225px fixed | Story catalog |
| `.pg-card--large` | 100% fill | Left page big card |
| `.pg-card--grid` | flex:1 | Config 2×3 grid (start book right page) |

Cards support `style_main` and `style_detail` fields in mock JSON to inject extra CSS classes on the wrapper and image respectively.

### Hover Interactions

- Scale `1.03` + gold border + drop shadow on card hover
- `z-index: 10` on hovered card so it renders above siblings in scroll rows
- `(i)` info buttons: `opacity: 0` by default, `opacity: 1` on parent `:hover`
- On mobile (≤767px) all `(i)` buttons and cover badges are always visible

---

## 4. API Client and Mock Fallback

`src/api/client.js` wraps Axios. Every API call is attempted against the real backend; on any network error the mock JSON is returned transparently:

```js
export const fetchWithFallback = async (url, mockData) => {
  try {
    const res = await axios.get(url)
    return res.data
  } catch {
    return mockData
  }
}
```

---

## 5. Internationalisation (i18n)

`src/i18n/context.jsx` provides a `LanguageContext` with a `lang` state (default: `'it'`). The `useTranslation()` hook returns a `t(key)` function that resolves dot-notation keys from `en.json` / `it.json`.

The language switcher in the Navbar toggles the context. All UI labels use `t()` — no hardcoded strings in components.

---

## 6. Story Entity Shape (from OpenAPI v0.14.0)

```json
{
  "uuid": "...",
  "title": "...",
  "description": "...",
  "author": "...",
  "category": "...",
  "group": "...",
  "visibility": "PUBLIC",
  "priority": 1,
  "card": {
    "uuid": "...",
    "imageUrl": "...",
    "title": "...",
    "description": "...",
    "copyrightText": "...",
    "linkCopyright": "...",
    "awesomeIcon": "fas fa-...",
    "style_main": "",
    "style_detail": ""
  },
  "characters": [ { "uuid", "name", "icon", "sub", "card": { ... } } ],
  "classes":    [ { "uuid", "name", "icon", "sub", "card": { ... } } ],
  "traits":     [ { "uuid", "name", "icon", "sub", "card": { ... } } ],
  "difficulties": [ { "uuid", "name", "icon", "sub", "card": { ... } } ]
}
```

`characters`, `classes`, `traits`, and `difficulties` are per-story arrays. Different stories can offer different options. The `card` sub-object on each option follows the same OpenAPI card shape including `style_main` / `style_detail` for per-card CSS overrides.

---

## 7. Start Book Modal

### Desktop layout (≥768px)

```
┌────────────────────┬────────────────────┐
│   LEFT PAGE        │   RIGHT PAGE       │
│                    │                    │
│  Big story card    │  ConfigView        │
│  (image + title    │  2 × 3 grid of     │
│   + description)   │  config cards      │
│                    │                    │
│  [✓] Accept Terms  │       [Start Game] │
└────────────────────┴────────────────────┘
```

When the user clicks **Change** on a config card the right page switches to `SelectionView` (options list for that type). Selecting an option returns to `ConfigView` with the new value.

### Mobile layout (≤767px)

Vertical scroll list inside `.book-overlay`:
1. Story card (image + title + description)
2. Six config cards stacked (character, class, trait, difficulty, game type, login)
3. Terms checkbox + Start Game button

### Config Cards (6 total)

| # | Type | Changeable | Source |
|---|------|-----------|--------|
| 1 | character | yes | `story.characters` |
| 2 | class | yes | `story.classes` |
| 3 | trait | yes | `story.traits` |
| 4 | difficulty | yes | `story.difficulties` |
| 5 | game type | locked | Fixed (Single Player icon from `images.json` id=`person`) |
| 6 | login | locked | Fixed (Guest icon from `images.json` id=`gems`) |

Locked cards show a faded gold **"Coming soon"** badge (lock icon, 45% opacity, pointer-events none) instead of a change button.

### Credits (i) Modal

Every config card with an image shows an `(i)` button (top-left, hover-only on desktop). Clicking opens a Bootstrap modal with credit cards:

| # | Card | Content |
|---|------|---------|
| 1 | Story | Story card image + author |
| 2 | Image | Config card image + `copyrightText` + "View original" link |
| 3 | Text | Disabled ("Coming soon") |
| 4 | Sound | Disabled ("Coming soon") |

Credit cards are 170px wide, image fills absolutely, gold text overlay at bottom.

---

## 8. Game Page (`/play/:storyId`)

Full React Router route. Navbar and Footer always present.

### Desktop layout

```
┌────────────────────┬────────────────────┐
│   LEFT PAGE        │   RIGHT PAGE       │
│                    │                    │
│  LocationCard      │  PlayerStats       │
│  (current          │  (life/energy/     │
│   location big     │   sadness/xp/      │
│   card with (i))   │   food/magic/gold) │
│                    ├────────────────────┤
│                    │  NeighborRow       │
│                    │  (h-scroll cards)  │
│                    ├────────────────────┤
│                    │  ActionsRow        │
│                    │  (h-scroll cards)  │
└────────────────────┴────────────────────┘
```

### Mobile layout

Vertical stack:
1. LocationCard (full width)
2. PlayerStats badges row
3. NeighborRow (horizontal scroll)
4. ActionsRow (horizontal scroll)

Clicking a neighbor or action card opens `CardDetailModal` — a Bootstrap modal with the big card image, title, description, and a Move / Execute button.

---

## 9. Responsive Breakpoints

| Breakpoint | Layout changes |
|-----------|---------------|
| ≤767px | Book modal switches to vertical list; game book stacks pages; navbar brand text hidden; hero shorter |
| ≤767px | `pg-card--medium` shrinks to 130px; `pg-card--home` shrinks to 180px |

Mobile CSS lives in `src/styles/mobile.css` and is imported at the top of `main.css`.

---

## 10. Google Tag Manager

GTM snippet is injected inline in `index.html`. The GTM container ID is read from the environment variable `VITE_GTM_ID` (default: `GTM-T52SH6JQ`). See `.env.example` for configuration.

---

## 11. Images and Credits

`src/mock/images.json` lists every static image used by the mock layer:

```json
[
  { "id": "person", "imageUrl": "data:image/svg+xml;base64,...", "linkCopyright": "https://game-icons.net/..." },
  { "id": "gems",   "imageUrl": "data:image/svg+xml;base64,...", "linkCopyright": "https://game-icons.net/..." },
  { "id": "shadow-keep", "url": "https://images.unsplash.com/...", "author": "Stefan Steinbauer", "authorLink": "https://unsplash.com/@usinglight" },
  ...
]
```

All Unsplash images are free-license. All SVG icons are from [game-icons.net](https://game-icons.net) (CC BY 3.0).


## Version Control
- Created with AI prompts:
  > I wanna start new "Frotend react game project" into "code/frontend/react-game" folder. 
  It is going to be main website of my paths.games project.
  With react>18 , vite , fontawesome, Bootstrap 5 via CDN only (no npm), Tailwind as primary utility layer — use Bootstrap only for grid/modal classes to avoid CSS conflicts, Axios e React Router 6.
  Website with alwasy nav-header and footer, copy nav-header and footer from "code/website/html/index.html" file, create navbar/footer as React components inspired by the HTML, don't copy verbatim. Copy "Google Tag Manager" configuration too but GTM-code shound be parametric in env variabiles. USe only color and styles from "documentation_v0/website_concepts_v0/v0.17.5-prototype" folder.
  If you need some images (fix or in mock) use unsplash.com with free license, write me a json-file with the list of images url, authors link (example "https://unsplash.com/@cedericvandenberghe" ).
  There are some parts of website:
  1) modals for privacy, terms of conditions and copyright alert you shound import from actual html website. "privacy/terms as React modal components triggered by footer links".
  2) main page: home page with netflix style with a list of Stories (get from API or mock), story with medium-card style, click on story open a "start book modal". Stories cards on responsive rows (by story categories). Must be responsive and in mobile like netflix mobile style.
  2) start book modal: a modal with a book-style (from documentation_v0/website_concepts_v0/v0.16.6-prototype-book). on book there are left and right pages. in book on left there is a big card with image, title, long description. on right a list of medium card and (on bottom) the "start button". main right book page contains two rows with 3 card for ever row: category (first disponibile), class (first disponible), 3 traits (first disponibile), 4 difficulties, 5 type=single player (locked for now, multiplayer coming soon), 6 gues user (locked for now, login system coming soon). On Main-right page every not locked card with button "change" then show a new right-page (left page doen't chage) with list of possibile card (example possibile difficulties), every card with button "select" to back to main-right page with new value/card selected. On bottom "start game" with beautiful checkbox "accept terms of conditions", start game disabled if user doesn't accept terms of condition. On "start game" the user jump to "game book" page. "start-book-modal" must be responsive for tablet and mobile: on little screen there isn't a book but vertical card list: first is a story card, second is category (with possiblity to change in modal), classes, ... on botton "start game" button. 
  3) Game page is a full React Router route at /play/:storyId, not a modal overlay. get exampe from "html" folder and others prototypes. there aren't any specific story-top-bar (but leave nav-bar), only a "game book". the book is with two pages: right and left. right pages is always the current location big-card, the right page is component with : 3a) player with statistics of Life, Energy, Sadness, Experience, Food (backpack), Magic (backpack), Coins (backpack)", backpack weight 3b) neighbord location with possiblity to move show as a row cards 3c) disponibile actions into this location. The neighbor card and action card is medium side with image and title, on click open a modal big-card with same image, title, long description and button move/execute. On mobile actual location card is first card, after 3 rows  with horizontal scroll system: first of personal situation, second neighbor, third actions. NavBar and footer must be present into Game-page-book too in desktop, tablet and mobile too. Project is multilangage so add language change system and "caption" system (it and en for now).
  4) every big card have image, title, long description and (i) icon on bottom, the (i) jump to modal popup to show copyright information (from card entity). Book page system must be animated. 
  Story list and all information come from APIs (is server is not disponbile use a mock-json file). 
  At the end update code/frontend/react-game/README.md file.

  > I wanna edit all react-game project: all card must be 3 types: little, medium or large. All card must have always height = width × 1,4 ALWAYS and all types, overidde hidden, must be 3 types little, medium and large dimension. on home page use medium, on start-game use large on left page, use medium on right pages. on game component use use large on left page, use medium on right pages

  > **Iterative refinements (session log)**
    >
    > - **Unified card system**: all cards enforce `aspect-ratio: 1/1.4` via four size variants (`--small`, `--medium`, `--home`, `--grid`, `--large`). Hover interaction: scale 1.03 + gold border + `z-index: 10` so card renders above siblings in scroll rows.
    > - **Per-story option lists**: `characters`, `classes`, `traits`, `difficulties` moved from a global static file into each story object in `stories.json`. Values are Young Woman / Young Man / Adult Woman / Adult Man (characters), Human / Elf / Dwarf / Hobbit (classes), Happy / Strong / Smart / Fast (traits). Each item has a `card` sub-object following the OpenAPI card shape (`imageUrl`, `copyrightText`, `linkCopyright`, `awesomeIcon`, `style_main`, `style_detail`).
    > - **`style_main` / `style_detail` fields**: added to card JSON objects to inject additional CSS classes onto the card wrapper (`style_main`) and the image element (`style_detail`) at render time, enabling per-card image positioning or visual overrides without touching CSS.
    > - **ConfigView grid**: switched from two `config-row-fill` rows to the same `selection-list` grid used by `SelectionView`, giving uniform sizing and spacing across both views.
    > - **`(i)` info buttons**: rendered via `createPortal` to escape `overflow: hidden` stacking contexts. Positioned top-left (`position: absolute; top: 6px; left: 6px`). Visibility: `opacity: 0` by default, `opacity: 1` on parent `:hover`. On mobile (≤767px) always visible. Present on home story cards, config cards (desktop and selection view), and game location cards.
    > - **`config-cover-badge`**: same hover-only visibility as `(i)` buttons; always visible on mobile.
    > - **Credits modal unification**: all `(i)` buttons open a Bootstrap `modal-lg` with the same visual style — 170 px credit cards (image fills absolutely via `position: absolute; inset: 0`), gold gradient overlay, gold-light text. Credits order: 1 Story card (story author + story image), 2 Image credit (config card image + `copyrightText` + "View original" link), 3 Text (disabled, coming soon), 4 Sound (disabled, coming soon). `credits-card--disabled` applies `opacity: 0.35; filter: grayscale(60%); pointer-events: none`.
    > - **X button**: `margin-left: auto` on `.modal-custom-close` forces the close button to the right in every modal header flex container.
    > - **ConfigCard `story` prop**: `ConfigView` passes `story={story}` to all four changeable `ConfigCard` instances so the story image appears as the first credit card in the right-page `(i)` modal.
    > - **Locked cards with images**: `gameType` (Single Player) and `login` (Guest) locked cards now receive real image data from `images.json` (`id="person"` and `id="gems"` respectively — SVG icons from game-icons.net). Locked badge replaced by a faded gold **"Coming soon"** span (lock icon, 45% opacity, border, `pointer-events: none`).
    > - **Button alignment**: `config-change-btn` and `config-coming-soon-btn` are `width: auto`, font-size reduced to `0.65rem`, footer aligned right (`align-items: flex-end`) so buttons sit in the bottom-right corner of cover cards.
    > - **Mobile top clipping fix**: `book-overlay` padding-top raised to `56px` on mobile so the first card in the vertical list is not hidden under the navbar.

- **Document Version**: 0.18.0
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.18.0 | First web main frontend project | May 05, 2026 |
    
- **Last Updated**: May 05, 2026
- **Status**: On progress



# < Paths Games />
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


