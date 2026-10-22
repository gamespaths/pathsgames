# Step 12 — Pagination residuals and multi-device continuity

**Status: analysed (October 21, 2026), owner answers recorded, not developed. Steps 6-12 are developed together and released as 1.6.0. Open points in section 4.**
Roadmap line: *lists that scale for matches and stories, and the same account on many devices* ([Roadmap](./Roadmap.md) step 12). This step takes over the old step 10 (admin pagination) and closes the multi-device chain: [Step 6](./Step06_UserProfileBackend.md) · [Step 7](./Step07_UserProfileReactGame.md) · [Step 8](./Step08_MatchConcurrencyMultiDevice.md) · [Step 9](./Step09_MatchListCancelledLastPlayed.md) (merge rule) · [Step 12](./Step12_PaginationAndMultiDeviceContinuity.md).

## 1. Goal

Admin lists page and filter on the server; a player on any device sees that the match changed elsewhere; sessions and cookies have clear, predictable lifetimes and limits.

## 2. Decisions (owner, October 21, 2026)

- **Pagination residuals only:** user and story filters in the react-admin Matches page, server-side paging of the stories list, DynamoDB access-pattern check. The user filter is a picker that uses the users search of [Step 10](./Step10_AdminUserManagementBackend.md). The AWS `storyUuid` filter is a post-read loop with a read budget of 5 pages; react-admin handles short pages.
- **Banner "Match is being updated"** (IT "Partita in aggiornamento"; the same text as the 409 `STALE_MATCH` message of [Step 8](./Step08_MatchConcurrencyMultiDevice.md); neutral: it covers another tab, an admin edit or a snapshot restore) with a link to the existing match log, when the refetched `matchVersion` differs from the one this device knew ([Step 8](./Step08_MatchConcurrencyMultiDevice.md)).
- **Flag `pathsgames.knownAccount`:** non-personal localStorage flag written at Google login; with no session on the device react-game shows "Sign in with Google to find your matches". It is kept at logout and removed at account deletion; a necessary non-personal key, so no new consent prompt. The cookie policy and privacy texts (react-game policy data and i18n) are updated for it, list the other local keys missing today (`pathsgames.lang`, the server key, the Google nonce, the Turnstile pass) and fix the guest cookie duration.
- **Session cap raised from 5 to 12** on the 3 backends (parameter). A session revoked by the cap answers a dedicated `SESSION_LIMIT` ("too many devices, sign in again") instead of `SESSION_REVOKED`; evicting the least recently used device at the cap is accepted. The profile page shows the number of active sessions (only those used in the last 30 days; the cap of 12 counts the total) next to "Log out of all devices". This supersedes the cap of 5 in [Step 3](./Step03_GoogleSsoBackendFlow.md) and [Security](../Security.md).
- **Token rows:** `ROTATED` and `LOGOUT` rows are deleted after 7 days; `LIMIT`, `LOGOUT_ALL` and `ADMIN` rows stay until their expiry. **Reuse detection:** a `ROTATED` token presented again outside the 2-minute grace (within the 7 days it is kept) revokes all the user's sessions with `SESSION_REVOKED`.
- **`sessions_valid_after`** on `users` (AWS attribute on `USER#`), read in the existing 60-second state cache: access tokens issued before it answer 401 `SESSION_REVOKED`, so "Log out of all devices" acts within 60 seconds instead of 30 minutes. Ban and suspend ([Step 10](./Step10_AdminUserManagementBackend.md)) also set it.
- **Refresh token 250 days sliding** for all refresh tokens on the 3 backends; the guest cookie stays 180 days; the refresh cookie `Max-Age` follows (250 days, under the 400-day browser cap). Guest refresh tokens are capped at 180 days like the guest cookie. On Java and Python, tokens issued before the deploy keep their expiry and get 250 days at their next refresh (no cut); AWS tables are recreated, so no token survives. The policy texts change from 7 days to 250 days. `SameSite` becomes a parameter with default `Lax`, `None` only where needed (execute-api URLs, Replit, local dev against a remote API); the README of each backend lists those places.
- **Manual check on `test`** with a real iPhone during this step: the Safari 7-day cap on API cookies is only a hypothesis.
- **Robot scenario A, B, C, B, A** with 3 fake-provider sessions of the same Google user: each device sees the last move, the device with an old version gets `STALE_MATCH`, "Log out of all devices" closes all.
- The merge rule change is NOT here any more: it moved to [Step 9](./Step09_MatchListCancelledLastPlayed.md).

