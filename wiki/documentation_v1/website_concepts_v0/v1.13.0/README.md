# v1.13.0 — Card animation concepts

Standalone prototype of three animations for the game book of `code/frontend/react-game`,
on desktop and mobile. No build and no library: open `index.html` in a browser (Font Awesome
and Google Fonts load from their CDNs, as on the site). Look and tokens are copied from
`src/styles/main.css` and `variables.css`.

| File | Content |
|---|---|
| `index.html` | Demo control panel, section tabs and the two-page book |
| `demo.css` | Book / card look, the three effects, mobile layout, reduced motion |
| `demo.js` | A tiny 8-page story, 5 sections, rendering and the effect sequence |

## The three effects

Playing a card runs them in order: **2 → 3 → 1**. Opening a tab runs **3 → 1**.

1. **Deal** — the cards of a page fly from the deck (bottom-right of the right page) to their
   slot, one after the other (`--i` × step delay, at most 8 steps). Option *face-down*: they
   travel showing the card back and flip face-up when they land. A card is dealt when it
   enters the screen: below the fold it waits on the deck.
2. **Play** — the chosen card lifts, pulses gold with a light sweep while the server answers
   (the *Server* slider simulates the latency), the other cards dim and fall away, then a copy
   of the card flies in an arc into the left page picture (on mobile: to the top of the screen).
3. **Page turn** — on every change of spread: location, tab (Board, Info, Backpack, Map,
   Missions), item used, map travel. *full flip*: a sheet hinged on the spine, old page in
   front, new page on its back. A tab on the right of the open one, or a "Go", turns forward;
   a tab on the left, a "back" card or a used item turns back. *simple*: the new right page
   swings in from the spine and the left one fades.

## Mobile

Same query as `mobileView.js` (`MOBILE_MQ`: ≤ 767 px, or a phone turned sideways).

- One page only: the full flip becomes a sheet hinged on the page's **left edge**. Only the
  part on screen is copied on a fixed sheet, so a tall page still turns well; the jump back to
  the top of the new page happens under the sheet, unseen. Back turns bring the new page in
  from the left over the old one.
- The stage is the scroller (as `.book-overlay` on the site); scrolling is locked while a page
  turns.
- Tabs are sticky pills on top (labels hidden under 480 px except the active one); the deck
  is sticky at the bottom of the screen while the cards are in view (`overflow: clip` on the
  pages, as `hidden` would stop `position: sticky`).
- Hover effects only under `(hover: hover)`: on touch a tapped card would stay lifted.
- Phone sideways: three card columns and a shorter picture.

## Panel and planned env variables

| Panel control | Planned env variable | Default |
|---|---|---|
| 1 Deal | `VITE_ANIM_DEAL` | `true` |
| face-down | `VITE_ANIM_DEAL_FACEDOWN` | `true` |
| 2 Play | `VITE_ANIM_PLAY` | `true` |
| 3 Page turn | `VITE_ANIM_TURN` | `true` |
| full flip / simple | `VITE_ANIM_TURN_MODE` | `full` |
| Speed 1× / ½× / ¼× | `VITE_ANIM_SPEED` (durations divided by it) | `0.25` |

*Server* (latency), *reduced motion* (same as the OS setting: every effect is skipped),
*Re-deal* and *Restart* exist only in the demo. Story path: *Search the well* (gets the
key) → back → *Stone Tower* unlocks; Backpack → *Bread* → back to the board.

## Porting notes (React game)

- **Card** — the face-down deal needs `Card.jsx` split in a front and a back face: today
  `.pg-card` has `overflow: hidden`, which flattens 3D. Never animate `opacity` on a
  3D-flipping card (Chromium flattens it and the back face disappears).
- **Deal** — one `<DealtList>` around every `.selection-list`; an IntersectionObserver
  (root `.book-overlay` on mobile) deals the visible cards; `animationend` plus a timeout
  fallback (jsdom fires no `animationend`).
- **Play** — `CardButtons.jsx` already knows when an action is in flight (`actionStarted`);
  lift it to the list so siblings get `is-dimmed`. The flight and the fall must end before
  `useGameplayResults` swaps the right page for `LoadingCard`.
- **Page turn** — `Book.jsx` gets a page key and a direction; the board is rendered twice
  (book + hidden mobile stack): animate the visible copy only.
- **Tests** — guard `matchMedia`, `Element.animate`, `IntersectionObserver` (absent in jsdom).
  The Robot suites are API-only (RequestsLibrary): no impact.
