# Step 12 — Pagination and multi-device continuity: test list

**Status: tested (October 29, 2026), developed in 1.7.0, fixes in 1.8.0, 1.10.0 and 1.11.0.** Step file: [Step12_PaginationAndMultiDeviceContinuity.md](../Step12_PaginationAndMultiDeviceContinuity.md).
Moved here from the owner's old lists `1_07_TESTED_Google.md` (items 40-47), `1_08_AWS_TEST_LAMBDA_COOKIE_SAME_SITE.md`,
`1_10_TODO_TEST_1.10.0.md` and `1_11_TODO_TEST.1.11.0.md`, translated (November 25, 2026).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` unit tests · `[ ROBOT ]` Robot suites ·
`[ NOT TESTABLE ]` with the reason. **Done** = what changed, **Test** = what to try, **Expected** = the result.

---

## Developed (1.7.0)

- [ DONE ] **1. Admin paging**
  - Done: stories by cursor; user and story filters on the Matches page done by the server.
  - Test: in Matches choose a user with the picker and a story.
  - Expected: results filtered by the server; a page with fewer rows than the limit but with "load more" is normal.
- [ DONE ] **2. Limit of 12 sessions**
  - Done: beyond 12 sessions the oldest one is closed with `SESSION_LIMIT`; the profile shows the active sessions.
  - Test: Robot suite (13 logins) and the profile.
  - Expected: the excluded device sees "too many devices"; the number of sessions shows next to the global logout.
- [ DONE ] **3. Cookie lifetime**
  - Done: refresh token 250 days renewed on every use, guest 180 days, configurable `SameSite`.
  - Test: DevTools → Cookies.
  - Expected: `refreshToken` lasts 250 days, guest 180; `SameSite=Lax` (`None` on AWS test).
- [ DONE ] **4. "Match is being updated" banner** (closed by the 1.10.0 re-test, item 11)
  - Done: it shows on return if the match version changed, with a link to the log.
  - Test: move on A and go back to B.
  - Expected: B shows the closable banner with the link to the log.
- [ DONE ] **5. `knownAccount` flag** (retired in 1.10.0, item 9)
  - Done: after a Google login, the device remembers that an account exists.
  - Test: login, logout, then open the site again without a session.
  - Expected: "Sign in with Google to find your matches" shows up.
- [ NOT TESTABLE ] **6. Manual test on iPhone** (alternative check in 1.10.0, item 12)
  - Done: to check whether Safari limits the API cookies to 7 days.
  - Test: on test with a real iPhone, come back after more than 7 days.
  - Expected: still logged in.

---

## Fixes (1.8.0)

- [ DONE ] **7. Global logout on Java**
  - Done: the revocation of all tokens runs inside the transaction.
  - Test: log out of all devices and delete an account on Java/Postgres.
  - Expected: no 500.
- [ DONE ] **8. Test deploy script**
  - Done: an empty pepper is no longer passed to `sam deploy`.
  - Test: run `aws_backend_deploy.sh --auto-confirm`.
  - Expected: no `--parameter-overrides` error.

---

## Fixes (1.10.0)

Environment for the Robot runs on AWS test (from the 1.10.0 list): `run_robot_with_aws_serverless.sh` passes
`AWS_TEST_LAMBDA_MAX_SESSIONS_PER_USER` to Robot (`MAX_SESSIONS`, the 13-logins test assumed 12) and
`EXPECTED_SAME_SITE` from `AWS_TEST_LAMBDA_COOKIE_SAME_SITE`. `EXPECTED_SAME_SITE` is a Robot variable, not a
`.env` key: `--variable EXPECTED_SAME_SITE:None` on the `robot` line, `Lax` locally, `None` on AWS test; without it
the test accepts any valid SameSite.

- [ DONE ] **9. `knownAccount` removed** (react-game)
  - Done: the flag is no longer written and is deleted at start; removed from the cookie table and the EN/IT policy.
  - Test: on a browser that already did a Google login open DevTools → Application → Local Storage and reload.
  - Expected: `pathsgames.knownAccount` disappears; it no longer shows in the cookie window nor in `cookies.html`.
- [ ROBOT ] **10. Log out of all devices** (Java, Python, AWS test)
  - Done: a refresh token issued before the global logout is refused also inside the 2-minute grace.
  - Test: Google login on two browsers A and B; on B reload the page (the token rotates); within 1 minute on A click
    "Log out of all devices"; on B reload at once.
  - Expected: B goes back to guest with "session closed by another device"; it does not stay logged in.
- [ DONE ] **11. "Match is being updated" banner** (item 4, still open in the 1.7.0 list)
  - Test: same Google account on A and on B (B = Safari/iPhone, or any browser with `MATCH_REFETCH_BROWSERS=all`).
    On B open the match **from the list on the Home** and do not reload; put it in the background; on A make a move;
    wait more than 30 s and go back to B without clicking.
  - Expected: B updates and "Match is being updated" shows at the top with the link to the log and the ×.
    Reverse check: move on B, leave for more than 30 s, come back → no banner.
- [ DONE ] **12. iPhone cookies and the 7-day limit** (item 6, alternative to the real test)
  - Test: Safari on Mac → Develop → Web Inspector → Storage → Cookies.
  - Expected: `pathsgames.refreshToken` HttpOnly and Secure, expiring in about 250 days. The real risk is an API on
    another site (execute-api URL with `SameSite=None`), which Safari blocks as third party: keep the API on the
    same domain (`api-*.paths.games`).
- [ ROBOT ] **13. Cookie SameSite**
  - Test: DevTools → Application → Cookies, after a Google login, locally and on AWS test.
  - Expected: `pathsgames.refreshToken` HttpOnly, SameSite `Lax` locally and `None` + Secure on AWS test.
- [ ROBOT ] **14. Robot `tests_v1/12_multi_device/session_hardening.robot`** (4 tests)
  - Token rotated less than 2 minutes before → after "log out of all devices" the refresh answers 401 `SESSION_REVOKED`.
  - Refresh after a ban: the active token answers 401 `SESSION_REVOKED`, the one just rotated 403 `ACCOUNT_DISABLED`.
  - Suspension: login refused, then `expire-suspension`, then the login works and the admin detail shows state 2.
  - Cookies `pathsgames.refreshToken` and `pathsgames.guestcookie`: HttpOnly, valid SameSite, Secure if SameSite=None.
  - On local AWS (mock tokens without `iat`) the check on the old token is skipped: that is normal.
  - The existing suite 12 only had keywords moved to `sessions_common.resource`: it must stay green as before.

---

## Fixes (1.11.0)

- [ DONE ] **15. Python cookie on `/api/auth`** (local Python or EC2 Python)
  - Done: as Java and AWS; the old copy on `Path=/` is deleted at the first answer.
  - Test: login, reload, logout and "log out of all devices" with the Python backend; DevTools → Cookies.
  - Expected: a single `pathsgames.refreshToken` with Path `/api/auth`, no session lost.

---

## Note: F5 loses the login on localhost → api-test (SameSite)

From the owner's note `1_08_AWS_TEST_LAMBDA_COOKIE_SAME_SITE.md`. Not a code bug: a configuration. The `.env` had
`AWS_TEST_LAMBDA_COOKIE_SAME_SITE=Lax`.

**Why it happens**
- `localhost` and `api-test.paths.games` are two different sites, so for Chrome the API calls are cross-site.
- With `SameSite=Lax` Chrome neither stores nor sends the `pathsgames.refreshToken` and `pathsgames.guestcookie`
  cookies in those calls.
- On a page reload (F5) both the Google session renewal and the guest resume fail, and the frontend creates a new
  guest (`guest_ffd231d8` and so on).
- The right default for test is `None`: the deploy script uses it and `.env.example` says so ("None: the test pages
  call execute-api URLs"). The `.env` overrode it with `Lax`.
- On `test.paths.games` it works also with `Lax`, because website and API are under the same `paths.games` domain.
  The problem exists only in local development against api-test.

**What to do**
1. In `.env` set `AWS_TEST_LAMBDA_COOKIE_SAME_SITE=None`.
2. Run the test deploy again (`aws_backend_deploy.sh --auto-confirm`).
3. On localhost log in again. From then on F5 keeps the session.

**To know**
- `SameSite=None` works on Chrome as long as third-party cookies are allowed. If they are blocked in the settings,
  in incognito, on Safari or on Firefox in strict mode, the problem comes back. In those cases use `test.paths.games`.
- The development port must be in `AWS_TEST_APIGW_CORS_ORIGINS`: today 3000, 5172, 5174 and 5500. 5173, the Vite
  default, is not there. If nothing works at all, this is the cause.

**Alpha, beta and prod.** Rule: `Lax` when website and API are under the same domain (`*.paths.games`), `None` only
when the page calls the API from another site (localhost, `execute-api` URL).

| Stage | Website | API | Value |
|---|---|---|---|
| alpha | `paths.games`, `www.paths.games` | `api-alpha.paths.games` | `Lax` |
| beta | `beta.paths.games`, then `paths.games` | `api-beta.paths.games` | `Lax` |
| prod | `paths.games` | production API under `paths.games` | `Lax` |

- **`.env`**: `AWS_ALPHA_LAMBDA_COOKIE_SAME_SITE=Lax`, `AWS_BETA_LAMBDA_COOKIE_SAME_SITE=Lax`,
  `AWS_PROD_LAMBDA_COOKIE_SAME_SITE=Lax`. Leaving them empty gives the same result on a new stack (template default
  `Lax`), but on an existing stack the script does not pass the parameter and the previous value stays: better
  written explicitly.
- **GitHub**: the `alpha-deploy-backend-aws.yml` workflow reads the `AWS_ALPHA_LAMBDA_COOKIE_SAME_SITE` variable of
  the `alpha` Environment. Set it to `Lax`, otherwise every CI deploy keeps the stack's previous value.
- **Never `None` on public stages**: not needed (the website is on the same domain) and it weakens the CSRF
  protection of the cookies.
- **Local development against alpha/beta/prod**: with `Lax` it does not work (same problem as test). To try locally
  use test with `None`, or the real website.
- **After a value change** the stage must be redeployed and a new login done: the cookies already stored in the
  browser keep the old attribute until they are written again.
- **The website must call the API with the custom domain** (`api-alpha.paths.games`), never with the `execute-api`
  URL: that is another site, and with `Lax` the session is lost at every F5.

---

# Version Control
- **Document Version**: 1.13.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Old test lists and SameSite note moved here, translated | November 25, 2026 |

- **Last Updated**: November 25, 2026 (v1.13.0)