## 3. Sub-points per component

### 3.1 Pagination (Java, Python, AWS, react-admin)
- `GET /api/admin/stories` is a plain array of every story today: add `limit` and `cursor` with the envelope of [API Conventions](../ApiConventions.md) section 6 (the v0.28.1 matches change is the precedent: callers move to the envelope). react-admin `StoriesPage.jsx` and every selector that reads all stories are updated.
- `GET /api/admin/matches` already has `status`, `userUuid`, `storyUuid`, `sinceDays` and the cursor; `MatchesPage.jsx` uses the cursor but its text box only filters the loaded rows. The page gets server-side user (picker through `listAdminUsers`) and story filters next to the status and period ones; a page may hold fewer rows than `limit` while `nextCursor` is set.
- AWS check: the admin list is one Query on GSI2 `MATCH` with `Limit`; `userUuid` and `storyUuid` are equality filters applied after the read. Move `userUuid` to a key query on GSI1 `USER_MATCHES#<uuid>` (sort key `MATCH#<tsInsert>#<uuid>`). `storyUuid` has no key: keep the post-read filter and loop over the GSI2 pages until the page is full or 5 pages were read, then return what was found with the `nextCursor`. Document the read cost in the step.

### 3.2 Sessions and cookies (Java, Python, AWS)
- Cap: Java `game.auth.max-tokens-per-user` exists (5 in `application.yml`, also defaults of 5 in `SessionService` and `GuestAuthService`); Python has `max_tokens_per_user=5` hardcoded in `launcher.py` (make it a `config.py` field); AWS has the constant `MAX_SESSIONS = 5` in `common/auth_tokens.py` (make it an environment/SAM parameter). Code default 12 everywhere. The cap is enforced at Google login, at guest login and at every refresh and revokes the oldest issued active token, which is the least recently refreshed one.
- `SESSION_LIMIT`: today a revoked token carries no reason. Add `users_tokens.revoked_reason` (Java migration `V1.6.0_2__sessions.sql`, Python `align_schema()`; AWS attribute on `REFRESH#<hash>`) with values `ROTATED`, `LOGOUT`, `LOGOUT_ALL`, `LIMIT`, `ADMIN`; the refresh of a revoked token outside the 2-minute grace answers `SESSION_LIMIT` for `LIMIT`, `SESSION_REVOKED` otherwise. New code in `AuthException.Code`, Python `auth_error.py`, the AWS `sso.py` error map (401) and OpenAPI. Retention: a `ROTATED` or `LOGOUT` row is deleted after 7 days (AWS: `ttl` = now + 7 days set at the rotation; Java and Python: a daily job); `LIMIT`, `LOGOUT_ALL` and `ADMIN` rows keep their expiry. Reuse detection: a `ROTATED` token presented outside the grace and still stored revokes every session of the user (`SESSION_REVOKED`); once deleted it is simply unknown.
- `activeSessions` in `GET /api/auth/me`: count of refresh tokens not revoked, not expired and issued in the last 30 days (SQL count on `ts_insert`; AWS range on the sort key of `USER_SESSIONS#<uuid>`); the cap of 12 stays on the total.
- `sessions_valid_after`: `users.sessions_valid_after` (same migration; AWS attribute on `USER#`) set by `POST /api/auth/logout/all`, ban and suspend (seconds precision, token valid when `iat >=` the value). Java `JwtAuthenticationFilter` and Python `jwt_middleware.py` read it from the 60-second `UserStateService` cache (`UserStatus` carries it; the setters evict the user, so the serving instance is immediate and another instance lags at most 60 seconds); AWS `_require_auth` and `_resolve_user` already read the `USER#` item on every request, so it is immediate. A token older than the value answers 401 `SESSION_REVOKED`.
- Refresh lifetime: Java `refresh-token-days` and Python `refresh_token_days` from 7 to 250; AWS `REFRESH_SECONDS` from 15,552,000 (180 days) to 21,600,000 (250 days). The refresh cookie `Max-Age` becomes 250 days on all three (Java `CookieHelper.REFRESH_MAX_AGE_SECONDS`, Python `set_auth_cookie` which today uses one value for both cookies and is split, AWS `COOKIE_MAX_REFRESH`) and is renewed at each refresh (sliding). The guest cookie stays 180 days and a guest's refresh token is capped at 180 days (`min(lifetime, 180 days)` when the user is a guest). On Java and Python tokens already issued keep their own expiry.
- `SameSite`: Java already has `game.auth.cookie.same-site` (default `Lax`, `None` in the dev profile); Python (`set_auth_cookie`) and AWS (`_refresh_cookie`, `_guest_cookie`, `_clear_cookies`) hardcode `None` and become a parameter with default `Lax`; `None` is set where the API host is not on the same site as the page (AWS execute-api URLs, Replit, local dev against a remote API); the README of each backend lists those places.

