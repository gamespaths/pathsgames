# Paths Games V0 - Step 20: Game Website — First Run & Match End Flow
 

# Player-driven match completion (`PATCH /api/match/{uuidMatch}/end/{uuidEvent}`)

### Context: who today can set a match as complete

Before 0.20.1 the only ways to mark a match as terminal (`ENDED` / `GAMEOVER`)
were **admin operations**:

| Action | Endpoint | Status | Caller |
|--------|----------|--------|--------|
| Stop a match | `POST /api/admin/matches/{uuid}/stop` | `ENDED` | Admin token |
| Force any status | `PUT /api/admin/matches/{uuid}` `{"status":"GAMEOVER"}` | any | Admin token |
| Pause a match | `POST /api/admin/matches/{uuid}/pause` | `PAUSED` | Admin token |
| Resume a match | `POST /api/admin/matches/{uuid}/resume` | `RUNNING` | Admin token |

No gameplay engine existed: only admins could complete a match. 0.20.1 adds
the **first player-driven** way to complete a match.

### Contract

```
PATCH /api/match/{uuidMatch}/end/{uuidEvent}
Authorization: Bearer <player access token>

200 → { "status": "ENDED", "uuid": "<match-uuid>" }     (match owned by caller, event = end-game)
401 → missing / invalid Bearer token
404 → match not found OR caller is not the owner       (MATCH_NOT_FOUND)
406 → event is not the configured end-game event       (EVENT_NOT_END_GAME)
```

### Rules

- The authenticated user must be the **match creator**; ownership failures
  return `404` (not `403`) to avoid leaking that the match exists.
- The supplied event uuid is resolved via `StoryReadPort.findEventByStoryIdAndUuid`
  against the match's story. When the resolved event id equals the story's
  `id_event_end_game` (retrieved via `StoryReadPort.findStoryById`), the match
  status is set to `ENDED` via the same persistence call used by the admin stop
  endpoint (`persistencePort.updateMatchFields(uuidMatch, ENDED, null)`).
- **`idEventEndGame` is private**: it is **never** returned in any API
  response (request, success, 404, or 406). This applies to all four
  backends and is asserted by Robot E2E.

### Where the code lives

| Layer | Java | Python | PHP | AWS Lambda |
|-------|------|--------|-----|------------|
| Port (interface) | [MatchCommandPort.java](code/backend/java/core/src/main/java/games/paths/core/port/match/MatchCommandPort.java) | [match_ports.py](code/backend/python/app/core/ports/match/match_ports.py) | [MatchCommandPort.php](code/backend/php/src/Core/Port/Matches/MatchCommandPort.php) | inline (`handler.py`) |
| Service | [MatchCommandService.java](code/backend/java/core/src/main/java/games/paths/core/service/match/MatchCommandService.java) | [match_command_service.py](code/backend/python/app/core/services/match/match_command_service.py) | [MatchCommandService.php](code/backend/php/src/Core/Service/Matches/MatchCommandService.php) | [match/handler.py](code/backend/aws/lambda/match/handler.py) `_end_match` |
| Controller / route | [MatchController.java](code/backend/java/adapter-rest/src/main/java/games/paths/adapters/rest/controller/match/MatchController.java) `endMatch()` | [match_controller.py](code/backend/python/app/adapters/rest/match/match_controller.py) `end_match()` | [MatchController.php](code/backend/php/src/Adapter/Rest/Matches/MatchController.php) `endMatch()` + `public/index.php` PATCH route | [match.yaml](code/backend/aws/template/match.yaml) `EndMatchRoute` + dispatcher in `handler.py` |
| Story-event lookup | `StoryReadPort.findEventByStoryIdAndUuid` + new `findStoryById` | `StoryMatchReadPort.find_event_by_story_id_and_uuid` + `find_story_by_id` | `StoryMatchReadPort::findEventByStoryIdAndUuid` + `findStoryById` | DynamoDB `STORY#{uuid}` item embeds `events[]` and `idEventEndGame` |
| OpenAPI spec | [v0.20.1-match-end-api.yaml](code/backend/java/adapter-rest/src/main/resources/openapi/v0.20.1-match-end-api.yaml) | (shared) | (shared) | (shared) |

### Tests

- **Java**: new `PlayerEndMatch` nested test class in `MatchCommandServiceTest`
  (7 cases: blank inputs, unknown match, caller not owner, unknown caller,
  story missing end event, wrong event, success) + 4 controller cases in
  `MatchControllerTest` (401, 200, 406, 404). Full suite: core → 738 passed;
  adapter-rest → BUILD SUCCESS.
- **Python**: 8 service tests in `test_match_command_service.py` + 4 controller
  tests in `test_match_controller.py`. Full suite: 393 passed.
- **PHP**: 7 service tests + 4 controller tests via PHPUnit. Full suite: 453 passed.
- **AWS Lambda**: 6 new handler tests in `test_match_handler.py` (401, 404 match
  unknown, 404 wrong owner, 406 story missing end event, 406 wrong event, 200
  success). Full suite: 184 passed.
- **Robot E2E** (`code/tests/robot/tests/19_match/match_end.robot`): 5 cases
  covering 401 / 404 / 406, ownership boundary, and the privacy assertion that
  no response leaks `idEventEndGame`.

### Future work (roadmap items 30–45)

The new endpoint is the first hook for a real gameplay engine. The natural
next steps are:

1. Auto-end a match server-side when `MaxConsecutivePassBeforeGameover` is
   exceeded — sets status to `GAMEOVER` rather than `ENDED`.
2. Surface the player-driven completion in the `react-game` frontend (out of
   scope for 0.20.1 by request).
3. Reflect completion via WebSocket so other connected clients of the same
   match (multi-player) see the state change in real time.


## 0.20.3 — In-project cookie consent 
To replace CookieYes with self-hosted vanilla-cookieconsent + Google Consent Mode v2

### Context

Cookie consent was previously handled by the third-party **CookieYes** SaaS, loaded only on the marketing website, and existed solely to gate **Google Tag Manager** (`GTM-XXXXX`). Two problems drove the change: (a) external dependency with no control over consent UI, policy text, or tag-gating; (b) the `react-game` app loaded GTM with no consent gate at all while its UI text falsely claimed "no tracking cookies." The fix brings consent in-project using the self-hosted MIT library **vanilla-cookieconsent v3.1.0**, shared across website and react-game, keeping GTM but gating it via **Google Consent Mode v2**.

