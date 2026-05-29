# Step 20 — Website Styles: React-Game Frontend Design System

> **Source files**: `code/frontend/react-game/src/styles/`  
> — `variables.css` (design tokens), `main.css` (components), `mobile.css` (responsive), `abbrev.css` (utility shortcuts)  
> **Stack**: Tailwind CSS v3 + custom CSS properties (CSS variables)

---

## 1. Color Palette

All colors are defined as CSS custom properties in `variables.css` and consumed via `var(--token)` throughout the codebase.

### Parchment (light warm tones — text backgrounds, page fills)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-parchment` | `#e8d5b0` | Primary text color (`--text-primary`) |
| `--color-parchment-light` | `#f2e6c8` | Book page description background |
| `--color-parchment-medium` | `#f5e9c2` | Old book page background (legacy) |
| `--color-parchment-dark` | `#c9b48a` | Secondary text, card descriptions (`--text-secondary` area) |

### Brown (structural — dark backgrounds, navbars, cards)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-brown-deep` | `#1a0a02` | Page background, darkest container fill |
| `--color-brown-dark` | `#2e1508` | Card body background, footer |
| `--color-brown-mid` | `#5c3317` | Navbar gradient, stat badges, buttons |
| `--color-brown-warm` | `#7a4520` | Card borders, choice-card base |
| `--color-brown-light` | `#a0622e` | Footer gradient mid-point |
| `--color-brown-tan` | `#c08040` | Book page right-side gradient end |
| `--color-brown-super-tan` | `#d9a060` | Book page gradient body |
| `--color-brown-extra-tan` | `#e0b080` | Book page left-side gradient start |

### Gold (accent — borders, titles, badges, CTAs)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-gold` | `#c8960a` | Borders, badges, checkbox accent |
| `--color-gold-light` | `#e8b830` | Titles, navbar brand, icon color |
| `--color-gold-shine` | `#ffd700` | Selected card glow / highlight |
| `--color-gold-dark` | `#9a6f08` | Standard border color everywhere |
| `--color-gold-deep` | `#7a4e00` | Config titles, selection titles |
| `--color-gold-super-deep` | `#5c3700` | Muted gold text, section titles |

### Semantic / Utility

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-ink` | `#1a0f06` | Near-black for text on light backgrounds |
| `--color-ash` | `#8b7355` | Muted text, disabled labels |
| `--color-stone` | `#6b5c4a` | Tertiary text |
| `--color-ember` | `#d44a0a` | Danger/close button hover |
| `--status-online` | `#28a745` | Server status indicator (green) |
| `--status-offline` | `#dc3545` | Server status indicator (red) |
| `--status-loading` | `#ffc107` | Server status indicator (yellow) |

### Semantic Theme Tokens

| Token | Resolves to |
|-------|-------------|
| `--bg-page` | `--color-brown-deep` |
| `--bg-card` | `#2e1a0e` |
| `--text-primary` | `--color-parchment` |
| `--text-secondary` | `#c0a070` |
| `--text-muted` | `--color-ash` |

---

## 2. Backgrounds & Gradients

### Page & Global

```css
html, body {
  background-color: var(--color-brown-deep);  /* solid #1a0a02 */
}
```

### Named Gradient Tokens

| Token | Direction | Usage |
|-------|-----------|-------|
| `--navbar-bg` | `120deg brown-deep → brown-mid` | Sticky navigation bar |
| `--footer-background` | `180deg transparent → brown-deep` | Footer section (fallback; overridden in component) |
| `--book-page-background` | `90deg extra-tan → super-tan → tan` | Left book page |
| `--book-page-background-right` | `270deg extra-tan → super-tan → tan` | Right book page |
| `--card-body-background` | `135deg brown-deep → brown-dark` | Card body panels |
| `--card-header-background` | `radial ellipse brown-warm → brown-deep` | Modal headers |
| `--card-title-background` | `120deg brown-mid → brown-deep` | Title bars in cards |

### Component-specific Gradients (inline in main.css)

| Component | Gradient |
|-----------|----------|
| Hero overlay | `to bottom: #0a0400 25% → brown-deep 100%` |
| Story card body | `transparent → rgba(26,10,2,0.92) 40%` |
| Book spine | `180deg brown-dark → brown-mid → brown-dark` |
| Footer (actual) | `135deg brown-mid → brown-dark` |
| Config card cover footer | `transparent → rgba(10,4,0,0.88) 40%` |
| Btn-start-game | `180deg gold-light → gold` |
| Btn-action | `180deg gold-light → gold` |
| GC footer | `180deg brown-dark → brown-deep` |
| GC footer button | `180deg brown-mid → brown-dark` |

---

## 3. Typography

### Font Families