### 3.3 react-game
- `GamePage`: after a return refetch, if `matchVersion` differs from the known one and this device did not cause it, show the banner "Match is being updated" / "Partita in aggiornamento" with a link to the match log (the log card of the book); dismissible, EN and IT.
- Flag `pathsgames.knownAccount`: written on Google login success (a constant value, no identifier, no email), read at boot: when no session is restored the home shows "Sign in with Google to find your matches". Kept at logout, removed at account deletion.
- Policy update: the cookie table in `src/consent/cookieConsent.js` (EN and IT rows), `modals.cookies` and `modals.privacy` in `src/i18n/en.json` and `it.json`; the static pages follow at the next build. Local data to list: localStorage `pathsgames.lang`, `pg_game_server`, `pathsgames.knownAccount` (and `pathsgames.highContrast` of [Step 7](./Step07_UserProfileReactGame.md)); sessionStorage `pathsgames.googleNonce` and the story cache `pg_story:*`; cookies `pathsgames.guestcookie` (180 days, the table says 30), `pathsgames.refreshToken` (250 days from this step, the table says 7), `pathsgames.cookiesConsent`, `pathsgames.turnstilePass`. The consent revision constant is not raised.
- Messages: `SESSION_LIMIT` ("too many devices, sign in again", opens the sign-in), `SESSION_REVOKED` stays "session closed from another device"; the profile page shows `activeSessions` next to "Log out of all devices".

### 3.4 react-admin
- `MatchesPage.jsx`: server-side user (picker) and story filters (together with the existing status and period); the text box stays for the loaded rows and short pages are handled; `StoriesPage.jsx`: cursor paging with a load-more button; selectors that need every story use the paged API.

### 3.5 OpenAPI
- The one file `v1.6.0-multi-device-api.yaml`: `SESSION_LIMIT`, `activeSessions`, `GET /api/admin/stories` envelope.

