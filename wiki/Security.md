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
  layer, of the Java/Python per-port firewall. The shared `common/http_utils.check_admin_ip`
  check in each admin-route handler is kept too, as defense-in-depth.

## 3. AWS admin IP allow-list authorizer

`code/backend/aws/lambda/authorizer/handler.py` is an HTTP API request authorizer (payload
format 2.0, simple `{"isAuthorized": bool}` response) attached to `PathsGamesAdminApi`. It
reads `ADMIN_IP_WHITELIST` (comma-separated IPs, the `AdminIpWhitelist` SAM parameter) and
allows the source IP only if it's on the list. `common/http_utils.admin_ip_allowed` /
`check_admin_ip` is the one shared implementation, called by the authorizer and, as
defense-in-depth, by every Lambda with admin routes (auth, story, match); the three private
per-handler copies that used to duplicate this check are gone.

**What an empty list means (v0.41.0):** the SAM parameter `AdminIpEmptyMeans` (env
`ADMIN_IP_EMPTY_MEANS`) chooses `nobody` (default) or `everybody`. `nobody` fails the admin
API closed — including on `dev`/`test` — when no IP is configured, instead of the old
implicit "allow all"; the deploy scripts (`aws_backend_deploy.sh`,
`aws_backend_deploy_stage.sh`) detect the caller's public IP and merge it into
`ADMIN_IP_WHITELIST` so the deployer keeps access.

## 4. Rate limiting and CSRF (v0.37.7, all backends; limits raised and a per-guest bucket added in v0.41.0)

Introduced together in v0.37.7 (Step 41 in the code comments); grep `security_utils.py`
(AWS), `RateLimitService` (Java `core/.../service/security/`), `csrf_token_service.py`
(Python) to find the implementations — no dedicated step file covers this release yet.

- **Per-IP rate limiting**: a fixed-window counter per `(bucket, source IP)`, window start
  stored per counter (v0.41.0, so a periodic sweep no longer resets every bucket's clock at
  once). Buckets: guest creation and match creation, code default **20 per hour each** (was
  0/off). `limit <= 0` disables a bucket entirely — the dev/Robot default, since Robot mints
  hundreds of guests from one address; every Robot launcher script forces the limits to 0
  before starting a local server. Configured via `RATE_LIMIT_GUEST_PER_IP`,
  `RATE_LIMIT_MATCH_PER_IP`, `RATE_LIMIT_WINDOW_SECONDS` (Java `application.yml` / Python
  `config.py`; the AWS test stack takes the `_TEST`-suffixed variants). A blank/unknown
  source key is never limited.
- **Per-guest rate limiting (v0.41.0)**: a second bucket, `match-guest`, keyed by the guest's
  own user uuid rather than the source IP — code default **10 matches per day**
  (`RATE_LIMIT_MATCH_PER_GUEST`, window `RATE_LIMIT_MATCH_PER_GUEST_WINDOW_SECONDS` = 86400).
  A 429 on either bucket answers `{error: "RATE_LIMITED", message, retryAfterSeconds,
  timestamp}` with a `Retry-After` header, exposed by CORS on all three backends;
  react-game shows a translated message with the wait time instead of the raw code.
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

**Since v0.41.0**, `test.paths.games` runs `csp_mode = "restricted"` (`environments/test.tfvars`),
with `csp_extra_domains` extending `connect` (test API hosts, `cdn.jsdelivr.net`), `script`
(Cloudflare Turnstile), `img` (Unsplash location art) and `frame` (the Turnstile widget) —
`cloudfront.tf` only emits a `frame-src` directive when that list is non-empty. **Since v0.41.2**,
`paths.games` (`environments/production.tfvars`) also runs `csp_mode = "restricted"`, with
`csp_extra_domains` adding `connect = ["cdn.jsdelivr.net"]` (Bootstrap source maps) and
`img = ["unsplash.com"]` (the landing page hero); the static site has no inline scripts, so no
other change was needed. Checked by the owner in the browser (`paths.games/?stay`) after
`terraform apply`.

