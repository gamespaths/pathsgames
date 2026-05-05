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
├── components/
│   ├── layout/     # Navbar (lang switcher + user btn), Footer (social + legal links)
│   ├── modals/     # PrivacyModal, TermsModal, CookiesModal, CopyrightModal
│   └── book/       # BookWrapper, BookPageLeft, BookPageRight
├── features/
│   ├── home/       # StoryCard (Netflix card), StoryCatalog (rows by category)
│   ├── startBook/  # StartBookModal, ConfigView, SelectionView, ConfigCard
│   └── game/       # GameBook, LocationCard, PlayerStats, NeighborRow, ActionsRow, CardDetailModal
└── pages/
    ├── HomePage.jsx    # /
    └── GamePage.jsx    # /play/:storyId
```

## Pages & Features
1. **Home** (`/`) — Netflix-style story catalog grouped by category. Click story → book modal.
2. **Start Book Modal** — book UI (desktop) / vertical list (mobile). Configure character, class, trait, difficulty. Locked: game type (Single) + login (Guest). Accept terms → Start Game.
3. **Game** (`/play/:storyId`) — book layout. Left: current location card. Right: player stats (Life/Energy/Sadness/XP/Food/Magic/Coins/Weight) + neighbor locations row + actions row. Click card → detail modal with move/execute button. Navbar + Footer always present.
4. **i18n** — IT (default) / EN via language switcher in Navbar. All labels in `src/i18n/en.json` + `it.json`.
5. **API fallback** — If backend unreachable, falls back to `src/mock/` JSON automatically.
6. **Legal modals** — Privacy, Terms, Cookies triggered by Footer links. Copyright (i) on every big card.

## Card System

All cards enforce `aspect-ratio: 1/1.4`. Four size variants:

| Class | Width | Usage |
|-------|-------|-------|
| `.pg-card--small` | 100px | — |
| `.pg-card--medium` | 150px | Game rows (neighbors, actions) |
| `.pg-card--home` | 225px | Story catalog |
| `.pg-card--grid` | flex:1 | Config 2×3 grid |
| `.pg-card--large` | 100% | Left page big card |

Cards support `style_main` (extra classes on wrapper) and `style_detail` (extra classes on image) in mock JSON for per-card visual overrides.

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

- **Document Version**: 0.18.0
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.18.0 | React game frontend initial implementation | May 04, 2026 |
    | 0.18.0 | Per-story options, card system, credits modals, locked card images, mobile fixes | May 05, 2026 |
- **Last Updated**: May 5, 2026
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