### What changed / Where the code lives

**react-game** (`code/frontend/react-game/`):

| File | Change |
|------|--------|
| [index.html](code/frontend/react-game/index.html) | Added Consent Mode v2 default-deny block at top of `<head>`; removed broken `__GTM_ID__` inline GTM snippet and un-gateable `<noscript>` GTM iframe |
| NEW [src/consent/gtm.js](code/frontend/react-game/src/consent/gtm.js) | Loads GTM container from `VITE_GTM_ID`; fixes latent bug where GTM never actually loaded |
| NEW [src/consent/cookieConsent.js](code/frontend/react-game/src/consent/cookieConsent.js) | `CookieConsent.run` config: `necessary` (read-only) + `analytics` (off by default); en/it translations with cookie tables; `onConsent`/`onChange` bridge to `gtag('consent','update',…)`; exports `initCookieConsent(lang)`, `openCookiePreferences()`, `setConsentLanguage(lang)` |
| NEW [src/components/CookieConsentManager.jsx](code/frontend/react-game/src/components/CookieConsentManager.jsx) | Headless component; boots consent once with the app language and syncs it on it/en switch; mounted in [App.jsx](code/frontend/react-game/src/App.jsx) under `LanguageProvider` |
| [src/main.jsx](code/frontend/react-game/src/main.jsx) | Calls `loadGtm(import.meta.env.VITE_GTM_ID)`; replaces the broken placeholder-replace logic |
| [src/i18n/en.json](code/frontend/react-game/src/i18n/en.json) + [it.json](code/frontend/react-game/src/i18n/it.json) | Rewrote `modals.cookies.body` (removed false "no tracking cookies" claim; now describes essential session cookies + analytics-with-consent); added `modals.cookies.manage` label |
| [src/components/modals/CookiesModal.jsx](code/frontend/react-game/src/components/modals/CookiesModal.jsx) | Added "Cookie settings" button that opens consent preferences |
| [package.json](code/frontend/react-game/package.json) | Added `vanilla-cookieconsent ^3.1.0` |

**website** (`code/website/html/`, static, deployed via `aws s3 sync`):

| File | Change |
|------|--------|
| NEW [assets/cookieconsent.css](code/website/html/assets/cookieconsent.css) | Self-hosted vanilla-cookieconsent v3.1.0 stylesheet |
| NEW [assets/cookieconsent.umd.js](code/website/html/assets/cookieconsent.umd.js) | Self-hosted vanilla-cookieconsent v3.1.0 UMD bundle |
| NEW [assets/cookieconsent-config.js](code/website/html/assets/cookieconsent-config.js) | `CookieConsent.run` config (en/it), gtag bridge, wires `#pg-cookie-settings` button |
| NEW [assets/consent-init.js](code/website/html/assets/consent-init.js) | External (CSP-safe) Consent Mode v2 defaults + GTM container loader; replaces former inline GTM snippet |
| [index.html](code/website/html/index.html) | Removed CookieYes banner script and `cky-cookie-policy` renderer; `<head>` loads `consent-init.js` + `cookieconsent.css`; cookie-policy modal has self-hosted policy text and `#pg-cookie-settings` button; loads UMD bundle + config before `</body>` |

**CSP / Terraform** (`code/website/terraform-aws/`):

| File | Change |
|------|--------|
| [ssm.tf](code/website/terraform-aws/ssm.tf) | Removed `cdn-cookieyes.com` (script-src) and `cookieyes.com` (connect-src) from CSP allowlists; self-hosted library is same-origin (`'self'`) |

### Behavior

Consent Mode v2 starts with all categories denied. The GTM container loads but Google tags write no cookies until the user accepts the `analytics` category. The choice is stored in a first-party `pathsgames.cookiesConsent` cookie (6-month, revision-based re-prompt) and is reversible via "Cookie settings". `react-admin` is unaffected (no tracking). Backend HttpOnly session cookies (`pathsgames.guestcookie`, `pathsgames.refreshToken`) are strictly necessary and consent-exempt.

The consent banner/modal is themed with the site design tokens (dark background + gold text) via a `cookieconsent-theme.css` override on both surfaces. The full **GDPR cookie policy** (categories, legal basis, third-party transfers, data-subject rights) is shown in the react-game `CookiesModal` and on the website's dedicated `cookies.html` page.

### Tests / Verification

- NEW [src/test/cookieConsent.test.js](code/frontend/react-game/src/test/cookieConsent.test.js) + [src/test/gtm.test.js](code/frontend/react-game/src/test/gtm.test.js): 9 new tests.
- `react-game` full suite (`npx vitest run`): 106 passed (9 new); 6 pre-existing failures in `SelectionView.test.jsx` unrelated to this change.
- `npm run build` succeeds.
- Website: all 5 consent assets (`consent-init.js`, `cookieconsent.css`, `cookieconsent.umd.js`, `cookieconsent-config.js`, `index.html`) served at HTTP 200 when static-hosting locally.
- No functional CookieYes references remain in `code/` (only descriptive "replaces CookieYes" comments).


## 0.20.4 — Turnstile antibot expanded to three surfaces

### Context

Until now Cloudflare Turnstile ran in a single place — inside `ConfigView`, where the widget appeared on a timer **before** the "Start Game" button and gated the terms/button until a token was obtained. This release moves the check to three explicit decision points and turns a failed/expired challenge into a visible "you're a bot" outcome instead of silently blocking the UI.

### What changed / Where the code lives

