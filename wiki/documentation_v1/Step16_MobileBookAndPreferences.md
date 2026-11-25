# Step 16 — Mobile book and preferences

**Status: analysed (November 24, 2026), version 1.13.0. No open doubts: ready for development.**
Roadmap line: *the same book on phones, and the player's own settings* ([Roadmap](./Roadmap.md) step 16).
Prototype: [`website_concepts_v0/v1.13.0/`](./website_concepts_v0/v1.13.0/README.md) (mobile part of `demo.js` / `demo.css`).
Sibling steps: `Step13_BookLayoutWithoutModals.md` (no modals, routes, page scroller, footer),
`Step14_HomeBookAndCardFaces.md` (card faces, animation config, deal, columns parameter),
`Step15_PlayAndPageTurn.md` (play, desktop turn, (i) fade), and step 17 in the roadmap (high contrast, profile reduced motion).

## 1. Scope

Goal: phones get the same book as the desktop, as a **vertical book**. Players get a **preferences card** on the player page. Only react-game changes.

**In**
- Analysis of the mobile vertical book and its layout for every page: game, Home, story set-up, start match, end game, player page, policy chapter.
- The vertical version of step 13's book graphics: a book bound on its left edge.
- The mobile page turn (a single page hinged on its left edge), added to the turn mechanism of step 15.
- Sticky tabs (step 13's home tab pinned at the end of the row while the others scroll sideways) and sticky deck on mobile (step 14's in-page deck; its table pile is hidden on phones), deal on scroll, landscape phone layout.
- The Card special components stay on the phone, with today's picture, text and badge sizes (step 13, 6.3.16).
- Touch guards (`(hover: hover)`, `:active`) and a light vibration on Android when a card is played.
- The preferences module: env defaults, then the player's localStorage choices, then the OS `prefers-reduced-motion`, which always wins.
- The preferences card and the editing card on the player page. The number of card columns can be changed.
- One row in the cookie banner's "strictly necessary" table, plus a sentence in the privacy and cookies policies (EN/IT).
- EN/IT i18n keys and unit tests.

**Out**
- Modal removal, routes `/player` and `/story/:storyId`, moving the scroll to the page, the footer, the home tab, the drawn tooltip and the desktop book graphics (step 13).
- Card faces, env parsing of the `VITE_ANIM_*` keys (and their alpha website workflow variables), the desktop deal and table deck pile, the default columns parameter and the Home rendered once on mobile (step 14).
- Play glow and flight, the desktop spine flip, the (i) fade and where previews open on mobile (step 15).
- High contrast and the reduced-motion option in the profile (step 17). Profile sync of the new keys (owner: localStorage only).

**Analysis of the mobile layout.** Today a phone hides `.book-wrapper` and shows a second copy of each page, `.book-mobile-layout` (`GameBookMobile`, `StartBookMobile`, plus inline stacks in `PolicyBook`, `StartMatchFlow` and `EndGameBook`). The same React elements are rendered twice, so every component mounts twice. Today this means two `UserMatchesList` / `MatchLogCard` fetches, and two Turnstile widgets on the start-match page. Options:

| Option | What it is | Verdict |
|---|---|---|
| A. Keep the card stack | No book on phones (today) | Rejected: the owner wants the concept's book |
| B. **One tree, vertical book** | The same `Book`; under `MOBILE_MQ` the left page sits on top and the right page below it, no spine, and the document scrolls | **Chosen**: same as the prototype, removes the double render, and lets steps 14 and 15 animate one copy only |
| C. Two trees, stack styled as a book | Keeps `.book-mobile-layout`, adds book chrome | Keeps the double mount and the "animate the visible copy" problem |
| D. One page at a time | Left or right page, switched with a toggle | Hides the location while the player chooses; not like the concept |

**Development order (owner decision).** The step is built in two parts, in this order within the book chain:
1. Step 13.
2. **Part A of this step, developed early: the one-tree switch** (section 6.3 and its tests in 7.1). Each page is rendered once and the two pages are stacked by CSS under `MOBILE_MQ`; `GameBookMobile`, `StartBookMobile` and the other mobile stacks are deleted.
3. Steps 14 and 15, which then animate one copy only.
4. **Part B, the rest of this step**: sections 6.4–6.10 (pills, deck, mobile turn, touch, preferences, cookie and policy texts).

## 2. Endpoint APIs