| Token | Stack | Usage |
|-------|-------|-------|
| `--font-display` | `'Cinzel Decorative', 'Trajan Pro', serif` | Brand name, page titles, hero titles |
| `--font-heading` | `'Cinzel', 'Palatino Linotype', serif` | Section labels, card titles, buttons |
| `--font-body` | `'Crimson Text', 'Georgia', serif` | Body text, descriptions, base |

### Text Sizes (key classes)

| Class / Element | Size | Notes |
|----------------|------|-------|
| `.navbar-brand-pg` | `clamp(1rem, 2.5vw, 2rem)` | Responsive brand name |
| `.hero-title` | `clamp(1.6rem, 4vw, 3rem)` | Full-width hero banner |
| `.book-page-title` | `2rem` | Book chapter title |
| `.book-page-desc` | `1.5rem` | Main game narrative text |
| `.config-title` | `2rem` | Config page title |
| `.selection-title` | `2.0rem` | Selection screen title |
| `.gc-title__text` | `clamp(0.65rem, 1.5vw, 0.9rem)` | Game card title bar |
| `.pg-card__title` | `clamp(0.62rem, 1.6vw, 1rem)` | Card overlay title |
| `.stat-badge` | `0.8rem` | Player stats bar |
| `.section-label` | `1rem` | Catalog section label |

---

## 4. Borders

### Border Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--book-border` | `0.5rem solid var(--color-brown-warm)` | Book page outer frame |

### Common Border Patterns

| Pattern | CSS | Where |
|---------|-----|-------|
| Standard card border | `2px solid var(--color-gold-dark)` | `.pg-card`, `.book-page-content`, `.book-mobile-story-card` |
| Navbar bottom | `2px solid var(--color-gold-dark)` | `.navbar-medieval` |
| Footer top | `2px solid var(--color-gold)` | `.medieval-footer` |
| Modal content | `2px solid var(--color-gold-dark)` | `.modal-content` |
| Section label left bar | `3px solid var(--color-gold)` | `.section-label` |
| Stat badge | `1px solid var(--color-gold-dark)` | `.stat-badge` |
| Page footer divider | `1px solid var(--color-brown-mid)` | `.page-footer`, `.book-page-footer` |
| Hover: card selected | `var(--color-gold-shine)` | `.config-card-selected`, `.choice-card.selected-card` |
| Page corner ornaments | `2px solid var(--color-gold-dark)` | `.page-corner-*` (opacity 0.5) |

---

## 5. Border Radius (Rounded Corners)

| Value | Where used |
|-------|-----------|
| `50%` | Circular buttons: `.book-close-btn`, `.nav-user-btn` (20px), `.card-info-btn`, `.gc-title__btn`, `.gc-actions__info`, `.book-page-tts-btn`, `.card-preview-close`, `.card-magnify-btn` |
| `10px` | Cards: `.pg-card`, `.book-page-img` (shared), `.credits-card`, `.book-mobile-story-card`, `.match-info-popover` |
| `12px` | Book pages: `.book-page-left`, `.book-page-right`, `.book-mobile-config-card`, `.book-mobile-footer`; mobile game book corners |
| `8px` | Title bars: `.gc-title`, `.gc-credits`, `.book-page-title`, `.config-cover-footer`, `.choice-card-img-wrap` |
| `6px` | Toasts, footers: `.navbar-toast`, `.footer-server-row`, `.btn-start-game`, `.choice-card-img-wrap` (6px top) |
| `4px` | Buttons: `.btn-back`, `.gc-footer__btn`, `.config-change-btn`, `.lang-btn`, `.credits-view-btn`, `.card-big__btn`, `.config-coming-soon-btn`, `.modal-custom-close`, `.modal-close-btn`, `.btn-action`, `.game-card-img`, `.choice-select-btn` |
| `3px` | Small badges: `.pg-card__badge`, `.story-card-badge`, `.config-cover-badge`, `.bonus-badge`, `.credits-view-btn`, `.book-spine`, `.scrollbar-thumb` |
| `20px` | Pill buttons: `.nav-user-btn`, `.stat-badge` |
| `0` | Game card image (`.gc-img`), book page image (`.book-page-img` inside wrapper) |

---

## 6. Buttons

### Primary CTA — Gold gradient

Used for the main game-start actions.

```css
/* .btn-start-game */
background: linear-gradient(180deg, var(--color-gold-light) 0%, var(--color-gold) 100%);
color: var(--color-brown-deep);
font-family: var(--font-heading);
font-weight: 700;
font-size: 1.2rem;
padding: 9px 20px;
border: 2px solid var(--color-gold-dark);
border-radius: 6px;
/* hover: filter brightness(1.1) + translateY(-1px) */
/* disabled: opacity 0.4 */
```

Same visual pattern: `.btn-action`, `.modal-close-btn`.

