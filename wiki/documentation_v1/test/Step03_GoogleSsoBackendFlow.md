# Step 3 — Google SSO backend flow: test list

**Status: tested (October 23, 2026), developed in 1.2.0–1.4.0.** Step file: [Step03_GoogleSsoBackendFlow.md](../Step03_GoogleSsoBackendFlow.md).
Moved here from the owner's old list `1_07_TESTED_Google.md` (items 5-10), translated (November 25, 2026).
The 1.10.0 security fixes on tokens and rate limits (mock tokens off on AWS test, `X-Forwarded-For`) are in the
[Step 40 test list](./Step40_SecurityAndHardeningCheck.md).

Legend: `[ ]` to do · `[ DONE ]` checked by the owner · `[ UNIT ]` unit tests · `[ ROBOT ]` Robot suites ·
`[ NOT TESTABLE ]` with the reason. **Done** = what changed, **Test** = what to try, **Expected** = the result.

---

## Developed (1.2.0–1.4.0)

- [ DONE ] **1. `POST /api/auth/google`**
  - Done: check of the ID token (aud, iss, exp, nonce) and replay block.
  - Test: repeated login and logout; the security cases are covered by the Robot suite with the fake provider.
  - Expected: the login works; in Robot a token with wrong aud, iss or nonce, expired or reused is refused.
- [ DONE ] **2. Safer tokens**
  - Done: `iss`/`aud` in the JWTs; role and state read from the DB on every request; the AWS "synthetic" user removed.
  - Test: use an old admin token created before the release, or a token of a uuid that does not exist in the DB.
  - Expected: 401.
- [ DONE ] **3. Tokens stored as hashes**
  - Done: refresh token and guest cookie stored as SHA-256, migrated on first use.
  - Test: close the browser as a guest and open it again.
  - Expected: the guest is resumed; the DB holds only the hash.
- [ DONE ] **4. Admin bootstrap**
  - Done: manual Lambda on AWS and CLI on Java/Python that create a real ADMIN user and return its token.
  - Test: invoke the Lambda (or the script) on test with a nickname, then run it again with the same nickname.
  - Expected: ADMIN user plus token; the second time a new token, without a duplicate user.
- [ DONE ] **5. `google-enabled` flag and client id**
  - Done: both exposed in `GET /api/echo/status`.
  - Test: call the endpoint; on test set `GoogleEnabled=false`.
  - Expected: the fields are there; with false the button disappears and `/auth/google` answers with a clear error.
- [ DONE ] **6. Rate limit and clean logs**
  - Done: per-IP limit on `/auth/google` and log sanitizer on email, name and picture.
  - Test: many logins in a row with a low limit, then look at the CloudWatch logs.
  - Expected: 429 with `Retry-After`; no email nor name in the logs.

---

# Version Control
- **Document Version**: 1.13.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 1.13.0 | Old test list moved here and translated | November 25, 2026 |

- **Last Updated**: November 25, 2026 (v1.13.0)