None. Java, Python and AWS are untouched, and no OpenAPI file changes. The language row keeps the existing `PATCH /api/auth/me` for Google users (step 7). The new keys never reach the backend.

## 3. DTOs and Domain Models

There is no backend model. Two front-end shapes:

- **Stored preferences**: localStorage key `pathsgames.preferences`, holding one JSON object. Every field is optional, and a missing field means "use the default". Unknown or invalid values are dropped when the object is read.
  `{ v: 1, theme: 'medieval'|'parchment', size: 'small'|'normal'|'large', columns: 'auto'|1|2|3|4, anim: { deal, dealFaceDown, play, turn: boolean, turnMode: 'full'|'simple', speed: 0.25|0.5|1, deck: 'under'|'over' }, vibration: boolean }`
- **Effective settings** (computed, never stored):
  - For each animation flag, the value is `reducedMotion ? false : (pref ?? envDefault)`. Speed, turn mode and deck placement are `pref ?? envDefault`.
  - `vibration` is on only when the pref is not `false` and `navigator.vibrate` exists; reduced motion does not affect it.
  - Theme, size and columns use the pref when set, otherwise `medieval`, `normal` and `auto`. Columns are then clamped to the current layout (6.8).
- Unchanged: `pathsgames.lang` (also stored in the profile for Google users) and `pathsgames.highContrast` (step 17). `devicePreferencesBody()` must not include the new keys.

## 4. Roles and Authentication

Guests and Google users behave the same: the new preferences belong to the device, not to the account. Logout and account deletion keep them, as they keep `pathsgames.lang` today (they hold no personal data). No new auth, roles or rate limits.

## 5. Database Tables

None: no Flyway migration (SQLite, PostgreSQL), no DynamoDB item.

## 6. Components

### 6.1 Java, Python, AWS, react-admin, OpenAPI
No change.

### 6.2 Robot
No change: the suites are API-only (RequestsLibrary, no browser library in `code/tests/robot`), and this step adds no endpoint. Mobile layout and touch are checked by hand (section 7.2).

