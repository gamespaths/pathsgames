# Paths Games — Prototype v0.14.0

Modern React + TypeScript prototype of the **Paths Games** gamebook RPG platform.  
Recreates the existing static HTML/JS website as a fully component-based single-page application with routing, state management, and the same medieval parchment/brown/gold design system.

> **Concept Folder** — This is a standalone prototype in `code/website/concepts_v0/v0.14.0-prototype/`.  
> It does **not** modify any file outside this folder. No backend integration (yet).

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| **React** | 19.x | UI component library |
| **TypeScript** | 6.x | Type-safe development |
| **Vite** | 8.x | Build tool + dev server (HMR) |
| **Tailwind CSS** | 4.x | Utility-first CSS framework |
| **Bootstrap 5** | 5.3.x | Grid system, modal component |
| **react-bootstrap** | 2.x | React wrappers for Bootstrap components |
| **React Router** | 7.x | Client-side routing (`/`, `/play/:storyId`) |
| **Font Awesome** | 5.15.x (CDN) + 7.x (React) | Icons (medieval theme) |
| **Google Fonts** | — | Cinzel Decorative, Cinzel, Crimson Text |

---

## Prerequisites

- **Node.js** ≥ 18.0.0
- **npm** ≥ 9.0.0

---

## Quick Start

```bash
# Navigate to the project folder
cd code/website/concepts_v0/v0.14.0-prototype

# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Type-check without emitting
npx tsc -b
```

---

## Project Structure

```
v0.14.0-prototype/
├── index.html                  # HTML entry point (Font Awesome CDN, dice favicon)
├── package.json                # Dependencies & scripts
├── vite.config.ts              # Vite configuration + Tailwind plugin
├── tsconfig.json               # TypeScript project references
├── tsconfig.app.json           # App-level TS config
├── tsconfig.node.json          # Node-level TS config (Vite config)
├── eslint.config.js            # ESLint configuration
│
├── public/
│   └── assets/                 # Static assets (images, etc.)
│
└── src/
    ├── main.tsx                # Entry point: Bootstrap CSS + Tailwind + render
    ├── App.tsx                 # Root component: Router + Providers + Layout
    ├── vite-env.d.ts           # Vite type declarations
    │
    ├── styles/
    │   ├── index.css           # Master CSS: Tailwind directives + @theme tokens
    │   └── theme.css           # CSS custom properties, animations, component styles
    │
    ├── types/
    │   └── index.ts            # TypeScript interfaces (Story, Location, Action, State)
    │
    ├── data/
    │   ├── stories.ts          # Story catalog + world locations (ported from stories.js)
    │   └── storyOptions.ts     # Multi-step option flow (Difficulty, Character, Type, Login)
    │
    ├── context/
    │   ├── GameContext.tsx      # Game state: active story, current location, nav history
    │   └── UIContext.tsx        # UI state: modals, popups, slide direction, terms
    │
    ├── hooks/
    │   ├── useGame.ts          # Shortcut to GameContext
    │   ├── useUI.ts            # Shortcut to UIContext
    │   └── useCard3D.ts        # 3D perspective tilt effect on mouse hover
    │
    ├── layout/
    │   ├── Navbar.tsx          # Sticky top bar: brand, badge carousel, guest btn, game bar
    │   └── Footer.tsx          # Links, version, magic code, legal modals
    │
    ├── pages/
    │   ├── HomePage.tsx        # Crowdfunding banner + Story catalog
    │   └── GamePage.tsx        # Game world: player bar, location, neighbors, actions
    │
    └── components/
        ├── BadgeCarousel.tsx   # Rotating badge (3s interval, slide animation)
        ├── Card3D.tsx          # Wrapper for 3D tilt effect on any card
        ├── ChoicePopup.tsx     # Toast popup for "Coming Soon" messages
        ├── CrowdfundingBanner.tsx  # Parchment gradient banner
        ├── StoryCatalog.tsx    # Groups stories by category → StoryRow
        ├── StoryRow.tsx        # Netflix-style horizontal scroll with drag-to-scroll
        ├── StoryCard.tsx       # Single catalog card (emote, title, Play/Coming Soon)
        ├── StoryPreviewModal.tsx   # Multi-step wizard (5 steps) → Start Adventure
        ├── OptionStep.tsx      # Option cards with lock overlay for disabled items
        ├── PlayerBar.tsx       # HP / Energy / Armor bars + Inventory button
        ├── LocationPanel.tsx   # Large location card with slide transitions
        ├── NearbyLocations.tsx # Go-cards for neighboring locations
        ├── ActionCards.tsx     # Action cards (click → CardDetailModal)
        └── CardDetailModal.tsx # Enlarged action card with Proceed button
```

---

## Architecture

### State Management

Two React Context providers with `useReducer`:

**GameContext** — manages game logic:
- `SET_ACTIVE_STORY` — select a story from the catalog
- `START_GAME` — set initial location, begin game
- `NAVIGATE_LOCATION` — move to a neighboring location (with history)
- `GO_BACK` — pop navigation history
- `STOP_GAME` — return to home catalog
- `SET_OPTION` — store selected option from the preview wizard