| File | What |
|------|------|
| NEW [src/utils/turnstile.js](code/frontend/react-game/src/utils/turnstile.js) | Shared config: exports `CF_KEY` (falsy ⇒ widget disabled / dev bypass), `TURNSTILE_APPEARANCE` (`{ home, config, guest }`, each env-resolved to `'always'` / `'interaction-only'`, default `'always'`), and the pass-cache helpers `isTurnstilePassValid()` / `recordTurnstilePass()` backed by the first-party `pathsgames.turnstilePass` cookie (TTL from `VITE_TURNSTILE_PASS_TTL_MINUTES`, default 30). |
| NEW [src/components/common/TurnstileWidget.jsx](code/frontend/react-game/src/components/common/TurnstileWidget.jsx) | Thin wrapper over `@marsidev/react-turnstile` with the shared dark theme; renders nothing when no site key is set. Props: `appearance`, `size`, `onSuccess`, `onError`, `onExpire`. |
| NEW [src/components/common/AntibotMessage.jsx](code/frontend/react-game/src/components/common/AntibotMessage.jsx) | The funny block shown when a visitor is flagged as a bot (`t('antibot.blocked')`). |
| [src/pages/HomePage.jsx](code/frontend/react-game/src/pages/HomePage.jsx) | **Change 1 — gate first.** On load a `gate` state starts `'checking'`; `getStories()` is called **only** when Turnstile passes (`gate === 'human'`). Bot/error ⇒ `gate === 'bot'`, the stories API is never called and the antibot message replaces the catalog. **A valid `pathsgames.turnstilePass` cookie skips the widget entirely** (gate starts `'human'`) so a confirmed human is not re-verified for 30 min; a fresh pass refreshes the cookie. |
| [src/features/startBook/ConfigView.jsx](code/frontend/react-game/src/features/startBook/ConfigView.jsx) | **Change 2 — button first.** Terms + "Start Game" show immediately. Clicking Start (terms required) hides both, sets `phase='checking'` and renders Turnstile; `onSuccess(token)` calls `onStartGame(token)`; error/expire ⇒ `phase='bot'` and the antibot message. The old 20s pre-button delay is removed. |
| [src/features/startBook/StartBookMobile.jsx](code/frontend/react-game/src/features/startBook/StartBookMobile.jsx) | Same button→Turnstile→bot flow mirrored for the mobile layout (it previously sent the click event as the token — fixed). |
| [src/components/modals/user/GuestUserModal.jsx](code/frontend/react-game/src/components/modals/user/GuestUserModal.jsx) | **Change 3 — gate first.** A `status` state runs Turnstile on open and shows `UserMatchesList` **only after a pass** (`status === 'human'`); error/expire ⇒ the antibot message. No site key — or a valid `pathsgames.turnstilePass` cookie — ⇒ list shown directly without re-verifying; a fresh pass refreshes the cookie. |
| [src/i18n/en.json](code/frontend/react-game/src/i18n/en.json) + [it.json](code/frontend/react-game/src/i18n/it.json) | New `antibot.blocked` ("Antibot activated — these adventures are only for humans!") + `antibot.verifying`. |
| [src/styles/main.css](code/frontend/react-game/src/styles/main.css) | `.antibot-message` + `.turnstile-checking` styling. |
| [src/consent/cookieConsent.js](code/frontend/react-game/src/consent/cookieConsent.js) | Added the `pathsgames.turnstilePass` security cookie to the **strictly-necessary** table (en + it); bumped `REVISION` 1 → 2 to re-prompt returning users. |
| [.env](code/frontend/react-game/.env) · [.env.example](code/frontend/react-game/.env.example) · [.env.test](code/frontend/react-game/.env.test) | Three appearance env vars + `VITE_TURNSTILE_PASS_TTL_MINUTES` (below). |

### Bot detection

A bot is any Turnstile **`onError` OR `onExpire`** → the funny message. `onSuccess` ⇒ human (HomePage loads the catalog; ConfigView starts the game; GuestUserModal reveals the matches list). When `VITE_CF_TURNSTILE_KEY` is empty the widget is skipped entirely and all three surfaces behave as before (dev bypass).

### Configurable widget appearance (3 env vars)

Each surface reads its own var; value is `always` (visible widget, **default**) or `interaction-only` (invisible until Cloudflare needs a challenge). Anything else falls back to `always`. The managed/invisible nature of the key itself is also set in the Cloudflare dashboard.

```bash
VITE_TURNSTILE_APPEARANCE_HOME=always       # HomePage antibot gate
VITE_TURNSTILE_APPEARANCE_START=always      # start-game button (ConfigView + mobile)
VITE_TURNSTILE_APPEARANCE_GUEST=always      # guest user modal (matches list)
VITE_TURNSTILE_PASS_TTL_MINUTES=30          # how long a HomePage pass is remembered
```

### Remembering a pass for 30 min (why no native Turnstile cookie)

The embedded Turnstile widget does **not** set a reusable first-party cookie. `cf_clearance` only exists when **Pre-Clearance** is enabled on the widget in the Cloudflare dashboard *and* the domain is proxied (orange-cloud) through Cloudflare; otherwise the widget loads from `challenges.cloudflare.com`, sets cookies only on that third-party domain, and each render yields a fresh **single-use token** (~300 s, consumed on server verify). So there is nothing on our domain to reuse and the check would re-run on every visit (invisible but still executing under `interaction-only`).

To stop re-verifying every load, after a successful pass on either pure gate (**HomePage** or **GuestUserModal**) we set our **own** first-party cookie `pathsgames.turnstilePass` (`max-age` = `VITE_TURNSTILE_PASS_TTL_MINUTES` × 60, default 30 min, `SameSite=Lax`). While that cookie is live, both surfaces start in the `'human'` state and never mount the widget. **This is UX only, not a security control** — a client could forge the cookie; the authoritative protection remains the server-side `turnstileToken` validation on match creation, which always uses a fresh token from `ConfigView` (never cached).

### Does Turnstile use cookies? Where the cookie list is and how to change it

The only Turnstile-related cookie we set is the first-party `pathsgames.turnstilePass` described above. Like the session cookies it is **strictly necessary / consent-exempt** (security), so it lives in the `necessary` category, not behind the analytics opt-in, and is disclosed in the cookie tables.

The cookie list shown to users lives in **two** places — edit both to keep website and game in sync:

1. **react-game** — [src/consent/cookieConsent.js](code/frontend/react-game/src/consent/cookieConsent.js), in `TRANSLATIONS.en` / `TRANSLATIONS.it` → `preferencesModal.sections[].cookieTable.body`. Add/edit rows there (`{ name, description, expiration }`). Necessary cookies go under the section with `linkedCategory: 'necessary'`; analytics under `linkedCategory: 'analytics'`. **Bump `REVISION`** at the top of the file whenever the policy materially changes so returning users are re-prompted.
2. **website** — [code/website/html/assets/cookieconsent-config.js](code/website/html/assets/cookieconsent-config.js), same `cookieTable.body` structure.

The long-form GDPR policy text is separately in the react-game `CookiesModal` (`modals.cookies.*` i18n keys) and the website `cookies.html` page.

### Tests / Verification