### 6.3 react-game — vertical book (one tree), part A: developed early, right after step 13
- `components/book/Book.jsx`: remove the `mobile` prop. Under `MOBILE_MQ`:
  - `.book-wrapper` becomes `flex-direction: column; height: auto`, and `.book-spine` is hidden.
  - `.book-page` gets `width: 100%; height: auto; overflow: visible; overflow: clip`. `clip` does not stop `position: sticky`; `visible` is the fallback for old Safari.
  - `.page-inner`, `.book-page-content`, `.config-view-wrap`, `.config-cards-area`, `.selection-scroll`, `.matches-list-wrap` and `.start-match-cards` get `height: auto; overflow: visible`.
  - Left page corners are rounded on top, right page corners at the bottom.
  - **Book graphics, vertical** (step 13's `book.css`, same tokens): the spine, its binding thread and the dark gold headbands run along the left edge (headbands at its top and bottom); the leather cover, gold frame and stitching wrap the whole stack; dark gold corners on the four outer corners; stacked page edges on the right side; paper grain, gutter shading along the left edge, corner flourishes; the ribbon under the bottom edge.
- Delete `GameBookMobile.jsx`, `StartBookMobile.jsx` and the inline `.book-mobile-layout` stacks in `PolicyBook`, `StartMatchFlow`, `EndGameBook` and the player page. In `styles/mobile.css`, rules written for `.book-mobile-layout …` now apply to `.book-wrapper …` under `MOBILE_MQ`. Dead `.book-mobile-*` rules go.
- Home tab: step 13's mobile copy at the top of `.book-stage` goes. Until part B, the right bookmarks row (the home tab only) shows right-aligned above the left page; the left row stays hidden.
- **Card special components stay** (step 13, 6.3.16): no retargeted rule and no deleted mobile stack may hide or drop any of them on the phone (page arrows, badges and overlays, `TipNote`, `extraContent`, `CardButtons` with select, spinner, `actionsList` and locked label, `CardCreditsBar`, "view original" link, `gc-type-badge`, `childrenIntoImage`). Their tests and test ids stay.
- **Sizes stay** (step 13, 6.3.16): the page card picture keeps `height: 33svh` (today's `.book-mobile-layout` rule, retargeted to `.book-wrapper` under `MOBILE_MQ`), never shrunk for the text, with the description flowing below it; the mobile text sizes of `mobile.css` stay (little card titles `1rem`, footer buttons `1.125rem`, `extraContent` `1rem`, stat badges `0.72rem`).
- `hideWhereClass` keeps its contract: `.hide-in-mobile` is hidden under `MOBILE_MQ`, and `.hide-in-book` is hidden under its negation (nested `@media not all and (…)`).
- **Sticky fix**: `html, body { overflow-x: hidden }` and `.game-page-wrap { overflow-x: hidden }` in `mobile.css` become `overflow-x: clip`. `hidden` turns body into a scroll box, and that silently stops every `position: sticky`, the step 13 navbar included. Step 13 ships the fix; part A only checks that it holds in the one tree.
- Previews on mobile follow step 15: the left previews of story set-up, start match and game open in the top card (the left page); the other game (i) previews stay in place with the same fade. With one tree, the start-match page mounts one Turnstile widget instead of two.

| Page | Top (left page) | Below (right page) | Mobile notes |
|---|---|---|---|
| Game `/play/:storyId` | Location picture (33svh) and description, or the (i) / item / map / mission page | Action cards, lists, map node, loading page | Sticky tabs, sticky deck, turn on the left edge, vibration on play |
| Home `/` | Step 14 intro card: picture, title, tutorial button, anti-bot check | All stories, in columns | Step 14 already renders the Home once on mobile; deal on scroll matters most here (long list) |
| Story set-up `/story/:storyId` | Story card or preview, with its back arrow | Loadout (`ConfigView`), `OptionPicker`, single-option detail | The extra `.book-mobile-back` button and the hero-card gold CTA go: the left page carries the back arrow, as on desktop |
| Start match `/start-match/:storyId` | Story card, preview or Google login page | Phase cards, anti-bot, status | One Turnstile instance |
| End game | Story card | End card and the home button | `.end-game-wrapper .book-page-right { order: -1 }` keeps the end card on top, as today; the missions branch keeps the normal order |
| Player `/player` | User card: name, avatar, account panel (no language buttons, 6.9) | Anti-bot, then the grid: stats card, **preferences card**, matches; or the missions or the editing card | Section 6.9 |
| Policy chapter (step 13) | Manifesto card | Policy text, roadmap or credits | Tall pages: the visible-slice turn handles them |
| Loading / error (step 13) | Unchanged | `LoadingCard` / `ErrorCard` | Below the left page, reached by the landing rule (6.5) |

### 6.4 react-game — sticky tabs and sticky deck
- Owner note (November 25, 2026): seen in the step 13 test, phones have no bookmarks today. The pills must reuse the existing modules (`BookBookmarks`, same items, icons and badges as desktop: position, information, backpack, map, missions, home tab at the end); to be reviewed in the analysis and tested with the step.
- The bookmarks (`BookBookmarks`, inside `.book-wrapper`) become visible on mobile. They are one sticky row of pills (`position: sticky; top: var(--navbar-h)`, opaque background), with icons and badges, on **one line that scrolls sideways** (`flex-wrap: nowrap; overflow-x: auto`, hidden scrollbar, pills `flex-shrink: 0`). Only the active pill shows its label. On pages without game tabs the row holds the home tab alone; the Home has none.
- The left and right rows merge: `Book` wraps the two `BookBookmarks` in one `.book-bookmarks-row` (`display: contents` on desktop, so today's positions stay; the sticky scrolling row on mobile). The right row holds only step 13's home tab, which **ends the row** (home icon only).
- **Home tab pinned** (owner decision): the right row is `position: sticky; right: 0` inside the scrolling row (row padding compensated), with the row's background and `margin-left: auto`. The other tabs scroll under it, so it stays visible on narrow phones.
- A long press on a pill or on the home tab shows step 13's drawn tooltip and never opens it; a tap opens it (step 13, 6.3.14). The label stays the `aria-label`.
- The sticky pills replace the mobile status card: the code default of `SHOW_MOBILE_CARD_CHARACTERISTICS` in `constants/features.js` becomes `false` (no env file sets it; `VITE_SHOW_MOBILE_CARD_CHARACTERISTICS=true` brings the card back).
- Deck (step 14's page deck, `variant="page"`, hidden on desktop): `position: sticky; bottom: 12px; margin-left: auto` at the end of the right page, `pointer-events: none`. It rides the bottom of the screen while the right page is on screen. Step 14's table pile stays hidden under `MOBILE_MQ` (phones and phones sideways: no room beside the book), so the deal takes the page deck as origin and reads its rectangle at every batch, because it moves while sticky.

### 6.5 react-game — mobile page turn
- New `components/book/mobileTurn.js` (next to `Book.jsx`), plugged in as the mobile strategy of step 15's turn. Step 16 needs two hooks from step 15: one **before the new page commits** (snapshot) and one **after it** (run).
  - `visibleSlice()`: the book's rectangle cut to the viewport, below the sticky navbar and pills.
  - `snapshot(slice)`: `cloneNode(true)` of the book on a `position: fixed` sheet, portaled to `document.body` (away from transformed ancestors). The copy loses `id`, `data-testid`, `data-tip` and `iframe` elements: Turnstile and Google iframes would load again, so they become empty boxes of the same size. It also gets `aria-hidden` and `inert`.
  - Forward: snapshot the old slice, commit the new page, jump the scroll **instantly** under the sheet, then rotate the sheet `0 → −90deg` on its left edge, with shade and cast shadow.
  - Back: keep a still snapshot of the old page, commit, jump, then bring a snapshot of the new slice in from `−90deg → 0`.
- Landing of the jump: the top of the page when the left page changed, otherwise the top of the right page (today the backpack, missions, map node and right-page previews already land there).
- While the sheet turns, scrolling is locked: `overflow: hidden` on the root, plus a transparent fixed blocker with `touch-action: none` for iOS. The input is busy (step 15).
- `turnMode: 'simple'` uses step 15's simple swing on mobile too, with the same jump. With turns off or reduced motion, there is no sheet; the jump is instant (`behavior: 'auto'`, not `smooth`). `scrollBookToTop` / `scrollMobileIntoView` (as updated in step 13) take that behaviour.
- The play flight on mobile (step 15) targets the top of `visibleSlice()`. This step exports the helper.
- jsdom (no `Element.animate`): the commit and the jump run at once, so tests take the plain path.

### 6.6 react-game — deal on scroll, landscape phone
- Deal on scroll: step 14's IntersectionObserver uses the page scroller (root `null`) after step 13, so it already deals cards as they enter the screen. On mobile, this step only checks two things: the deal starts after a turn ends (order 3 → 1), and the threshold is 0.2, as in the prototype.
- Phone sideways (landscape branch of `MOBILE_MQ`): the left page shows picture and description side by side (today's `:has()` rule, retargeted). The picture keeps today's sizes (6.3: `33svh` when alone, the side-by-side rule as today; not the prototype's 120 px), the pills show icons only, and the columns range 2–3 (default 3, as in the prototype).

### 6.7 react-game — touch guards and vibration
- Wrap the lift and zoom hover rules in `@media (hover: hover)`. Affected rules: `.pg-card:hover` and its image/play children, `.choice-card:hover`, `.card-big:hover`, `.config-card-cover:hover`, `.book-bookmark:hover`, `.btn-start-game:hover`, plus step 14's face rules. On touch, a tapped card would otherwise stay lifted. The `gc-type-badge` hover rule is not a lift: it stays unwrapped, so a tap still shows the type.
- Tap feedback: `:active { transform: scale(0.96) }` on `.gc-footer__btn`, `.book-bookmark`, `.lang-btn`, `.btn-start-game`, and `-webkit-tap-highlight-color: transparent` on them.
- New `utils/haptics.js`: `vibratePlay()` calls `navigator.vibrate(15)` when the effective `vibration` is on and the API exists.
  - Errors are swallowed. iOS and browsers without the API are ignored silently.
  - It is called **synchronously in the tap handler** that starts a play (step 15's play start; the user activation is required), on game-board actions only.

### 6.8 react-game — preferences module
- `auth/devicePreferences.js` gains `PREFERENCES_KEY = 'pathsgames.preferences'`, `devicePreferences()` (parse and whitelist, `{}` on any error) and `setDevicePreferences(prefs)` / `clearDevicePreferences()`. Both use try/catch: in private mode the choices last for the page only.
- New `preferences/settings.js` (pure):
  - `effectiveSettings({ prefs, animDefaults, reducedMotion })`, where `animDefaults` is the object exported by step 14's config module.
  - `THEMES = ['medieval', 'parchment']` and `SIZES = ['small', 'normal', 'large']`.
  - `COLUMN_LIMITS` per layout: desktop 2–4, medium 1–3, phone 1–2 (always 1 under 330 px), phone sideways 2–3. A stored value outside the range is clamped to it (e.g. 4 shows 2 on a phone). `auto` = step 14's default (3 desktop, 2 medium and phone, 3 phone sideways).
- New `preferences/PreferencesContext.jsx`, added to `app/providers.jsx`:
  - Holds the stored prefs, `setPreference(path, value)` (writes at once, no Save button) and `reset()` (removes the key; the language stays).
  - Listens to `matchMedia('(prefers-reduced-motion: reduce)')` changes (`addEventListener`, falling back to `addListener`; guarded when `matchMedia` is missing).
  - Listens to the `storage` event, so other open tabs follow.
  - Writes `data-pg-theme`, `data-pg-size`, `data-pg-cols` (absent when `auto`) and `data-pg-reduced` on `<html>`. It writes no inline style, so CSP has nothing to object to.
- `useAnimationSettings()` is the single accessor that steps 14 and 15 read; until part B lands it returns the env defaults (step 14's seven `VITE_ANIM_*` keys, which step 14 also adds to the alpha website workflow). Step 17 adds its profile reduced-motion flag to the same `reducedMotion` input.
- CSS (`styles/preferences.css`, imported by `main.css`):
  - Theme is the palette of the book pages and overrides only the page variables (`--book-page-background*`): `medieval` (today, default) or `parchment` (light pages from the existing `--book-page-background-old`).
  - Size is the text size: `small` / `normal` / `large` set `html { font-size: 87.5% | 100% | 112.5% }` of the browser size. Rem text scales, px card widths do not.
  - Columns set step 14's columns parameter per value, with per-layout caps in media queries. The `!important` column rules in `mobile.css` are already replaced by step 14 (`--cards-cols-wide` / `--cards-cols-narrow`): here only the player's value overrides them.
  - Reduced motion: `@media (prefers-reduced-motion: reduce), html[data-pg-reduced]` turns animations and transitions to 1 ms. If step 14 already ships this guard, it is reused, not duplicated.
- The theme attribute must leave room for step 17's high contrast, which is applied after it and wins.

### 6.9 react-game — preferences card and editing card (player page)
- `features/preferences/PreferencesCard.jsx`: a little `Card` (icon `fas fa-sliders-h`). Its badges summarise the language, theme, size, animations and columns (e.g. `IT`, `Medieval`, `M`, `On ¼×`, `Auto`), and its action is "Change" (`fa-pen`).
  - It sits in the player-page grid right after `UserStatsCard`, so `UserMatchesList` needs an `onOpenPreferences` prop.
  - Like the grid, it appears after the player page's anti-bot check.
- `features/preferences/PreferencesEditor.jsx`: a `Card variant="page"` that replaces the grid on the right page (a forward turn). Its back arrow turns back to the grid. Rows use `.lang-btn` pills as radio groups (`role="radiogroup"`, `aria-checked`, ready for step 17):
  - Language: reuses `UserLanguageSelector`, so Google users get the profile `PATCH` and guests the device. This is now its only place: the buttons leave the user card on the left page (today's `userExtra` in `GuestUserModal`, the player page after step 13).
  - Theme (Medieval / Parchment) and text size (Small / Normal / Large).
  - Columns: Auto, 1, 2, 3, 4; options outside the current layout's range are shown disabled.
  - Animations, one row per env key: Deal, Face-down deal, Play, Page turn (on/off each), Turn style (full / simple), Speed (¼× / ½× / 1×), Deck (under / over the book: step 14's desktop pile, `VITE_ANIM_DECK`; phones have no pile, so there it changes nothing). Under reduced motion these rows are disabled and a note says the device asks for reduced motion.
  - Vibration (on/off, default on, not tied to reduced motion): shown only where `navigator.vibrate` exists.
  - "Back to defaults" button.
- Every change applies live; the left page (user card) stays.

### 6.10 react-game — cookie banner, policies, i18n
- `consent/cookieConsent.js`: one new "strictly necessary" row in EN and IT:
  - EN: `pathsgames.preferences (browser storage)`, "Remembers your display choices: theme, text size, card columns, animations, vibration", "Persistent (until cleared)".
  - IT: `pathsgames.preferences (memoria del browser)`, with the matching text.
  - `REVISION` stays 2, so the banner does not reappear.
- Policy texts live in `i18n/en.json` and `it.json` (`data/policies.json` only maps section keys):
  - Add one sentence to `modals.privacy.dataBody`: display preferences stay in the browser and are never sent to our servers.
  - Add the key to the browser-storage list in `modals.cookies.necessaryBody`.
  - Set both `updated` lines to the release month. This is not a material change: no re-consent.
- New `preferences.*` keys in EN and IT: title, change, intro, the row names, the theme, size and speed names, full/simple, on/off, deck under/over, the reduced-motion note, back to defaults and the badge labels. They sit in one top-level namespace so step 17's `react-i18next` move is a rename only.

## 7. Tests

### 7.1 Unit tests (Vitest, coverage > 96% of new code)
- `devicePreferences`:
  - read, write and clear of the new key; broken JSON; unknown values dropped (an `anim.deck` other than `under` / `over` included); storage exceptions.
  - `devicePreferencesBody()` still holds language and high contrast only.
- `settings`: the merge (pref over env, reduced motion wins, deck placement and vibration untouched by it); column limits and clamping per layout, `auto` per layout; theme and size lists and defaults.
- `PreferencesContext`:
  - writes the `<html>` data attributes; updates on reduced-motion change, with both listener APIs and with no `matchMedia`;
  - follows the `storage` event; `reset()`.
- `PreferencesCard` / `PreferencesEditor`:
  - badges, open and back, every row writes;
  - language through `savePreferences` (Google) and `setLang` (guest); the user card no longer shows the language buttons (player-page tests updated);
  - seven animation rows (Deck under / over included) plus vibration; animation rows disabled under reduced motion, vibration not; vibration row hidden without `navigator.vibrate`; column options outside the layout disabled.
- `features.test.js`: the default of `SHOW_MOBILE_CARD_CHARACTERISTICS` is now `false`.
- `haptics`: no API means a no-op; with the API it calls `vibrate(15)` once; the pref set to off; a throwing API.
- `mobileTurn`:
  - `visibleSlice` maths with mocked rectangles; the snapshot strips `id`, `data-testid` and `iframe`;
  - forward and back with a mocked `Element.animate` (layers added and removed, scroll locked and restored); the plain path in jsdom;
  - landing: page top when the left page changed, right page top otherwise; `data-tip` stripped from the snapshot.
- One-tree books (part A, developed with 6.3): tests of `GameBook`, the player page, the story set-up, `StartMatchFlow` (one Turnstile), `EndGameBook` and `PolicyBook` are rewritten without `.book-mobile-layout`. `GameBookMobile.test.jsx`, `StartBookMobile.test.jsx` and `GuestUserModalMobile.test.jsx` are removed or rewritten. `Book.test.jsx`: one home tab (no mobile copy), last of the merged row, both rows inside one `.book-bookmarks-row`. The Card suites (`Card`, `CardVariants`, `CardButtons`, `CardCreditsBar`, `BonusBadgeList`) stay green with every test id.
- `cookieConsent.test.js`: the new key in both languages, `REVISION` still 2. `policyPages.test.js` stays green. EN/IT key parity of `preferences.*`.

### 7.2 Robot and manual checks
- Robot: no new suite, no change (API-only).
- Manual check by the owner on Android Chrome and iOS Safari, portrait and landscape:
  - sticky navbar, bookmark pills with the same items, icons and badges as desktop (home tab last, still visible while the row scrolls sideways on a narrow phone) and deck (the in-page one; no table pile, also sideways); the vertical book graphics; a turn on a tall page; deal on scroll;
  - page pictures at `33svh` and card texts as big as today (6.3);
  - on desktop, the Deck row moves step 14's pile under or over the book's cover at once;
  - a long press on a pill and on the home tab shows the tooltip and opens nothing; a tap opens the tab;
  - no stuck hover after a tap; vibration on Android only;
  - preferences survive a reload; reduced motion switched on in the OS.

## 8. Doubts

No open doubts. The owner accepted all seven recommendations (development order, status card, landing, theme and size, animation rows, columns, language buttons); they are recorded in sections 1, 3 and 6. Later decisions (home tab pinned at the end of the row, long-press tooltip on the pills, vertical book graphics, card components and sizes kept, no table pile on phones, Deck row) are in 3, 6.3, 6.4 and 6.9.

# Version Control
- **Document Version**: 1.13.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Phone book, preferences, deck setting and bookmark note | November 24, 2026 |

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