An optional **WAF v2** (`enable_waf`, off by default to save cost) adds rate limiting (1000
req/5min per IP) and AWS Managed Rules (OWASP Top 10, known bad inputs). See
[Environments §2](./Environments.md) for how the certificate and CSP allowlists are shared
across environments.

## 8. API security headers, secrets and dependency scanning (v0.41.0)

- **Headers on every API response**, all three backends: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
  `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`,
  `Strict-Transport-Security: max-age=31536000`, plus `Cache-Control: no-store` on
  `/api/auth/**` and `/api/admin/**` only (public story reads stay cacheable). Java:
  `SecurityHeadersFilter` (order -1, before the JWT filter). Python:
  `security_headers_middleware.py`, skipping `/docs`, `/redoc` and `/openapi.json` so Swagger
  UI keeps its CDN assets. AWS: `common/response.py` `HEADERS` + `finalize(resp, path)`.
- **Python dev endpoints**: `/docs`, `/redoc` and `/openapi.json` are served only on dev/test
  (see the env rule in [Environments §4](./Environments.md)); `dev_test_endpoints_enabled` and
  the CORS default (Java's dev allowlist, not `*`) follow the same rule.
- **Secrets refused outside dev/test**: the committed JWT secret default is refused at
  startup outside dev/test (Java `StartupSecretsGuard`, Python `check_secrets()` in `_serve`,
  AWS `jwt_utils.misconfigured()` → 500 `MISCONFIGURED`); the Turnstile bypass is honoured
  only on dev/test everywhere; AWS `AllowMockAccess` now defaults to `"false"` in SAM (was
  `"true"`).
- **JWT rotation procedure**: `code/scripts/dev/mint_admin_token.sh [--days 365]` prints a
  long-lived admin token signed with the `.env` `JWT_SECRET`, HMAC via the Python stdlib. To
  rotate: set a new `JWT_SECRET` (`openssl rand -base64 48`), run the mint script for the new
  `ROBOT_VAR_ADMIN_TOKEN`, then redeploy the affected stack(s) — all four
  `run_robot_with_*.sh` and the local starter/stress scripts read `JWT_SECRET` from `.env`, so
  every local tool signs with the same secret.
- **Dependency scanning**: `.github/workflows/dependency-scan.yml` runs OSV-Scanner v2 over
  every backend/frontend manifest (`osv-scanner.toml` at the repo root), on push to `develop`
  touching a manifest and on a weekly schedule (GitHub only runs scheduled workflows on the
  default branch, `main`), uploading SARIF to the GitHub Security tab. For an on-demand local
  run: `code/scripts/dev/run_dependency_scan.sh` (same config, checks `osv-scanner` is on the
  `PATH` and exits 2 with install instructions if not).

## 9. Match export and import (v0.41.4)

- **Admin only**: `GET /api/admin/matches/{uuidMatch}/export` and `POST /api/admin/matches/import`
  live on the admin port 8044 (AWS: admin routes behind the allow-list). No export in react-game or
  the public API.
- **Nothing secret travels**: users are copied with role forced to `PLAYER`, no password hash, no
  tokens, so copied guests cannot resume and SSO users log in again. The file carries a SHA-256
  checksum and is validated against a JSON Schema before any write.
- **Size cap**: `MATCH_EXPORT_MAX_BYTES` (default 5000000), above it the import answers 413.
- A story with the same id but another fingerprint is refused with 409 `STORY_DIFFERS` unless the
  admin chooses `storyMode`. Details: [Step 41 §9](./documentation_v0/Step41_AlphaPreparation.md).
- **Owner move (v0.41.6)**: `GET`/`PUT /api/admin/matches/{uuidMatch}/owner` and `GET /api/admin/users/{identifier}` are admin-only on port 8044 and behind the AWS allow-list.

# Version Control
- **Document Version**: 0.41.6

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First shared write-up of every security control in one place | September 25, 2026 |
  | 0.41.0 | API headers, allow-list default, guest limits, dependency scan | September 28, 2026 |
  | 0.41.2 | Production website CSP switched to restricted | September 29, 2026 |
  | 0.41.4 | Admin-only match export and import, no secrets copied; owner move | October 3, 2026 |

- **Last Updated**: October 3, 2026 (v0.41.6)

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