### Secondary — Transparent with gold border

```css
/* .btn-secondary-pg, .btn-back, .modal-custom-close */
background: transparent;
border: 1px solid var(--color-gold-dark);
color: var(--color-gold-light);    /* or gold-super-deep */
border-radius: 4px;
font-family: var(--font-heading);
/* hover: background rgba(200,150,10,0.15) */
```

### Game Card Footer Button (`.gc-footer__btn`)

```css
background: linear-gradient(180deg, var(--color-brown-mid), var(--color-brown-dark));
border: 1px solid var(--color-gold-dark);
color: var(--color-gold-light);
border-radius: 4px;
/* hover: warm gradient + gold border + gold-shine text */
/* selected: semi-transparent gold background + gold-shine border */
```

Same pattern: `.config-change-btn`, `.lang-btn`, `.card-big__btn`.

### Close Button — Circular

```css
/* .book-close-btn, .card-preview-close */
width: 36px; height: 36px;
border-radius: 50%;
background: var(--color-brown-mid);
border: 2px solid var(--color-gold-dark);
color: var(--color-gold-light);
/* hover: background ember (#d44a0a), color white */
```

### Icon/Info Button — Circular small

```css
/* .card-info-btn, .gc-title__btn */
border-radius: 50%;
background: rgba(0,0,0,0.55);
border: 1px solid var(--color-gold-dark);
color: var(--color-gold-light);
width: 22px–26px; height: 22px–26px;
/* hover: rgba(200,150,10,0.35-0.45) */
```

### Navbar User Button

```css
/* .nav-user-btn */
background: transparent;
border: 1px solid var(--color-gold-dark);
color: var(--color-gold-light);
border-radius: 20px;   /* pill shape */
padding: 5px 14px;
/* hover: rgba(200,150,10,0.15) */
```

### Choice Select Button

```css
/* .choice-select-btn */
background: var(--color-gold-dark);
color: var(--color-brown-deep);
border: none;
border-radius: 4px;
font-weight: 700;
/* hover: background gold-light */
```

---

## 7. Cards (`.pg-card` System)

All cards share a **2:3 aspect ratio** and the same base class `.pg-card`.

### Sizes

| Class | Width | Description |
|-------|-------|-------------|
| `.pg-card--small` | `100px` | Tiny card (compact lists) |
| `.pg-card--medium` | `150px` (130px on mobile) | Game selection row cards |
| `.pg-card--home` | `225px` (180px on mobile) | Story catalog cards |
| `.pg-card--large` | `100%` | Location card (fills container) |
| `.pg-card--grid` | `flex:1` | Config selection grid |

### Base Style

```css
border-radius: 10px;
border: 2px solid var(--color-gold-dark);
background: linear-gradient(145deg, brown-warm → brown-dark);
overflow: hidden;
transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s;
```

### Hover Effect

```css
transform: translateY(-3px) scale(1.03);
box-shadow: 0 10px 28px rgba(0,0,0,0.65), 0 0 14px rgba(200,150,10,0.22);
border-color: var(--color-gold);
```

### Selected State

```css
/* .config-card-selected */
border-color: var(--color-gold-shine);
box-shadow: 0 0 16px rgba(255,215,0,0.4), 0 0 6px rgba(255,215,0,0.2);
```

---

## 8. Book Layout

The game renders inside a two-page book overlay.

### Book Overlay (full-screen backdrop)

```css
position: fixed; inset: 0;
background: rgba(10,4,0,0.85);
backdrop-filter: blur(4px);
animation: fadeIn 0.4s ease;
```

### Book Wrapper

```css
width: min(94vw, 1080px);
height: min(88vh, 680px);
box-shadow: 0 24px 48px rgba(0,0,0,0.8);
animation: bookOpen 0.6s cubic-bezier(0.22, 1, 0.36, 1);
```

### Book Pages

Each page gets a parchment warm gradient:

```css
background: var(--book-page-background);
/* = linear-gradient(90deg, #e0b080 → #d9a060 80% → #c08040) */
border: 0.5rem solid var(--color-brown-warm);
```

- Left page: `border-radius: 12px 0 0 12px`
- Right page: `border-radius: 0 12px 12px 0` with mirrored gradient

A subtle **noise texture** (SVG fractalNoise, opacity 0.06) overlays each page for a paper feel.

### Book Spine

```css
width: 12px;
background: linear-gradient(180deg, brown-dark → brown-mid → brown-dark);
border-radius: 3px;
```

### Corner Ornaments (`.page-corner-*`)

Four decorative L-shaped brackets in the corners of each page, using `border-color: var(--color-gold-dark)` at 50% opacity.

---

## 9. Navbar

