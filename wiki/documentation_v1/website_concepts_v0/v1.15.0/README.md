# v1.15.0 — Bookmarks on the book's side and edges (concept)

Standalone prototype for `code/frontend/react-game`, built from the
[v1.13.0 concept](../v1.13.0/README.md) and aligned to the react-game as it is in 1.14.0 (steps 14–16
developed). No build and no library: open `index.html` in a browser (Font Awesome, Google Fonts and the
Home photo load from their CDNs). Everything the v1.13.0 README describes (pages, book graphics, card
components, deck, effects, policy chapters, mobile vertical book, demo controls) still holds, except
for the points below.

| File | Content |
|---|---|
| `index.html` | Navbar, the book (cover, bookmarks, two pages, deck), footer, demo controls |
| `demo.css` | v1.13.0 styles + the bookmarks per screen and the 1.14.0 alignments |
| `demo.js` | v1.13.0 router and effects + bookmark groups and side tooltips, the 1.14.0 Home, the reading-card flight |
| `Screenshot From 2026-11-26 09-48-26.png` | The react-game 1.14.0 game page today: tabs on the book's top edge |

## New in this concept: where the bookmarks sit

Today (screenshot) the tabs sit on the book's top edge on desktop and tablet (the game's tabs over the
left page, the home tab over the right one) and in a separate sticky pill bar on phones.

| Screen | Game tabs (position, information, backpack, map, missions) | Home tab |
|---|---|---|
| **Desktop** (wider than 1120px) | Down the book's **right side**, from the top, all the same width | Book's **right side**, at the **bottom**, just **under the deck pile** and in front of it |
| **Tablet** (768–1120px, not a sideways phone) | Book's **top edge**, over the left page (as today) | Book's top edge, over the right page (as today) |
| **Phone** (`MOBILE_MQ`) | Leather tabs on the book's **top edge**, icon only, no separate bar | Leather tab hanging **under the book's bottom-right corner** |

The 1120px edge is the one where the cards already go from three columns to two (`--cards-cols`).
In the markup the two groups are `.bm-group--tabs` and `.bm-group--home`.

**Desktop — every tab on the right side**
- **Game tabs:** they hang down the book's right edge, one under the other, starting under the cover's
  top-right gold corner, **all the same width** (74px, the width the badges need: one even column).
  Each tab shows its icon with its badges stacked under it (information: life, energy, sadness;
  backpack: weight). Same leather look, tooled gold frame and stitching as today,
  turned for a side tab; each tucks 6px under the cover's edge as the top tabs did. Active, red
  (information: critical statistic; backpack: over the weight limit) and gold (missions changed)
  states unchanged.
- **Rule — home tab at the bottom, deck pile just above it and under it** (owner's decision): the home
  tab sits on the right edge at the bottom, over the bottom-right corner (`--home-bottom: 42px`), on every
  page but the Home; the pile lies on the table right above it (`bottom: calc(var(--home-bottom) + 24px)`),
  so the home tab covers its lowest card a little. Vertically the pile is above the home tab; in depth the
  pile is under every tab, home included (z-index -1 in the book's stacking context: on the table, still
  under the cover). The pile is `scale(0.82)` up to 1360px wide and `scale(0.7)` on screens up to 820px
  high (less of it under the game tabs there). `VITE_ANIM_DECK=over` keeps it on top of everything.
- **Taller book:** no tab row over the book, so it rises to 16px under the navbar on every page (as the
  Home already does) and gains that height.
- **The rule — the book gives up width, never the tabs:** the right side keeps a column of
  `--side-tab-w` (78px) plus the 16px gutter on every page, the Home too (owner: the book never shifts
  sideways between the Home and the player page); the book is `min(1080px, the room left)` and sits
  centred in what is left. From about 1190px up the book keeps its 1080px; between 1121 and 1190px it
  narrows.
- **Tooltips:** a side tab's drawn tooltip opens on its left, over the cover, arrow pointing at the tab;
  if it does not fit it falls back to above / below.

**Tablet** — unchanged from 1.14.0: tabs on the top edge, book 46px under the navbar.

**Phone — bookmarks of the book, no separate bar**
- **Game tabs:** leather tabs standing on the book's top edge (clear of the top-left gold corner) and
  tucked under the cover, as the desktop top tabs; they scroll with the book (no sticky bar). Icon only:
  no life / energy / sadness badges, no weight counter; `padding: 12px 16px`, larger to tap. The tabs
  still turn red when it matters (critical statistic; bag over the weight limit); the values stay on the
  information and backpack pages.
- **Home tab:** a leather tab hanging under the book's bottom edge, at the bottom right (left of the
  ribbon and of the bottom-right gold corner), at the end of the book.
