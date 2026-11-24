# v1.13.0 — Book UI and card animation concept

Standalone prototype of V1 steps 13–16 for `code/frontend/react-game`: every page is a book under
an always-visible navbar (no modals), with the card animations, on desktop and mobile. No build
and no library: open `index.html` in a browser (Font Awesome, Google Fonts and the Home photo load
from their CDNs, as on the site). Look and tokens come from `src/styles/main.css` and `variables.css`.

| File | Content |
|---|---|
| `index.html` | Navbar, the book (cover, bookmarks, two pages, deck), footer, demo controls |
| `demo.css` | Book graphics, cards, the three effects, footer, mobile vertical book, reduced motion |
| `demo.js` | Hash router with four pages, a small story, previews, policy chapters, effects |

## Pages (one book each, no page turn between them)

| Route | Left page | Right page |
|---|---|---|
| `#/` Home | Intro card: photo, title, tutorial button, anti-bot check | All stories in one list, category badge, Resume / Replay / Coming soon |
| `#/story/:id` Story set-up | Story card | Class, Character, Attributes, Trait, Difficulty, Your hero (Start); "Change" turns to the option list |
| `#/start/:id` Start match | Story card + anti-bot check | Story (Back), Single player, Attributes, Login, Terms (Accept), Start; then Creating → Joining → Running |
| `#/play/:id` Game | Location / section | Cards of the board, information, backpack, map, missions |

Between pages: Home → story set-up, story set-up → Home and game → Home close the book (its right
half folds over the spine, the leather cover shows the book's title), the closed book slides out
to the left, the next one comes in closed from the right and its cover opens; on mobile the cover
closes over the page from its left edge, slides out left, the next cover slides in and opens. Every
other change of page turns the page: forward towards the game, back otherwise. Start match replaces its own
history entry, so Back from the game returns to the story set-up. Inside a page, every change of
spread is a page turn.

## The book

Leather cover with gold tooled frame, stitching, dark gold metal corners and headbands; stacked page edges;
paper grain and gutter shading; corner flourishes; a ribbon under the bottom edge. The game has the
react-game bookmarks on the top edge: icon plus badges (life, energy, sadness; weight), the label
only as tooltip, red when a statistic is critical, gold when the missions changed.

## Card components (kept as in the react-game)

The animations never remove the special parts of `Card.jsx`; the concept draws them too:

- **Page card** — title bar with the back arrow; picture with the `BonusBadgeList` overlay; description
  with the `TipNote` (gold-glow tip, or a story / picture credit on one line, eye-slash to hide it);
  `extraContent` (e.g. "Success! You are human." on the Home and start pages); the page `CardButtons`
  bar (the reading page of a card carries its action: Go, Select, Use…); `CardCreditsBar` (type, Tip,
  Story, Picture — each opens its note).
- **Little card** — title with the little statistics (fading out on the right) and the type badge on
  hover; picture with category, status and full statistics; `CardButtons`: (i), the main action, its
  selected state (✓ Selected), secondary actions (`actionsList`, e.g. the bin to drop the bread), the
  locked label with its own icon.
- The card back holds only the d20 pattern: every component lives on the front face.

## Book position and deck

The book sits close to the navbar: over it only the bookmarks' height, almost nothing on a page
without bookmarks. On desktop the deck lies on the table, right of the right page: ten gathered
card backs, the top one with the pulsing d20, a strip under the book's cover (or over it: demo option
*Deck*, planned env `VITE_ANIM_DECK`, default `under`). Dealt cards leave the top card and enter the
page from its right edge. Smaller and closer between 1100 and 1360 px; on mobile the deck stays in
the page, sticky at the bottom of the screen.

## Effects

1. **Deal** — cards fly from the deck face-down (card back: the site's d20 in light gold, pulsing)
   and flip when they land, when they enter the screen, stagger capped at 8.
2. **Play** — the card lifts and glows while the "server" answers, the others fall, a copy flies
   into the left picture (mobile: to the top of the screen); light vibration on Android.
3. **Page turn** — full flip on the spine (forward / back), or simple mode.
4. **(i) preview** — fades in and out: on the left page; in the game on the right page.
5. **Policy chapter** — footer links open Privacy, Terms, Cookies, Credits or the roadmap as a
   chapter of the open book (turn forward, back arrow turns back); the address does not change.

The home tab (house icon) sits on the right of the book's top edge on every page but the Home: it goes back
to the Home; in a match it first turns to a "Close the book" spread (Leave / Stay). Tooltips are
drawn by the page (one fixed element placed above or below its target), never the browser's; on touch
screens a long press shows them. In a match the home tab asks first, also from a policy chapter; on
mobile it stays pinned at the end of the sticky bookmarks row. The
right page has no heading over the cards: its place is kept for the multiplayer messages (the
markup is there, hidden by the CSS). The footer sits below the fold: two centred rows
(environment with roadmap info, server badge, copyright; Privacy, Terms, Cookies, Credits).

## Mobile

Same query as `mobileView.js` (`MOBILE_MQ`). A vertical book bound on its left edge: left page on
top, right page below, the document scrolls. The bookmarks become one sticky row under the navbar;
the deck sticks to the bottom of the screen while the cards are visible; cards are dealt as they
scroll into view. The page turn is a single sheet hinged on the left edge (copy of the visible
slice; the jump to the top of the new page happens under it). Hover only under `(hover: hover)`.

## Demo controls and planned env variables

The round button bottom-left opens the controls (concept only).

| Control | Planned env variable | Default |
|---|---|---|
| 1 Deal / face-down | `VITE_ANIM_DEAL` / `VITE_ANIM_DEAL_FACEDOWN` | `true` / `true` |
| 2 Play | `VITE_ANIM_PLAY` | `true` |
| 3 Page turn / mode | `VITE_ANIM_TURN` / `VITE_ANIM_TURN_MODE` | `true` / `full` |
| Speed 1× / ½× / ⅓× / ¼× | `VITE_ANIM_SPEED` (durations divided by it) | `0.3333` (⅓×) |
| Deck under / over the book | `VITE_ANIM_DECK` | `under` |

Server latency, vibration, reduced motion (same as the OS setting: every effect off), Re-deal and
Restart exist only here. Path to see everything: Home → a story → Change class → Start → accept
the terms → Start → game; Search the well, then the Stone Tower opens; footer → Privacy.

Porting details per step: `Step13_BookLayoutWithoutModals.md` … `Step16_MobileBookAndPreferences.md`.