- Updated [src/test/HomePage.test.jsx](code/frontend/react-game/src/test/HomePage.test.jsx): controllable Turnstile mock (auto-pass; flip to bot); bot never calls `getStories`/sees the antibot message; pass writes the `pathsgames.turnstilePass` cookie; a live cookie skips the widget and loads stories directly.
- Fixed [src/test/UserMatchesList.test.jsx](code/frontend/react-game/src/test/UserMatchesList.test.jsx): stale import path (`features/matches` → `components/modals/user`) — the suite was failing to load before.
- NEW [src/test/ConfigView.test.jsx](code/frontend/react-game/src/test/ConfigView.test.jsx): start-button → Turnstile → `onStartGame(token)`; bot path; disabled-until-terms.
- NEW [src/test/GuestUserModal.test.jsx](code/frontend/react-game/src/test/GuestUserModal.test.jsx): list shown only after a pass; pass writes the cookie; a live cookie skips the widget; antibot message for bots.
- `npx vitest run` on the affected files: **28 passed**. `npm run build` succeeds. Full suite: 104 passed; the remaining failures are pre-existing in `Footer.test.jsx`, `Navbar.test.jsx`, `SelectionView.test.jsx` (untouched files, unrelated to this change).
- Not verified here: real browser click-through of the live Cloudflare challenge.



# Website Styles: React-Game Frontend Design System

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



# Dedicated Admin Endpoint

## Goal

Isolate every `/api/admin/**` endpoint onto a **separate network boundary** so the admin
surface can be locked down to the owner's IP, independently of the public/player API.

- **Java / Python / PHP** — admin APIs are served on a dedicated **port 8044**; the public
  API stays on 8042 (8080 in Java prod).
- **AWS** — admin APIs are served on a **separate HTTP API** gated by an IP-allow-list
  Lambda authorizer (there is no "port" in API Gateway).

The split is **strict**: the public listener returns `404` for `/api/admin/**`, and the admin
listener serves nothing but `/api/admin/**`. Admin-role authorization (JWT) is unchanged and
still applies on top of the network boundary.

Before this step, admin endpoints were mixed into the public listener and protected only by a
path-prefix check (`/api/admin/`). Admin match endpoints were also embedded in the player
`MatchController`. Step 20 extracts all admin code into its own files and onto its own endpoint.

---

## Architecture

```
                 ┌─────────────────────────── public ───────────────────────────┐
  player/public  │  8042 (Java/Python/PHP) · 8080 (Java prod) · PathsGamesApi    │
                 │  /api/echo, /api/auth, /api/stories, /api/content, /api/matches│
                 └───────────────────────────────────────────────────────────────┘
                 ┌─────────────────────────── admin ────────────────────────────┐
  admin only     │  8044 (Java/Python/PHP) · PathsGamesAdminApi (AWS)            │
  (firewall to   │  /api/admin/**  → guests, stories CRUD, match management      │
   owner IP)     │  AWS: + IP-allow-list Lambda authorizer                       │
                 └───────────────────────────────────────────────────────────────┘
```

Two layers of defense on the admin surface:
1. **Network boundary** — separate port (firewalled) / separate API (IP authorizer).
2. **Admin role** — the existing JWT check (`admin-path-prefix` / `is_admin`) still runs.

### Health check on the admin endpoint
The admin endpoint also serves **`GET /api/echo/status`**, backed by the **same EchoService**
as the public endpoint, so the admin endpoint can be monitored independently:
- **Java** — `AdminPortFilter` allows `/api/echo/status` on the admin connector (the shared
  `EchoController` already answers on both connectors).
- **Python** — `echo_controller.router` is included on `app_admin`.
- **PHP** — `RouteRegistrar::registerAdmin` registers `GET /api/echo/status`.
- **AWS** — the `EchoFunction` gets a route on the admin API (`EchoAdminRoute`), gated by the
  same IP authorizer as the other admin routes.

The local run scripts use `GET http://localhost:8044/api/echo/status` (expect 200) as the
admin-server readiness check. Robot suite `01_smoke/admin_echo.robot` asserts the admin echo
returns 200, has the same body shape, and reports the same `status` as the public echo.

### Dev / maintenance endpoints (`/api/dev/**`)
The dev-only maintenance endpoints — `POST /api/dev/cleanup` (remove Robot test data) and,
on AWS, `POST /api/dev/seed` — are served **only on the admin endpoint** so they sit behind
the same IP boundary (no admin JWT required; the network/IP gate is the protection):
- **Java** — `AdminPortFilter` treats `/api/dev/**` as admin-only (served on 8044, 404 on 8042);
  the shared `DevController` answers on the admin connector.
- **Python** — `dev_controller.router` is mounted on `app_admin` only.
- **PHP** — `RouteRegistrar::registerAdmin` registers `POST /api/dev/cleanup` (removed from public).
- **AWS** — the `SeedFunction` routes (`/api/dev/seed`, `/api/dev/cleanup`) live on the admin API
  with the IP authorizer; the `SeedEndpoint` output points at the admin API.

Run scripts call cleanup on the admin endpoint: local `POST http://localhost:8044/api/dev/cleanup`;
AWS seeds/cleans via `AdminApiUrl` (env `AWS_ADMIN_API_URL_TEST` or the stack output).

---

## Java — `code/backend/java/`

- Admin match endpoints extracted from `adapter-rest/.../match/MatchController` into
  **`adapter-admin/.../controller/match/MatchAdminController`** (joins the existing
  `GuestAdminController`, `StoryAdminController`, `StoryCrudAdminController`). `adapter-admin`
  now depends on `adapter-rest` to reuse the match DTOs, so admin/player JSON stays identical.
- **`AdminServerConfig`** (`ms-launcher`) adds a second Tomcat connector on `game.admin.port`
  via `WebServerFactoryCustomizer.addAdditionalTomcatConnectors(...)`.
- **`AdminPortFilter`** (`ms-launcher`, registered at order 0 in `SecurityFilterConfig`) keys on
  `request.getLocalPort()`: admin port + non-admin path → 404; public port + admin path → 404.
- Config: `game.admin.port` = `${ADMIN_PORT:8044}` in `application.yml` / `application-prod.yml`.

Run: `mvn -pl ms-launcher spring-boot:run` → public 8042 + admin 8044 in one JVM.

## Python — `code/backend/python/`

- Admin match routes extracted into **`app/adapters/rest/match/match_admin_controller.py`**
  (reuses the `_summary_to_camel` / `_detail_to_camel` presenters from `match_controller`).