- **Rule — every page change goes back to the very top** (owner's decision): the tabs scroll with the
  book, so after every page turn (a tab, a play, a route change) the screen returns to the top, tabs in
  view; the jump happens under the turning sheet. An (i) preview on the right page still scrolls to it.

## Aligned to react-game 1.14.0 (owner decisions after the step 14–16 tests)

- **Home intro:** title "Epic Adventures Await" and the three-line text; the anti-bot check sits right
  under the text; "Success! You are human." shows only after a check passed on this visit and fades
  away after 4 s; the tutorial button alone at the card's foot. On a short screen (e.g. 1280×800) the
  line is under the text in the scrolling text box, as in the app.
- **Hover:** tight dark drop shadow and a gold glow (`0 10px 14px -4px`, `0 0 9px 1px`), border light gold.
- **Scroll bar inside the book:** dark gold, rounded, on a dark see-through track.
- **Speed:** default ¼× (as `VITE_ANIM_SPEED=0.25`); the demo offers 1×, ½×, ¼× as the step 16 preferences.
- **Play from a reading page:** the whole reading card flies to the story (v1.13.0 only lifted it), as a small card does.
- **Backpack tab:** red when the bag is over its weight limit (1.14.0 `isBagOverloaded`).
- Already as 1.14.0 in v1.13.0: the deck pile always on the table on desktop.

## Book change between routes (step 15 §9, second to-do)

- **When:** whenever the book changes (owner): the Home book (Home, player page) ↔ the story's book (set-up,
  start match, game). The book closes (desktop: its right half folds over the spine; phone: the cover closes over
  the page), slides out left, the next one slides in closed and opens. Every other change of page turns the page.
- **Settings (demo controls):** "Book cover" on/off (planned `VITE_ANIM_COVER`, default on, with its own preference
  row; off: the new book just appears); "at most" 10 s (default) / 6 s / 4 s / no limit (planned
  `VITE_ANIM_COVER_MAX_S`, default 10): when the speed would make the change longer, all its phases shrink together
  (desktop at ¼×: ~10 s instead of 13.8 s; at 1× it stays 3.4 s, phone 2.4 s).
- **Navigation during an animation** waits until the book is free (`pendingRoute`), as v1.13.0 did.
- **First load:** the opening zoom stays, gated by the cover setting and scaled by the speed.
- Not drawn: the fade instead of a turn when a play does not change the location (step 15 §9, first to-do).

## Owner decisions (November 26, 2026)

- Tab look, every screen: the light (tan) inside of today's tabs, framed by a band of the cover's dark tooled leather
  at half the cover's thickness (9px of 18px) with its gold tooled line (3px in) and stitching (5px in); the side
  that tucks under the cover stays open; active tab parchment-light; red and gold states unchanged. Paddings shrink
  by the band, so the tabs keep their outer size (block "owner's tab look" at the end of `demo.css`).
- Book change: whenever the book changes; its own "Book cover" setting; at most 10 s by default, a parameter;
  in-app navigation to the Home (Leave, Back to home, fatal error, brand) instead of a reload; the first-load
  opening kept; navigation during an animation waits.
- Start match: "Success! You are human." shows only after the check passed on this visit and leaves after 4 s, as
  on the Home.

- Desktop: every tab on the right side, all the same width; the home tab at the bottom, the deck pile just above it
  and under every tab (the home tab in front of its lowest card).
- Tablet: tabs on top, as today.
- Desktop: the right column kept on the Home too.
- Phone: icon-only tabs on the book's top edge (outer size of `padding: 12px 16px`; less side padding under 360px
  wide, so the five tabs stay on the book), the home tab hanging under its bottom-right corner (kept there, now light
  and clearly visible); every page change goes back to the very top.


# Version Control
- **Document Version**: 1.15.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.15.0 | Bookmarks moved to the book's side and edges | November 26, 2026 |

- **Last Updated**: November 26, 2026 (v1.15.0)
