# Security

Everything that gates who can call the API, from what address, and what it renders: guest
identity, admin access, abuse controls, and the frontend/infrastructure hardening around them.

## 1. Guest login and JWT (access + refresh, with rotation)

There is no password account in V0 — every player is a **guest**. `POST /api/auth/guest`
creates one and returns an access token (JWT, 30 min default), a refresh token (JWT, 7 days
default) and a `guestCookieToken` used to resume the same identity later via
`POST /api/auth/guest/resume`. Full claim tables and DB columns:
[Step12](documentation_v0/Step12_GuestLoginMethod.md).

- **Access token** claims: `sub` (user UUID), `username`, `role` (`PLAYER`/`ADMIN`), `type:
  access`, `iat`, `exp`, `jti`. Sent as `Authorization: Bearer <token>`.
- **Refresh token** is delivered as an **HttpOnly** cookie (`pathsgames.refreshToken`), never
  readable by JavaScript, so an XSS compromise cannot steal it — it can at most steal the
  short-lived access token from memory. `POST /api/auth/refresh` reads that cookie,
  **revokes every previous token for the user (full rotation, not just the presented one)**,
  and issues a new access+refresh pair, resetting the cookie. Full flow and rationale:
  [Step13](documentation_v0/Step13_SessionTokenManagement.md).
- `JwtAuthenticationFilter` runs on every `/api/*` request except a public-path allow-list
  (`/api/echo/**`, `/api/auth/guest`, `/api/auth/guest/resume`, `/api/auth/refresh`). Error
  codes: `MISSING_TOKEN` / `EMPTY_TOKEN` / `INVALID_TOKEN` (401), `FORBIDDEN` (403, non-ADMIN
  hitting `/api/admin/**`).
- `POST /api/auth/logout` / `POST /api/auth/logout/all` revoke one or all sessions and clear
  both HttpOnly cookies.

## 2. Admin role and the admin port

Admin access is a **role** (`role: ADMIN` in the JWT) *and* a **network boundary**: the admin
API is never reachable from the public listener.

- Java/Python: public port `8042` (dev) / `8080` (prod) 404s any `/api/admin/**` path; only
  the dedicated **admin port `8044`** (`game.admin.port` / env `ADMIN_PORT`) serves it. Lock
  8044 to the owner's IP at the network layer (firewall/security group).
- react-admin pastes a JWT admin token at login and talks only to the admin port (dev proxy
  `/api/admin/**` → `localhost:8044`).
- AWS: admin endpoints sit behind a **separate API Gateway** (`PathsGamesAdminApi`) with its
  own **Lambda authorizer** doing IP allow-listing (§3) — the equivalent, at the API Gateway
  layer, of the Java/Python per-port firewall. The in-Lambda `_check_admin_ip` check in each
  handler is kept too, as defense-in-depth.

## 3. AWS admin IP allow-list authorizer

`code/backend/aws/lambda/authorizer/handler.py` is an HTTP API request authorizer (payload
format 2.0, simple `{"isAuthorized": bool}` response) attached to `PathsGamesAdminApi`. It
reads `ADMIN_IP_WHITELIST` (comma-separated IPs, the `AdminIpWhitelist` SAM parameter) and
allows the source IP only if it's on the list.

**Today:** an empty allow-list means **allow all** — i.e. no IP restriction at all. This is
explicit in the code comment (`# Empty allow-list = no IP restriction (dev only, insecure)`)
and is the default for `dev`; it must not be the effective behavior for a production-facing
stack.

**Planned (step 0.41):** a new parameter will let the deployer choose what an empty list
means — "allow all" or "allow none" — with the **default flipped to none**, so a stack
deployed without explicitly setting `AdminIpWhitelist` fails closed on the admin API instead
of failing open. Not implemented yet; tracked as a step 0.41 item, not in any current step
file.

## 4. Rate limiting and CSRF (v0.37.7, all backends)

Introduced together in v0.37.7 (Step 41 in the code comments); grep `security_utils.py`
(AWS), `RateLimitService` (Java `core/.../service/security/`), `csrf_token_service.py`
(Python) to find the implementations — no dedicated step file covers this release yet.