- **`launcher.py`** builds two FastAPI apps — `app` (public) and `app_admin` (admin) — each with
  its own `JwtMiddleware` + CORS, and runs both in one process via
  `asyncio.gather(uvicorn.Server(...8042), uvicorn.Server(...8044))`.
- Config: `admin_port: int = 8044` in `app/config.py`.

Run: `python3 -m app.launcher` → public 8042 + admin 8044 in one process.

## PHP — `code/backend/php/`

- Admin match methods extracted into **`src/Adapter/Rest/Matches/MatchAdminController.php`**.
- Shared wiring moved to **`public/bootstrap.php`**; routes split into
  **`src/Adapter/Rest/RouteRegistrar.php`** (`registerPublic` / `registerAdmin`).
- Two front controllers: **`public/index.php`** (public only) and
  **`public/index_admin.php`** (admin only).

Run both:
```bash
php -S localhost:8042 -t public                            # public
php -S localhost:8044 -t public public/index_admin.php     # admin
```

## AWS — `code/backend/aws/`

- New **`PathsGamesAdminApi`** (second `AWS::Serverless::HttpApi`) carries every `/api/admin/**`
  route; the public `PathsGamesApi` keeps the player/public routes.
- New **`AdminIpAuthorizerFunction`** (`lambda/authorizer/handler.py`) + **`AdminIpAuthorizer`**
  (REQUEST authorizer, simple responses, no `IdentitySource` → runs on every request) gate the
  admin API by source IP against `AdminIpWhitelist`. Empty allow-list = allow all (dev only).
- **Shared functions:** the existing Auth/Story/Match Lambdas keep serving admin routes; each
  admin-bearing module gained a second integration (`<Fn>AdminIntegration`) and a second invoke
  permission (`<Fn>AdminPermission`) for the admin API. Admin routes use
  `AuthorizationType: CUSTOM` + `AuthorizerId`.
- The in-Lambda `_check_admin_ip` stays as defense-in-depth.
- New stack output **`AdminApiUrl`**.

Set the allow-list at deploy time:
```bash
sam deploy ... --parameter-overrides AdminIpWhitelist=<your.ip.here>
```
> Deploys require explicit confirmation — see the AWS notes in `CLAUDE.md`.

---

## Frontend — `code/frontend/`

- **react-admin** (the only frontend that calls `/api/admin/**`) now defaults to the admin
  endpoint: `client.js` baseURL → `http://localhost:8044`, the Vite proxy → 8044, and
  `VITE_DEFAULT_SERVERS` lists the admin endpoint first. For AWS, point it at `AdminApiUrl`.
- **react-game** is unchanged (it makes no admin calls).

## Robot tests — `code/tests/robot/`

- New variable **`ADMIN_BASE_URL`** (`http://localhost:8044` in `dev.yaml`; the admin API URL in
  `aws.yaml`). The shared **`Create Admin Session`** keyword (`resources/common.resource`) now
  opens its session against `${ADMIN_BASE_URL}` — suites `14_admin` and `17_admin_crud` are
  unchanged.
- Local run scripts (`run_robot_with_local_java*.sh`, `_python.sh`, `_php.sh`) start/await the
  8044 admin listener and clean it up.

## Infra

- `code/scripts/test/java_docker_compose/docker-compose.yml` publishes the backend admin port
  `8044` to the host — **firewall it to the owner IP** (host firewall / security group). With the
  strict split, the legacy nginx by-path admin filter on 8042 is redundant.

---

## How to restrict to your IP

| Backend | Mechanism |
|---|---|
| Java / Python / PHP (bare) | OS firewall / cloud security group rule allowing 8044 only from your IP |
| Java docker-compose | host port `8044` mapping + host firewall / security group |
| AWS | `AdminIpWhitelist` deploy parameter → the Lambda authorizer rejects other IPs with 403 |

---

## Verification

```bash
# Java (one JVM serves both)
mvn -pl ms-launcher spring-boot:run
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8042/api/echo/status      # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8042/api/admin/matches    # 404 (admin hidden on public)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8044/api/admin/matches    # 401 (admin up, needs token)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8044/api/echo/status      # 404 (public hidden on admin)
```

- **Java:** `mvn test` — `MatchAdminControllerTest`, `AdminPortFilterTest`, `AdminServerConfigTest`.
- **Python:** `pytest tests` — `test_match_admin_controller.py`, `test_launcher_apps.py`.
- **PHP:** `vendor/bin/phpunit tests/Unit` — `MatchAdminControllerTest`, `RouteRegistrarTest`.
- **AWS:** `sam validate`; `pytest tests/test_authorizer_handler.py`.
- **Frontend:** `npm run test` (react-admin); **Robot:** suites `14_admin`, `17_admin_crud`.



# EC2 Docker Deploy (Test Environment)

## Goal

Provide a reproducible, scriptable way to run the Java backend on a test EC2 instance
using a pre-built Docker image pulled from Docker Hub, without cloning the repo or running
Maven on the instance.

This step also covers three bug fixes delivered in the same session:

- **CORS varargs fix** in `WebConfig.java`
- **`env` field** in `/api/echo/status` (Java `test`/`prod` profiles + AWS Lambda)
- **Multi-language text import fix** in `StoryImportService`

---

## Scripts

All scripts live under `code/scripts/test/` (build) and
`code/scripts/test/aws_ec2_with_java_docker/` (lifecycle).

| Script | Purpose |
|--------|---------|
| `code/scripts/test/build_docker_test_and_push.sh` | Build the Java image locally for `linux/amd64` and push to Docker Hub with tag `:test` |
| `aws_ec2_with_java_docker/start.sh` | Create SG + launch EC2 instance; user-data pulls the image and starts two containers |
| `aws_ec2_with_java_docker/redeploy.sh` | On a running instance: update env-file, `docker pull`, restart only the backend container |
| `aws_ec2_with_java_docker/stop.sh` | Terminate instance, delete SG, delete Route53 record (and CloudFront distribution if present) |

---

## Configuration

All variables are read from the **project root `.env`** file (not a local `.env` inside the
scripts folder). Shared variables reused from other scripts keep their existing names; EC2-specific
variables carry the `_TEST_EC2` suffix.

Key variables:

