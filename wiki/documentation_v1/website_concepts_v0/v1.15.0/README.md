# v1.15.0 — Played cards on the table, phone single page (concept, second round)

Standalone prototype for `code/frontend/react-game`, built from the [v1.14.0 concept](../v1.14.0/README.md)
(bookmarks on the book's side and edges, book change between routes; that folder was named `v1.15.0` until
November 27, 2026). No build and no library: open `index.html` in a browser (Font Awesome, Google Fonts and the
Home photo load from their CDNs). Everything the v1.13.0 and v1.14.0 READMEs describe still holds, except for the
points below. Owner's requests of November 27, 2026; the work to do in react-game is in
[Step 15 §9](../../Step15_PlayAndPageTurn.md) ("Second round").

| File | Content |
|---|---|
| `index.html` | v1.14.0 page + the face-up pile `#played-pile` beside the deck |
| `demo.css` | v1.14.0 styles + the block "v1.15.0 — second round" at the end of the file |
| `demo.js` | v1.14.0 router and effects + `renderPlayed`, `placeTable`, `addPlayed`, `flightTarget`, `mobileShuffle`, zoom in `swapBook` / `mobileSwap` |

Try it: Home → a story → Start → play cards (desktop: watch the pile above the deck); open the tabs on a phone-sized
window (DevTools device mode); go back to the Home from a story page (book change). Demo speed ¼× by default.

## 1. Played-cards pile (desktop and tablet)

- **In a match only** (game page, end pages included): a second pile lies on the table **under** the face-down deck,
  **the same size** (box 160 × 210px, cards 84px wide as the deck's, same scale), **horizontally aligned** (same centre)
  and **10% of a pile's height** (21px × the scale) below it (owner, November 27); **under every tab** (z-index −1
  like the deck). Outside a match it is not there and the deck keeps its place (no jump when a match starts).
- **Bottom card: the story's card** (its picture and colours, gold frame, tilted 9°), so the pile always shows
  something, also before the first play.
- **Every play lands on it**: the played card (small card or whole reading card) flies in an arc onto the pile and
  shrinks to the pile's card size (`--mini-w: 84px`, a deck card, × the pile scale), it does not fade. Then it stays there as the
  **last played card**, on top, straight (−4°), lit with a thin gold glow; up to five played cards show under it,
  each with a small tilt.
- **Small card**: only the picture (colours and icon in the concept; the card's `urlImage` in the app), no text, no
  badges, no buttons; the title only as a hint, 0.6rem and blurred (`filter: blur(1.4px)`).
- Hover: a tooltip "Last played: <title> (N cards played)".
- **Phones**: no second pile; the played card flies into the sticky page deck at the bottom of the screen (or the
  screen's bottom-right corner when the deck is not on screen) and vanishes there.
- **Tablets**: as the desktop (owner), even if the cover hides most of the two piles there (little room beside the book).
- **After a reload**: only the story card (owner: the simplest; the played cards are kept in memory only).

## 2. Piles centred beside the book (desktop and tablet)

- Both piles are centred horizontally **halfway between the book's right edge and the screen's right edge**
  (`--table-mid` = half that room; the concept measures it in `placeTable`, the app can use a CSS `calc`).
- The face-up pile sits at the foot of the right side (`bottom: var(--home-bottom)`, 42px), since the home tab is gone;
  the deck right above it, `(210px + 21px) × scale` higher, on every page. On narrow desktops (1121–1360px) the centre falls under the tab column: the piles
  slide under the tabs, as the deck already did.
- Tablets: the same rule (owner), deck 70px from the bottom, scale 0.82; the room is small, so the piles are mostly under
  the cover. Phones: the sticky page deck.

## 3. Home bookmark

| Screen | 1.14.0 | v1.15.0 |
|---|---|---|
| Desktop (> 1120px) | Right side, at the bottom | **Removed** for now; its group (`bm-group--home`) stays in the markup, empty, for future icons |
| Tablet | Top edge, right end | Unchanged |
| Phone | Hanging under the book's bottom-right corner | **Top edge, right end** (as tablets), same tab look |

- Phone tabs: **bigger icons** (`1.45rem`; owner: `1.25rem` under 400px). To keep six tabs (five game tabs + home) on a
  360px phone the leather band of the phone tabs is 6px instead of 9px and the row starts 34px from the left edge.
- Desktop: the way home is the navbar brand (in a match it opens the close card first, as the home tab did).

## 4. Phones: one single page, cards shuffle instead of a page turn

- **Single page**: no binding on the left edge (no spine line, no gutter shade), the same cover margin on both sides,
  no seam or shadow between the two stacked pages: one parchment sheet in the leather cover, its four corner
  ornaments, the cover frame and the ribbon kept (owner: the page of a book).
- **No page turn on phones** (both turn modes): every page change (tab, play, preview list, route turn) runs
  `mobileShuffle` (owner: approved as drawn): the small cards on screen **spin** (in-plane rotation, 240°) and shrink into the sticky deck,
  one after the other (`gather` 420ms, `gatherStep` 60ms at 1×); the page card and the list heading fade out; the
  screen goes back to the very top; the new page card fades in and the new cards are **dealt from the deck**
  (step 14's deal; deal off: they fade in). Back and forward only change the spin's direction.
- A 3D flip (back face showing) was tried and dropped: a card fading out is flattened by the browser and shows its
  front mirrored.
- The book change on phones (cover over the screen) stays, with the zoom of point 5.

## 5. Book change: smaller while it slides

- Desktop: the book closes (right half over the spine), then **shrinks** to 62% where it is (`zoom`), slides out
  left small; the next closed book slides in small, stops in its place, **grows back** to full size with a light
  overshoot, then opens. The scale is centred on the spine, so the flap and the left half stay together.
- Phone: the cover closes over the screen, shrinks, slides out small, the next one slides in small, grows, opens.
- New timing `zoom` 320ms at 1×, counted inside the 10 s cap: desktop 4.04 s at 1× (was 3.4 s), 16.2 s at ¼× capped to
  10 s (factor 0.62); phone 3.08 s at 1×, 12.32 s at ¼× capped to 10 s.

## 6. Rounds three and four: piles, titles, deal flight

- **Deck during a book change**: the face-down deck stays on the table while the book closes, slides and opens; the played pile stays hidden.
- **Piles inverted**: the deck at the foot of the right side on every page (Home too), the played pile right above it, cards just touching (`--pile-gap: -44px`).
- **Readable title** on each played card: a small dark bar at the top, gold text, one line.
- **Deal flight**: the dealt card flies on a fixed copy from the table deck's top card to its slot, never clipped by the page.
- App only (not drawn): tabs shown only on an open book, and the copy following its slot while the page scrolls.

## Not drawn

- **Map centring** (desktop page turn to the map): the concept has no map; the cause and the fix are in step 15 §9.

# Version Control
- **Document Version**: 1.15.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.15.0 | Played cards pile and single phone page | November 27, 2026 |

- **Last Updated**: November 27, 2026 (v1.15.0)