- **Per-IP rate limiting**: a fixed-window counter per `(bucket, source IP)`. Buckets today:
  guest creation and match creation. `limit <= 0` disables a bucket entirely — the dev/Robot
  default, since Robot mints hundreds of guests from one address. Configured via
  `RATE_LIMIT_GUEST_PER_IP`, `RATE_LIMIT_MATCH_PER_IP`, `RATE_LIMIT_WINDOW_SECONDS` (Java
  `application.yml` / Python `config.py`; the AWS test stack takes the `_TEST`-suffixed
  variants). A blank/unknown source key is never limited.
- **CSRF token**: issued at guest login/refresh, must be echoed back as the `X-CSRF-TOKEN`
  header on `POST /api/matches` (match creation — the one state-changing, cookie-authenticated
  action that needed it). The token is `base64url(HMAC-SHA256(JWT_SECRET, "csrf:" +
  accessToken))` with no padding — computed identically by Java, Python and AWS from the
  access token, so nothing extra is stored server-side. Toggle: `CSRF_ENFORCED` (`true`
  everywhere by default; `false` only to run an old client against a newer backend during a
  transition).

## 5. HTML sanitization (react-game)

Story and card text comes from the backend and may carry light author markup (`<p>`, `<i>`,
`<b>`, line breaks). `src/utils/sanitizeHtml.js` runs it through **DOMPurify**
(`USE_PROFILES: { html: true }`) before any `dangerouslySetInnerHTML`, stripping
`<script>`, inline event handlers and `javascript:` URLs — so a compromised or malicious
content source cannot inject active content into a player's browser.

## 6. Antibot (Turnstile) and cookie consent

Full detail: [Step20](documentation_v0/Step20_GameWebSiteFirstRun.md).

- **Cloudflare Turnstile** gates three surfaces in react-game: the home story catalog, the
  "Start Game" button, and the guest-matches modal. A pass (`onSuccess`) is cached for
  `VITE_TURNSTILE_PASS_TTL_MINUTES` (default 3000) in the first-party
  `pathsgames.turnstilePass` cookie so a confirmed human isn't re-challenged on every load —
  UX only, **not** the security boundary. The authoritative check is always the server-side
  `turnstileToken` verification on `POST /api/matches`, using a fresh, never-cached token.
  When no site key is configured the widget is skipped (dev bypass); Robot uses a deployed
  `TURNSTILE_BYPASS_TOKEN`, honored only when the AWS stack's environment isn't `prod`.
- **Cookie consent**: self-hosted `vanilla-cookieconsent` v3.1.0 + Google Consent Mode v2,
  shared between the website and react-game, replacing the former third-party CookieYes.
  Consent starts fully denied; Google tags (via GTM) write no cookies until the user opts
  into the `analytics` category. Strictly-necessary, consent-exempt cookies:
  `pathsgames.guestcookie`, `pathsgames.refreshToken`, `pathsgames.cookiesConsent`,
  `pathsgames.turnstilePass`, plus the `pathsgames.lang` localStorage key.

## 7. CSP and security headers (website Terraform)

`code/website/terraform-aws/` attaches a CloudFront response-headers policy to every
environment with `Strict-Transport-Security` (1 year, includeSubDomains, preload),
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`,
`Referrer-Policy: strict-origin-when-cross-origin`, and a **Content-Security-Policy** built
dynamically per `csp_mode`:

| `csp_mode` | Behavior |
|---|---|
| `open` (default) | `default-src *` — no restriction, dev/debug only |
| `restricted` | Per-directive allowlist assembled from SSM `StringList` parameters
  (`/paths-games/csp/{script,style,font,img,connect}-src`, owned by `production`) plus each
  environment's own `csp_extra_domains` |

An optional **WAF v2** (`enable_waf`, off by default to save cost) adds rate limiting (1000
req/5min per IP) and AWS Managed Rules (OWASP Top 10, known bad inputs). See
[Environments §2](./Environments.md) for how the certificate and CSP allowlists are shared
across environments.

# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First shared write-up of every security control in one place | September 25, 2026 |

- **Last Updated**: September 25, 2026 (v0.40.0)

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