| Variable | Description |
|----------|-------------|
| `DOCKERHUB_USERNAME_TEST` | Docker Hub account name |
| `DOCKERHUB_IMAGE_TEST` | Image repository name (default: `pathsgames-backend`) |
| `DOCKERHUB_IMAGE_TAG_TEST` | Image tag (default: `test`) |
| `DOCKERHUB_TOKEN_TEST` | Docker Hub access token — used only by `build_docker_test_and_push.sh` on the local machine |
| `EC2_KEY_NAME_TEST_EC2` | EC2 SSH key pair name |
| `EC2_INSTANCE_TYPE_TEST_EC2` | Instance type (default: `t3.small`) |
| `DB_PASSWORD_TEST_EC2` | PostgreSQL password injected into the backend env-file |
| `JWT_SECRET` | JWT secret shared with the SAM deploy |
| `AWS_REGION_TEST` | AWS region (reused) |
| `AWS_ENVIRONMENT_NAME_TEST` | Value passed as `ENVIRONMENT` to the container; appears in `/api/echo/status` as the `env` field (reused from SAM deploy) |
| `ROUTE53_RECORD_NAME_TEST_EC2` | DNS record name for the API (e.g. `api-test-server2.paths.games`) |
| `AWS_DOMAIN_HOSTED_ZONE_TEST` | Route53 hosted zone ID (reused; leave empty to skip DNS) |
| `ENABLE_CLOUDFRONT_TEST_EC2` | `true` to front the public API (8042) with CloudFront; default `false` |
| `CLOUDFRONT_DOMAIN_CERTIFICATE_ARN_TEST_EC2` | ACM cert ARN — **must be in `us-east-1`** |

---

## Build — `build_docker_test_and_push.sh`

Runs on the **developer's machine**, not on EC2.

1. Loads the root `.env`.
2. Uses `docker buildx` with `--platform linux/amd64` so the image runs on `t3` instances
   regardless of host architecture (e.g. Apple Silicon).
3. Reuses the existing multi-stage `Dockerfile` at `code/backend/java/Dockerfile` — Maven
   compiles inside the build container, producing a minimal JRE image.
4. Pushes the image to Docker Hub as `<DOCKERHUB_USERNAME>/<DOCKERHUB_IMAGE>:<IMAGE_TAG>`.
5. Docker Hub login uses `DOCKERHUB_TOKEN_TEST` (access token, not password).

```bash
# Build and push
cd <repo root>
code/scripts/test/build_docker_test_and_push.sh

# Preview only (no push)
code/scripts/test/build_docker_test_and_push.sh --dry-run
```

---

## Start — `start.sh`

**Idempotent**: if an instance tagged with `INSTANCE_NAME` already exists (in any
non-terminated state), the script prints its ID and IP and **exits immediately** (no-op).
Image updates on a running instance are handled by `redeploy.sh`.

### What start.sh does (first run)

1. Detects the caller's public IP (used for SSH and admin port rules).
2. Creates (or reuses) a security group with:
   - TCP 22 → caller IP only (SSH)
   - TCP 8042 → `0.0.0.0/0` (public API — open to all)
   - TCP 8044 → caller IP only (admin API — owner-locked)
3. Finds the latest Ubuntu 24.04 LTS AMI in the target region.
4. Generates a **user-data** script that runs on first boot:
   - Installs Docker (official repo, no Compose plugin needed).
   - Creates a Docker bridge network `pathsgames-net`.
   - Runs `postgres:16-alpine` as container `pathsgames-postgres`.
   - Writes `/opt/pathsgames/backend.env` with DB credentials, JWT secret, and port config.
   - Runs `docker pull <BACKEND_IMAGE>` (public Docker Hub repo — no login required on EC2).
   - Runs the backend container, publishing ports 8042 (public) and 8044 (admin).
5. Launches the EC2 instance and saves state to `.state`.
6. Optionally creates a Route53 record (see DNS/CloudFront below).

```bash
cd code/scripts/test/aws_ec2_with_java_docker
./start.sh           # launch (no-op if already running)
./start.sh --dry-run # print user-data only
```

---

## Redeploy — `redeploy.sh`

Used to roll a new image onto an **already-running** instance without touching PostgreSQL.

1. Loads root `.env` + `.state` (for the instance IP).
2. Resolves the live public IP via AWS API (robust to elastic IP changes).
3. Writes a fresh `/opt/pathsgames/backend.env` over SSH (secrets sent via stdin, never on
   the command line).
4. On the instance: `docker pull` → `docker rm -f pathsgames-backend` → `docker run`.
   PostgreSQL container `pathsgames-postgres` is left untouched — data persists.
5. Prompts for confirmation unless `--force` is passed.

```bash
./redeploy.sh          # with confirmation prompt
./redeploy.sh --force  # skip prompt
```

**Typical workflow:**

```
build_docker_test_and_push.sh   # 1. build + push new image locally
aws_ec2_with_java_docker/redeploy.sh  # 2. roll it onto the running EC2
```

---

## Stop — `stop.sh`

Destroys all resources created by `start.sh`, reading state from `.state`:

1. If `CLOUDFRONT_DIST_ID` is set: deletes the Route53 alias, disables the distribution,
   waits for propagation (~15 min), then deletes the distribution.
2. Otherwise, deletes the direct Route53 A record (if present).
3. Terminates the EC2 instance (waits for `terminated` state).
4. Deletes the security group (retries up to 10 times if still attached).
5. Removes `.state`.

---

## DNS and CloudFront

`ROUTE53_RECORD_NAME_TEST_EC2` is the single user-facing hostname. Its type depends on
`ENABLE_CLOUDFRONT_TEST_EC2`:

| `ENABLE_CLOUDFRONT` | Route53 record type | Target |
|---------------------|--------------------|--------|
| `false` (default) | A (direct) | EC2 public IP |
| `true` | A alias | CloudFront distribution domain |

When CloudFront is enabled:

- The distribution origin is the EC2 **public DNS name** (not the IP), connecting on port
  8042 via HTTP. This avoids DNS loop issues.
- The ACM certificate **must be in `us-east-1`** regardless of the EC2 region.
- CloudFront fronts **only the public API** (port 8042). The admin port 8044 stays
  SG-locked to the owner IP and is reached via SSH tunnel:

```bash
ssh -i ~/.ssh/<key>.pem -L 8044:localhost:8044 ubuntu@<EC2-IP>
# then: curl http://localhost:8044/api/admin/matches
```