```css
height: 56px;
position: sticky; top: 0; z-index: 1000;
background: var(--navbar-bg);  /* 120deg brown-deep → brown-mid */
border-bottom: 2px solid var(--color-gold-dark);
box-shadow: 0 2px 12px rgba(0,0,0,0.5);
```

Brand name uses `--font-display` with `color: var(--color-gold-light)` and a gold glow `text-shadow`.  
The dice icon (🎲) animates with a bouncing keyframe (`dice-bounce`, 4s infinite).

---

## 10. Footer

```css
background: linear-gradient(135deg, brown-mid, brown-dark);
border-top: 2px solid var(--color-gold);
padding: 32px 20px 20px;
margin-top: 60px;
```

Links use `--color-parchment-dark` with `--color-gold-light` on hover.

---

## 11. Badges

### Category/Type Badge

```css
background: var(--color-gold);
color: var(--color-brown-deep);
font-size: 0.58rem;
padding: 2px 6px;
border-radius: 4px;
text-transform: uppercase;
font-weight: 700;
```

### Stat Badge (player stats bar)

```css
background: var(--color-brown-mid);
border: 1px solid var(--color-gold-dark);
color: var(--color-parchment);
padding: 3px 7px;
border-radius: 20px;  /* pill */
```

### Bonus Badge (item/effect inline)

```css
border: 1px solid var(--color-gold-dark);
border-radius: 3px;
background: var(--color-gold);
color: var(--color-brown-deep);
font-family: var(--font-heading);
text-transform: uppercase;
letter-spacing: 1px;
```

---

## 12. Modals (Bootstrap Override)

```css
.modal-content {
  background: var(--color-brown-dark) !important;
  border: 2px solid var(--color-gold-dark) !important;
  color: var(--text-primary) !important;
}
.modal-header {
  background: var(--card-header-background) !important;
  border-bottom: 1px solid var(--color-gold-dark) !important;
}
.modal-title {
  font-family: var(--font-heading) !important;
  color: var(--color-gold-light) !important;
}
```

---

## 13. Scrollbar Styling

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--color-brown-dark); }
::-webkit-scrollbar-thumb { background: var(--color-brown-mid); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--color-gold-dark); }
```

---

## 14. Animations & Transitions

| Keyframe | Duration | Usage |
|----------|----------|-------|
| `fadeIn` | 0.3–0.4s ease | Book overlay, card preview overlay, toast |
| `bookOpen` | 0.5–0.6s cubic-bezier(0.22, 1, 0.36, 1) | Book/game wrapper opening |
| `slideInRight` | 0.3s ease | Selection list, matches grid |
| `slideInLeft` | 0.3s ease | Reverse slide |
| `toastFadeOut` | 0.5s (delay 2.5s) | Navbar toast notification |
| `dice-bounce` | 4s ease-in-out infinite | Navbar dice icon |

---

## 15. Mobile Breakpoint (`≤ 767px`)

- **Book modal**: two-page desktop layout (`.book-wrapper`) is hidden; vertical `.book-mobile-layout` is shown instead.
- **Game page**: pages stack vertically; left page gets `border-radius: 12px 12px 0 0`, right gets `0 0 12px 12px`.
- **Navbar**: brand text hidden; button labels hidden (icons only).
- **Cards**: `--medium` shrinks to 130px, `--home` to 180px.
- **Hero**: height reduced to `clamp(180px, 32vw, 280px)`.
- **Touch devices**: all info/badge overlays forced visible (opacity: 1 — no hover needed).

---

## 16. Utility Abbreviations (`abbrev.css`)

Shorthand position/padding helpers used inline in JSX:

| Class | Property |
|-------|---------|
| `.top--10` / `.top-10` | `top: -10px` / `top: 10px` |
| `.left--20` / `.left-20` | `left: -20px` / `left: 20px` |
| `.right--10` / `.right-10` | `right: -10px` / `right: 10px` |
| `.padding-left-10/20/30` | `padding-left: 10/20/30px` |
| `.of-c` | `object-fit: contain` |
| `.of-f` | `object-fit: fill` |
| `.ob-c-25` … `.ob-c-99` | `object-position: center 25%` … |
| `.no-shadow` | `box-shadow: none` |
| `.height-unset` | `height: unset` |

---

## 17. CSS Variables Quick Reference

```css
/* Paste into browser DevTools to override the theme */
:root {
  --color-parchment:        #e8d5b0;
  --color-brown-deep:       #1a0a02;
  --color-gold:             #c8960a;
  --color-gold-light:       #e8b830;
  --color-gold-shine:       #ffd700;
  --color-gold-dark:        #9a6f08;
  --color-ember:            #d44a0a;
  --color-ash:              #8b7355;
  --font-display:  'Cinzel Decorative', serif;
  --font-heading:  'Cinzel', serif;
  --font-body:     'Crimson Text', serif;
}
```
