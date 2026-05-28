# Paths Games V0 - Step 20: Game Website — First Run & Match End Flow
 

## 0.20.1 — Player-driven match completion (`PATCH /api/match/{uuidMatch}/end/{uuidEvent}`)

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


## Version Control
- Created with AI assistance (Claude Sonnet 4.6 via Claude Code).
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

- **Document Version**: 0.20.3

    | Version | Description | Date |
    |---------|-------------|------|
    | 0.20.0 | First-run flow documentation + Cloudflare Turnstile anti-bot | May 21, 2026 |
    | 0.20.0 | Hybrid Cloudflare architecture: pathsgames.com → CF Pages, paths.games → AWS invariato | May 25, 2026 |
    | 0.20.0 | Back pathsgames.com on AWS and define test.paths.games environment | May 26, 2026 |
    | 0.20.1 | Player-driven match completion: `PATCH /api/match/{uuidMatch}/end/{uuidEvent}` | May 27, 2026 |
    | 0.20.2 | Complete the match in react-game frontend | May 27, 2026 |
    | 0.20.3 | In-project cookie consent (CookieYes → vanilla-cookieconsent + GCM v2) website & react-game | May 28, 2026 |


- **Last Updated**: May 28, 2026
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