**UIContext** — manages UI state:
- `OPEN/CLOSE_STORY_PREVIEW` — story preview modal
- `SET_OPTION_STEP` — wizard step (0–4)
- `OPEN/CLOSE_CARD_DETAIL` — action detail modal
- `SHOW/HIDE_CHOICE_POPUP` — toast messages
- `SET_SLIDE_DIRECTION` — slide-left/right animation trigger
- `SET_TERMS_ACCEPTED` — terms checkbox
- `RESET_OPTIONS` — reset wizard state

### Routing

| Route | Component | Description |
|---|---|---|
| `/` | `HomePage` | Crowdfunding banner + story catalog |
| `/play/:storyId` | `GamePage` | Game world (protected — redirects if no active game) |
| `*` | — | Redirects to `/` |

### Styling Strategy

- **CSS Custom Properties** (`:root`) — all color tokens, fonts, card sizes from original `variables.css`
- **Tailwind CSS** — utility classes for layout, spacing, responsive design
- **Custom CSS classes** — complex component styles (gradients, animations, card frames) in `theme.css`
- **Bootstrap** — modal component via `react-bootstrap`, grid utilities
- **Three font families**: Cinzel Decorative (display), Cinzel (headings), Crimson Text (body)

---

## Color Design System

All colors are ported from the original website's `variables.css`:

| Token | Hex | Usage |
|---|---|---|
| `parchment` | `#e8d5b0` | Page backgrounds, banners |
| `parchment-light` | `#f2e6c8` | Banner gradients |
| `parchment-dark` | `#c9b48a` | Page background (default) |
| `brown-deep` | `#1a0a02` | Navbar, card backgrounds |
| `brown-dark` | `#2e1508` | Card gradients, footer |
| `brown-mid` | `#5c3317` | Navbar gradient, borders |
| `brown-warm` | `#7a4520` | Card header gradients |
| `brown-tan` | `#c08040` | Button backgrounds |
| `gold` | `#c8960a` | Primary accent |
| `gold-light` | `#e8b830` | Text highlights, titles |
| `gold-shine` | `#ffd700` | Hover states, shine effects |
| `gold-dark` | `#9a6f08` | Borders, muted gold |
| `ember` | `#d44a0a` | Danger, dragon theme |

---

## Features Implemented

### Home Page
- [x] Sticky medieval-themed navbar with dice bounce animation
- [x] Rotating badge carousel (7 badges, 3s interval)
- [x] Crowdfunding hero banner with parchment gradient
- [x] Netflix-style story catalog (horizontal drag-scroll rows)
- [x] 7 stories across 2 categories (Fantasy, Adventure)
- [x] Story cards with 3D tilt effect on hover
- [x] "Play" button for active stories, "Coming Soon" for inactive

### Story Preview
- [x] Modal with large story card (left) + wizard (right)
- [x] 5-step option flow: Difficulty → Character → Type → Login → Confirm
- [x] Lock overlay on disabled options with "Coming Soon" toast
- [x] Step indicator dots
- [x] Terms acceptance checkbox
- [x] "Start Adventure" button → navigate to game

### Game World
- [x] Player stats bar (HP, Energy, Armor — cosmetic)
- [x] Game bar with story title + Map/Journal buttons
- [x] Large location card with emote and description
- [x] Nearby locations row (go-cards for navigation)
- [x] Available actions row (click → detail modal)
- [x] Card detail modal with "Proceed" button
- [x] Slide transitions on location navigation
- [x] Navigation history (back support)
- [x] 5 locations: Castle → Dungeon, Mountains → Wolf Camp, Dragon

### General
- [x] 3D card tilt effect (perspective + radial gradient shine)
- [x] Choice popup toast (auto-dismiss, 2.5s)
- [x] Footer with social links, legal modals, version, magic code
- [x] Responsive design (desktop → tablet → mobile)
- [x] React Router with browser history support
- [x] Zero TypeScript errors, clean production build

---

## Planned / Not Implemented

These features are placeholders in the prototype, matching the original site:

- [ ] Backend API integration (REST endpoints from Step 11–13 docs)
- [ ] Guest login (`POST /api/auth/guest`)
- [ ] Session/token management (JWT access + refresh)
- [ ] Real game state persistence
- [ ] Map view
- [ ] Journal view
- [ ] Inventory system
- [ ] Action outcomes / results
- [ ] Multiplayer, Open World, Hard difficulty modes
- [ ] User registration & login
- [ ] Admin panel

---

## Relation to Documentation

This prototype corresponds to the frontend milestone in the project roadmap:

| Doc Step | Title | Relevance |
|---|---|---|
| Step 00 | Roadmap | Steps 31–32 (Frontend UI) |
| Step 03 | Define Scope | Feature list for V1 |
| Step 09 | Core Data Model | Story, Location, Action structures |
| Step 11 | API Versioning | Future REST integration base URL |
| Step 12 | Guest Login | Guest auth flow (stubbed in Step 3 of wizard) |
| Step 13 | Session Tokens | Future HttpOnly cookie integration |
| Step 14+ | Match Lifecycle | Future match creation / play endpoints |

---

## Scripts

| Script | Command | Description |
|---|---|---|
| dev | `npm run dev` | Start Vite dev server with HMR |
| build | `npm run build` | TypeScript check + production build |
| preview | `npm run preview` | Serve production build locally |
| lint | `npm run lint` | Run ESLint |

---

## License

See [LICENSE](../../../../LICENSE) in the repository root.