- CloudFront takes approximately 5-15 minutes to deploy globally before HTTPS becomes
  available. The `start.sh` output notes this.

---

## Spring Profile `test` and env-file

The backend container runs with `SPRING_PROFILES_ACTIVE=test`, loading
`application-test.yml` (PostgreSQL dialect + CORS origins including
`https://test.paths.games` and `https://test2.paths.games`).

`/opt/pathsgames/backend.env` contents (injected by `start.sh` / `redeploy.sh`):

```
SPRING_PROFILES_ACTIVE=test
ENVIRONMENT=<AWS_ENVIRONMENT_NAME_TEST>
DB_HOST=pathsgames-postgres
DB_PORT=5432
DB_NAME=<DB_NAME_TEST_EC2>
DB_USERNAME=<DB_USERNAME_TEST_EC2>
DB_PASSWORD=<DB_PASSWORD_TEST_EC2>
JWT_SECRET=<JWT_SECRET>
ADMIN_PORT=8044
```

---

## Related fixes delivered in this step

### CORS fix — `WebConfig.java`

**File:** `code/backend/java/ms-launcher/src/main/java/games/paths/launcher/config/WebConfig.java`

**Problem:** `allowedOriginPatterns()` was called with a single string containing
comma-separated origins. Spring interprets this as one literal pattern, so no origin
matched and the `Access-Control-Allow-Origin` header was never emitted.

**Fix:** the list is now spread with `allowedOrigins.toArray(new String[0])` so each
origin is a separate argument:

```java
.allowedOriginPatterns(allowedOrigins.toArray(new String[0]))
```

The allowed origins are configured per Spring profile:
- `application-test.yml`: `https://test.paths.games`, `https://test2.paths.games`, and
  local development origins (`localhost:3000`, `localhost:5172`, etc.)
- `application-prod.yml`: `https://paths.games`, `https://www.paths.games`,
  `https://pathsgames.com`

---

### Echo `env` field

`GET /api/echo/status` returns a `properties.env` field so callers can identify the
deployment environment without needing to inspect headers or configuration.

**Java** (`application-test.yml` / `application-prod.yml`):

```yaml
game:
  server:
    env: ${ENVIRONMENT:test}      # test profile default
    env: ${ENVIRONMENT:production} # prod profile default
```

The value is overridden by the `ENVIRONMENT` environment variable, which `start.sh` /
`redeploy.sh` derive from `AWS_ENVIRONMENT_NAME_TEST` — the same variable used by the
SAM deploy as its `Environment` parameter, keeping both environments in sync.

**AWS Lambda** (`code/backend/aws/lambda/echo/handler.py`):

```python
"env": os.environ.get("ENV", "dev"),
```

The `ENV` variable is injected by `template/echo.yaml` as `!Ref Environment`.

---

### Multi-language text import fix — `StoryImportService`

**File:** `code/backend/java/core/src/main/java/games/paths/core/service/story/StoryImportService.java`
**Method:** `importTexts`

**Problem:** Story JSON files use the same surrogate `id` for all language variants of
the same logical text (same `idText`, different `lang`). The PK on `list_texts` is
`(id, id_story)`, so reusing the same surrogate id for two rows with the same `id_story`
caused a `NonUniqueObjectException` on PostgreSQL (duplicate PK constraint violation).

**Fix:** a two-pass algorithm de-collides surrogate ids before persisting:

1. First pass: resolve all surrogate ids and find `maxId`.
2. Second pass: if a surrogate id is `null` or already used, assign `++maxId`.

The **business key** `(idText, lang)` — which has a unique constraint in the DB and is
what all FKs reference — is preserved unchanged. No FK references the surrogate PK,
so reassigning it is safe.

---

## Verification

```bash
# After start.sh or redeploy.sh (give ~40s for Spring boot):
curl http://<EC2-IP>:8042/api/echo/status
# Expected: {"status":"UP","properties":{"env":"test",...}}

curl http://<EC2-IP>:8042/api/echo/status | python3 -m json.tool

# Admin endpoint (via SSH tunnel or from owner IP):
curl http://localhost:8044/api/admin/matches
# Expected: 401 (up, requires admin token)
```






