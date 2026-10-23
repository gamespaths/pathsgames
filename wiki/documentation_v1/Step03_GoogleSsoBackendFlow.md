# Step 3 — Google SSO: backend flow

**Status: developed in 1.2.0 (October 20, 2026) — unit tests green, Robot suites written and not yet run, docs aligned.**
Roadmap line: *login with Google on all three backends* ([Roadmap](./Roadmap.md) step 3).
**Steps 2-5 are developed together** (intermediate releases get intermediate versions):
[Step 2](./Step02_GoogleSsoIdentityModel.md) · [Step 3](./Step03_GoogleSsoBackendFlow.md) ·
[Step 4](./Step04_GoogleSsoReactGameLogin.md) · [Step 5](./Step05_GoogleSsoPrivacyE2E.md).

**Prerequisite (owner, at the start of the development of steps 2-5):** the brand/domain verification of the prod Google Cloud project takes days and release 1.2 depends on it. Google Auth Platform Branding uses the static pages `https://paths.games/privacy.html` and `https://paths.games/terms.html`, built by the first point of [Step 2](./Step02_GoogleSsoIdentityModel.md) (static policy pages, already developed). The pages exist as soon as that point is released on alpha; then the owner submits the Google verification with those two URLs. The updated texts of [Step 5](./Step05_GoogleSsoPrivacyE2E.md) reach the pages at the next build.

## 1. Goal

`POST /api/auth/google` exchanges a Google ID token for the existing JWT access and refresh
tokens, on Java, Python and AWS, with a hardened token and session handling.

## 2. Decisions (owner, October 19, 2026)

Superseded in 1.7.0 (the text below is the 1.2.0 design): the guest merge rule by [Step 9](./Step09_MatchListCancelledLastPlayed.md) (the Google user's active match wins, the guest's is `CANCELLED`); the cap of 5 sessions (now 12), the refresh lifetime (now 250 days) and the refresh grace (30 seconds, now 2 minutes) by [Step 12](./Step12_PaginationAndMultiDeviceContinuity.md). Current values: [Security §1.2](../Security.md).