### 3.6 Tests
- Unit (coverage > 96%): rotated rows deleted after 7 days and the other reasons kept, reuse of a rotated token revoking all sessions (also at the edge of the grace), guest refresh capped at 180 days, `activeSessions` ignoring a session unused for 30 days while the cap counts it; 13th session revokes the oldest with `SESSION_LIMIT` and the reason is stored for each kind of revocation; `sessions_valid_after` (older token refused, newer accepted, boundary second, cache eviction, set by logout-all, ban and suspend); `activeSessions`; refresh lifetime (250 days) and cookie `Max-Age` per backend, an old token keeping its expiry until its next refresh; `SameSite` parameter (default `Lax`, `None` on request); stories envelope; matches filters; on AWS the key query for `userUuid` and the 5-page loop for `storyUuid`.
- Vitest: banner conditions, flag written only at login, kept at logout and removed at deletion, `SESSION_LIMIT` message, admin filters, picker, short pages and paging.
- Robot `tests_v1/12_multi_device/` on all backends: the scenario A, B, C, B, A with 3 fake-provider sessions of the same Google user (create and move on A; B sees it; B moves; C sees it; C moves; B writes with its old version and gets `STALE_MATCH`; B refetches and moves; A refetches and sees B's move); "Log out of all devices" closes all (refresh `SESSION_REVOKED`, access tokens 401 `SESSION_REVOKED`); 13 logins make the first session answer `SESSION_LIMIT`. Check that the Google per-IP limit (default 30) does not stop 13 logins in a Robot run. The merge-rule scenario is in the step 9 suite.
- Manual checklist on the `test` stack with a real iPhone: sign in with Safari, wait past 7 days (or use the Safari developer tools to age the cookie) and verify that the API cookie survives; the 7-day cap on API cookies is a hypothesis to confirm or drop.

### 3.7 Docs (when developed)
- [Security](../Security.md) (cap 12, `SESSION_LIMIT`, `sessions_valid_after`, refresh lifetime, `SameSite`), [Data Model](../DataModel.md) (columns and AWS attributes), [Environments](../Environments.md) (cap and `SameSite` parameters), [API Conventions](../ApiConventions.md) (stories envelope).

## 4. Open points

1. (decided) User filter through a picker on the users search; AWS `storyUuid` filter is a post-read loop with a budget of 5 pages.
2. (decided) One message for the banner and the 409: EN "Match is being updated", IT "Partita in aggiornamento".
3. (decided) `knownAccount` kept at logout, removed at deletion, no new consent prompt; policy lists the other local keys and fixes the guest cookie duration.
4. (decided) Refresh token 250 days sliding for all refresh tokens on all backends, cookie `Max-Age` 250 days, guest cookie 180 days; on Java and Python tokens issued before the deploy keep their expiry and get 250 days at their next refresh (AWS is recreated); policy 7 days becomes 250 days.
5. (decided) `SameSite` is a parameter with default `Lax`; the README of each backend lists where `None` is needed (execute-api URLs, Replit, local dev against a remote API).
6. (decided) Ban and suspend also set `sessions_valid_after`.
7. (decided) Evicting the least recently used device at the cap of 12 is accepted, with `SESSION_LIMIT`.
8. (decided) Manual Safari cookie check on `test` with a real iPhone during this step (the 7-day cap is a hypothesis).
9. (decided) Guest refresh tokens are capped at 180 days like their cookie.
10. (decided) `ROTATED` rows deleted after 7 days (AWS `ttl` at the rotation; Java and Python daily job); `LIMIT`, `LOGOUT_ALL` and `ADMIN` rows kept until expiry.
11. (decided) Reuse detection: a `ROTATED` token presented outside the 2-minute grace, within its 7 days, revokes all the user's sessions with `SESSION_REVOKED`.
12. (decided) `activeSessions` counts only sessions used in the last 30 days; the cap of 12 stays on the total.
13. (decided) Single-logout `LOGOUT` rows are deleted after 7 days like `ROTATED`.
14. (decided) The refresh grace is raised from 30 seconds to 2 minutes (it also softens the lost-answer case); a rotated token presented after the grace, within its 7 days, revokes all the user's sessions.

# Version Control
- **Document Version**: 1.4.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.4.0 | Pagination and many-device continuity analysed | October 21, 2026 |

- **Last Updated**: October 21, 2026 (v1.4.0)


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