# Version Control
- Created with AI assistance (Claude via Claude Code).
  - i wanna add Turnstile anti-robot on react-game proeject
    - ciao, new update i added "Cloudflare Turnstile anti-bot" on react-game project but now i wanna validate token on serve side , let's go!
      - change others backend (python, php and aws lambda)
      - add robot test too if it's possibile, create "code/tests/robot/tests/20_website"
  - check all project and all documentation files, check where and who to set complete a match.
    - now i wanna create an new api PATCH `/match/{uuid_match}/end/{uuid_event}`: to complete the match (set on ENDED state) if event is the "idEventEndGame" of story of match (never return idEventEndGame values on API), if event is not the idEventEndGame return "406 Not Acceptable". use "0.20.1" version, we are on step 20. please develop all backend (java, php,python, aws lambda), remember to add robot tests. In this session don't change frontend-react projects.
  - read documentation_v0/Step20_GameWebSiteFirstRun.md and let's go to import match end into react-game project and GameBook components: refactor LocationCard to use GameCard component, if there are not any location into story object, show story big card. refactor PlayerStats to use BonusBadgeList. refactor NeighborRow and ActionsRow to use GameCard little. If actions has "endGame"="true" show button "End game" to call "end game api" and hide GameBook and show EndGameBook with on left story card and on right endGameCard from gameData.json and a button "close" to restart from home page. 
    - into GameBook refactor NeighborRow and ActionsRow to a SelectionView
  - check projects, website folder and react-game project, actualy i'm using cookies-yes but i wanna manage cookies into project, what do you succest?
    - run paths-games-doc on documentation_v0/Step20_GameWebSiteFirstRun.md and add section with version "0.20.3". let's go
    - check documentation_v0/Step07_ConfigureWebsite.md file and update with last code updates
    - i wanna some changes : 1 change "cc_cookie" name to "pathsgames.cookiesConsent". 2 change style with variables styles (background-color and gold text color) 3 on index.html show pathsgames cookies too. 4 on "Cookies Policy" modal into react-game show long text, create a text GDPR compliance, on index.html version link to Cookies policy content it's possibile 
    - into react-game project i wanna create "Privacy Policy" and "Terms of Service" texts, suggest me main poinst. I wanna to be compliance to regulations (eu and usa). Let's go 
  - On react-game project i've TURNSTILE but i wahnna this 3 changes, actualy it's configurated on ConfigView component
    - 1 on HomePage, when is loading, after call API service, i wanna use TURNSTILE to check robot/bot , if it's the bot don't call APIs and show funny message "antibot activate, these adventures is only for humans!".
    - 2 on ConfigView actaly is before "btn-start-game", i wanna change after: user shee "start game" button, when click then button hide (anche terms of conditions hide) and start TURNSTILE check antibot and generate token to send to onStartGame
    - 3 on GuestUserModal after show UserMatchesList, use TURNSTILE to check, if it's a bot show the funny message
    - TURNSTILE uses any cookies? if yes change vanilla-cookieconsent configuration.
    - After update documentation_v0/Step20_GameWebSiteFirstRun.md using "v0.20.4" version write what you have done and where there is cookies configuration list and how change it
    - if it's possibile add 3 ENV variabiles to configure if 3 element is interaction-only or always visibile, default alwasy visibile. if it's not possibile configure "always visibile"
    - on home page it's possibile add logic: if TURNSTILE confirmed it's not a bot, don't recall it for 30 minutes, it's possibile use cookies from TURNSTILE
  - for AWS-backend add API Gateway Resource Policy on cloudformation cloudformation checking enabled ip-list from .env and local ip (executing code/scripts/test/deploy_website_test_on_aws.sh). about java-backend create "code/scripts/test/java_docker_compose" where use docker-compose to create backend image, db postgreg and nginx to filter /admin/ APIS for my ip. let's go
    - now create "code/scripts/test/aws_ec2_with_java_postgress_docker_compose", inside create start.sh and stop.sh . Using AWS CLI with default az ohio (but possibile change) in env. Start script have to run an ec2 with last ubuntu image , create a security group to permeti 8042 from paths.games domain and all from my ip, and user data where install git, clone repository (name and branch in env) and run start script of "code/scripts/test/javaDockerCompose", use already existing key "paths-games-ohio" (name in .env). Stop script have to destroy all components. Please change "code/scripts/test/javaDockerCompose" to "code/scripts/test/java_docker_compose" name.
    - instance should be with name "api-test-server2" and security group "api-test-server2-sg", every resouces created with tags env=test , createdBy=SH, project=PathsGames. into start i wanna create a dns record "api-test-server2.paths.games" into hosted zone "paths.games" with ID "XXXX" (all on .env). remember stop must be delete record too.another change on start if resources already exist don't throw error but continue and continue script steps, on stop if any resource doesn't exist don't throw error and continue script steps
  - hi, actualy on "configview" there is a start game button when clicked start the Turnstile and after onStartGame api. I wanna change this logic: move termsAccepted to X, when "start game" pressed hide ConfigView and show StartGameView with same graphics of ConfigView: 6 card and buttons on bottom. fist ConfigCard is term of conditions (x) point, with button di select/deselect conditions and onPreview must open modal. Second is gameType (same of ConfigView), 3rd card is login (same of ConfigView). Second row hide at loading, start the TurnstileWidget and when ok, show second row. 4th is new card "antibot ok" (create buildAntibotCard on loadoutCards). 5yh is free to play card (create buldFreeToPlay) and 6 is story card. On botton , after TurnstileWidget start setPhase to create the match. Let's go
    - yes: apply to mobile layout. on mobile i wanna change StartBookModal: remove book-mobile-config-card and use GameCard with 2 cards for every rows. on mobile on SelectionView i wanna 2 cards for every rows. Let's go
  - check all documentation files and backend projects (java, python, php e aws lambda). i wanna move all APIs to different port (default 8044). i wanna code-refactor to have ALWAYS separeted files and endpoints (example in java there is adapter-admin). for aws lambda I wanna different endpoint with IP limitations (example my IP). always remember to chage unit test and robot test. after check and edit frontend projects (only admin?), (create new if necessary). at the end write documentation_v0/Step20_AdminEndpoint.md and update notebooklm. take your time and use plan mode. let's go!
    - move admin APIs to another port (default 8044), on AWS Backend create a second API gateway with authorizer limited to my IP. update all robot test and all documentation



- **Document Version**: 0.20.7

    | Version | Description | Date |
    |---------|-------------|------|
    | 0.20.0 | First-run flow documentation + Cloudflare Turnstile anti-bot | May 21, 2026 |
    | 0.20.0 | Hybrid Cloudflare architecture: pathsgames.com → CF Pages, paths.games → AWS invariato | May 25, 2026 |
    | 0.20.0 | Back pathsgames.com on AWS and define test.paths.games environment | May 26, 2026 |
    | 0.20.1 | Player-driven match completion: `PATCH /api/match/{uuidMatch}/end/{uuidEvent}` | May 27, 2026 |
    | 0.20.2 | Complete the match in react-game frontend | May 27, 2026 |
    | 0.20.3 | In-project cookie consent (CookieYes → vanilla-cookieconsent) website & react-game | May 28, 2026 |
    | 0.20.4 | Turnstile antibot on 3 surfaces (HomePage, ConfigView & GuestUserModal) | May 28, 2026 |
    | 0.20.5 | Admin APIs with network limitations rules on AWS backend | May 29, 2026 |
    | 0.20.6 | Advanced start-match interface | June 03, 2026 |
    | 0.20.7 | Ec2 Docker deploy and first java-postgres tests | June 05, 2026 |

- **Last Updated**: June 05, 2026
- **Status**: Complete

# < Paths Games />
All source code and information in this repository are the result of careful and patient development work by the developer team, who has made every effort to verify their correctness to the greatest extent possible. Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.

For all details, in-depth information, or requests for clarification, please visit [Paths.Games](https://paths.games/) website.

## License
Made with ❤️ by <a href="https://github.com/gamespaths/pathsgames">paths.games dev team</a>
&bull;
Public projects
<a href="https://www.gnu.org/licenses/gpl-3.0" valign="middle"><img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=plastic" alt="GPL v3" valign="middle" /></a>
*Free Software!*

The software is distributed under the terms of the GNU General Public License v3.0. Use, modification, and redistribution are permitted, provided that any copy or derivative work is released under the same license. The content is provided "as is", without any warranty, express or implied.

Narrative Content & Assets: The story, dialogues, characters, sounds, musics, paint, all artist contents and world-building (located on /data folder) are NOT open source. They are licensed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 (CC BY-NC-ND 4.0).