- Verify the Google ID token (Google Identity Services, **no client secret**). Java: `GoogleIdTokenVerifier`. Python and AWS: PyJWT + `PyJWKClient` with cached keys (no `google-auth` dependency).
- One Google OAuth client per stage. Two Google Cloud projects: **non-prod** (dev, test; published "In production" status, no test-users list, open to every Google account, only the `openid email` scopes so no brand verification: it shows the app name without logo; only dev/test clients and `localhost` origins) and **prod** (alpha, beta and later stages; Production, verified brand and domain; the alpha client has the origins `paths.games` and `www.paths.games`), each with a second owner. Version 1.x runs on alpha (deployed on every push to `main`), so alpha has Google SSO from release 1.2 and the prod project with the verified brand/domain consent screen is needed already for 1.2 (step 41 keeps only the beta client). No Identity Platform / Firebase Auth.
- No explicit API version in V1 (`/api/{version}/` of V0 Step11 dropped; confirmed in [API Conventions](../ApiConventions.md)).
- Identity is per backend database (a Google account on Java is not the one on AWS); every public stage uses one backend.
- Login and refresh check `users.state`: blocked, banned and deleting (7) are refused. A login of a user in state 7 answers `ACCOUNT_DELETION_IN_PROGRESS` until the deletion job ends; afterwards the same email creates a new user. `users.ts_last_access` is updated at Google login and at refresh (3 backends).
- Refresh tokens and guest cookie tokens are stored as **SHA-256 hash** and looked up by hash, on all 3 backends. **Lazy migration**: if the lookup by hash fails, try the clear value and rewrite it as hash; the clear-value fallback is removed after 180 days (guest session length).
- Login CSRF and replay: the frontend generates a random **nonce** (sessionStorage) sent with the ID token; the backend checks the token `nonce`; the hash of the ID token is kept until its `exp` (DynamoDB `ttl`) to block replay. Checks: `aud`, `iss`, `exp`, `nonce`, replay.
- **Refresh** revokes only the used refresh token (not all the user's tokens); the cap of 5 sessions per user stays; on 3 backends.
- **Guest merge at login** (moved here from roadmap step 8): the current guest is linked to the Google user; if that user already had another guest linked, the two are merged from the first to the second. On the same story (1.2.0 rule, replaced in 1.7.0 by Step 9: the Google user's active match always wins) the STARTED match with the latest `gaming_match.ts_update` won and the others became `CANCELLED`; ended and completed matches are all kept; the empty guest user is deleted in the same transaction; the guest tokens are invalidated. New match status `CANCELLED` in all backends and OpenAPI; the match state machine is written in [Game Rules](../GameRules.md) (roadmap step 24 extends it with game over).
- **Token and session hardening** (verified in code: JWT HS256 with claims `sub/username/role/type/jti/exp`, no `iss`/`aud`; Python and AWS share the same committed dev secret, Java another; AWS `auth/handler.py::_require_auth` and `match/handler.py::_resolve_user` build a "synthetic" user, role from the claims and state 2, when the uuid is not in DynamoDB; Java `JwtAuthenticationFilter` and Python `jwt_middleware.py` only validate the token, no state check):
  - The AWS **synthetic user is removed**: a token is valid only if the user exists in the DB (its reason, Java-only users, is gone with "one backend per public stage").
  - The role is always read from the DB, never trusted from the token.
  - The user `state` is checked **on every request**: free on AWS (item already read); Java and Python one query with a 60-second cache. Banned and deleting users are refused. Ban, suspend and deletion (state change to 3, 4 or 7) **evict that user from the 60-second cache** on Java and Python, so the refusal is immediate on every backend.
  - New JWT claims `iss` (stage + backend) and `aud` on **both access and refresh tokens** (refresh tokens are JWTs with `type=refresh`, validated by `SessionService.refreshToken` through `jwtPort.validateToken`; same on Python and AWS), verified on the 3 backends; rule "a different JWT secret per stage" in [Environments](../Environments.md). At the release the old tokens fail once: react-game on the first 401 tries a refresh, then the guest resume; guests continue through their guest cookie, Google users sign in once more.
- **Concurrent refresh** (two tabs share the refresh cookie, the access token lives in React state per tab): the backend accepts the just-rotated refresh token for a 30-second grace window.
- **Revoked session**: when a refresh fails because the token was revoked, a dedicated error code `SESSION_REVOKED` (not the generic 401). The cap of 5 sessions stays. `POST /api/auth/logout/all` already exists (no page uses it yet; see roadmap step 7); deletion and ban already revoke everything.
- AWS `ALLOW_MOCK_ACCESS` code default becomes `false` (SAM already false); for dev the owner adds it to his own `.env` (never edited by agents).
- Parameter `google-enabled` (Java, Python, AWS; code default `true`): true on every environment, forever, once an environment is born with Google; it may be set false only on test, sometimes, for trials. When false, `POST /api/auth/google` answers a clear error and react-game hides the button (guests keep playing); it is not an emergency switch for production. The flag is exposed in `GET /api/echo/status` with the client id.
- Rate limit on `POST /api/auth/google` with `RateLimitService`, new parameter `google-per-ip` with a code default.
- The backend exposes the Google client id in `GET /api/echo/status`; react-game reads it at runtime (no build variable).
- Error cases: invalid token, disabled user, provider unavailable (JWKS fetch failure), and the identity errors `EMAIL_NOT_VERIFIED`, `EMAIL_DOMAIN_NOT_ALLOWED` (only `gmail.com`; `googlemail.com` is refused too), `IDENTITY_MISMATCH`, `ACCOUNT_DELETION_IN_PROGRESS` (rules in [Step 2](./Step02_GoogleSsoIdentityModel.md)); on these errors nothing is written and the email is not logged.
- **Log sanitizer** on the 3 backends (keys `email`, `given_name`, `family_name`, `name`, `picture`) with unit tests, plus a pass over the logs that print user objects (no redaction exists today).
- Login reads the ID token claims `email`, `name`, `given_name`, `family_name`, `picture`, `locale`, stores the email once in `users.email_address` and `users_identities` (never updated) and the profile columns of `users_identities` (name, surname, picture, locale refreshed at every login); checks `email_verified`, the `gmail.com` domain and the `sub` + email pair; none of them is written to logs.
- Users in the Google flow: find by `(google, sub)`; if absent create user (role PLAYER, state 2, step 2 naming).

## 3. Sub-points per component

### 3.1 Java
- `GoogleLoginService` (core) behind a `GoogleTokenVerifierPort`; adapter-auth implements it with `GoogleIdTokenVerifier`. Controller `POST /api/auth/google` body `{idToken, nonce}`; response same shape as guest login (access token, csrf, refresh cookie).
- `SessionService`: hash on refresh token and guest cookie token (column holds the hash; migration in V1.2.0 or a sibling file), state check on login and refresh.
- Merge: `GuestMergeService` in a single transaction (SQL) / ordered conditional writes (AWS: move `USER_MATCHES#` items, character and log owner keys, delete the guest `USER#`); `CANCELLED` status constant, openapi enum; unit tests for merge, conflicts and cancellation.
- Java/Python: state check with a 60 s cache in `JwtAuthenticationFilter` / `jwt_middleware.py`; `iss`/`aud` in the token provider; refresh grace column (previous token hash and rotation time).
- Replay store: table `auth_id_token_seen` (hash, exp) cleaned by the existing cleanup job. `google-per-ip` in `RateLimitService`. Client id property exposed in `/api/echo/status`.

### 3.2 Python
- Same flow with PyJWT + `PyJWKClient` (cache, `lifespan`); add `PyJWT[crypto]` to requirements if missing. Hash column, replay table via models + ALTER list.

### 3.3 AWS
- Remove the synthetic user in `_require_auth` and `_resolve_user`; state and role from the item already read; refresh grace stored on the session item. AWS writes have no `ConditionExpression` today (see roadmap step 8).
- New route `POST /api/auth/google` in `lambda/auth/handler.py`; replay item `GOOGLEJTI#{hash}` with `ttl = exp`; refresh/guest token items keyed by hash. SAM parameter for the client id (code default only for dev) and API Gateway route in `template.yaml`; JWKS cache in the Lambda container.
- Today `_require_auth` builds a **synthetic user** when the uuid is not in DynamoDB: removed in this step (open point 2).

### 3.4 Infra and docs
Two Google Cloud projects with a second owner each (owner task, not code). [Security](../Security.md) and [Environments](../Environments.md) updated when developed. OpenAPI `POST /api/auth/google` and the `echo/status` field.

### 3.5 Tests
Unit tests with provider mocks (valid, `iss`/`aud` of the access token, unknown user refused, state check and cache, refresh grace, `SESSION_REVOKED`, wrong `aud`, wrong `iss`, expired, wrong nonce, replay, JWKS down, disabled user, rate limit), hashing lookups, state checks; coverage > 96%.

### 3.6 Admin bootstrap (new)

Today admin tokens come from `code/scripts/dev/mint_admin_token.sh` and `code/tests/robot/resources/JwtHelper.py`: a RANDOM uuid as `sub`, `role=ADMIN` in the claim, 365 days; Java `JwtAuthenticationFilter` trusts the claim and AWS builds the synthetic user. With the new rules (user must exist, role and state from the DB) these tokens stop working. Replacement: a tool that creates a **real admin user** (role ADMIN, state 2, nickname given as input) and returns the user and a signed admin token (with `iss`/`aud` of the stage). Admin tokens then follow the same rules as everybody: no special case for admin paths.

- **AWS**: a new Lambda with **no API Gateway route**, invoked manually from the AWS console (owner only); returns user uuid and token in the response; the token is never written to CloudWatch logs; SAM template and IAM.
- **Java**: command-line mode of the launcher, e.g. `java -jar ms-launcher.jar --paths.admin.create=<nickname>`: an `ApplicationRunner` creates the user, prints user and token on stdout and exits without starting the web server.
- **Python**: CLI module, e.g. `python -m app.scripts.create_admin <nickname>`, same core service, prints user and token.
- Token duration: parameter with a code default of **365 days on every environment, alpha and beta included; 30 days only on the AWS `prod` environment** (production). Running the tool again for the same nickname issues a new token, never a duplicate user.
- **Robot**: in dev/test the suites get their admin through a dev-only endpoint (enabled only with the test endpoints, like `X-Test-Marker`) that calls the same service; the same on the AWS test stack. `mint_admin_token.sh` becomes a wrapper of the tool; `JwtHelper.py` keeps minting non-admin test tokens and adds `iss`/`aud`.
- **Scripts** (one `.sh` per backend in `code/scripts`, launched by the owner on his local machine; the token goes only to stdout, never to a file or log):
  - Java: takes a target `local|ec2`: `local` runs the launcher in `--paths.admin.create=<nickname>` mode against the local DB; `ec2` connects via ssh (key `AWS_TEST_EC2_KEY_NAME`, the EC2 test servers of [Environments](../Environments.md) §1/§5) and runs the admin create mode with `docker exec` inside the backend container.
  - Python: same `local|ec2` target, running `python -m app.scripts.create_admin <nickname>`.
  - The Java and Python scripts are not used for now (they have no public stage), kept for completeness.
  - AWS: the alpha stage gets the same admin bootstrap system as beta (manual Lambda + script); the script invokes the manual admin Lambda of the given stage (`aws lambda invoke`) and prints user and token (the console invoke stays possible).
  - Sub-point: list the three scripts in `.claude/docs/commands.md` when developed.
- Admin with Google SSO stays out of scope (roadmap step 14 note unchanged).

### 3.7 Release checklist

**Alpha is emptied at release 1.2** (owner decision): no live alpha data has to survive the lazy hash migration, the `iss`/`aud` change or the dropped columns. The step 41 alpha-to-beta migration applies to the data created on alpha after 1.2.

**CSP of the website** (Terraform already changed in `code/website/terraform-aws/ssm.tf`: `accounts.google.com` in script-src, style-src, connect-src; `googleusercontent.com` in img-src; `environments/production.tfvars` and `test.tfvars`: `accounts.google.com` in frame-src). The owner runs `terraform apply` by hand, production first (it owns the shared SSM lists), then test.

After the release re-create the admin tokens with the tool: the owner's react-admin token and `ROBOT_VAR_ADMIN_TOKEN` / CI secrets.

## 4. Open points

1. (decided) Merge lives here, see section 2.
2. (decided) AWS synthetic user removed, see section 2.
3. (decided) Test-stage users: the non-prod project is open to every Google account.
4. (decided) Admin token duration: see section 3.6.


# Version Control
- **Document Version**: 1.2.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.2.0 | Google login analysis, steps two to five | October 19, 2026 |

- **Last Updated**: October 19, 2026 (v1.2.0)

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
